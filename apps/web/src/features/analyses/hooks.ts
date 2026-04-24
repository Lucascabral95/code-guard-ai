import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAnalysis, getAnalysis, listAnalyses } from './api';
import type { CreateAnalysisRequest } from './types';

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
    },
  });
}
