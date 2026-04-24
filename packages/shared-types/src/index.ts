export enum AnalysisStatus {
  Pending = 'PENDING',
  Queued = 'QUEUED',
  Running = 'RUNNING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export enum RiskLevel {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
  Critical = 'CRITICAL',
}

export enum FindingType {
  Test = 'TEST',
  Lint = 'LINT',
  Security = 'SECURITY',
  Coverage = 'COVERAGE',
  Dependency = 'DEPENDENCY',
  StackDetection = 'STACK_DETECTION',
  System = 'SYSTEM',
}

export enum Severity {
  Info = 'INFO',
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
  Critical = 'CRITICAL',
}

export enum LogLevel {
  Info = 'INFO',
  Warn = 'WARN',
  Error = 'ERROR',
}

export enum FindingStatus {
  Open = 'OPEN',
  AcceptedRisk = 'ACCEPTED_RISK',
  FalsePositive = 'FALSE_POSITIVE',
  Fixed = 'FIXED',
}

export enum ToolRunStatus {
  Pending = 'PENDING',
  Running = 'RUNNING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Skipped = 'SKIPPED',
}

export enum ArtifactKind {
  NormalizedJson = 'NORMALIZED_JSON',
  Sarif = 'SARIF',
  CycloneDx = 'CYCLONEDX',
  MarkdownReport = 'MARKDOWN_REPORT',
  RawToolOutput = 'RAW_TOOL_OUTPUT',
}

export interface Analysis {
  id: string;
  repoUrl: string;
  branch: string;
  status: AnalysisStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  summary: string | null;
  detectedStack: string | null;
  safeMode: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Finding {
  id: string;
  analysisId: string;
  scanId: string | null;
  fingerprint: string | null;
  category: string | null;
  type: FindingType;
  severity: Severity;
  status: FindingStatus;
  confidence: number | null;
  cwe: string | null;
  cve: string | null;
  cvss: number | null;
  epss: number | null;
  tool: string;
  file: string | null;
  line: number | null;
  message: string;
  recommendation: string | null;
  raw: unknown | null;
  firstSeenAt: string;
  lastSeenAt: string;
  fixedAt: string | null;
  acceptedUntil: string | null;
  createdAt: string;
  evidences?: Evidence[];
  remediation?: Remediation | null;
}

export interface AnalysisLog {
  id: string;
  analysisId: string;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export interface CreateAnalysisRequest {
  repoUrl: string;
  branch?: string;
}

export interface AnalysisDetailResponse {
  analysis: Analysis;
  scan?: Scan | null;
  findings: Finding[];
  logs: AnalysisLog[];
  toolRuns?: ToolRun[];
  artifacts?: Artifact[];
  components?: Component[];
  licenseRisks?: LicenseRisk[];
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  createdAt: string;
  updatedAt: string;
  repositories?: Repository[];
  snapshots?: RiskSnapshot[];
}

export interface Repository {
  id: string;
  projectId: string;
  provider: string;
  repoUrl: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface Scan {
  id: string;
  repositoryId: string;
  analysisId: string | null;
  branch: string;
  commitSha: string | null;
  status: AnalysisStatus;
  currentStage: string | null;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  summary: string | null;
  detectedStack: string | null;
  safeMode: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  repository?: Repository;
}

export interface ToolRun {
  id: string;
  scanId: string;
  tool: string;
  stage: string;
  status: ToolRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  summary: string | null;
  errorMessage: string | null;
  raw: unknown | null;
}

export interface Evidence {
  id: string;
  findingId: string;
  title: string;
  snippet: string | null;
  file: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  raw: unknown | null;
  createdAt: string;
}

export interface Remediation {
  id: string;
  findingId: string;
  title: string;
  description: string;
  effort: string | null;
  priority: number;
  createdAt: string;
}

export interface Component {
  id: string;
  scanId: string;
  name: string;
  version: string | null;
  ecosystem: string | null;
  packageUrl: string | null;
  license: string | null;
  direct: boolean;
  createdAt: string;
  vulnerabilities?: Vulnerability[];
}

export interface Vulnerability {
  id: string;
  componentId: string | null;
  scanId: string | null;
  source: string;
  externalId: string;
  severity: Severity;
  cvss: number | null;
  epss: number | null;
  fixedVersion: string | null;
  title: string;
  description: string | null;
  url: string | null;
  createdAt: string;
}

export interface LicenseRisk {
  id: string;
  scanId: string;
  component: string;
  license: string;
  risk: string;
  policy: string | null;
  createdAt: string;
}

export interface Artifact {
  id: string;
  scanId: string;
  kind: ArtifactKind;
  name: string;
  contentType: string;
  path: string | null;
  content: unknown | null;
  createdAt: string;
}

export interface RiskSnapshot {
  id: string;
  projectId: string | null;
  scanId: string | null;
  score: number;
  level: RiskLevel;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  createdAt: string;
}

export interface CreateProjectRequest {
  name: string;
  repoUrl: string;
  defaultBranch?: string;
  description?: string;
}

export interface CreateScanRequest {
  branch?: string;
}

export interface ProjectDetailResponse {
  project: Project;
  repositories: Repository[];
  scans: Scan[];
  latestScan: Scan | null;
}

export interface ScanDetailResponse {
  scan: Scan;
  findings: Finding[];
  toolRuns: ToolRun[];
  artifacts: Artifact[];
  components: Component[];
  licenseRisks: LicenseRisk[];
}

export interface PortfolioRiskResponse {
  totals: {
    projects: number;
    scans: number;
    openFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  topRiskProjects: Project[];
  severityTrend: RiskSnapshot[];
  latestScans: Scan[];
  findingsByCategory: Array<{ category: string; count: number }>;
}
