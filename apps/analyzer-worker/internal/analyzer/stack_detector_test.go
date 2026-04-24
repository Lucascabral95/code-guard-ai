package analyzer

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectStack(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		fileName string
		want     string
	}{
		{name: "node", fileName: "package.json", want: "node"},
		{name: "go", fileName: "go.mod", want: "go"},
		{name: "python requirements", fileName: "requirements.txt", want: "python"},
		{name: "python pyproject", fileName: "pyproject.toml", want: "python"},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			repoPath := t.TempDir()
			if err := os.WriteFile(filepath.Join(repoPath, test.fileName), []byte("{}"), 0o644); err != nil {
				t.Fatal(err)
			}

			if got := DetectStack(repoPath); got != test.want {
				t.Fatalf("expected %s, got %s", test.want, got)
			}
		})
	}
}

func TestDetectStackUnknown(t *testing.T) {
	t.Parallel()

	if got := DetectStack(t.TempDir()); got != "unknown" {
		t.Fatalf("expected unknown, got %s", got)
	}
}
