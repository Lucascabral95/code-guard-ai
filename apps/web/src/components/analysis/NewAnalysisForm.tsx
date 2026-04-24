'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useCreateAnalysis } from '@/features/analyses/hooks';
import {
  createAnalysisSchema,
  CreateAnalysisFormValues,
  CreateAnalysisSubmitValues,
} from '@/features/analyses/schemas';
import { Button } from '../ui/Button';

export function NewAnalysisForm() {
  const router = useRouter();
  const createAnalysis = useCreateAnalysis();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAnalysisFormValues, unknown, CreateAnalysisSubmitValues>({
    resolver: zodResolver(createAnalysisSchema),
    defaultValues: {
      repoUrl: '',
      branch: 'main',
    },
  });

  async function onSubmit(values: CreateAnalysisSubmitValues) {
    const analysis = await createAnalysis.mutateAsync(values);
    router.push(`/dashboard/analyses/${analysis.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-2xl rounded-md border border-[var(--border)] bg-[var(--panel)] p-6"
    >
      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Repository URL</span>
          <input
            {...register('repoUrl')}
            placeholder="https://github.com/vercel/next.js"
            className="h-11 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          {errors.repoUrl && (
            <span className="text-sm text-rose-300">{errors.repoUrl.message}</span>
          )}
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Branch</span>
          <input
            {...register('branch')}
            className="h-11 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          {errors.branch && <span className="text-sm text-rose-300">{errors.branch.message}</span>}
        </label>

        {createAnalysis.isError && (
          <div className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-100">
            Could not create the scan.
          </div>
        )}

        <Button type="submit" disabled={createAnalysis.isPending}>
          {createAnalysis.isPending ? 'Creating...' : 'Create Scan'}
        </Button>
      </div>
    </form>
  );
}
