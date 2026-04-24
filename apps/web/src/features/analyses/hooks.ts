import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnalysis,
  createProject,
  createScan,
  getAnalysis,
  getPortfolioRisk,
  getProject,
  getScan,
  listAnalyses,
  listProjects,
  updateFindingStatus,
} from './api';
import type {
  CreateAnalysisRequest,
  CreateProjectRequest,
  CreateScanRequest,
  FindingStatus,
} from './types';

export function useAnalyses() {
  return useQuery({
    queryKey: ['analyses'],
    queryFn: listAnalyses,
  });
}

export function useAnalysis(id: string) {
  return useQuery({
    queryKey: ['analysis', id],
    queryFn: () => getAnalysis(id),
    refetchInterval: (query) => {
      const status = query.state.data?.analysis.status;
      return status === 'QUEUED' || status === 'RUNNING' || status === 'PENDING' ? 3000 : false;
    },
  });
}

export function useCreateAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAnalysisRequest) => createAnalysis(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['analyses'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectRequest) => createProject(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
    },
  });
}

export function useCreateScan(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScanRequest) => createScan(projectId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
      await queryClient.invalidateQueries({ queryKey: ['analyses'] });
    },
  });
}

export function useScan(id: string) {
  return useQuery({
    queryKey: ['scan', id],
    queryFn: () => getScan(id),
    refetchInterval: (query) => {
      const status = query.state.data?.scan.status;
      return status === 'QUEUED' || status === 'RUNNING' || status === 'PENDING' ? 3000 : false;
    },
  });
}

export function usePortfolioRisk() {
  return useQuery({
    queryKey: ['portfolio-risk'],
    queryFn: getPortfolioRisk,
  });
}

export function useUpdateFindingStatus(scanId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FindingStatus }) =>
      updateFindingStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
      await queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
    },
  });
}
