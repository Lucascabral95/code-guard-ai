import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnalysis,
  createPolicy,
  createProject,
  createScan,
  compareScans,
  downloadScanReportPdf,
  getAnalysis,
  getExecutiveReport,
  getFinding,
  getPortfolioRisk,
  getProject,
  getProjectRiskHistory,
  getRemediationOverview,
  getRemediationPlan,
  getScan,
  listPolicies,
  listAnalyses,
  listProjects,
  updateFindingStatus,
  updatePolicy,
} from './api';
import type {
  CreateAnalysisRequest,
  CreatePolicyRequest,
  CreateProjectRequest,
  CreateScanRequest,
  UpdateFindingStatusRequest,
  UpdatePolicyRequest,
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
      await queryClient.invalidateQueries({ queryKey: ['remediation-overview'] });
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
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectRequest) => createProject(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
      await queryClient.invalidateQueries({ queryKey: ['remediation-overview'] });
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
      await queryClient.invalidateQueries({ queryKey: ['remediation-overview'] });
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

export function useExecutiveReport(id: string) {
  return useQuery({
    queryKey: ['scan-executive-report', id],
    queryFn: () => getExecutiveReport(id),
  });
}

export function useDownloadScanReportPdf() {
  return useMutation({
    mutationFn: (id: string) => downloadScanReportPdf(id),
  });
}

export function useRemediationPlan(id: string) {
  return useQuery({
    queryKey: ['scan-remediation-plan', id],
    queryFn: () => getRemediationPlan(id),
  });
}

export function useScanCompare(id: string, previousScanId: string | null) {
  return useQuery({
    queryKey: ['scan-compare', id, previousScanId],
    queryFn: () => compareScans(id, previousScanId ?? ''),
    enabled: Boolean(previousScanId),
  });
}

export function useProjectRiskHistory(id: string) {
  return useQuery({
    queryKey: ['project-risk-history', id],
    queryFn: () => getProjectRiskHistory(id),
    enabled: Boolean(id),
  });
}

export function usePortfolioRisk() {
  return useQuery({
    queryKey: ['portfolio-risk'],
    queryFn: getPortfolioRisk,
  });
}

export function useRemediationOverview() {
  return useQuery({
    queryKey: ['remediation-overview'],
    queryFn: getRemediationOverview,
  });
}

export function usePolicies() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: listPolicies,
  });
}

export function useFinding(id: string) {
  return useQuery({
    queryKey: ['finding', id],
    queryFn: () => getFinding(id),
    enabled: Boolean(id),
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePolicyRequest) => createPolicy(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePolicyRequest }) =>
      updatePolicy(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
  });
}

export function useUpdateFindingStatus(scanId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFindingStatusRequest }) =>
      updateFindingStatus(id, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['finding', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
      await queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
      await queryClient.invalidateQueries({ queryKey: ['remediation-overview'] });
    },
  });
}
