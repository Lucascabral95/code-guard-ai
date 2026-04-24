package analyzer

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParsePackageJSON(t *testing.T) {
	t.Parallel()

	repoPath := t.TempDir()
	manifestPath := filepath.Join(repoPath, "package.json")
	manifest := []byte(`{"scripts":{"test":"vitest","lint":"eslint ."}}`)
	if err := os.WriteFile(manifestPath, manifest, 0o644); err != nil {
		t.Fatal(err)
	}

	parsed, err := ParsePackageJSON(manifestPath)
	if err != nil {
		t.Fatal(err)
	}

	if parsed.Scripts["test"] != "vitest" {
		t.Fatalf("expected test script to be parsed")
	}
	if parsed.Scripts["lint"] != "eslint ." {
		t.Fatalf("expected lint script to be parsed")
	}
}

func TestParsePackageJSONInitializesMissingScripts(t *testing.T) {
	t.Parallel()

	repoPath := t.TempDir()
	manifestPath := filepath.Join(repoPath, "package.json")
	if err := os.WriteFile(manifestPath, []byte(`{"name":"sample"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	parsed, err := ParsePackageJSON(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Scripts == nil {
		t.Fatalf("expected scripts map to be initialized")
	}
}
