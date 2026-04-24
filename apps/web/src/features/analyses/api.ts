import { apiClient } from '@/lib/axios';
import type { Analysis, AnalysisDetailResponse, CreateAnalysisRequest } from './types';

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
