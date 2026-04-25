import { apiClient } from '@/lib/axios';
import type {
  Analysis,
  AnalysisDetailResponse,
  CreatePolicyRequest,
  CreateAnalysisRequest,
  CreateProjectRequest,
  CreateScanRequest,
  ExecutiveReportResponse,
  Finding,
  FindingDetailResponse,
  Policy,
  PortfolioRiskResponse,
  Project,
  ProjectDetailResponse,
  ProjectRiskHistoryResponse,
  RemediationOverviewResponse,
  RemediationPlanResponse,
  ScanDetailResponse,
  ScanCompareResponse,
  UpdateFindingStatusRequest,
  UpdatePolicyRequest,
} from './types';

export async function listAnalyses(): Promise<Analysis[]> {
  const response = await apiClient.get<Analysis[]>('/analyses');
  return response.data;
}

export async function getAnalysis(id: string): Promise<AnalysisDetailResponse> {
  const response = await apiClient.get<AnalysisDetailResponse>(`/analyses/${id}`);
  return response.data;
}

export async function createAnalysis(input: CreateAnalysisRequest): Promise<Analysis> {
  const response = await apiClient.post<Analysis>('/analyses', input);
  return response.data;
}

export async function listProjects(): Promise<Project[]> {
  const response = await apiClient.get<Project[]>('/projects');
  return response.data;
}

export async function createProject(input: CreateProjectRequest): Promise<Project> {
  const response = await apiClient.post<Project>('/projects', input);
  return response.data;
}

export async function getProject(id: string): Promise<ProjectDetailResponse> {
  const response = await apiClient.get<ProjectDetailResponse>(`/projects/${id}`);
  return response.data;
}

export async function createScan(
  projectId: string,
  input: CreateScanRequest,
): Promise<ScanDetailResponse> {
  const response = await apiClient.post<ScanDetailResponse>(`/projects/${projectId}/scans`, input);
  return response.data;
}

export async function getScan(id: string): Promise<ScanDetailResponse> {
  const response = await apiClient.get<ScanDetailResponse>(`/scans/${id}`);
  return response.data;
}

export async function getExecutiveReport(id: string): Promise<ExecutiveReportResponse> {
  const response = await apiClient.get<ExecutiveReportResponse>(`/scans/${id}/report/executive`);
  return response.data;
}

export async function getRemediationPlan(id: string): Promise<RemediationPlanResponse> {
  const response = await apiClient.get<RemediationPlanResponse>(`/scans/${id}/remediation-plan`);
  return response.data;
}

export async function compareScans(
  id: string,
  previousScanId: string,
): Promise<ScanCompareResponse> {
  const response = await apiClient.get<ScanCompareResponse>(
    `/scans/${id}/compare/${previousScanId}`,
  );
  return response.data;
}

export async function getProjectRiskHistory(id: string): Promise<ProjectRiskHistoryResponse> {
  const response = await apiClient.get<ProjectRiskHistoryResponse>(`/projects/${id}/risk-history`);
  return response.data;
}

export async function getPortfolioRisk(): Promise<PortfolioRiskResponse> {
  const response = await apiClient.get<PortfolioRiskResponse>('/dashboard/portfolio-risk');
  return response.data;
}

export async function getRemediationOverview(): Promise<RemediationOverviewResponse> {
  const response = await apiClient.get<RemediationOverviewResponse>('/dashboard/remediation');
  return response.data;
}

export async function listPolicies(): Promise<Policy[]> {
  const response = await apiClient.get<Policy[]>('/policies');
  return response.data;
}

export async function createPolicy(input: CreatePolicyRequest): Promise<Policy> {
  const response = await apiClient.post<Policy>('/policies', input);
  return response.data;
}

export async function updatePolicy(id: string, input: UpdatePolicyRequest): Promise<Policy> {
  const response = await apiClient.put<Policy>(`/policies/${id}`, input);
  return response.data;
}

export async function getFinding(id: string): Promise<FindingDetailResponse> {
  const response = await apiClient.get<FindingDetailResponse>(`/findings/${id}`);
  return response.data;
}

export async function updateFindingStatus(
  id: string,
  input: UpdateFindingStatusRequest,
): Promise<Finding> {
  const response = await apiClient.post<Finding>(`/findings/${id}/status`, input);
  return response.data;
}
