package analyzer

import (
	"path/filepath"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type SafeAnalyzer struct{}

func NewSafeAnalyzer() SafeAnalyzer {
	return SafeAnalyzer{}
}

func (safeAnalyzer SafeAnalyzer) Analyze(repoPath string, stack string) contracts.AnalysisResult {
	findings := []contracts.Finding{
		{
			Type:           FindingTypeStackDetection,
			Severity:       SeverityInfo,
			Tool:           "stack-detector",
			Message:        "Detected repository stack: " + stack,
			Recommendation: stringPointer("Use safe mode output as a baseline before enabling sandboxed execution."),
		},
	}
	logs := []contracts.AnalysisLog{infoLog("Safe analysis mode enabled")}
	rawSummary := map[string]any{
		"testsDetected":      nil,
		"lintConfigured":     nil,
		"securityIssues":     0,
		"installationErrors": 0,
	}

	if stack != "node" {
		return contracts.AnalysisResult{
			DetectedStack: stack,
			Findings:      findings,
			Logs:          logs,
			RawSummary:    rawSummary,
		}
	}

	manifest, err := ParsePackageJSON(filepath.Join(repoPath, "package.json"))
	if err != nil {
		findings = append(findings, contracts.Finding{
			Type:           FindingTypeSystem,
			Severity:       SeverityHigh,
			Tool:           "safe-analyzer",
			Message:        "package.json could not be parsed",
			Recommendation: stringPointer("Fix package.json syntax before running deeper analysis."),
		})
		logs = append(logs, contracts.AnalysisLog{Level: LogError, Message: err.Error()})
		rawSummary["installationErrors"] = 1
		return contracts.AnalysisResult{DetectedStack: stack, Findings: findings, Logs: logs, RawSummary: rawSummary}
	}

	if _, ok := manifest.Scripts["test"]; !ok {
		findings = append(findings, contracts.Finding{
			Type:           FindingTypeTest,
			Severity:       SeverityMedium,
			Tool:           "package-json",
			Message:        "No test script found",
			Recommendation: stringPointer("Add a deterministic test script to package.json."),
		})
		rawSummary["testsDetected"] = false
	} else {
		rawSummary["testsDetected"] = true
	}

	if _, ok := manifest.Scripts["lint"]; !ok {
		findings = append(findings, contracts.Finding{
			Type:           FindingTypeLint,
			Severity:       SeverityLow,
			Tool:           "package-json",
			Message:        "No lint script found",
			Recommendation: stringPointer("Add a lint script to package.json."),
		})
		rawSummary["lintConfigured"] = false
	} else {
		rawSummary["lintConfigured"] = true
	}

	if fileExists(filepath.Join(repoPath, "package-lock.json")) {
		findings = append(findings, contracts.Finding{
			Type:           FindingTypeDependency,
			Severity:       SeverityInfo,
			Tool:           "package-lock",
			Message:        "Dependency lockfile detected",
			Recommendation: stringPointer("Keep lockfiles committed to make dependency review reproducible."),
		})
	}

	logs = append(logs, infoLog("Node.js safe analysis completed"))
	return contracts.AnalysisResult{
		DetectedStack: stack,
		Findings:      findings,
		Logs:          logs,
		RawSummary:    rawSummary,
	}
}
