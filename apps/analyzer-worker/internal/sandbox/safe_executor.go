package sandbox

import (
	"context"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type SafeExecutor struct{}

func NewSafeExecutor() SafeExecutor {
	return SafeExecutor{}
}

func (executor SafeExecutor) Execute(
	_ context.Context,
	repoPath string,
	stack string,
) (contracts.AnalysisResult, error) {
	return contracts.AnalysisResult{
		DetectedStack: stack,
		Logs: []contracts.AnalysisLog{
			{Level: "INFO", Message: "Safe executor reserved for analyzer package integration"},
			{Level: "INFO", Message: "Repository path inspected: " + repoPath},
		},
		RawSummary: map[string]any{},
	}, nil
}
