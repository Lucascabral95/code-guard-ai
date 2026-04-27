package analyzer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

const maxSafeScanFileSize = 256 * 1024

type SafeAnalyzer struct{}

func NewSafeAnalyzer() SafeAnalyzer {
	return SafeAnalyzer{}
}

func (safeAnalyzer SafeAnalyzer) Analyze(repoPath string, stack string) contracts.AnalysisResult {
	findings := []contracts.Finding{}
	toolRuns := []contracts.ToolRun{}
	artifacts := []contracts.Artifact{}
	components := []contracts.Component{}
	licenseRisks := []contracts.LicenseRisk{}
	logs := []contracts.AnalysisLog{infoLog("Safe analysis mode enabled")}
	rawSummary := map[string]any{
		"testsDetected":        nil,
		"lintConfigured":       nil,
		"securityIssues":       0,
		"installationErrors":   0,
		"componentsDetected":   0,
		"licenseRiskCount":     0,
		"secretCandidates":     0,
		"iacFindings":          0,
		"scorecardWarnings":    0,
		"toolExecutionMode":    "safe",
		"externalCodeExecuted": false,
	}

	findings = append(findings, safeAnalyzer.finding(
		FindingTypeStackDetection,
		SeverityInfo,
		"stack-detector",
		"inventory",
		nil,
		nil,
		"Detected repository stack: "+stack,
		"Use this as routing evidence for deeper sandboxed scanners.",
		0.95,
		nil,
	))
	toolRuns = append(toolRuns, completedToolRun("stack-detector", "detect", "Repository stack detected without executing project code."))

	if stack == "node" {
		nodeResult := safeAnalyzer.analyzeNode(repoPath)
		findings = append(findings, nodeResult.findings...)
		toolRuns = append(toolRuns, nodeResult.toolRuns...)
		components = append(components, nodeResult.components...)
		licenseRisks = append(licenseRisks, nodeResult.licenseRisks...)
		artifacts = append(artifacts, nodeResult.artifacts...)
		for key, value := range nodeResult.rawSummary {
			rawSummary[key] = value
		}
	} else {
		toolRuns = append(toolRuns, skippedToolRun("node-quality", "quality", "Node.js quality checks skipped because package.json was not detected."))
	}

	repositoryFindings, repositoryToolRuns, repositoryArtifacts, repositorySummary := safeAnalyzer.analyzeRepositoryPosture(repoPath)
	findings = append(findings, repositoryFindings...)
	toolRuns = append(toolRuns, repositoryToolRuns...)
	artifacts = append(artifacts, repositoryArtifacts...)
	for key, value := range repositorySummary {
		rawSummary[key] = value
	}

	findings = dedupeFindings(findings)
	components = dedupeComponents(components)
	licenseRisks = dedupeLicenseRisks(licenseRisks)
	rawSummary["securityIssues"] = countSecurityFindings(findings)
	rawSummary["componentsDetected"] = len(components)
	rawSummary["licenseRiskCount"] = len(licenseRisks)
	rawSummary["toolCoverage"] = summarizeToolCoverage(toolRuns)

	logs = append(logs, infoLog("Safe analysis produced normalized enterprise evidence"))
	return contracts.AnalysisResult{
		DetectedStack: stack,
		Findings:      findings,
		Logs:          logs,
		RawSummary:    rawSummary,
		ToolRuns:      toolRuns,
		Artifacts:     artifacts,
		Components:    components,
		LicenseRisks:  licenseRisks,
	}
}

type nodeSafeResult struct {
	findings     []contracts.Finding
	toolRuns     []contracts.ToolRun
	components   []contracts.Component
	licenseRisks []contracts.LicenseRisk
	artifacts    []contracts.Artifact
	rawSummary   map[string]any
}

