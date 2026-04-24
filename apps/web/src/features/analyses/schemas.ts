import { z } from 'zod';

export const createAnalysisSchema = z.object({
  repoUrl: z.url('Enter a valid repository URL').refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && parsed.hostname === 'github.com';
    } catch {
      return false;
    }
  }, 'Only public github.com repositories are supported'),
  branch: z.string().trim().min(1).max(128).default('main'),
});

export type CreateAnalysisFormValues = z.input<typeof createAnalysisSchema>;
export type CreateAnalysisSubmitValues = z.output<typeof createAnalysisSchema>;
