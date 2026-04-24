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
  type: FindingType;
  severity: Severity;
  tool: string;
  file: string | null;
  line: number | null;
  message: string;
  recommendation: string | null;
  raw: unknown | null;
  createdAt: string;
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
  findings: Finding[];
  logs: AnalysisLog[];
}
