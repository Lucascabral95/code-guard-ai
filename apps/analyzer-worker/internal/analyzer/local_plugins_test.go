package analyzer

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCIPostureDetectsDangerousWorkflowPatterns(t *testing.T) {
	t.Parallel()

	repoPath := t.TempDir()
	workflowDir := filepath.Join(repoPath, ".github", "workflows")
	if err := os.MkdirAll(workflowDir, 0o755); err != nil {
		t.Fatal(err)
	}
	workflow := []byte(`
name: risky
on: pull_request_target
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`)
	if err := os.WriteFile(filepath.Join(workflowDir, "ci.yml"), workflow, 0o644); err != nil {
		t.Fatal(err)
	}

	output := runCIPosture(repoPath, RepositoryMetadata{})

	if len(output.findings) < 3 {
		t.Fatalf("expected risky workflow findings, got %d", len(output.findings))
	}
}

func TestDockerfilePostureDetectsPrivilegedComposeAndRootImage(t *testing.T) {
	t.Parallel()

	repoPath := t.TempDir()
	if err := os.WriteFile(filepath.Join(repoPath, "Dockerfile"), []byte("FROM node:latest\nCMD node server.js\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repoPath, "docker-compose.yml"), []byte("services:\n  app:\n    privileged: true\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	output := runDockerfilePosture(repoPath, RepositoryMetadata{})

	if len(output.findings) < 4 {
		t.Fatalf("expected Docker posture findings, got %d", len(output.findings))
	}
}

func TestPackageHealthDetectsLifecycleScriptsAndManagerDrift(t *testing.T) {
	t.Parallel()

	repoPath := t.TempDir()
	manifest := []byte(`{
		"name": "sample",
		"packageManager": "pnpm@9.0.0",
		"scripts": { "postinstall": "node scripts/setup.js" },
		"dependencies": { "left-pad": "*" }
	}`)
	if err := os.WriteFile(filepath.Join(repoPath, "package.json"), manifest, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repoPath, "package-lock.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}

	output := runPackageHealth(repoPath, RepositoryMetadata{Stack: "node"})

	if len(output.findings) < 3 {
		t.Fatalf("expected package health findings, got %d", len(output.findings))
	}
}

func TestLicensePolicyClassifiesRestrictedLicenses(t *testing.T) {
	t.Parallel()

	risks := classifyLicenseRisk("BUSL-1.1")

	if len(risks) != 1 {
		t.Fatalf("expected one restricted license risk, got %d", len(risks))
	}
	if risks[0].severity != SeverityHigh {
		t.Fatalf("expected high severity, got %s", risks[0].severity)
	}
}