func (safeAnalyzer SafeAnalyzer) analyzeNode(repoPath string) nodeSafeResult {
	manifestPath := filepath.Join(repoPath, "package.json")
	manifest, err := ParsePackageJSON(manifestPath)
	if err != nil {
		return nodeSafeResult{
			findings: []contracts.Finding{
				safeAnalyzer.finding(
					FindingTypeSystem,
					SeverityHigh,
					"safe-analyzer",
					"system",
					stringPointer("package.json"),
					nil,
					"package.json could not be parsed",
					"Fix package.json syntax before running deeper analysis.",
					0.9,
					map[string]any{"error": err.Error()},
				),
			},
			toolRuns: []contracts.ToolRun{
				failedToolRun("node-quality", "quality", "package.json parsing failed", err.Error()),
			},
			rawSummary: map[string]any{"installationErrors": 1},
		}
	}

	findings := []contracts.Finding{}
	toolRuns := []contracts.ToolRun{
		completedToolRun("node-quality", "quality", "package.json, scripts, lockfiles and TypeScript settings inspected in safe mode."),
		completedToolRun("osv-safe", "dependency-scan", "Dependency inventory built from package.json without network calls."),
		completedToolRun("trivy-safe", "sbom", "CycloneDX-style component inventory generated from manifest metadata."),
	}
	rawSummary := map[string]any{
		"testsDetected":      scriptExists(manifest, "test"),
		"lintConfigured":     scriptExists(manifest, "lint"),
		"packageManager":     detectPackageManager(repoPath),
		"typescriptDetected": fileExists(filepath.Join(repoPath, "tsconfig.json")),
	}

	if !scriptExists(manifest, "test") {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeTest,
			SeverityMedium,
			"node-quality",
			"quality",
			stringPointer("package.json"),
			nil,
			"No test script found",
			"Add a deterministic test script so CI and local scans can verify regressions.",
			0.9,
			map[string]any{"script": "test"},
		))
	}

	if !scriptExists(manifest, "lint") {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeLint,
			SeverityLow,
			"node-quality",
			"quality",
			stringPointer("package.json"),
			nil,
			"No lint script found",
			"Add a lint script and run it in CI before enabling stricter policy gates.",
			0.85,
			map[string]any{"script": "lint"},
		))
	}

	if len(manifest.Dependencies)+len(manifest.DevDependencies) > 0 && detectPackageManager(repoPath) == "unknown" {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeDependency,
			SeverityMedium,
			"node-quality",
			"supply-chain",
			stringPointer("package.json"),
			nil,
			"Dependencies are declared without a committed lockfile",
			"Commit npm, pnpm, yarn or bun lockfiles so dependency scans are reproducible.",
			0.85,
			map[string]any{"dependencyCount": len(manifest.Dependencies) + len(manifest.DevDependencies)},
		))
	}

	if multipleLockfiles(repoPath) {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeDependency,
			SeverityLow,
			"node-quality",
			"supply-chain",
			nil,
			nil,
			"Multiple package-manager lockfiles detected",
			"Keep one lockfile aligned with the package manager used in CI.",
			0.75,
			map[string]any{"packageManager": detectPackageManager(repoPath)},
		))
	}

	if _, ok := manifest.Engines["node"]; !ok {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeDependency,
			SeverityLow,
			"node-quality",
			"supply-chain",
			stringPointer("package.json"),
			nil,
			"Node.js engine version is not pinned",
			"Declare engines.node to reduce runtime drift between local, CI and production environments.",
			0.7,
			nil,
		))
	}

	if fileExists(filepath.Join(repoPath, "tsconfig.json")) && tsconfigStrictDisabled(filepath.Join(repoPath, "tsconfig.json")) {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeLint,
			SeverityMedium,
			"node-quality",
			"quality",
			stringPointer("tsconfig.json"),
			nil,
			"TypeScript strict mode is disabled",
			"Enable strict mode or document a phased migration plan for strict compiler checks.",
			0.8,
			map[string]any{"compilerOption": "strict"},
		))
	}

	components := componentsFromManifest(manifest)
	licenseRisks := licenseRisksFromManifest(manifest)
	findings = append(findings, dependencyRangeFindings(safeAnalyzer, manifest)...)

	artifacts := []contracts.Artifact{
		{
			Kind:        "RAW_TOOL_OUTPUT",
			Name:        "safe-node-inventory.json",
			ContentType: "application/json",
			Content: map[string]any{
				"packageManager": detectPackageManager(repoPath),
				"scripts":        manifest.Scripts,
				"componentCount": len(components),
			},
		},
	}

	return nodeSafeResult{
		findings:     findings,
		toolRuns:     toolRuns,
		components:   components,
		licenseRisks: licenseRisks,
		artifacts:    artifacts,
		rawSummary:   rawSummary,
	}
}

