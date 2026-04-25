package analyzer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type OSVPlugin struct {
	executor sandbox.DockerExecutor
	image    string
}

func NewOSVPlugin(executor sandbox.DockerExecutor, image string) AnalyzerPlugin {
	return OSVPlugin{
		executor: executor,
		image:    image,
	}
}

func (plugin OSVPlugin) Name() string {
	return "osv-scanner"
}

func (plugin OSVPlugin) Stage() Stage {
	return StageDependencyScan
}

func (plugin OSVPlugin) Run(
	ctx context.Context,
	repoPath string,
	_ RepositoryMetadata,
) (PluginRunResult, error) {
	runResult, err := runDockerPlugin(
		ctx,
		plugin.executor,
		repoPath,
		plugin.image,
		"scan",
		"-r",
		".",
		"--format",
		"json",
	)
	if err != nil {
		return PluginRunResult{}, err
	}

	raw, err := parseJSONObject(runResult.Stdout)
	if err != nil {
		return PluginRunResult{}, fmt.Errorf("parse osv-scanner output: %w", err)
	}

	return PluginRunResult{
		Tool:      plugin.Name(),
		Stage:     plugin.Stage(),
		Status:    toolRunStatusCompleted,
		Duration:  time.Duration(runResult.DurationMs) * time.Millisecond,
		ExitCode:  intPointer(runResult.ExitCode),
		Raw:       raw,
		Stdout:    runResult.Stdout,
		Stderr:    runResult.Stderr,
		Artifacts: []contracts.Artifact{rawJSONArtifact("osv-scanner.json", raw)},
	}, nil
}

func (plugin OSVPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	findings := make([]contracts.Finding, 0)
	components := make([]contracts.Component, 0)
	vulnerabilities := make([]contracts.Vulnerability, 0)

	for _, scanResult := range objectArrayValue(result.Raw, "results") {
		for _, pkg := range objectArrayValue(scanResult, "packages") {
			pkgInfo := objectValue(pkg, "package")
			name := firstNonEmpty(stringFromMap(pkgInfo, "name"), stringFromMap(pkg, "name"))
			version := firstNonEmpty(stringFromMap(pkg, "version"), stringFromMap(pkgInfo, "version"))
			ecosystem := firstNonEmpty(
				stringFromMap(pkgInfo, "ecosystem"),
				stringFromMap(pkg, "ecosystem"),
			)
			purl := firstNonEmpty(stringFromMap(pkg, "purl"), stringFromMap(pkgInfo, "purl"))

			if name != "" {
				components = append(components, contracts.Component{
					Name:       name,
					Version:    optionalString(version),
					Ecosystem:  optionalString(strings.ToLower(ecosystem)),
					PackageURL: optionalString(purl),
					Direct:     true,
				})
			}

			for _, vulnerability := range objectArrayValue(pkg, "vulnerabilities") {
				externalID := firstNonEmpty(
					stringFromMap(vulnerability, "id"),
					firstAlias(vulnerability),
				)
				title := firstNonEmpty(
					stringFromMap(vulnerability, "summary"),
					stringFromMap(vulnerability, "details"),
					externalID,
				)
				fixedVersion := osvFixedVersion(vulnerability)
				severity := osvSeverity(vulnerability)
				message := fmt.Sprintf("%s affects %s", externalID, name)
				if name == "" {
					message = title
				}

				findings = append(findings, contracts.Finding{
					Type:           FindingTypeDependency,
					Severity:       severity,
					Fingerprint:    fingerprint(plugin.Name(), FindingTypeDependency, severity, name, externalID),
					Category:       "supply-chain",
					Confidence:     floatPointer(0.9),
					CVE:            optionalString(externalID),
					Tool:           plugin.Name(),
					File:           optionalString(stringFromMap(scanResult, "source")),
					Message:        message,
					Recommendation: optionalString(osvRecommendation(fixedVersion)),
					Raw:            vulnerability,
					Evidences: []contracts.Evidence{
						{
							Title: "OSV dependency vulnerability",
							File:  optionalString(stringFromMap(scanResult, "source")),
							Raw:   vulnerability,
						},
					},
					Remediation: buildRemediation(osvRecommendation(fixedVersion), severity),
				})

				vulnerabilities = append(vulnerabilities, contracts.Vulnerability{
					ComponentName: optionalString(name),
					Version:       optionalString(version),
					Ecosystem:     optionalString(strings.ToLower(ecosystem)),
					Source:        plugin.Name(),
					ExternalID:    externalID,
					Severity:      severity,
					FixedVersion:  optionalString(fixedVersion),
					Title:         title,
					Description:   optionalString(stringFromMap(vulnerability, "details")),
					URL:           optionalString(firstNonEmpty(stringFromMap(vulnerability, "url"), aliasURL(vulnerability))),
				})
			}
		}
	}

	status := toolRunStatusCompleted
	summary := summaryWithCount("OSV Scanner produced", len(findings))
	errorMessage := ""
	exitCode := 0
	if result.ExitCode != nil {
		exitCode = *result.ExitCode
		if exitCode > 1 {
			status = toolRunStatusFailed
			errorMessage = strings.TrimSpace(result.Stderr)
			summary = "OSV Scanner did not complete successfully."
		}
	}

	return contracts.AnalysisResult{
		Findings:        findings,
		Artifacts:       result.Artifacts,
		Components:      components,
		Vulnerabilities: vulnerabilities,
		ToolRuns: []contracts.ToolRun{
			stageToolRun(
				plugin.Name(),
				plugin.Stage(),
				status,
				int(result.Duration.Milliseconds()),
				exitCode,
				summary,
				errorMessage,
				result.Raw,
			),
		},
		RawSummary: map[string]any{
			"osvFindings": len(findings),
		},
	}, nil
}

func firstAlias(vulnerability map[string]any) string {
	if aliases := stringSlice(vulnerability["aliases"]); len(aliases) > 0 {
		return aliases[0]
	}
	return ""
}

func aliasURL(vulnerability map[string]any) string {
	if databaseSpecific := objectValue(vulnerability, "database_specific"); databaseSpecific != nil {
		return stringFromMap(databaseSpecific, "url")
	}
	return ""
}

func osvSeverity(vulnerability map[string]any) string {
	if databaseSpecific := objectValue(vulnerability, "database_specific"); databaseSpecific != nil {
		if severity := stringFromMap(databaseSpecific, "severity"); severity != "" {
			return normalizeSeverity(severity, SeverityHigh)
		}
	}
	if fixedVersion := osvFixedVersion(vulnerability); fixedVersion != "" {
		return SeverityHigh
	}
	return SeverityMedium
}

func osvFixedVersion(vulnerability map[string]any) string {
	for _, affected := range objectArrayValue(vulnerability, "affected") {
		for _, item := range objectArrayValue(affected, "ranges") {
			for _, event := range objectArrayValue(item, "events") {
				if value := stringFromMap(event, "fixed"); value != "" {
					return value
				}
			}
		}
	}
	return ""
}

func osvRecommendation(fixedVersion string) string {
	if fixedVersion != "" {
		return "Upgrade to a fixed version such as " + fixedVersion + " and refresh the lockfile."
	}
	return "Review affected dependency ranges and move to a patched release before the next deployment."
}
