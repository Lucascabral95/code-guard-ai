package contracts

type AnalysisJob struct {
	AnalysisID string
	RepoURL    string
	Branch     string
	SafeMode   bool
}

type Finding struct {
	Type           string         `json:"type"`
	Severity       string         `json:"severity"`
	Tool           string         `json:"tool"`
	File           *string        `json:"file"`
	Line           *int           `json:"line"`
	Message        string         `json:"message"`
	Recommendation *string        `json:"recommendation"`
	Raw            map[string]any `json:"raw,omitempty"`
}

type AnalysisLog struct {
	Level   string `json:"level"`
	Message string `json:"message"`
}

type AnalysisResult struct {
	DetectedStack string         `json:"detectedStack"`
	Findings      []Finding      `json:"findings"`
	Logs          []AnalysisLog  `json:"logs"`
	RawSummary    map[string]any `json:"rawSummary"`
}

type FailAnalysisRequest struct {
	ErrorMessage string `json:"errorMessage"`
}
