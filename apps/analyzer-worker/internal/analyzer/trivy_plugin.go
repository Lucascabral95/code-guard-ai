package analyzer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type TrivyFindingsPlugin struct {
	executor sandbox.DockerExecutor
	image    string
}

type TrivySBOMPlugin struct {
	executor sandbox.DockerExecutor
	image    string
}

func NewTrivyFindingsPlugin(executor sandbox.DockerExecutor, image string) AnalyzerPlugin {
	return TrivyFindingsPlugin{
		executor: executor,
		image:    image,
	}
}

func NewTrivySBOMPlugin(executor sandbox.DockerExecutor, image string) AnalyzerPlugin {
	return TrivySBOMPlugin{
		executor: executor,
		image:    image,
	}
}

func (plugin TrivyFindingsPlugin) Name() string {
	return "trivy"
}

func (plugin TrivyFindingsPlugin) Stage() Stage {
	return StageDependencyScan
}

func (plugin TrivyFindingsPlugin) Run(
	ctx context.Context,
	repoPath string,
	_ RepositoryMetadata,
) (PluginRunResult, error) {
	runResult, err := runDockerPlugin(
		ctx,
		plugin.executor,
		repoPath,
		plugin.image,
		"fs",
		"--quiet",
		"--format",
		"json",
		"--scanners",
		"vuln,misconfig,secret,license",
		".",
	)
	if err != nil {
		return PluginRunResult{}, err
	}

	raw, err := parseJSONObject(runResult.Stdout)
	if err != nil {
		return PluginRunResult{}, fmt.Errorf("parse trivy findings output: %w", err)
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
		Artifacts: []contracts.Artifact{rawJSONArtifact("trivy.json", raw)},
	}, nil
}

