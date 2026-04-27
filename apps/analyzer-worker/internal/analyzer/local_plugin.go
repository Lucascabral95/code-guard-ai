package analyzer

import (
	"context"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type localPluginOutput struct {
	findings     []contracts.Finding
	artifacts    []contracts.Artifact
	components   []contracts.Component
	licenseRisks []contracts.LicenseRisk
	rawSummary   map[string]any
	summary      string
}

type localAnalyzerPlugin struct {
	name   string
	stage  Stage
	runner func(repoPath string, metadata RepositoryMetadata) localPluginOutput
}

func newLocalAnalyzerPlugin(
	name string,
	stage Stage,
	runner func(repoPath string, metadata RepositoryMetadata) localPluginOutput,
) AnalyzerPlugin {
	return localAnalyzerPlugin{name: name, stage: stage, runner: runner}
}

func (plugin localAnalyzerPlugin) Name() string {
	return plugin.name
}

func (plugin localAnalyzerPlugin) Stage() Stage {
	return plugin.stage
}

func (plugin localAnalyzerPlugin) Run(
	_ context.Context,
	repoPath string,
	metadata RepositoryMetadata,
) (PluginRunResult, error) {
	startedAt := time.Now()
	output := plugin.runner(repoPath, metadata)

	return PluginRunResult{
		Tool:     plugin.name,
		Stage:    plugin.stage,
		Status:   toolRunStatusCompleted,
		Duration: time.Since(startedAt),
		ExitCode: intPointer(0),
		Raw: map[string]any{
			"findings":     output.findings,
			"licenseRisks": output.licenseRisks,
			"rawSummary":   output.rawSummary,
			"summary":      output.summary,
		},
		Artifacts:  output.artifacts,
		Components: output.components,
	}, nil
}

func (plugin localAnalyzerPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	findings, _ := result.Raw["findings"].([]contracts.Finding)
	licenseRisks, _ := result.Raw["licenseRisks"].([]contracts.LicenseRisk)
	rawSummary, _ := result.Raw["rawSummary"].(map[string]any)
	summary, _ := result.Raw["summary"].(string)

	return contracts.AnalysisResult{
		Findings:     findings,
		Artifacts:    result.Artifacts,
		Components:   result.Components,
		LicenseRisks: licenseRisks,
		ToolRuns: []contracts.ToolRun{
			stageToolRun(
				plugin.Name(),
				plugin.Stage(),
				toolRunStatusCompleted,
				int(result.Duration.Milliseconds()),
				0,
				summary,
				"",
				result.Raw,
			),
		},
		RawSummary: rawSummary,
	}, nil
}
