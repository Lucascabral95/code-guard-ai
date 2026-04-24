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
	if parsed.Dependencies == nil {
		t.Fatalf("expected dependencies map to be initialized")
	}
}

func TestParsePackageJSONParsesDependencyInventory(t *testing.T) {
	t.Parallel()

	repoPath := t.TempDir()
	manifestPath := filepath.Join(repoPath, "package.json")
	manifest := []byte(`{
		"name":"sample",
		"dependencies":{"next":"16.0.0"},
		"devDependencies":{"typescript":"5.9.3"},
		"engines":{"node":">=20"},
		"license":"MIT"
	}`)
	if err := os.WriteFile(manifestPath, manifest, 0o644); err != nil {
		t.Fatal(err)
	}

	parsed, err := ParsePackageJSON(manifestPath)
	if err != nil {
		t.Fatal(err)
	}

	if parsed.Dependencies["next"] != "16.0.0" {
		t.Fatalf("expected dependency inventory to be parsed")
	}
	if parsed.DevDependencies["typescript"] != "5.9.3" {
		t.Fatalf("expected dev dependency inventory to be parsed")
	}
	if parsed.Engines["node"] != ">=20" {
		t.Fatalf("expected engines to be parsed")
	}
}