func (safeAnalyzer SafeAnalyzer) analyzeRepositoryPosture(repoPath string) ([]contracts.Finding, []contracts.ToolRun, []contracts.Artifact, map[string]any) {
	findings := []contracts.Finding{}
	toolRuns := []contracts.ToolRun{
		completedToolRun("semgrep-safe", "sast", "Safe static heuristics inspected repository text files without executing code."),
		completedToolRun("trivy-safe", "iac", "Docker, Compose, Terraform, Kubernetes and GitHub Actions posture inspected in safe mode."),
		completedToolRun("scorecard-safe", "scorecard", "OpenSSF Scorecard-style repository posture checks were approximated offline."),
	}
	artifacts := []contracts.Artifact{}
	summary := map[string]any{}

	secretFindings := safeAnalyzer.secretFindings(repoPath)
	findings = append(findings, secretFindings...)
	summary["secretCandidates"] = len(secretFindings)

	iacFindings := safeAnalyzer.iacFindings(repoPath)
	findings = append(findings, iacFindings...)
	summary["iacFindings"] = len(iacFindings)

	scorecardFindings := safeAnalyzer.scorecardFindings(repoPath)
	findings = append(findings, scorecardFindings...)
	summary["scorecardWarnings"] = len(scorecardFindings)

	for _, plugin := range []AnalyzerPlugin{
		NewCIPosturePlugin(),
		NewRepoHygienePlugin(),
		NewDockerfilePosturePlugin(),
		NewLicensePolicyPlugin(),
		NewPackageHealthPlugin(),
	} {
		runResult, err := plugin.Run(context.Background(), repoPath, RepositoryMetadata{
			Stack:    DetectStack(repoPath),
			SafeMode: true,
		})
		if err != nil {
			toolRuns = append(toolRuns, failedToolRun(plugin.Name(), string(plugin.Stage()), "Safe local posture plugin failed", err.Error()))
			continue
		}
		normalized, err := plugin.Normalize(runResult)
		if err != nil {
			toolRuns = append(toolRuns, failedToolRun(plugin.Name(), string(plugin.Stage()), "Safe local posture normalization failed", err.Error()))
			continue
		}
		findings = append(findings, normalized.Findings...)
		toolRuns = append(toolRuns, normalized.ToolRuns...)
		artifacts = append(artifacts, normalized.Artifacts...)
		for key, value := range normalized.RawSummary {
			summary[key] = value
		}
	}

	return findings, toolRuns, artifacts, summary
}

func (safeAnalyzer SafeAnalyzer) secretFindings(repoPath string) []contracts.Finding {
	findings := []contracts.Finding{}
	for _, relativePath := range discoverSafeScanFiles(repoPath) {
		content, ok := readSmallTextFile(filepath.Join(repoPath, relativePath))
		if !ok {
			continue
		}
		lower := strings.ToLower(content)
		if strings.Contains(lower, "private_key") || strings.Contains(lower, "api_key") || strings.Contains(lower, "secret_key") || strings.Contains(lower, "password=") {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityHigh,
				"semgrep-safe",
				"secrets",
				stringPointer(relativePath),
				nil,
				"Potential secret-like value detected in repository text",
				"Move secrets to a secret manager and rotate any exposed credentials before enabling automated remediation.",
				0.6,
				map[string]any{"heuristic": "secret-keyword"},
			))
			if len(findings) >= 5 {
				break
			}
		}
	}
	return findings
}

