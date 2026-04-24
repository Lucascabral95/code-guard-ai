package contracts

type AnalysisJob struct {
	AnalysisID string
	ScanID     string
	RepoURL    string
	Branch     string
	SafeMode   bool
}

type Evidence struct {
	Title     string         `json:"title"`
	Snippet   *string        `json:"snippet,omitempty"`
	File      *string        `json:"file,omitempty"`
	LineStart *int           `json:"lineStart,omitempty"`
	LineEnd   *int           `json:"lineEnd,omitempty"`
	Raw       map[string]any `json:"raw,omitempty"`
}

type Remediation struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Effort      *string `json:"effort,omitempty"`
	Priority    int     `json:"priority"`
}

type Finding struct {
	Type           string         `json:"type"`
	Severity       string         `json:"severity"`
	Fingerprint    string         `json:"fingerprint,omitempty"`
	Category       string         `json:"category,omitempty"`
	Confidence     *float64       `json:"confidence,omitempty"`
	CWE            *string        `json:"cwe,omitempty"`
	CVE            *string        `json:"cve,omitempty"`
	CVSS           *float64       `json:"cvss,omitempty"`
	EPSS           *float64       `json:"epss,omitempty"`
	Tool           string         `json:"tool"`
	File           *string        `json:"file"`
	Line           *int           `json:"line"`
	Message        string         `json:"message"`
	Recommendation *string        `json:"recommendation"`
	Raw            map[string]any `json:"raw,omitempty"`
	Evidences      []Evidence     `json:"evidences,omitempty"`
	Remediation    *Remediation   `json:"remediation,omitempty"`
}

type ToolRun struct {
	Tool         string         `json:"tool"`
	Stage        string         `json:"stage"`
	Status       string         `json:"status"`
	DurationMs   *int           `json:"durationMs,omitempty"`
	ExitCode     *int           `json:"exitCode,omitempty"`
	Summary      *string        `json:"summary,omitempty"`
	ErrorMessage *string        `json:"errorMessage,omitempty"`
	Raw          map[string]any `json:"raw,omitempty"`
}

type Artifact struct {
	Kind        string         `json:"kind"`
	Name        string         `json:"name"`
	ContentType string         `json:"contentType"`
	Path        *string        `json:"path,omitempty"`
	Content     map[string]any `json:"content,omitempty"`
}

type Component struct {
	Name       string  `json:"name"`
	Version    *string `json:"version,omitempty"`
	Ecosystem  *string `json:"ecosystem,omitempty"`
	PackageURL *string `json:"packageUrl,omitempty"`
	License    *string `json:"license,omitempty"`
	Direct     bool    `json:"direct"`
}

type LicenseRisk struct {
	Component string  `json:"component"`
	License   string  `json:"license"`
	Risk      string  `json:"risk"`
	Policy    *string `json:"policy,omitempty"`
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
	ToolRuns      []ToolRun      `json:"toolRuns,omitempty"`
	Artifacts     []Artifact     `json:"artifacts,omitempty"`
	Components    []Component    `json:"components,omitempty"`
	LicenseRisks  []LicenseRisk  `json:"licenseRisks,omitempty"`
}

type FailAnalysisRequest struct {
	ErrorMessage string `json:"errorMessage"`
}
