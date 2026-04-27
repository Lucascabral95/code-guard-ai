package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	RedisAddr               string
	AnalysisServiceURL      string
	InternalSecret          string
	ConsumerName            string
	ConsumerGroup           string
	StreamName              string
	SafeAnalysisMode        bool
	SandboxAnalysisMode     string
	TempDir                 string
	CloneTimeout            time.Duration
	ScannerTimeout          time.Duration
	ScannerOutputLimitBytes int
	ScannerDockerNetwork    string
	ScannerSharedVolume     string
	ScannerWorkspacePath    string
	ScannerMemoryLimit      string
	ScannerCPULimit         string
	WorkerMetricsPort       int
	SemgrepImage            string
	TrivyImage              string
	OSVScannerImage         string
	GitleaksImage           string
	ScorecardImage          string
}

func Load() Config {
	return Config{
		RedisAddr:               getEnv("REDIS_ADDR", "localhost:6379"),
		AnalysisServiceURL:      getEnv("ANALYSIS_SERVICE_URL", "http://localhost:3002"),
		InternalSecret:          getEnv("INTERNAL_SECRET", ""),
		ConsumerName:            getEnv("WORKER_CONSUMER_NAME", "worker-1"),
		ConsumerGroup:           getEnv("WORKER_CONSUMER_GROUP", "codeguard-workers"),
		StreamName:              getEnv("ANALYSIS_STREAM_NAME", "scan.jobs"),
		SafeAnalysisMode:        getBoolEnv("SAFE_ANALYSIS_MODE", true),
		SandboxAnalysisMode:     getEnv("SANDBOX_ANALYSIS_MODE", "docker"),
		TempDir:                 getEnv("TEMP_DIR", "/tmp/codeguard"),
		CloneTimeout:            time.Duration(getIntEnv("CLONE_TIMEOUT_SECONDS", 60)) * time.Second,
		ScannerTimeout:          time.Duration(getIntEnv("SCANNER_TIMEOUT_SECONDS", 120)) * time.Second,
		ScannerOutputLimitBytes: getIntEnv("SCANNER_OUTPUT_LIMIT_BYTES", 10*1024*1024),
		ScannerDockerNetwork:    getEnv("SCANNER_DOCKER_NETWORK", "none"),
		ScannerSharedVolume:     getEnv("SCANNER_SHARED_VOLUME", ""),
		ScannerWorkspacePath:    getEnv("SCANNER_WORKSPACE_PATH", "/workspace"),
		ScannerMemoryLimit:      getEnv("SCANNER_MEMORY_LIMIT", "2g"),
		ScannerCPULimit:         getEnv("SCANNER_CPU_LIMIT", "2.0"),
		WorkerMetricsPort:       getIntEnv("WORKER_METRICS_PORT", 9101),
		SemgrepImage:            getEnv("SEMGREP_IMAGE", "semgrep/semgrep:latest"),
		TrivyImage:              getEnv("TRIVY_IMAGE", "aquasec/trivy:latest"),
		OSVScannerImage:         getEnv("OSV_SCANNER_IMAGE", "ghcr.io/google/osv-scanner:latest"),
		GitleaksImage:           getEnv("GITLEAKS_IMAGE", "zricethezav/gitleaks:latest"),
		ScorecardImage:          getEnv("SCORECARD_IMAGE", "gcr.io/openssf/scorecard:latest"),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getBoolEnv(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getIntEnv(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
