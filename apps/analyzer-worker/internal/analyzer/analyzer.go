package analyzer

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type Analyzer struct {
	tempDir      string
	cloneTimeout time.Duration
	logger       *slog.Logger
}

func New(tempDir string, cloneTimeout time.Duration, logger *slog.Logger) Analyzer {
	return Analyzer{
		tempDir:      tempDir,
		cloneTimeout: cloneTimeout,
		logger:       logger,
	}
}

func (analyzer Analyzer) Run(ctx context.Context, job contracts.AnalysisJob) (contracts.AnalysisResult, error) {
	if err := ValidateGitHubURL(job.RepoURL); err != nil {
		return contracts.AnalysisResult{}, err
	}

	if err := os.MkdirAll(analyzer.tempDir, 0o755); err != nil {
		return contracts.AnalysisResult{}, fmt.Errorf("create temp root: %w", err)
	}

	repoPath := filepath.Join(analyzer.tempDir, job.AnalysisID)
	defer func() {
		if err := os.RemoveAll(repoPath); err != nil {
			analyzer.logger.Warn("failed to clean temp repository", "path", repoPath, "error", err)
		}
	}()

	if err := CloneRepository(ctx, job.RepoURL, job.Branch, repoPath, analyzer.cloneTimeout); err != nil {
		return contracts.AnalysisResult{}, err
	}

	stack := DetectStack(repoPath)
	var result contracts.AnalysisResult
	if job.SafeMode {
		result = NewSafeAnalyzer().Analyze(repoPath, stack)
	} else {
		var err error
		result, err = sandbox.NewDockerExecutor().Execute(ctx, repoPath, stack)
		if err != nil {
			return contracts.AnalysisResult{}, err
		}
	}

	result.Logs = append([]contracts.AnalysisLog{
		infoLog("Repository cloned successfully"),
		infoLog("Detected stack: " + stack),
	}, result.Logs...)
	result.DetectedStack = stack
	return result, nil
}
