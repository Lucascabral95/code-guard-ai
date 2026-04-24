package queue

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type Consumer struct {
	client       *redis.Client
	streamName   string
	consumerName string
	groupName    string
}

func NewConsumer(redisAddr, streamName, groupName, consumerName string) *Consumer {
	return &Consumer{
		client: redis.NewClient(&redis.Options{
			Addr: redisAddr,
		}),
		streamName:   streamName,
		groupName:    groupName,
		consumerName: consumerName,
	}
}

func (consumer *Consumer) EnsureGroup(ctx context.Context) error {
	err := consumer.client.XGroupCreateMkStream(ctx, consumer.streamName, consumer.groupName, "0").Err()
	if err == nil || strings.Contains(err.Error(), "BUSYGROUP") {
		return nil
	}
	return err
}

func (consumer *Consumer) Read(ctx context.Context) ([]redis.XMessage, error) {
	streams, err := consumer.client.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    consumer.groupName,
		Consumer: consumer.consumerName,
		Streams:  []string{consumer.streamName, ">"},
		Count:    1,
		Block:    5 * time.Second,
	}).Result()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(streams) == 0 {
		return nil, nil
	}
	return streams[0].Messages, nil
}

func (consumer *Consumer) Ack(ctx context.Context, messageID string) error {
	return consumer.client.XAck(ctx, consumer.streamName, consumer.groupName, messageID).Err()
}

func (consumer *Consumer) Close() error {
	return consumer.client.Close()
}

func JobFromMessage(message redis.XMessage) (contracts.AnalysisJob, error) {
	values := message.Values
	job := contracts.AnalysisJob{
		AnalysisID: stringValue(values, "analysisId"),
		ScanID:     stringValue(values, "scanId"),
		RepoURL:    stringValue(values, "repoUrl"),
		Branch:     stringValue(values, "branch"),
		SafeMode:   boolValue(values, "safeMode"),
	}

	if job.AnalysisID == "" || job.RepoURL == "" {
		return contracts.AnalysisJob{}, fmt.Errorf("invalid job payload in Redis message %s", message.ID)
	}
	if job.Branch == "" {
		job.Branch = "main"
	}

	return job, nil
}

func stringValue(values map[string]any, key string) string {
	value, ok := values[key]
	if !ok {
		return ""
	}
	return fmt.Sprint(value)
}

func boolValue(values map[string]any, key string) bool {
	value := stringValue(values, key)
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false
	}
	return parsed
}