func (plugin TrivyFindingsPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	findings := make([]contracts.Finding, 0)
	components := make([]contracts.Component, 0)
	vulnerabilities := make([]contracts.Vulnerability, 0)
	licenseRisks := make([]contracts.LicenseRisk, 0)

	for _, scanResult := range objectArrayValue(result.Raw, "Results") {
		target := stringFromMap(scanResult, "Target")
		resultType := strings.ToLower(stringFromMap(scanResult, "Type"))

		for _, vulnerability := range objectArrayValue(scanResult, "Vulnerabilities") {
			pkgName := stringFromMap(vulnerability, "PkgName")
			installedVersion := stringFromMap(vulnerability, "InstalledVersion")
			ecosystem := strings.ToLower(firstNonEmpty(stringFromMap(vulnerability, "PkgType"), resultType))
			severity := normalizeSeverity(stringFromMap(vulnerability, "Severity"), SeverityHigh)
			externalID := firstNonEmpty(
				stringFromMap(vulnerability, "VulnerabilityID"),
				stringFromMap(vulnerability, "ID"),
			)
			title := firstNonEmpty(stringFromMap(vulnerability, "Title"), externalID)
			description := firstNonEmpty(stringFromMap(vulnerability, "Description"), title)
			fixedVersion := stringFromMap(vulnerability, "FixedVersion")
			recommendation := trivyRecommendation(fixedVersion)
			cvss := trivyCVSS(vulnerability)

			if pkgName != "" {
				components = append(components, contracts.Component{
					Name:       pkgName,
					Version:    optionalString(installedVersion),
					Ecosystem:  optionalString(ecosystem),
					PackageURL: optionalString(stringFromMap(vulnerability, "PkgIdentifier")),
					Direct:     true,
				})
			}

			findings = append(findings, contracts.Finding{
				Type:           FindingTypeDependency,
				Severity:       severity,
				Fingerprint:    fingerprint(plugin.Name(), FindingTypeDependency, severity, pkgName, externalID),
				Category:       "supply-chain",
				Confidence:     floatPointer(0.9),
				CVE:            optionalString(externalID),
				CVSS:           cvss,
				Tool:           plugin.Name(),
				File:           optionalString(target),
				Message:        fmt.Sprintf("%s affects %s", title, pkgName),
				Recommendation: optionalString(recommendation),
				Raw:            vulnerability,
				Evidences: []contracts.Evidence{
					{
						Title: "Trivy vulnerability match",
						File:  optionalString(target),
						Raw:   vulnerability,
					},
				},
				Remediation: buildRemediation(recommendation, severity),
			})

			vulnerabilities = append(vulnerabilities, contracts.Vulnerability{
				ComponentName: optionalString(pkgName),
				Version:       optionalString(installedVersion),
				Ecosystem:     optionalString(ecosystem),
				Source:        plugin.Name(),
				ExternalID:    externalID,
				Severity:      severity,
				CVSS:          cvss,
				FixedVersion:  optionalString(fixedVersion),
				Title:         title,
				Description:   optionalString(description),
				URL:           optionalString(stringFromMap(vulnerability, "PrimaryURL")),
			})
		}

		for _, misconfiguration := range objectArrayValue(scanResult, "Misconfigurations") {
			severity := normalizeSeverity(stringFromMap(misconfiguration, "Severity"), SeverityMedium)
			title := firstNonEmpty(stringFromMap(misconfiguration, "Title"), stringFromMap(misconfiguration, "ID"))
			recommendation := firstNonEmpty(
				stringFromMap(misconfiguration, "Resolution"),
				"Review the infrastructure definition and align it with least-privilege defaults.",
			)

			findings = append(findings, contracts.Finding{
				Type:           FindingTypeSecurity,
				Severity:       severity,
				Fingerprint:    fingerprint(plugin.Name(), FindingTypeSecurity, severity, target, title),
				Category:       "iac",
				Confidence:     floatPointer(0.85),
				Tool:           plugin.Name(),
				File:           optionalString(target),
				Line:           trivyStartLine(misconfiguration),
				Message:        title,
				Recommendation: optionalString(recommendation),
				Raw:            misconfiguration,
				Evidences: []contracts.Evidence{
					{
						Title:     "Trivy misconfiguration",
						File:      optionalString(target),
						LineStart: trivyStartLine(misconfiguration),
						LineEnd:   trivyEndLine(misconfiguration),
						Raw:       misconfiguration,
					},
				},
				Remediation: buildRemediation(recommendation, severity),
			})
		}

		for _, secret := range objectArrayValue(scanResult, "Secrets") {
			severity := normalizeSeverity(stringFromMap(secret, "Severity"), SeverityHigh)
			title := firstNonEmpty(stringFromMap(secret, "Title"), stringFromMap(secret, "RuleID"))
			file := firstNonEmpty(stringFromMap(secret, "Target"), target)

			findings = append(findings, contracts.Finding{
				Type:           FindingTypeSecurity,
				Severity:       severity,
				Fingerprint:    fingerprint(plugin.Name(), FindingTypeSecurity, severity, file, title),
				Category:       "secrets",
				Confidence:     floatPointer(0.9),
				Tool:           plugin.Name(),
				File:           optionalString(file),
				Line:           trivyStartLine(secret),
				Message:        title,
				Recommendation: stringPointer("Rotate the exposed credential and move the secret to a managed secret store."),
				Raw:            secret,
				Evidences: []contracts.Evidence{
					{
						Title:     "Trivy secret match",
						File:      optionalString(file),
						LineStart: trivyStartLine(secret),
						LineEnd:   trivyEndLine(secret),
						Raw:       secret,
					},
				},
				Remediation: buildRemediation(
					"Rotate the leaked credential, purge it from source control and enforce secret scanning before merge.",
					severity,
				),
			})
		}

		for _, license := range objectArrayValue(scanResult, "Licenses") {
			pkgName := firstNonEmpty(stringFromMap(license, "PkgName"), target)
			licenseName := firstNonEmpty(
				stringFromMap(license, "Name"),
				stringFromMap(license, "License"),
			)
			if pkgName == "" || licenseName == "" {
				continue
			}

			risk := trivyLicenseRisk(licenseName)
			licenseRisks = append(licenseRisks, contracts.LicenseRisk{
				Component: pkgName,
				License:   licenseName,
				Risk:      risk,
				Policy:    optionalString("review-license-compatibility"),
			})
		}
	}

	status := toolRunStatusCompleted
	summary := summaryWithCount("Trivy produced", len(findings))
	errorMessage := ""
	exitCode := 0
	if result.ExitCode != nil {
		exitCode = *result.ExitCode
		if exitCode != 0 {
			status = toolRunStatusFailed
			errorMessage = strings.TrimSpace(result.Stderr)
			summary = "Trivy findings scan did not complete successfully."
		}
	}

	return contracts.AnalysisResult{
		Findings:        findings,
		Artifacts:       result.Artifacts,
		Components:      components,
		Vulnerabilities: vulnerabilities,
		LicenseRisks:    licenseRisks,
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
			"trivyFindings": len(findings),
		},
	}, nil
}

func (plugin TrivySBOMPlugin) Name() string {
	return "trivy-sbom"
}

func (plugin TrivySBOMPlugin) Stage() Stage {
	return StageSBOM
}

