package analyzer

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/sandbox"
	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

const (
	toolRunStatusCompleted = "COMPLETED"
	toolRunStatusFailed    = "FAILED"
	toolRunStatusSkipped   = "SKIPPED"
	toolRunStatusTimedOut  = "TIMED_OUT"
)

func mergeAnalysisResults(target *contracts.AnalysisResult, source contracts.AnalysisResult) {
	target.Findings = append(target.Findings, source.Findings...)
	target.Logs = append(target.Logs, source.Logs...)
	target.ToolRuns = append(target.ToolRuns, source.ToolRuns...)
	target.Artifacts = append(target.Artifacts, source.Artifacts...)
	target.Components = append(target.Components, source.Components...)
	target.Vulnerabilities = append(target.Vulnerabilities, source.Vulnerabilities...)
	target.LicenseRisks = append(target.LicenseRisks, source.LicenseRisks...)
	if target.RawSummary == nil {
		target.RawSummary = map[string]any{}
	}
	for key, value := range source.RawSummary {
		target.RawSummary[key] = value
	}
}

func dedupeFindings(findings []contracts.Finding) []contracts.Finding {
	seen := map[string]struct{}{}
	result := make([]contracts.Finding, 0, len(findings))
	for _, finding := range findings {
		key := finding.Fingerprint
		if key == "" {
			key = fingerprint(finding.Tool, finding.Type, finding.Severity, valueOrEmpty(finding.File), finding.Message)
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, finding)
	}
	return result
}

func dedupeComponents(components []contracts.Component) []contracts.Component {
	seen := map[string]struct{}{}
	result := make([]contracts.Component, 0, len(components))
	for _, component := range components {
		key := firstNonEmpty(component.Name, "") + "|" + valueOrEmpty(component.Version) + "|" + valueOrEmpty(component.Ecosystem)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, component)
	}
	return result
}

func dedupeLicenseRisks(items []contracts.LicenseRisk) []contracts.LicenseRisk {
	seen := map[string]struct{}{}
	result := make([]contracts.LicenseRisk, 0, len(items))
	for _, item := range items {
		key := item.Component + "|" + item.License + "|" + item.Risk
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, item)
	}
	return result
}

func dedupeVulnerabilities(items []contracts.Vulnerability) []contracts.Vulnerability {
	seen := map[string]struct{}{}
	result := make([]contracts.Vulnerability, 0, len(items))
	for _, item := range items {
		key := item.Source + "|" + item.ExternalID + "|" + valueOrEmpty(item.ComponentName) + "|" + valueOrEmpty(item.Version)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, item)
	}
	return result
}

func parseJSONObject(input string) (map[string]any, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return map[string]any{}, nil
	}

	var parsed map[string]any
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func parseJSONArray(input string) ([]any, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return []any{}, nil
	}

	var parsed []any
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func rawJSONArtifact(name string, raw map[string]any) contracts.Artifact {
	return contracts.Artifact{
		Kind:        "RAW_TOOL_OUTPUT",
		Name:        name,
		ContentType: "application/json",
		Content:     raw,
	}
}

func stageToolRun(
	tool string,
	stage Stage,
	status string,
	durationMs int,
	exitCode int,
	summary string,
	errorMessage string,
	raw map[string]any,
) contracts.ToolRun {
	run := contracts.ToolRun{
		Tool:       tool,
		Stage:      string(stage),
		Status:     status,
		DurationMs: intPointer(durationMs),
		ExitCode:   intPointer(exitCode),
		Raw:        raw,
	}
	if summary != "" {
		run.Summary = stringPointer(summary)
	}
	if errorMessage != "" {
		run.ErrorMessage = stringPointer(errorMessage)
	}
	return run
}

func pluginFailureResult(
	plugin AnalyzerPlugin,
	status string,
	message string,
) contracts.AnalysisResult {
	return contracts.AnalysisResult{
		Logs: []contracts.AnalysisLog{
			{Level: LogWarn, Message: fmt.Sprintf("%s plugin did not complete: %s", plugin.Name(), message)},
		},
		ToolRuns: []contracts.ToolRun{
			{
				Tool:         plugin.Name(),
				Stage:        string(plugin.Stage()),
				Status:       status,
				Summary:      stringPointer("Scanner execution did not complete."),
				ErrorMessage: stringPointer(message),
			},
		},
		RawSummary: map[string]any{
			plugin.Name() + "Status": status,
		},
	}
}

func runDockerPlugin(
	ctx context.Context,
	executor sandbox.DockerExecutor,
	repoPath string,
	image string,
	args ...string,
) (sandbox.DockerRunResult, error) {
	return executor.RunTool(ctx, repoPath, image, args...)
}

func normalizeSeverity(value string, fallback string) string {
	upper := strings.ToUpper(strings.TrimSpace(value))
	switch upper {
	case SeverityCritical, "ERROR", "BLOCKER":
		return SeverityCritical
	case SeverityHigh:
		return SeverityHigh
	case SeverityMedium, "WARNING", "WARN", "MODERATE":
		return SeverityMedium
	case SeverityLow, "UNKNOWN":
		return SeverityLow
	case SeverityInfo:
		return SeverityInfo
	default:
		if fallback != "" {
			return fallback
		}
		return SeverityMedium
	}
}

func objectValue(raw map[string]any, key string) map[string]any {
	if raw == nil {
		return nil
	}
	value, ok := raw[key]
	if !ok {
		return nil
	}
	typed, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	return typed
}

func objectArrayValue(raw map[string]any, key string) []map[string]any {
	if raw == nil {
		return nil
	}
	value, ok := raw[key]
	if !ok {
		return nil
	}
	items, ok := value.([]any)
	if !ok {
		return nil
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		typed, ok := item.(map[string]any)
		if ok {
			result = append(result, typed)
		}
	}
	return result
}

func stringFromMap(raw map[string]any, key string) string {
	if raw == nil {
		return ""
	}
	value, ok := raw[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	default:
		return fmt.Sprint(value)
	}
}

func intFromMap(raw map[string]any, key string) *int {
	if raw == nil {
		return nil
	}
	value, ok := raw[key]
	if !ok || value == nil {
		return nil
	}
	switch typed := value.(type) {
	case float64:
		return intPointer(int(typed))
	case int:
		return intPointer(typed)
	case json.Number:
		parsed, err := typed.Int64()
		if err == nil {
			return intPointer(int(parsed))
		}
	case string:
		var parsed int
		if _, err := fmt.Sscanf(typed, "%d", &parsed); err == nil {
			return intPointer(parsed)
		}
	}
	return nil
}

func floatFromMap(raw map[string]any, key string) *float64 {
	if raw == nil {
		return nil
	}
	value, ok := raw[key]
	if !ok || value == nil {
		return nil
	}
	switch typed := value.(type) {
	case float64:
		return floatPointer(typed)
	case int:
		return floatPointer(float64(typed))
	case json.Number:
		parsed, err := typed.Float64()
		if err == nil {
			return floatPointer(parsed)
		}
	}
	return nil
}

func stringSlice(raw any) []string {
	items, ok := raw.([]any)
	if !ok {
		return nil
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok && text != "" {
			result = append(result, text)
		}
	}
	return result
}

func summaryWithCount(prefix string, count int) string {
	return fmt.Sprintf("%s %d finding(s).", prefix, count)
}

func optionalString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return stringPointer(value)
}

func buildRemediation(description string, severity string) *contracts.Remediation {
	return &contracts.Remediation{
		Title:       "Recommended remediation",
		Description: description,
		Effort:      remediationEffort(severity),
		Priority:    remediationPriority(severity),
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
