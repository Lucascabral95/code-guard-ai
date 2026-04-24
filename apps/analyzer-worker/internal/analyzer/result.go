package analyzer

import "github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"

const (
	FindingTypeTest           = "TEST"
	FindingTypeLint           = "LINT"
	FindingTypeDependency     = "DEPENDENCY"
	FindingTypeStackDetection = "STACK_DETECTION"
	FindingTypeSystem         = "SYSTEM"

	SeverityInfo   = "INFO"
	SeverityLow    = "LOW"
	SeverityMedium = "MEDIUM"
	SeverityHigh   = "HIGH"

	LogInfo  = "INFO"
	LogWarn  = "WARN"
	LogError = "ERROR"
)

func stringPointer(value string) *string {
	return &value
}

func infoLog(message string) contracts.AnalysisLog {
	return contracts.AnalysisLog{Level: LogInfo, Message: message}
}