func (safeAnalyzer SafeAnalyzer) iacFindings(repoPath string) []contracts.Finding {
	findings := []contracts.Finding{}
	dockerfiles := []string{"Dockerfile", "dockerfile"}
	for _, name := range dockerfiles {
		path := filepath.Join(repoPath, name)
		content, ok := readSmallTextFile(path)
		if !ok {
			continue
		}
		if strings.Contains(strings.ToLower(content), ":latest") {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityMedium,
				"trivy-safe",
				"iac",
				stringPointer(name),
				nil,
				"Docker image tag uses latest",
				"Pin base images to immutable versions or digests to make builds reproducible.",
				0.8,
				map[string]any{"rule": "dockerfile-latest-tag"},
			))
		}
		if !strings.Contains(strings.ToLower(content), "\nuser ") {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				SeverityMedium,
				"trivy-safe",
				"iac",
				stringPointer(name),
				nil,
				"Dockerfile does not switch to a non-root user",
				"Create and use an unprivileged runtime user in the final image stage.",
				0.75,
				map[string]any{"rule": "dockerfile-root-user"},
			))
		}
	}

	composePath := filepath.Join(repoPath, "docker-compose.yml")
	if content, ok := readSmallTextFile(composePath); ok && strings.Contains(strings.ToLower(content), "privileged: true") {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeSecurity,
			SeverityHigh,
			"trivy-safe",
			"iac",
			stringPointer("docker-compose.yml"),
			nil,
			"Compose service runs with privileged mode enabled",
			"Remove privileged mode or isolate it behind explicit local-only profiles.",
			0.8,
			map[string]any{"rule": "compose-privileged"},
		))
	}

	return findings
}

func (safeAnalyzer SafeAnalyzer) scorecardFindings(repoPath string) []contracts.Finding {
	findings := []contracts.Finding{}
	if !dirExists(filepath.Join(repoPath, ".github", "workflows")) {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeSecurity,
			SeverityMedium,
			"scorecard-safe",
			"scorecard",
			stringPointer(".github/workflows"),
			nil,
			"No GitHub Actions workflows detected",
			"Add CI workflows that run tests, linting and security checks on pull requests.",
			0.7,
			map[string]any{"check": "CI-Tests"},
		))
	}

	if !fileExists(filepath.Join(repoPath, "SECURITY.md")) && !fileExists(filepath.Join(repoPath, ".github", "SECURITY.md")) {
		findings = append(findings, safeAnalyzer.finding(
			FindingTypeSecurity,
			SeverityLow,
			"scorecard-safe",
			"scorecard",
			stringPointer("SECURITY.md"),
			nil,
			"No security policy found",
			"Add SECURITY.md with vulnerability reporting and supported-version guidance.",
			0.75,
			map[string]any{"check": "Security-Policy"},
		))
	}

	return findings
}

func (safeAnalyzer SafeAnalyzer) finding(
	findingType string,
	severity string,
	tool string,
	category string,
	file *string,
	line *int,
	message string,
	recommendation string,
	confidence float64,
	raw map[string]any,
) contracts.Finding {
	evidenceTitle := message
	evidence := contracts.Evidence{
		Title:     evidenceTitle,
		File:      file,
		LineStart: line,
		LineEnd:   line,
		Raw:       raw,
	}
	return contracts.Finding{
		Type:           findingType,
		Severity:       severity,
		Fingerprint:    fingerprint(tool, findingType, severity, valueOrEmpty(file), message),
		Category:       category,
		Confidence:     floatPointer(confidence),
		Tool:           tool,
		File:           file,
		Line:           line,
		Message:        message,
		Recommendation: stringPointer(recommendation),
		Raw:            raw,
		Evidences:      []contracts.Evidence{evidence},
		Remediation: &contracts.Remediation{
			Title:       "Recommended remediation",
			Description: recommendation,
			Effort:      remediationEffort(severity),
			Priority:    remediationPriority(severity),
		},
	}
}

