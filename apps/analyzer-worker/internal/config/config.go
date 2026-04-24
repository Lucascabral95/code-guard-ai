package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	RedisAddr           string
	AnalysisServiceURL  string
	InternalSecret      string
	ConsumerName        string
	ConsumerGroup       string
	StreamName          string
	SafeAnalysisMode    bool
	SandboxAnalysisMode string
	TempDir             string
	CloneTimeout        time.Duration
}

func Load() Config {
	return Config{
		RedisAddr:           getEnv("REDIS_ADDR", "localhost:6379"),
		AnalysisServiceURL:  getEnv("ANALYSIS_SERVICE_URL", "http://localhost:3002"),
		InternalSecret:      getEnv("INTERNAL_SECRET", ""),
		ConsumerName:        getEnv("WORKER_CONSUMER_NAME", "worker-1"),
		ConsumerGroup:       getEnv("WORKER_CONSUMER_GROUP", "codeguard-workers"),
		StreamName:          getEnv("ANALYSIS_STREAM_NAME", "scan.jobs"),
		SafeAnalysisMode:    getBoolEnv("SAFE_ANALYSIS_MODE", true),
		SandboxAnalysisMode: getEnv("SANDBOX_ANALYSIS_MODE", "docker"),
		TempDir:             getEnv("TEMP_DIR", "/tmp/codeguard"),
		CloneTimeout:        time.Duration(getIntEnv("CLONE_TIMEOUT_SECONDS", 60)) * time.Second,
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
