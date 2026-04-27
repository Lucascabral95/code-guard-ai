package analyzer

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

var actionPinnedToSHA = regexp.MustCompile(`@[a-fA-F0-9]{40}$`)

func NewCIPosturePlugin() AnalyzerPlugin {
	return newLocalAnalyzerPlugin("ci-posture", StageQuality, runCIPosture)
}

func runCIPosture(repoPath string, _ RepositoryMetadata) localPluginOutput {
	safeAnalyzer := NewSafeAnalyzer()
	workflowFiles := workflowFiles(repoPath)
	findings := []contracts.Finding{}

	if len(workflowFiles) == 0 {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeSecurity,
			SeverityMedium,
			"ci-posture",
			"ci-cd",
			stringPointer(".github/workflows"),
			nil,
			"No GitHub Actions workflows detected",
			"Add CI workflows that run tests, linting and security checks on pull requests.",
			0.8,
			map[string]any{"check": "missing-ci"},
		))
	}

	for _, relativePath := range workflowFiles {
		content, ok := readSmallTextFile(filepath.Join(repoPath, relativePath))
		if !ok {
			continue
		}
		lower := strings.ToLower(content)
		filePointer := stringPointer(relativePath)

		if strings.Contains(lower, "pull_request_target") {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityHigh,
				"ci-posture",
				"ci-cd",
				filePointer,
				nil,
				"Workflow uses pull_request_target",
				"Use pull_request for untrusted contributions, or isolate pull_request_target jobs from checkout and secret access.",
				0.85,
				map[string]any{"check": "pull-request-target"},
			))
		}

		if strings.Contains(lower, "permissions: write-all") {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityHigh,
				"ci-posture",
				"ci-cd",
				filePointer,
				nil,
				"Workflow grants write-all token permissions",
				"Set the minimum required permissions per job instead of broad write-all access.",
				0.9,
				map[string]any{"check": "write-all-permissions"},
			))
		}

		for _, line := range strings.Split(content, "\n") {
			trimmed := strings.TrimSpace(line)
			trimmed = strings.TrimSpace(strings.TrimPrefix(trimmed, "-"))
			if !strings.HasPrefix(trimmed, "uses:") {
				continue
			}
			actionRef := strings.Trim(strings.TrimSpace(strings.TrimPrefix(trimmed, "uses:")), `"'`)
			if actionRef == "" || strings.HasPrefix(actionRef, "./") || actionPinnedToSHA.MatchString(actionRef) {
				continue
			}
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityLow,
				"ci-posture",
				"ci-cd",
				filePointer,
				nil,
				"GitHub Action is not pinned to a commit SHA",
				"Pin third-party actions to immutable commit SHAs and review updates through dependency automation.",
				0.75,
				map[string]any{"check": "unpinned-action", "action": actionRef},
			))
		}

		if containsLiteralSecretAssignment(content) {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityHigh,
				"ci-posture",
				"ci-cd",
				filePointer,
				nil,
				"Workflow appears to define secret-like values inline",
				"Move secrets to GitHub Actions secrets or an external secret manager and rotate exposed values.",
				0.7,
				map[string]any{"check": "inline-secret-like-env"},
			))
		}
	}

	raw := map[string]any{
		"workflowFiles": workflowFiles,
		"findingCount":  len(findings),
	}

	return localPluginOutput{
		findings: findings,
		artifacts: []contracts.Artifact{
			rawJSONArtifact("ci-posture.json", raw),
		},
		rawSummary: map[string]any{
			"ciPostureFindings": len(findings),
			"workflowCount":     len(workflowFiles),
		},
		summary: summaryWithCount("CI/CD posture produced", len(findings)),
	}
}

func workflowFiles(repoPath string) []string {
	root := filepath.Join(repoPath, ".github", "workflows")
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}

	files := []string{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		extension := strings.ToLower(filepath.Ext(entry.Name()))
		if extension == ".yml" || extension == ".yaml" {
			files = append(files, filepath.ToSlash(filepath.Join(".github", "workflows", entry.Name())))
		}
	}
	return files
}

func containsLiteralSecretAssignment(content string) bool {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		lower := strings.ToLower(trimmed)
		if !strings.Contains(trimmed, ":") {
			continue
		}
		if !(strings.Contains(lower, "token") || strings.Contains(lower, "secret") || strings.Contains(lower, "password") || strings.Contains(lower, "api_key")) {
			continue
		}
		if strings.Contains(lower, "${{ secrets.") || strings.Contains(lower, "${{secrets.") {
			continue
		}
		parts := strings.SplitN(trimmed, ":", 2)
		if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
			return true
		}
	}
	return false
}
