package analyzer

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

func NewDockerfilePosturePlugin() AnalyzerPlugin {
	return newLocalAnalyzerPlugin("dockerfile-posture", StageIaC, runDockerfilePosture)
}

func runDockerfilePosture(repoPath string, _ RepositoryMetadata) localPluginOutput {
	safeAnalyzer := NewSafeAnalyzer()
	findings := []contracts.Finding{}
	files := dockerPostureFiles(repoPath)

	for _, relativePath := range files {
		content, ok := readSmallTextFile(filepath.Join(repoPath, relativePath))
		if !ok {
			continue
		}
		lower := strings.ToLower(content)
		filePointer := stringPointer(relativePath)

		if strings.EqualFold(filepath.Base(relativePath), "Dockerfile") || strings.Contains(strings.ToLower(filepath.Base(relativePath)), "dockerfile") {
			if strings.Contains(lower, ":latest") {
				findings = append(findings, safeAnalyzer.finding(
					FindingTypeSecurity,
					SeverityMedium,
					"dockerfile-posture",
					"docker",
					filePointer,
					nil,
					"Docker image tag uses latest",
					"Pin base images to immutable versions or digests to make builds reproducible.",
					0.85,
					map[string]any{"check": "latest-tag"},
				))
			}
			if !containsDockerUserInstruction(lower) {
				findings = append(findings, safeAnalyzer.finding(
					FindingTypeSecurity,
					SeverityMedium,
					"dockerfile-posture",
					"docker",
					filePointer,
					nil,
					"Dockerfile does not switch to a non-root user",
					"Create and use an unprivileged runtime user in the final image stage.",
					0.8,
					map[string]any{"check": "missing-non-root-user"},
				))
			}
			if !strings.Contains(lower, "healthcheck") {
				findings = append(findings, safeAnalyzer.finding(
					FindingTypeSecurity,
					SeverityLow,
					"dockerfile-posture",
					"docker",
					filePointer,
					nil,
					"Dockerfile has no healthcheck",
					"Add a lightweight healthcheck or ensure orchestration probes cover runtime readiness.",
					0.65,
					map[string]any{"check": "missing-healthcheck"},
				))
			}
		}

		if isComposeFile(relativePath) {
			if strings.Contains(lower, "privileged: true") {
				findings = append(findings, safeAnalyzer.finding(
					FindingTypeSecurity,
					SeverityHigh,
					"dockerfile-posture",
					"iac",
					filePointer,
					nil,
					"Compose service runs with privileged mode enabled",
					"Remove privileged mode or isolate it behind explicit local-only profiles.",
					0.85,
					map[string]any{"check": "compose-privileged"},
				))
			}
			if strings.Contains(lower, "/var/run/docker.sock") {
				findings = append(findings, safeAnalyzer.finding(
					FindingTypeSecurity,
					SeverityHigh,
					"dockerfile-posture",
					"iac",
					filePointer,
					nil,
					"Compose mounts the Docker socket",
					"Avoid mounting the Docker socket by default; isolate it behind explicit scanner/admin profiles.",
					0.85,
					map[string]any{"check": "docker-socket-mount"},
				))
			}
			if strings.Contains(lower, "- /:/") || strings.Contains(lower, "source: /") {
				findings = append(findings, safeAnalyzer.finding(
					FindingTypeSecurity,
					SeverityHigh,
					"dockerfile-posture",
					"iac",
					filePointer,
					nil,
					"Compose appears to mount the host root filesystem",
					"Remove host root mounts or restrict them to read-only observability profiles with documented risk.",
					0.75,
					map[string]any{"check": "host-root-mount"},
				))
			}
		}
	}

	raw := map[string]any{"files": files, "findingCount": len(findings)}
	return localPluginOutput{
		findings: findings,
		artifacts: []contracts.Artifact{
			rawJSONArtifact("dockerfile-posture.json", raw),
		},
		rawSummary: map[string]any{
			"dockerPostureFindings": len(findings),
			"dockerFilesInspected":  len(files),
		},
		summary: summaryWithCount("Docker/IaC posture produced", len(findings)),
	}
}

func dockerPostureFiles(repoPath string) []string {
	files := []string{}
	_ = filepath.WalkDir(repoPath, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if entry.IsDir() {
			if shouldSkipDirectory(entry.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		relativePath, err := filepath.Rel(repoPath, path)
		if err != nil {
			return nil
		}
		relativePath = filepath.ToSlash(relativePath)
		base := strings.ToLower(filepath.Base(relativePath))
		if strings.Contains(base, "dockerfile") || isComposeFile(relativePath) {
			files = append(files, relativePath)
		}
		return nil
	})
	return files
}

func containsDockerUserInstruction(content string) bool {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			continue
		}
		if strings.HasPrefix(trimmed, "user ") {
			return !strings.Contains(trimmed, " root")
		}
	}
	return false
}

func isComposeFile(path string) bool {
	base := strings.ToLower(filepath.Base(path))
	return base == "docker-compose.yml" ||
		base == "docker-compose.yaml" ||
		strings.HasPrefix(base, "compose.") && (strings.HasSuffix(base, ".yml") || strings.HasSuffix(base, ".yaml"))
}
