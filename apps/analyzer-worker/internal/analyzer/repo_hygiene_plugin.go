package analyzer

import (
	"os"
	"path/filepath"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

func NewRepoHygienePlugin() AnalyzerPlugin {
	return newLocalAnalyzerPlugin("repo-hygiene", StageScorecard, runRepoHygiene)
}

func runRepoHygiene(repoPath string, _ RepositoryMetadata) localPluginOutput {
	safeAnalyzer := NewSafeAnalyzer()
	findings := []contracts.Finding{}
	checks := map[string]bool{
		"securityPolicy": hasAnyFile(repoPath, "SECURITY.md", filepath.Join(".github", "SECURITY.md")),
		"codeowners":     hasAnyFile(repoPath, filepath.Join(".github", "CODEOWNERS"), "CODEOWNERS", filepath.Join("docs", "CODEOWNERS")),
		"dependabot":     hasAnyFile(repoPath, filepath.Join(".github", "dependabot.yml"), filepath.Join(".github", "dependabot.yaml")),
		"license":        hasAnyFile(repoPath, "LICENSE", "LICENSE.md", "COPYING"),
	}

	if !checks["securityPolicy"] {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeSecurity,
			SeverityLow,
			"repo-hygiene",
			"repo-hygiene",
			stringPointer("SECURITY.md"),
			nil,
			"No security policy found",
			"Add SECURITY.md with vulnerability reporting instructions and supported-version guidance.",
			0.85,
			map[string]any{"check": "security-policy"},
		))
	}
	if !checks["codeowners"] {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeSecurity,
			SeverityLow,
			"repo-hygiene",
			"repo-hygiene",
			stringPointer("CODEOWNERS"),
			nil,
			"No CODEOWNERS file found",
			"Add CODEOWNERS so critical paths require review from responsible maintainers.",
			0.8,
			map[string]any{"check": "codeowners"},
		))
	}
	if !checks["dependabot"] {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeDependency,
			SeverityMedium,
			"repo-hygiene",
			"supply-chain",
			stringPointer(".github/dependabot.yml"),
			nil,
			"No Dependabot configuration found",
			"Add Dependabot or an equivalent dependency update workflow for package and GitHub Actions updates.",
			0.8,
			map[string]any{"check": "dependency-updates"},
		))
	}
	if !checks["license"] {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeSecurity,
			SeverityLow,
			"repo-hygiene",
			"license",
			stringPointer("LICENSE"),
			nil,
			"No repository license file found",
			"Add an explicit license file so usage and distribution terms are auditable.",
			0.75,
			map[string]any{"check": "license-file"},
		))
	}

	raw := map[string]any{
		"checks":       checks,
		"findingCount": len(findings),
	}

	return localPluginOutput{
		findings: findings,
		artifacts: []contracts.Artifact{
			rawJSONArtifact("repo-hygiene.json", raw),
		},
		rawSummary: map[string]any{
			"repoHygieneFindings": len(findings),
			"repositoryChecks":    checks,
		},
		summary: summaryWithCount("Repository hygiene produced", len(findings)),
	}
}

func hasAnyFile(repoPath string, candidates ...string) bool {
	for _, candidate := range candidates {
		info, err := os.Stat(filepath.Join(repoPath, candidate))
		if err == nil && !info.IsDir() {
			return true
		}
	}
	return false
}
