import { apiClient } from '@/lib/axios';
import type {
  Analysis,
  AnalysisDetailResponse,
  CreateAnalysisRequest,
  CreateProjectRequest,
  CreateScanRequest,
  Finding,
  FindingStatus,
  PortfolioRiskResponse,
  Project,
  ProjectDetailResponse,
  ScanDetailResponse,
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

export async function getPortfolioRisk(): Promise<PortfolioRiskResponse> {
  const response = await apiClient.get<PortfolioRiskResponse>('/dashboard/portfolio-risk');
  return response.data;
}

export async function updateFindingStatus(id: string, status: FindingStatus): Promise<Finding> {
  const response = await apiClient.post<Finding>(`/findings/${id}/status`, { status });
  return response.data;
}
