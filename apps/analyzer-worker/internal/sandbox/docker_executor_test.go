package sandbox

import (
	"testing"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/config"
)

func TestRepoMountWithSharedVolume(t *testing.T) {
	t.Parallel()

	executor := NewDockerExecutor(config.Config{
		ScannerSharedVolume:  "codeguard_scanner_workspace",
		ScannerWorkspacePath: "/workspace",
	})

	repoMount, workDir, err := executor.repoMount("/tmp/codeguard/analysis-123")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if repoMount != "codeguard_scanner_workspace:/workspace:ro" {
		t.Fatalf("unexpected repo mount: %s", repoMount)
	}
	if workDir != "/workspace/analysis-123" {
		t.Fatalf("unexpected workdir: %s", workDir)
	}
}

func TestRepoMountWithBindMount(t *testing.T) {
	t.Parallel()

	executor := NewDockerExecutor(config.Config{
		ScannerWorkspacePath: "/workspace",
	})

	repoMount, workDir, err := executor.repoMount("/tmp/codeguard/analysis-123")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if repoMount != "/tmp/codeguard/analysis-123:/workspace/repo:ro" {
		t.Fatalf("unexpected repo mount: %s", repoMount)
	}
	if workDir != "/workspace/repo" {
		t.Fatalf("unexpected workdir: %s", workDir)
	}
}
