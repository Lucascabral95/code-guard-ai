package analyzer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type SemgrepPlugin struct {
	executor sandbox.DockerExecutor
	image    string
}

func NewSemgrepPlugin(executor sandbox.DockerExecutor, image string) AnalyzerPlugin {
	return SemgrepPlugin{
		executor: executor,
		image:    image,
	}
}

func (plugin SemgrepPlugin) Name() string {
	return "semgrep"
}

func (plugin SemgrepPlugin) Stage() Stage {
	return StageSAST
}

func (plugin SemgrepPlugin) Run(
	ctx context.Context,
	repoPath string,
	_ RepositoryMetadata,
) (PluginRunResult, error) {
	runResult, err := runDockerPlugin(
		ctx,
		plugin.executor,
		repoPath,
		plugin.image,
		"scan",
		"--config",
		"auto",
		"--json",
		"--quiet",
		".",
	)
	if err != nil {
		return PluginRunResult{}, err
	}

	raw, err := parseJSONObject(runResult.Stdout)
	if err != nil {
		return PluginRunResult{}, fmt.Errorf("parse semgrep output: %w", err)
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
		Artifacts: []contracts.Artifact{rawJSONArtifact("semgrep.json", raw)},
	}, nil
}

func (plugin SemgrepPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	findings := make([]contracts.Finding, 0)
	for _, item := range objectArrayValue(result.Raw, "results") {
		extra := objectValue(item, "extra")
		metadata := objectValue(extra, "metadata")
		start := objectValue(item, "start")
		file := stringFromMap(item, "path")
		message := stringFromMap(extra, "message")
		if message == "" {
			message = stringFromMap(item, "check_id")
		}

		severity := normalizeSeverity(
			stringFromMap(extra, "severity"),
			normalizeSeverity(stringFromMap(metadata, "severity"), SeverityMedium),
		)
		confidence := semgrepConfidence(metadata)
		cwe := semgrepCWE(metadata)
		recommendation := semgrepRecommendation(extra, metadata)
		fingerprintValue := stringFromMap(extra, "fingerprint")
		if fingerprintValue == "" {
			fingerprintValue = fingerprint(
				plugin.Name(),
				FindingTypeSecurity,
				severity,
				file,
				message,
			)
		}

		findings = append(findings, contracts.Finding{
			Type:           FindingTypeSecurity,
			Severity:       severity,
			Fingerprint:    fingerprintValue,
			Category:       "sast",
			Confidence:     confidence,
			CWE:            cwe,
			Tool:           plugin.Name(),
			File:           optionalString(file),
			Line:           intFromMap(start, "line"),
			Message:        message,
			Recommendation: optionalString(recommendation),
			Raw:            item,
			Evidences: []contracts.Evidence{
				{
					Title:     "Semgrep rule match",
					File:      optionalString(file),
					LineStart: intFromMap(start, "line"),
					LineEnd:   intFromMap(objectValue(item, "end"), "line"),
					Raw:       item,
				},
			},
			Remediation: buildRemediation(
				"Review the Semgrep rule match and replace the unsafe pattern with a safer implementation.",
				severity,
			),
		})
	}

	status := toolRunStatusCompleted
	summary := summaryWithCount("Semgrep produced", len(findings))
	errorMessage := ""
	exitCode := 0
	if result.ExitCode != nil {
		exitCode = *result.ExitCode
		if exitCode > 1 {
			status = toolRunStatusFailed
			errorMessage = strings.TrimSpace(result.Stderr)
			summary = "Semgrep did not complete successfully."
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
			"semgrepFindings": len(findings),
		},
	}, nil
}

func semgrepConfidence(metadata map[string]any) *float64 {
	switch strings.ToUpper(stringFromMap(metadata, "confidence")) {
	case "HIGH":
		return floatPointer(0.9)
	case "MEDIUM":
		return floatPointer(0.75)
	case "LOW":
		return floatPointer(0.55)
	default:
		return floatPointer(0.7)
	}
}

func semgrepCWE(metadata map[string]any) *string {
	if cwe := stringFromMap(metadata, "cwe"); cwe != "" {
		return stringPointer(cwe)
	}
	if values := stringSlice(metadata["cwe"]); len(values) > 0 {
		return stringPointer(values[0])
	}
	return nil
}

func semgrepRecommendation(extra map[string]any, metadata map[string]any) string {
	for _, key := range []string{"fix", "fix_regex", "fixRegex"} {
		if value := stringFromMap(extra, key); value != "" {
			return value
		}
		if value := stringFromMap(metadata, key); value != "" {
			return value
		}
	}
	return "Review the matched code path and apply the secure pattern recommended by the rule."
}
