package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/analyzer"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/client"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/config"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/logger"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/metrics"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/queue"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load()
	log := logger.New()

	if cfg.InternalSecret == "" {
		log.Error("INTERNAL_SECRET must be configured")
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	metricsRegistry := metrics.NewRegistry()
	go metricsRegistry.StartServer(ctx, fmt.Sprintf(":%d", cfg.WorkerMetricsPort), log)

	consumer := queue.NewConsumer(cfg.RedisAddr, cfg.StreamName, cfg.ConsumerGroup, cfg.ConsumerName)
	defer consumer.Close()

	if err := consumer.EnsureGroup(ctx); err != nil {
		log.Error("failed to create Redis consumer group", "error", err)
		os.Exit(1)
	}

	analysisClient := client.NewAnalysisClient(cfg.AnalysisServiceURL, cfg.InternalSecret)
	repositoryAnalyzer := analyzer.New(cfg, log)

	log.Info("analyzer worker started", "consumer", cfg.ConsumerName, "safeMode", cfg.SafeAnalysisMode)

	for {
		if ctx.Err() != nil {
			log.Info("analyzer worker stopped")
			return
		}

		messages, err := consumer.Read(ctx)
		if err != nil {
			if !errors.Is(err, context.Canceled) {
				log.Error("failed to read Redis Stream", "error", err)
			}
			continue
		}
		if len(messages) > 0 {
			metricsRegistry.RecordRedisMessages(len(messages))
		}
		if depth, err := consumer.StreamLength(ctx); err == nil {
			metricsRegistry.SetQueueDepth(depth)
		}

		for _, message := range messages {
			processMessage(ctx, log, metricsRegistry, consumer, analysisClient, repositoryAnalyzer, message.ID, message)
		}
	}
}

func processMessage(
	ctx context.Context,
	log *slog.Logger,
	metricsRegistry *metrics.Registry,
	consumer *queue.Consumer,
	analysisClient *client.AnalysisClient,
	repositoryAnalyzer analyzer.Analyzer,
	_ string,
	message redis.XMessage,
) {
	job, err := queue.JobFromMessage(message)
	if err != nil {
		log.Error("invalid analysis job", "messageID", message.ID, "error", err)
		if ackErr := consumer.Ack(ctx, message.ID); ackErr != nil {
			log.Error("failed to acknowledge invalid job", "messageID", message.ID, "error", ackErr)
		}
		return
	}

	log.Info("processing analysis job", "analysisID", job.AnalysisID, "repoURL", job.RepoURL)
	metricsRegistry.RecordJob("started")

	if err := analysisClient.MarkStarted(ctx, job.AnalysisID); err != nil {
		log.Error("failed to mark analysis as running", "analysisID", job.AnalysisID, "error", err)
		metricsRegistry.RecordJob("failed")
		return
	}

	result, err := repositoryAnalyzer.Run(ctx, job)
	if err != nil {
		log.Error("analysis failed", "analysisID", job.AnalysisID, "error", err)
		if failErr := analysisClient.SendFailure(ctx, job.AnalysisID, err); failErr != nil {
			log.Error("failed to publish analysis failure", "analysisID", job.AnalysisID, "error", failErr)
			return
		}
		if ackErr := consumer.Ack(ctx, message.ID); ackErr != nil {
			log.Error("failed to acknowledge failed job", "messageID", message.ID, "error", ackErr)
		}
		metricsRegistry.RecordJob("failed")
		return
	}

	metricsRegistry.RecordToolRuns(result.ToolRuns)

	if err := analysisClient.SendResult(ctx, job.AnalysisID, result); err != nil {
		log.Error("failed to publish analysis result", "analysisID", job.AnalysisID, "error", err)
		metricsRegistry.RecordJob("failed")
		return
	}

	if err := consumer.Ack(ctx, message.ID); err != nil {
		log.Error("failed to acknowledge completed job", "messageID", message.ID, "error", err)
		return
	}

	metricsRegistry.RecordJob("completed")
	log.Info("analysis job completed", "analysisID", job.AnalysisID)
}
