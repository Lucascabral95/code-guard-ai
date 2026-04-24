package sandbox

import (
	"context"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type Executor interface {
	Execute(ctx context.Context, repoPath string, stack string) (contracts.AnalysisResult, error)
}
