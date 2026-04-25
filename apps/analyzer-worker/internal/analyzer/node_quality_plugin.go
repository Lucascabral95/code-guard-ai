package analyzer

import (
	"context"
	"path/filepath"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type NodeQualityPlugin struct{}

func NewNodeQualityPlugin() AnalyzerPlugin {
	return NodeQualityPlugin{}
}

func (plugin NodeQualityPlugin) Name() string {
	return "node-quality"
}

func (plugin NodeQualityPlugin) Stage() Stage {
	return StageQuality
}

func (plugin NodeQualityPlugin) Run(
	_ context.Context,
	repoPath string,
	metadata RepositoryMetadata,
) (PluginRunResult, error) {
	raw := map[string]any{
		"stack":                    metadata.Stack,
		"packageManager":           detectPackageManager(repoPath),
		"hasLockfile":              detectPackageManager(repoPath) != "unknown",
		"tsconfig":                 fileExists(filepath.Join(repoPath, "tsconfig.json")),
		"typescriptStrictDisabled": tsconfigStrictDisabled(filepath.Join(repoPath, "tsconfig.json")),
	}

	if metadata.Stack != "node" {
		return PluginRunResult{
			Tool:     plugin.Name(),
			Stage:    plugin.Stage(),
			Status:   toolRunStatusSkipped,
			ExitCode: intPointer(0),
			Raw:      raw,
		}, nil
	}

	manifest, err := ParsePackageJSON(filepath.Join(repoPath, "package.json"))
	if err != nil {
		return PluginRunResult{}, err
	}

	raw["scripts"] = stringMapToAny(manifest.Scripts)
	raw["engines"] = stringMapToAny(manifest.Engines)
	raw["dependencies"] = len(manifest.Dependencies) + len(manifest.DevDependencies)
	return PluginRunResult{
		Tool:     plugin.Name(),
		Stage:    plugin.Stage(),
		Status:   toolRunStatusCompleted,
		ExitCode: intPointer(0),
		Raw:      raw,
		Artifacts: []contracts.Artifact{
			rawJSONArtifact("node-quality.json", raw),
		},
	}, nil
}

func (plugin NodeQualityPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	if result.Status == toolRunStatusSkipped {
		return contracts.AnalysisResult{
			ToolRuns: []contracts.ToolRun{
				stageToolRun(
					plugin.Name(),
					plugin.Stage(),
					toolRunStatusSkipped,
					0,
					0,
					"Node.js quality checks were skipped because package.json was not detected.",
					"",
					result.Raw,
				),
			},
			RawSummary: map[string]any{
				"nodeQualitySkipped": true,
			},
		}, nil
	}

	findings := make([]contracts.Finding, 0)
	recommendations := map[string]string{}
	if scripts, ok := result.Raw["scripts"].(map[string]any); ok {
		if _, exists := scripts["test"]; !exists {
			findings = append(findings, contracts.Finding{
				Type:           FindingTypeTest,
				Severity:       SeverityMedium,
				Fingerprint:    fingerprint(plugin.Name(), FindingTypeTest, SeverityMedium, "package.json", "missing-test-script"),
				Category:       "quality",
				Confidence:     floatPointer(0.95),
				Tool:           plugin.Name(),
				File:           stringPointer("package.json"),
				Message:        "No test script found in package.json",
				Recommendation: stringPointer("Add a deterministic test script so CI and local verification can block regressions."),
				Raw:            result.Raw,
				Remediation: buildRemediation(
					"Add a deterministic test script so CI and local verification can block regressions.",
					SeverityMedium,
				),
			})
		}
		if _, exists := scripts["lint"]; !exists {
			findings = append(findings, contracts.Finding{
				Type:           FindingTypeLint,
				Severity:       SeverityLow,
				Fingerprint:    fingerprint(plugin.Name(), FindingTypeLint, SeverityLow, "package.json", "missing-lint-script"),
				Category:       "quality",
				Confidence:     floatPointer(0.9),
				Tool:           plugin.Name(),
				File:           stringPointer("package.json"),
				Message:        "No lint script found in package.json",
				Recommendation: stringPointer("Add a lint script and run it in CI before tightening merge policies."),
				Raw:            result.Raw,
				Remediation: buildRemediation(
					"Add a lint script and run it in CI before tightening merge policies.",
					SeverityLow,
				),
			})
		}
	}

	if hasLockfile, ok := result.Raw["hasLockfile"].(bool); ok && !hasLockfile {
		recommendations["lockfile"] = "Commit a package manager lockfile to keep builds reproducible and scanner output stable."
		findings = append(findings, contracts.Finding{
			Type:           FindingTypeDependency,
			Severity:       SeverityMedium,
			Fingerprint:    fingerprint(plugin.Name(), FindingTypeDependency, SeverityMedium, "package.json", "missing-lockfile"),
			Category:       "supply-chain",
			Confidence:     floatPointer(0.9),
			Tool:           plugin.Name(),
			File:           stringPointer("package.json"),
			Message:        "Dependencies are declared without a committed lockfile",
			Recommendation: stringPointer(recommendations["lockfile"]),
			Raw:            result.Raw,
			Remediation:    buildRemediation(recommendations["lockfile"], SeverityMedium),
		})
	}

	if disabled, ok := result.Raw["typescriptStrictDisabled"].(bool); ok && disabled {
		findings = append(findings, contracts.Finding{
			Type:           FindingTypeLint,
			Severity:       SeverityMedium,
			Fingerprint:    fingerprint(plugin.Name(), FindingTypeLint, SeverityMedium, "tsconfig.json", "strict-disabled"),
			Category:       "quality",
			Confidence:     floatPointer(0.85),
			Tool:           plugin.Name(),
			File:           stringPointer("tsconfig.json"),
			Message:        "TypeScript strict mode is disabled",
			Recommendation: stringPointer("Enable strict mode or document a phased migration plan with explicit exceptions."),
			Raw:            result.Raw,
			Remediation: buildRemediation(
				"Enable strict mode or document a phased migration plan with explicit exceptions.",
				SeverityMedium,
			),
		})
	}

	return contracts.AnalysisResult{
		Findings:  findings,
		Artifacts: result.Artifacts,
		ToolRuns: []contracts.ToolRun{
			stageToolRun(
				plugin.Name(),
				plugin.Stage(),
				toolRunStatusCompleted,
				0,
				0,
				summaryWithCount("Node quality produced", len(findings)),
				"",
				result.Raw,
			),
		},
		RawSummary: map[string]any{
			"nodeQualityFindings": len(findings),
		},
	}, nil
}

func stringMapToAny(values map[string]string) map[string]any {
	result := make(map[string]any, len(values))
	for key, value := range values {
		result[key] = value
	}
	return result
}
