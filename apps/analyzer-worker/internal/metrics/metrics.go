package metrics

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

var stageBuckets = []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300}

type Registry struct {
	mu             sync.Mutex
	jobs           map[string]counter
	messages       int64
	toolRuns       map[string]counter
	stageDurations map[string]*histogram
	queueDepth     int64
}

type counter struct {
	labels map[string]string
	value  int64
}

type histogram struct {
	labels  map[string]string
	buckets map[float64]int64
	count   int64
	sum     float64
}

func NewRegistry() *Registry {
	return &Registry{
		jobs:           map[string]counter{},
		toolRuns:       map[string]counter{},
		stageDurations: map[string]*histogram{},
	}
}

func (registry *Registry) StartServer(ctx context.Context, address string, logger *slog.Logger) {
	mux := http.NewServeMux()
	mux.HandleFunc("/metrics", func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("content-type", "text/plain; version=0.0.4; charset=utf-8")
		_, _ = response.Write([]byte(registry.Render()))
	})

	server := &http.Server{
		Addr:              address,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("worker metrics server failed", "error", err)
	}
}

func (registry *Registry) RecordJob(status string) {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	registry.increment(registry.jobs, map[string]string{
		"service": "analyzer-worker",
		"status":  status,
	})
}

func (registry *Registry) RecordRedisMessages(count int) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	registry.messages += int64(count)
}

func (registry *Registry) SetQueueDepth(depth int64) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	registry.queueDepth = depth
}

func (registry *Registry) RecordToolRuns(toolRuns []contracts.ToolRun) {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	for _, toolRun := range toolRuns {
		labels := map[string]string{
			"service": "analyzer-worker",
			"tool":    emptyAsUnknown(toolRun.Tool),
			"stage":   emptyAsUnknown(toolRun.Stage),
			"status":  emptyAsUnknown(toolRun.Status),
		}
		registry.increment(registry.toolRuns, labels)

		if toolRun.DurationMs == nil {
			continue
		}
		registry.observeStageDuration(labels, float64(*toolRun.DurationMs)/1000)
	}
}

func (registry *Registry) Render() string {
	registry.mu.Lock()
	defer registry.mu.Unlock()

	lines := []string{
		"# HELP codeguard_worker_jobs_total Analyzer worker jobs by final status.",
		"# TYPE codeguard_worker_jobs_total counter",
	}
	for _, metric := range sortedCounters(registry.jobs) {
		lines = append(lines, fmt.Sprintf("codeguard_worker_jobs_total{%s} %d", formatLabels(metric.labels), metric.value))
	}

	lines = append(
		lines,
		"# HELP codeguard_worker_redis_messages_total Redis Stream messages read by the worker.",
		"# TYPE codeguard_worker_redis_messages_total counter",
		fmt.Sprintf("codeguard_worker_redis_messages_total{service=\"analyzer-worker\"} %d", registry.messages),
		"# HELP codeguard_worker_queue_depth Redis Stream length observed by the worker.",
		"# TYPE codeguard_worker_queue_depth gauge",
		fmt.Sprintf("codeguard_worker_queue_depth{service=\"analyzer-worker\",stream=\"scan.jobs\"} %d", registry.queueDepth),
		"# HELP codeguard_worker_tool_runs_total Scanner tool runs by status.",
		"# TYPE codeguard_worker_tool_runs_total counter",
	)
	for _, metric := range sortedCounters(registry.toolRuns) {
		lines = append(lines, fmt.Sprintf("codeguard_worker_tool_runs_total{%s} %d", formatLabels(metric.labels), metric.value))
	}

	lines = append(
		lines,
		"# HELP codeguard_worker_stage_duration_seconds Scanner and worker stage duration histogram.",
		"# TYPE codeguard_worker_stage_duration_seconds histogram",
	)
	for _, metric := range sortedHistograms(registry.stageDurations) {
		for _, bucket := range stageBuckets {
			lines = append(
				lines,
				fmt.Sprintf(
					"codeguard_worker_stage_duration_seconds_bucket{%s} %d",
					formatLabels(withLabel(metric.labels, "le", formatBucket(bucket))),
					metric.buckets[bucket],
				),
			)
		}
		lines = append(
			lines,
			fmt.Sprintf(
				"codeguard_worker_stage_duration_seconds_bucket{%s} %d",
				formatLabels(withLabel(metric.labels, "le", "+Inf")),
				metric.count,
			),
			fmt.Sprintf("codeguard_worker_stage_duration_seconds_sum{%s} %f", formatLabels(metric.labels), metric.sum),
			fmt.Sprintf("codeguard_worker_stage_duration_seconds_count{%s} %d", formatLabels(metric.labels), metric.count),
		)
	}

	return strings.Join(lines, "\n") + "\n"
}

func (registry *Registry) increment(store map[string]counter, labels map[string]string) {
	key := labelsKey(labels)
	metric := store[key]
	if metric.labels == nil {
		metric.labels = labels
	}
	metric.value++
	store[key] = metric
}

func (registry *Registry) observeStageDuration(labels map[string]string, seconds float64) {
	key := labelsKey(labels)
	metric := registry.stageDurations[key]
	if metric == nil {
		metric = &histogram{
			labels:  labels,
			buckets: map[float64]int64{},
		}
	}
	for _, bucket := range stageBuckets {
		if seconds <= bucket {
			metric.buckets[bucket]++
		}
	}
	metric.count++
	metric.sum += seconds
	registry.stageDurations[key] = metric
}

func sortedCounters(values map[string]counter) []counter {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	result := make([]counter, 0, len(keys))
	for _, key := range keys {
		result = append(result, values[key])
	}
	return result
}

func sortedHistograms(values map[string]*histogram) []*histogram {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	result := make([]*histogram, 0, len(keys))
	for _, key := range keys {
		result = append(result, values[key])
	}
	return result
}

func labelsKey(labels map[string]string) string {
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+":"+labels[key])
	}
	return strings.Join(parts, "|")
}

func formatLabels(labels map[string]string) string {
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=\"%s\"", key, escapeLabel(labels[key])))
	}
	return strings.Join(parts, ",")
}

func withLabel(labels map[string]string, key string, value string) map[string]string {
	clone := make(map[string]string, len(labels)+1)
	for labelKey, labelValue := range labels {
		clone[labelKey] = labelValue
	}
	clone[key] = value
	return clone
}

func formatBucket(bucket float64) string {
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.3f", bucket), "0"), ".")
}

func escapeLabel(value string) string {
	return strings.NewReplacer("\\", "\\\\", "\"", "\\\"", "\n", "\\n").Replace(value)
}

func emptyAsUnknown(value string) string {
	if strings.TrimSpace(value) == "" {
		return "unknown"
	}
	return value
}