func dependencyRangeFindings(safeAnalyzer SafeAnalyzer, manifest PackageJSON) []contracts.Finding {
	findings := []contracts.Finding{}
	for name, version := range mergeDependencies(manifest) {
		if version == "*" || strings.EqualFold(version, "latest") {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeDependency,
				SeverityHigh,
				"osv-safe",
				"supply-chain",
				stringPointer("package.json"),
				nil,
				"Dependency "+name+" uses an unbounded version range",
				"Pin dependencies to audited version ranges and let lockfile updates happen through controlled automation.",
				0.85,
				map[string]any{"dependency": name, "version": version},
			))
		}
		if strings.HasPrefix(version, "github:") || strings.Contains(version, "git+") {
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeDependency,
				SeverityMedium,
				"osv-safe",
				"supply-chain",
				stringPointer("package.json"),
				nil,
				"Dependency "+name+" is sourced directly from Git",
				"Prefer registry releases with immutable versions unless the Git dependency is explicitly reviewed.",
				0.75,
				map[string]any{"dependency": name, "version": version},
			))
		}
	}
	return findings
}

func componentsFromManifest(manifest PackageJSON) []contracts.Component {
	components := make([]contracts.Component, 0, len(manifest.Dependencies)+len(manifest.DevDependencies))
	for name, version := range manifest.Dependencies {
		components = append(components, componentFromDependency(name, version, true))
	}
	for name, version := range manifest.DevDependencies {
		components = append(components, componentFromDependency(name, version, false))
	}
	sort.Slice(components, func(i, j int) bool {
		return components[i].Name < components[j].Name
	})
	return components
}

func componentFromDependency(name string, version string, direct bool) contracts.Component {
	cleanVersion := strings.TrimLeft(version, "^~>=< ")
	return contracts.Component{
		Name:       name,
		Version:    stringPointer(cleanVersion),
		Ecosystem:  stringPointer("npm"),
		PackageURL: stringPointer("pkg:npm/" + name + "@" + cleanVersion),
		Direct:     direct,
	}
}

func licenseRisksFromManifest(manifest PackageJSON) []contracts.LicenseRisk {
	license := normalizedLicense(manifest.License)
	risks := classifyLicenseRisk(license)
	if len(risks) == 0 {
		return nil
	}

	component := manifest.Name
	if component == "" {
		component = "root-package"
	}

	items := make([]contracts.LicenseRisk, 0, len(risks))
	for _, risk := range risks {
		items = append(items, contracts.LicenseRisk{
			Component: component,
			License:   firstNonEmpty(license, "UNLICENSED_OR_UNKNOWN"),
			Risk:      risk.message,
			Policy:    stringPointer(risk.policy),
		})
	}
	return items
}

func detectPackageManager(repoPath string) string {
	switch {
	case fileExists(filepath.Join(repoPath, "pnpm-lock.yaml")):
		return "pnpm"
	case fileExists(filepath.Join(repoPath, "yarn.lock")):
		return "yarn"
	case fileExists(filepath.Join(repoPath, "package-lock.json")):
		return "npm"
	case fileExists(filepath.Join(repoPath, "bun.lockb")), fileExists(filepath.Join(repoPath, "bun.lock")):
		return "bun"
	default:
		return "unknown"
	}
}

func multipleLockfiles(repoPath string) bool {
	count := 0
	for _, name := range []string{"pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb", "bun.lock"} {
		if fileExists(filepath.Join(repoPath, name)) {
			count++
		}
	}
	return count > 1
}

func scriptExists(manifest PackageJSON, name string) bool {
	value, ok := manifest.Scripts[name]
	return ok && strings.TrimSpace(value) != ""
}

func tsconfigStrictDisabled(path string) bool {
	content, ok := readSmallTextFile(path)
	if !ok {
		return false
	}
	var parsed struct {
		CompilerOptions map[string]any `json:"compilerOptions"`
	}
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return false
	}
	return parsed.CompilerOptions["strict"] == false
}

