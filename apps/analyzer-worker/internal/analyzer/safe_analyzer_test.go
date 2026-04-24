package analyzer

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

func TestSafeAnalyzerProducesEnterpriseEvidenceForNode(t *testing.T) {
	t.Parallel()

	repoPath := t.TempDir()
	writeFile(t, repoPath, "package.json", `{
		"name":"sample",
		"dependencies":{"left-pad":"*"},
		"devDependencies":{"typescript":"5.9.3"},
		"license":"GPL-3.0"
	}`)
	writeFile(t, repoPath, "tsconfig.json", `{"compilerOptions":{"strict":false}}`)
	writeFile(t, repoPath, "Dockerfile", "FROM node:latest\nCMD [\"node\", \"server.js\"]\n")

	result := NewSafeAnalyzer().Analyze(repoPath, "node")

	if len(result.ToolRuns) == 0 {
		t.Fatalf("expected tool run evidence")
	}
	if len(result.Components) != 2 {
		t.Fatalf("expected dependency components, got %d", len(result.Components))
	}
	if len(result.LicenseRisks) != 1 {
		t.Fatalf("expected copyleft license risk")
	}
	if !containsFinding(result.Findings, "No test script found") {
		t.Fatalf("expected missing test finding")
	}
	if !containsFinding(result.Findings, "TypeScript strict mode is disabled") {
		t.Fatalf("expected TypeScript strictness finding")
	}
	if !containsFinding(result.Findings, "Dependency left-pad uses an unbounded version range") {
		t.Fatalf("expected dependency range finding")
	}
	if result.RawSummary["externalCodeExecuted"] != false {
		t.Fatalf("safe analyzer must not execute external code")
	}
}

func TestSafeAnalyzerProducesDifferentEvidenceForDifferentRepos(t *testing.T) {
	t.Parallel()

	withIssues := t.TempDir()
	writeFile(t, withIssues, "package.json", `{"dependencies":{"pkg":"latest"}}`)

	withControls := t.TempDir()
	writeFile(t, withControls, "package.json", `{
		"scripts":{"test":"vitest","lint":"eslint ."},
		"dependencies":{"pkg":"1.2.3"},
		"engines":{"node":">=20"},
		"license":"MIT"
	}`)
	writeFile(t, withControls, "package-lock.json", "{}")
	if err := os.MkdirAll(filepath.Join(withControls, ".github", "workflows"), 0o755); err != nil {
		t.Fatal(err)
	}
	writeFile(t, withControls, "SECURITY.md", "# Security\n")

	issueResult := NewSafeAnalyzer().Analyze(withIssues, "node")
	controlResult := NewSafeAnalyzer().Analyze(withControls, "node")

	if len(issueResult.Findings) <= len(controlResult.Findings) {
		t.Fatalf("expected riskier fixture to produce more findings")
	}
}

func writeFile(t *testing.T, root string, relativePath string, content string) {
	t.Helper()

	path := filepath.Join(root, relativePath)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func containsFinding(findings []contracts.Finding, message string) bool {
	for _, finding := range findings {
		if finding.Message == message {
			return true
		}
	}
	return false
}
