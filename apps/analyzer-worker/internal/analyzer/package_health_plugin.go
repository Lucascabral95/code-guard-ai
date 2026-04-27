package analyzer

import (
	"path/filepath"
	"strings"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

func NewPackageHealthPlugin() AnalyzerPlugin {
	return newLocalAnalyzerPlugin("package-health", StageQuality, runPackageHealth)
}

func runPackageHealth(repoPath string, metadata RepositoryMetadata) localPluginOutput {
	if metadata.Stack != "node" || !fileExists(filepath.Join(repoPath, "package.json")) {
		return localPluginOutput{
			rawSummary: map[string]any{"packageHealthSkipped": true},
			summary:    "Package health checks skipped because package.json was not detected.",
		}
	}

	safeAnalyzer := NewSafeAnalyzer()
	manifest, err := ParsePackageJSON(filepath.Join(repoPath, "package.json"))
	if err != nil {
		finding := safeAnalyzer.finding(
			FindingTypeSystem,
			SeverityHigh,
			"package-health",
			"quality",
			stringPointer("package.json"),
			nil,
			"package.json could not be parsed for package health checks",
			"Fix package.json syntax so dependency and package-manager health can be evaluated.",
			0.9,
			map[string]any{"error": err.Error()},
		)
		return localPluginOutput{
			findings:   []contracts.Finding{finding},
			rawSummary: map[string]any{"packageHealthFindings": 1},
			summary:    "Package health checks failed to parse package.json.",
		}
	}

	findings := []contracts.Finding{}
	packageManager := detectPackageManager(repoPath)
	declaredManager := declaredPackageManager(manifest.PackageManager)

	if declaredManager != "" && packageManager != "unknown" && declaredManager != packageManager {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeDependency,
			SeverityMedium,
			"package-health",
			"supply-chain",
			stringPointer("package.json"),
			nil,
			"Declared packageManager does not match committed lockfile",
			"Align packageManager with the lockfile used in CI to avoid dependency drift.",
			0.85,
			map[string]any{"declaredPackageManager": declaredManager, "detectedPackageManager": packageManager},
		))
	}
	if manifest.PackageManager == "" {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeDependency,
			SeverityLow,
			"package-health",
			"supply-chain",
			stringPointer("package.json"),
			nil,
			"packageManager field is not declared",
			"Declare packageManager so local, CI and scanner environments use the same package manager version.",
			0.7,
			nil,
		))
	}
	if manifest.Workspaces != nil && packageManager == "unknown" {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeDependency,
			SeverityMedium,
			"package-health",
			"supply-chain",
			stringPointer("package.json"),
			nil,
			"Workspace repository has no committed lockfile",
			"Commit the workspace lockfile so dependency graph and vulnerability scans are reproducible.",
			0.85,
			map[string]any{"workspaces": manifest.Workspaces},
		))
	}

	for _, script := range []string{"preinstall", "install", "postinstall"} {
		if value, exists := manifest.Scripts[script]; exists && strings.TrimSpace(value) != "" {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityMedium,
				"package-health",
				"supply-chain",
				stringPointer("package.json"),
				nil,
				"Install lifecycle script is defined: "+script,
				"Review install lifecycle scripts carefully because they execute during dependency installation.",
				0.8,
				map[string]any{"script": script, "command": value},
			))
		}
	}

	findings = append(findings, dependencyRangeFindings(safeAnalyzer, manifest)...)

	raw := map[string]any{
		"packageManager":         packageManager,
		"declaredPackageManager": manifest.PackageManager,
		"dependencyCount":        len(manifest.Dependencies) + len(manifest.DevDependencies),
		"findingCount":           len(findings),
	}

	return localPluginOutput{
		findings: findings,
		artifacts: []contracts.Artifact{
			rawJSONArtifact("package-health.json", raw),
		},
		rawSummary: map[string]any{
			"packageHealthFindings":  len(findings),
			"packageManager":         packageManager,
			"declaredPackageManager": manifest.PackageManager,
		},
		summary: summaryWithCount("Package health produced", len(findings)),
	}
}

func declaredPackageManager(value string) string {
	if value == "" {
		return ""
	}
	name, _, _ := strings.Cut(value, "@")
	return strings.ToLower(strings.TrimSpace(name))
}
