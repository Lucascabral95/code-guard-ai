'use client';

import Link from 'next/link';
import { useAnalyses } from '@/features/analyses/hooks';
import { RiskBadge } from '../ui/RiskBadge';
import { StatusBadge } from '../ui/StatusBadge';

export function AnalysisList() {
  const { data, isLoading, isError } = useAnalyses();

  if (isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading analyses...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Analysis data is unavailable.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-8 text-[var(--muted)]">
        No analyses have been created yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((analysis) => (
        <Link
          key={analysis.id}
          href={`/dashboard/analyses/${analysis.id}`}
          className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5 transition hover:border-[var(--accent)]"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="break-all font-medium">{analysis.repoUrl}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Branch {analysis.branch} · {new Date(analysis.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={analysis.status} />
              <RiskBadge level={analysis.riskLevel} />
              <span className="w-14 text-right text-sm text-[var(--muted)]">
                {analysis.riskScore ?? '--'}/100
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
