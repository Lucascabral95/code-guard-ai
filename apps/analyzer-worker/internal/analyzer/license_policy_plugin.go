package analyzer

import (
	"path/filepath"
	"strings"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

func NewLicensePolicyPlugin() AnalyzerPlugin {
	return newLocalAnalyzerPlugin("license-policy", StageDependencyScan, runLicensePolicy)
}

func runLicensePolicy(repoPath string, metadata RepositoryMetadata) localPluginOutput {
	if metadata.Stack != "node" || !fileExists(filepath.Join(repoPath, "package.json")) {
		return localPluginOutput{
			rawSummary: map[string]any{"licensePolicySkipped": true},
			summary:    "License policy checks skipped because package.json was not detected.",
		}
	}

	manifest, err := ParsePackageJSON(filepath.Join(repoPath, "package.json"))
	if err != nil {
		return localPluginOutput{
			rawSummary: map[string]any{"licensePolicyFindings": 0, "licensePolicyError": err.Error()},
			summary:    "License policy checks could not parse package.json.",
		}
	}

	safeAnalyzer := NewSafeAnalyzer()
	license := normalizedLicense(manifest.License)
	component := manifest.Name
	if component == "" {
		component = "root-package"
	}

	risks := classifyLicenseRisk(license)
	findings := []contracts.Finding{}
	licenseRisks := []contracts.LicenseRisk{}

	if len(risks) > 0 {
		for _, risk := range risks {
			licenseRisks = append(licenseRisks, contracts.LicenseRisk{
				Component: component,
				License:   firstNonEmpty(license, "UNLICENSED_OR_UNKNOWN"),
				Risk:      risk.message,
				Policy:    stringPointer(risk.policy),
			})
			findings = append(findings, safeAnalyzer.finding(
				FindingTypeSecurity,
				risk.severity,
				"license-policy",
				"license",
				stringPointer("package.json"),
				nil,
				risk.title,
				risk.recommendation,
				risk.confidence,
				map[string]any{"license": license, "policy": risk.policy},
			))
		}
	}

	raw := map[string]any{
		"license":      license,
		"findingCount": len(findings),
		"riskCount":    len(licenseRisks),
	}

	return localPluginOutput{
		findings:     findings,
		licenseRisks: licenseRisks,
		artifacts: []contracts.Artifact{
			rawJSONArtifact("license-policy.json", raw),
		},
		rawSummary: map[string]any{
			"licensePolicyFindings": len(findings),
			"licenseRiskCount":      len(licenseRisks),
		},
		summary: summaryWithCount("License policy produced", len(findings)),
	}
}

type licenseRiskRule struct {
	title          string
	message        string
	recommendation string
	policy         string
	severity       string
	confidence     float64
}

func classifyLicenseRisk(license string) []licenseRiskRule {
	upper := strings.ToUpper(strings.TrimSpace(license))
	if upper == "" || upper == "UNLICENSED" || upper == "UNKNOWN" {
		return []licenseRiskRule{{
			title:          "Package license is missing or unknown",
			message:        "License is missing or unknown; validate distribution and usage rights before release.",
			recommendation: "Declare an explicit SPDX license or document private/internal distribution constraints.",
			policy:         "require-explicit-license",
			severity:       SeverityMedium,
			confidence:     0.8,
		}}
	}

	rules := []licenseRiskRule{}
	if strings.Contains(upper, "AGPL") || strings.Contains(upper, "SSPL") {
		rules = append(rules, licenseRiskRule{
			title:          "Strong network copyleft license detected",
			message:        "Strong network copyleft license can introduce source-disclosure obligations for hosted services.",
			recommendation: "Review legal compatibility before distributing or hosting this software.",
			policy:         "block-network-copyleft",
			severity:       SeverityHigh,
			confidence:     0.9,
		})
	}
	if strings.Contains(upper, "GPL") && !strings.Contains(upper, "LGPL") && !strings.Contains(upper, "AGPL") {
		rules = append(rules, licenseRiskRule{
			title:          "Copyleft license detected",
			message:        "GPL-style copyleft license can affect redistribution obligations.",
			recommendation: "Validate license compatibility with the intended product distribution model.",
			policy:         "review-copyleft-licenses",
			severity:       SeverityMedium,
			confidence:     0.85,
		})
	}
	if strings.Contains(upper, "LGPL") {
		rules = append(rules, licenseRiskRule{
			title:          "Weak copyleft license detected",
			message:        "LGPL license needs compatibility review for linking and redistribution obligations.",
			recommendation: "Confirm linking model and attribution obligations before release.",
			policy:         "review-weak-copyleft-licenses",
			severity:       SeverityLow,
			confidence:     0.8,
		})
	}
	if strings.Contains(upper, "BUSL") || strings.Contains(upper, "BUSINESS SOURCE") || strings.Contains(upper, "COMMONS CLAUSE") {
		rules = append(rules, licenseRiskRule{
			title:          "Commercially restricted license detected",
			message:        "Commercial-use restriction detected; usage may be incompatible with product distribution.",
			recommendation: "Review commercial restrictions and replace the component if usage is not permitted.",
			policy:         "block-commercially-restricted-licenses",
			severity:       SeverityHigh,
			confidence:     0.9,
		})
	}

	return rules
}