func mergeDependencies(manifest PackageJSON) map[string]string {
	dependencies := map[string]string{}
	for name, version := range manifest.Dependencies {
		dependencies[name] = version
	}
	for name, version := range manifest.DevDependencies {
		dependencies[name] = version
	}
	return dependencies
}

func discoverSafeScanFiles(repoPath string) []string {
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
		if len(files) >= 1000 {
			return filepath.SkipDir
		}
		relativePath, err := filepath.Rel(repoPath, path)
		if err != nil {
			return nil
		}
		if isTextLikeFile(relativePath) {
			files = append(files, filepath.ToSlash(relativePath))
		}
		return nil
	})
	sort.Strings(files)
	return files
}

func shouldSkipDirectory(name string) bool {
	switch name {
	case ".git", "node_modules", ".next", "dist", "build", "coverage", "vendor":
		return true
	default:
		return false
	}
}

func isTextLikeFile(path string) bool {
	extension := strings.ToLower(filepath.Ext(path))
	switch extension {
	case ".env", ".js", ".jsx", ".ts", ".tsx", ".json", ".yml", ".yaml", ".toml", ".tf", ".md", ".go", ".py", ".java", ".rb", ".php", ".cs":
		return true
	default:
		return strings.EqualFold(filepath.Base(path), "Dockerfile")
	}
}

func readSmallTextFile(path string) (string, bool) {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() || info.Size() > maxSafeScanFileSize {
		return "", false
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", false
	}
	return string(content), true
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func normalizedLicense(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case map[string]any:
		if licenseType, ok := typed["type"].(string); ok {
			return licenseType
		}
	}
	return ""
}

func completedToolRun(tool string, stage string, summary string) contracts.ToolRun {
	return contracts.ToolRun{
		Tool:    tool,
		Stage:   stage,
		Status:  "COMPLETED",
		Summary: stringPointer(summary),
	}
}

func skippedToolRun(tool string, stage string, summary string) contracts.ToolRun {
	return contracts.ToolRun{
		Tool:    tool,
		Stage:   stage,
		Status:  "SKIPPED",
		Summary: stringPointer(summary),
	}
}

func failedToolRun(tool string, stage string, summary string, err string) contracts.ToolRun {
	return contracts.ToolRun{
		Tool:         tool,
		Stage:        stage,
		Status:       "FAILED",
		Summary:      stringPointer(summary),
		ErrorMessage: stringPointer(err),
	}
}

func countSecurityFindings(findings []contracts.Finding) int {
	count := 0
	for _, finding := range findings {
		if finding.Type == FindingTypeSecurity || finding.Severity == SeverityHigh || finding.Severity == SeverityCritical {
			count++
		}
	}
	return count
}

func summarizeToolCoverage(toolRuns []contracts.ToolRun) map[string]int {
	coverage := map[string]int{
		"enabled":   len(toolRuns),
		"completed": 0,
		"failed":    0,
		"skipped":   0,
	}
	for _, toolRun := range toolRuns {
		switch toolRun.Status {
		case toolRunStatusCompleted:
			coverage["completed"]++
		case toolRunStatusFailed, toolRunStatusTimedOut:
			coverage["failed"]++
		case toolRunStatusSkipped:
			coverage["skipped"]++
		}
	}
	return coverage
}

func fingerprint(parts ...string) string {
	hash := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(hash[:])
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func remediationEffort(severity string) *string {
	switch severity {
	case SeverityCritical, SeverityHigh:
		return stringPointer("medium")
	case SeverityMedium:
		return stringPointer("small")
	default:
		return stringPointer("low")
	}
}

func remediationPriority(severity string) int {
	switch severity {
	case SeverityCritical:
		return 1
	case SeverityHigh:
		return 2
	case SeverityMedium:
		return 3
	default:
		return 4
	}
}
