package analyzer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type GitleaksPlugin struct {
	executor sandbox.DockerExecutor
	image    string
}

func NewGitleaksPlugin(executor sandbox.DockerExecutor, image string) AnalyzerPlugin {
	return GitleaksPlugin{
		executor: executor,
		image:    image,
	}
}

func (plugin GitleaksPlugin) Name() string {
	return "gitleaks"
}

func (plugin GitleaksPlugin) Stage() Stage {
	return StageSecrets
}

func (plugin GitleaksPlugin) Run(
	ctx context.Context,
	repoPath string,
	_ RepositoryMetadata,
) (PluginRunResult, error) {
	runResult, err := runDockerPlugin(
		ctx,
		plugin.executor,
		repoPath,
		plugin.image,
		"detect",
		"--source",
		".",
		"--report-format",
		"json",
		"--report-path",
		"-",
		"--no-banner",
	)
	if err != nil {
		return PluginRunResult{}, err
	}

	entries, err := parseJSONArray(runResult.Stdout)
	if err != nil {
		return PluginRunResult{}, fmt.Errorf("parse gitleaks output: %w", err)
	}

	raw := map[string]any{"findings": entries}
	return PluginRunResult{
		Tool:      plugin.Name(),
		Stage:     plugin.Stage(),
		Status:    toolRunStatusCompleted,
		Duration:  time.Duration(runResult.DurationMs) * time.Millisecond,
		ExitCode:  intPointer(runResult.ExitCode),
		Raw:       raw,
		Stdout:    runResult.Stdout,
		Stderr:    runResult.Stderr,
		Artifacts: []contracts.Artifact{rawJSONArtifact("gitleaks.json", raw)},
	}, nil
}

func (plugin GitleaksPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	findings := make([]contracts.Finding, 0)
	for _, item := range objectArrayValue(result.Raw, "findings") {
		file := stringFromMap(item, "File")
		message := stringFromMap(item, "Description")
		if message == "" {
			message = "Potential secret detected"
		}
		line := intFromMap(item, "StartLine")
		fingerprintValue := stringFromMap(item, "Fingerprint")
		if fingerprintValue == "" {
			fingerprintValue = fingerprint(plugin.Name(), FindingTypeSecurity, SeverityCritical, file, message)
		}

		findings = append(findings, contracts.Finding{
			Type:           FindingTypeSecurity,
			Severity:       SeverityCritical,
			Fingerprint:    fingerprintValue,
			Category:       "secrets",
			Confidence:     floatPointer(0.95),
			Tool:           plugin.Name(),
			File:           optionalString(file),
			Line:           line,
			Message:        message,
			Recommendation: stringPointer("Remove the secret from source control, rotate the credential and move it to a secret manager."),
			Raw:            item,
			Evidences: []contracts.Evidence{
				{
					Title:     "Gitleaks secret match",
					File:      optionalString(file),
					LineStart: line,
					LineEnd:   line,
					Snippet:   optionalString(stringFromMap(item, "Match")),
					Raw:       item,
				},
			},
			Remediation: buildRemediation(
				"Rotate the credential, remove it from the repository and prevent future leakage through secret management and commit scanning.",
				SeverityCritical,
			),
		})
	}

	status := toolRunStatusCompleted
	summary := summaryWithCount("Gitleaks produced", len(findings))
	errorMessage := ""
	exitCode := 0
	if result.ExitCode != nil {
		exitCode = *result.ExitCode
		if exitCode > 1 {
			status = toolRunStatusFailed
			errorMessage = strings.TrimSpace(result.Stderr)
			summary = "Gitleaks did not complete successfully."
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
			"gitleaksFindings": len(findings),
		},
	}, nil
}
