package analyzer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/config"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type Analyzer struct {
	config         config.Config
	dockerExecutor sandbox.DockerExecutor
	logger         *slog.Logger
}

func New(cfg config.Config, logger *slog.Logger) Analyzer {
	return Analyzer{
		config:         cfg,
		dockerExecutor: sandbox.NewDockerExecutor(cfg),
		logger:         logger,
	}
}

func (analyzer Analyzer) Run(ctx context.Context, job contracts.AnalysisJob) (contracts.AnalysisResult, error) {
	if err := ValidateGitHubURL(job.RepoURL); err != nil {
		return contracts.AnalysisResult{}, err
	}

	if err := os.MkdirAll(analyzer.config.TempDir, 0o755); err != nil {
		return contracts.AnalysisResult{}, fmt.Errorf("create temp root: %w", err)
	}

	repoPath := filepath.Join(analyzer.config.TempDir, job.AnalysisID)
	defer func() {
		if err := os.RemoveAll(repoPath); err != nil {
			analyzer.logger.Warn("failed to clean temp repository", "path", repoPath, "error", err)
		}
	}()

	if err := CloneRepository(ctx, job.RepoURL, job.Branch, repoPath, analyzer.config.CloneTimeout); err != nil {
		return contracts.AnalysisResult{}, err
	}

	stack := DetectStack(repoPath)
	metadata := RepositoryMetadata{
		AnalysisID: job.AnalysisID,
		ScanID:     job.ScanID,
		RepoURL:    job.RepoURL,
		Branch:     job.Branch,
		Stack:      stack,
		SafeMode:   job.SafeMode,
	}

	var result contracts.AnalysisResult
	if job.SafeMode {
		result = NewSafeAnalyzer().Analyze(repoPath, stack)
	} else {
		var err error
		result, err = analyzer.runSandboxAnalysis(ctx, repoPath, metadata)
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

func (analyzer Analyzer) runSandboxAnalysis(
	ctx context.Context,
	repoPath string,
	metadata RepositoryMetadata,
) (contracts.AnalysisResult, error) {
	if analyzer.config.SandboxAnalysisMode != "docker" {
		return contracts.AnalysisResult{}, fmt.Errorf(
			"unsupported sandbox mode %q; only docker is currently implemented",
			analyzer.config.SandboxAnalysisMode,
		)
	}

	result := contracts.AnalysisResult{
		DetectedStack: metadata.Stack,
		Logs: []contracts.AnalysisLog{
			infoLog("Sandbox analysis mode enabled"),
			infoLog("Running scanner plugins inside Docker isolation"),
		},
		RawSummary: map[string]any{
			"toolExecutionMode":    "docker",
			"sandboxMode":          analyzer.config.SandboxAnalysisMode,
			"externalCodeExecuted": false,
		},
	}
	result.Findings = append(result.Findings, contracts.Finding{
		Type:           FindingTypeStackDetection,
		Severity:       SeverityInfo,
		Fingerprint:    fingerprint("stack-detector", FindingTypeStackDetection, SeverityInfo, metadata.Stack, metadata.RepoURL),
		Category:       "inventory",
		Confidence:     floatPointer(0.99),
		Tool:           "stack-detector",
		Message:        "Detected repository stack: " + metadata.Stack,
		Recommendation: stringPointer("Use the detected stack to route deeper language-specific analysis."),
		Remediation:    buildRemediation("Use the detected stack to route deeper language-specific analysis.", SeverityInfo),
	})
	result.ToolRuns = append(result.ToolRuns, stageToolRun(
		"stack-detector",
		StageDetect,
		toolRunStatusCompleted,
		0,
		0,
		"Repository stack detected without executing repository code.",
		"",
		map[string]any{"stack": metadata.Stack},
	))

	for _, plugin := range analyzer.pluginsForStack(metadata.Stack) {
		pluginCtx, cancel := context.WithTimeout(ctx, analyzer.config.ScannerTimeout)
		runResult, err := plugin.Run(pluginCtx, repoPath, metadata)
		cancel()
		if err != nil {
			status := toolRunStatusFailed
			if errors.Is(err, context.DeadlineExceeded) || errors.Is(pluginCtx.Err(), context.DeadlineExceeded) {
				status = toolRunStatusTimedOut
			}
			mergeAnalysisResults(&result, pluginFailureResult(plugin, status, err.Error()))
			continue
		}

		normalized, err := plugin.Normalize(runResult)
		if err != nil {
			mergeAnalysisResults(&result, pluginFailureResult(plugin, toolRunStatusFailed, err.Error()))
			continue
		}

		mergeAnalysisResults(&result, normalized)
	}

	result.Findings = dedupeFindings(result.Findings)
	result.Components = dedupeComponents(result.Components)
	result.Vulnerabilities = dedupeVulnerabilities(result.Vulnerabilities)
	result.LicenseRisks = dedupeLicenseRisks(result.LicenseRisks)
	result.RawSummary["securityIssues"] = countSecurityFindings(result.Findings)
	result.RawSummary["componentsDetected"] = len(result.Components)
	result.RawSummary["licenseRiskCount"] = len(result.LicenseRisks)
	result.RawSummary["toolRunsCompleted"] = len(result.ToolRuns)
	result.Logs = append(result.Logs, infoLog("Sandbox analysis completed with normalized evidence"))
	return result, nil
}

func (analyzer Analyzer) pluginsForStack(stack string) []AnalyzerPlugin {
	plugins := []AnalyzerPlugin{
		NewSemgrepPlugin(analyzer.dockerExecutor, analyzer.config.SemgrepImage),
		NewTrivyFindingsPlugin(analyzer.dockerExecutor, analyzer.config.TrivyImage),
		NewTrivySBOMPlugin(analyzer.dockerExecutor, analyzer.config.TrivyImage),
		NewGitleaksPlugin(analyzer.dockerExecutor, analyzer.config.GitleaksImage),
	}

	if stack == "node" {
		plugins = append(
			plugins,
			NewOSVPlugin(analyzer.dockerExecutor, analyzer.config.OSVScannerImage),
			NewNodeQualityPlugin(),
		)
	}

	return plugins
}
