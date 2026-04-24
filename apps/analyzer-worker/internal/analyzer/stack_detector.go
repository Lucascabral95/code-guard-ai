package analyzer

import (
	"os"
	"path/filepath"
)

func DetectStack(repoPath string) string {
	switch {
	case fileExists(filepath.Join(repoPath, "package.json")):
		return "node"
	case fileExists(filepath.Join(repoPath, "go.mod")):
		return "go"
	case fileExists(filepath.Join(repoPath, "requirements.txt")),
		fileExists(filepath.Join(repoPath, "pyproject.toml")):
		return "python"
	default:
		return "unknown"
	}
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
