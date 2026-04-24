package analyzer

import "github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"

const (
	FindingTypeTest           = "TEST"
	FindingTypeLint           = "LINT"
	FindingTypeSecurity       = "SECURITY"
	FindingTypeDependency     = "DEPENDENCY"
	FindingTypeStackDetection = "STACK_DETECTION"
	FindingTypeSystem         = "SYSTEM"

	SeverityInfo     = "INFO"
	SeverityLow      = "LOW"
	SeverityMedium   = "MEDIUM"
	SeverityHigh     = "HIGH"
	SeverityCritical = "CRITICAL"

	LogInfo  = "INFO"
	LogWarn  = "WARN"
	LogError = "ERROR"
)

func stringPointer(value string) *string {
	return &value
}

func intPointer(value int) *int {
	return &value
}

func floatPointer(value float64) *float64 {
	return &value
}

func infoLog(message string) contracts.AnalysisLog {
	return contracts.AnalysisLog{Level: LogInfo, Message: message}
}