func (plugin TrivySBOMPlugin) Run(
	ctx context.Context,
	repoPath string,
	_ RepositoryMetadata,
) (PluginRunResult, error) {
	runResult, err := runDockerPlugin(
		ctx,
		plugin.executor,
		repoPath,
		plugin.image,
		"fs",
		"--quiet",
		"--format",
		"cyclonedx",
		".",
	)
	if err != nil {
		return PluginRunResult{}, err
	}

	raw, err := parseJSONObject(runResult.Stdout)
	if err != nil {
		return PluginRunResult{}, fmt.Errorf("parse trivy sbom output: %w", err)
	}

	return PluginRunResult{
		Tool:     plugin.Name(),
		Stage:    plugin.Stage(),
		Status:   toolRunStatusCompleted,
		Duration: time.Duration(runResult.DurationMs) * time.Millisecond,
		ExitCode: intPointer(runResult.ExitCode),
		Raw:      raw,
		Stdout:   runResult.Stdout,
		Stderr:   runResult.Stderr,
		Artifacts: []contracts.Artifact{
			{
				Kind:        "CYCLONEDX",
				Name:        "trivy-sbom.cdx.json",
				ContentType: "application/vnd.cyclonedx+json",
				Content:     raw,
			},
		},
	}, nil
}

func (plugin TrivySBOMPlugin) Normalize(result PluginRunResult) (contracts.AnalysisResult, error) {
	components := make([]contracts.Component, 0)
	licenseRisks := make([]contracts.LicenseRisk, 0)

	for _, component := range objectArrayValue(result.Raw, "components") {
		name := stringFromMap(component, "name")
		version := stringFromMap(component, "version")
		purl := stringFromMap(component, "purl")
		license := componentLicense(component)

		components = append(components, contracts.Component{
			Name:       name,
			Version:    optionalString(version),
			Ecosystem:  optionalString(componentEcosystem(purl)),
			PackageURL: optionalString(purl),
			License:    optionalString(license),
			Direct:     true,
		})

		if risk := trivyLicenseRisk(license); risk != "" {
			licenseRisks = append(licenseRisks, contracts.LicenseRisk{
				Component: name,
				License:   license,
				Risk:      risk,
				Policy:    optionalString("review-license-compatibility"),
			})
		}
	}

	status := toolRunStatusCompleted
	summary := fmt.Sprintf("Trivy SBOM produced %d component(s).", len(components))
	errorMessage := ""
	exitCode := 0
	if result.ExitCode != nil {
		exitCode = *result.ExitCode
		if exitCode != 0 {
			status = toolRunStatusFailed
			errorMessage = strings.TrimSpace(result.Stderr)
			summary = "Trivy SBOM generation did not complete successfully."
		}
	}

	return contracts.AnalysisResult{
		Artifacts:    result.Artifacts,
		Components:   components,
		LicenseRisks: licenseRisks,
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
			"sbomComponents": len(components),
		},
	}, nil
}

func trivyRecommendation(fixedVersion string) string {
	if fixedVersion != "" {
		return "Upgrade to " + fixedVersion + " or later and verify the fix in a follow-up scan."
	}
	return "Review the affected dependency or configuration and move to a patched or safer alternative."
}

func trivyCVSS(vulnerability map[string]any) *float64 {
	cvssMap := objectValue(vulnerability, "CVSS")
	for _, vendor := range []string{"nvd", "redhat", "ghsa"} {
		score := floatFromMap(objectValue(cvssMap, vendor), "V3Score")
		if score != nil {
			return score
		}
	}
	return nil
}

func trivyStartLine(raw map[string]any) *int {
	causeMetadata := objectValue(raw, "CauseMetadata")
	return intFromMap(causeMetadata, "StartLine")
}

func trivyEndLine(raw map[string]any) *int {
	causeMetadata := objectValue(raw, "CauseMetadata")
	return intFromMap(causeMetadata, "EndLine")
}

func trivyLicenseRisk(license string) string {
	risks := classifyLicenseRisk(license)
	if len(risks) == 0 {
		return ""
	}
	return risks[0].message
}

func componentLicense(component map[string]any) string {
	for _, licenseWrapper := range objectArrayValue(component, "licenses") {
		license := objectValue(licenseWrapper, "license")
		if id := stringFromMap(license, "id"); id != "" {
			return id
		}
		if name := stringFromMap(license, "name"); name != "" {
			return name
		}
	}
	return ""
}

func componentEcosystem(purl string) string {
	if purl == "" {
		return ""
	}
	trimmed := strings.TrimPrefix(purl, "pkg:")
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) == 0 {
		return ""
	}
	return parts[0]
}
