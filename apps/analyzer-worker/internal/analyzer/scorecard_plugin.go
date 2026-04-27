package analyzer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type ScorecardPlugin struct {
	executor sandbox.DockerExecutor
	image    string
}

func NewScorecardPlugin(executor sandbox.DockerExecutor, image string) AnalyzerPlugin {
	return ScorecardPlugin{executor: executor, image: image}
}

func (plugin ScorecardPlugin) Name() string {
	return "scorecard"
}

func (plugin ScorecardPlugin) Stage() Stage {
	return StageScorecard
}

func (plugin ScorecardPlugin) Run(
	ctx context.Context,
	repoPath string,
	metadata RepositoryMetadata,
) (PluginRunResult, error) {
	runResult, err := runDockerPlugin(
		ctx,
		plugin.executor,
		repoPath,
		plugin.image,
		"--repo",
		metadata.RepoURL,
		"--format",
		"json",
	)
	if err != nil {
		return PluginRunResult{}, err
	}

	raw, err := parseJSONObject(runResult.Stdout)
	if err != nil {
		return PluginRunResult{}, fmt.Errorf("parse scorecard output: %w", err)
	}

	return PluginRunResult{
		Tool:      plugin.Name(),
		Stage:     plugin.Stage(),
		Status:    toolRunStatusCompleted,
		Duration:  time.Duration(runResult.DurationMs) * time.Millisecond,
		ExitCode:  intPointer(runResult.ExitCode),
		Raw:       raw,
		Stdout:    runResult.Stdout,
		Stderr:    runResult.Stderr,
		Artifacts: []contracts.Artifact{rawJSONArtifact("scorecard.json", raw)},
	}, nil
}

func (plugin ScorecardPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	findings := make([]contracts.Finding, 0)
	for _, check := range objectArrayValue(result.Raw, "checks") {
		score := floatFromMap(check, "score")
		if score != nil && *score >= 8 {
			continue
		}

		checkName := firstNonEmpty(stringFromMap(check, "name"), "Scorecard check")
		reason := firstNonEmpty(stringFromMap(check, "reason"), "OpenSSF Scorecard check is below the desired threshold.")
		severity := scorecardSeverity(score)
		recommendation := "Review the OpenSSF Scorecard recommendation and improve repository security posture for this check."

		findings = append(findings, contracts.Finding{
			Type:           FindingTypeSecurity,
			Severity:       severity,
			Fingerprint:    fingerprint(plugin.Name(), FindingTypeSecurity, severity, checkName, reason),
			Category:       "scorecard",
			Confidence:     floatPointer(0.85),
			Tool:           plugin.Name(),
			File:           nil,
			Line:           nil,
			Message:        checkName + ": " + reason,
			Recommendation: stringPointer(recommendation),
			Raw:            check,
			Evidences: []contracts.Evidence{
				{
					Title: "OpenSSF Scorecard check",
					Raw:   check,
				},
			},
			Remediation: buildRemediation(recommendation, severity),
		})
	}

	status := toolRunStatusCompleted
	summary := summaryWithCount("OpenSSF Scorecard produced", len(findings))
	errorMessage := ""
	exitCode := 0
	if result.ExitCode != nil {
		exitCode = *result.ExitCode
		if exitCode != 0 {
			status = toolRunStatusFailed
			errorMessage = strings.TrimSpace(result.Stderr)
			summary = "OpenSSF Scorecard did not complete successfully."
		}
	}

	return contracts.AnalysisResult{
		Findings:  findings,
		Artifacts: result.Artifacts,
		ToolRuns: []contracts.ToolRun{
			stageToolRun(
				plugin.Name(),
				plugin.Stage(),
				status,
				int(result.Duration.Milliseconds()),
				exitCode,
				summary,
				errorMessage,
				result.Raw,
			),
		},
		RawSummary: map[string]any{
			"scorecardFindings": len(findings),
			"scorecardScore":    floatFromMap(result.Raw, "score"),
		},
	}, nil
}

func scorecardSeverity(score *float64) string {
	if score == nil {
		return SeverityMedium
	}
	switch {
	case *score < 3:
		return SeverityHigh
	case *score < 6:
		return SeverityMedium
	default:
		return SeverityLow
	}
}
