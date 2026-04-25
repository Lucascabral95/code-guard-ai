'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useProjectRiskHistory } from '@/features/analyses/hooks';
import { RiskTrend } from './EnterpriseCharts';
import { RiskBadge } from '../ui/RiskBadge';

export function ProjectRisk({ id }: { id: string }) {
  const history = useProjectRiskHistory(id);

  if (history.isLoading) {
    return (
      <div className="rounded-md border border-[var(--border)] p-6">Loading risk history...</div>
    );
  }

  if (history.isError || !history.data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Risk history is unavailable.
      </div>
    );
  }

  const latest = history.data.snapshots.at(-1);

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Risk History</p>
            <h1 className="mt-2 text-3xl font-semibold">{history.data.project.name}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-200">
              Historical snapshots show whether remediation work is reducing open risk or creating
              new exposure over time.
            </p>
          </div>
          <Link
            href={`/dashboard/projects/${id}`}
            className="inline-flex h-11 items-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            Back to project
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Current Level" value={<RiskBadge level={latest?.level ?? null} />} />
          <Metric label="Current Score" value={`${latest?.score ?? '--'}/100`} />
          <Metric label="Snapshots" value={history.data.snapshots.length} />
          <Metric label="Last Total Findings" value={latest ? totalFindings(latest) : 0} />
        </div>
      </section>

      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Score Trend
        </h2>
        <RiskTrend snapshots={history.data.snapshots} />
      </section>

      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Snapshot Timeline
        </h2>
        <div className="grid gap-3">
          {history.data.trend.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No risk snapshots yet.</p>
          ) : (
            history.data.trend.map((point) => (
              <div
                key={`${point.createdAt}-${point.score}`}
                className="grid gap-3 rounded-md bg-[#0b1018] p-4 text-sm md:grid-cols-[1fr_auto_auto]"
              >
                <span>{new Date(point.createdAt).toLocaleString()}</span>
                <RiskBadge level={point.level} />
                <span className="text-right tabular-nums text-[var(--muted)]">
                  {point.score}/100 | {point.totalFindings} findings
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <div className="mt-2 min-h-7 text-lg font-semibold">{value}</div>
    </div>
  );
}

function totalFindings(snapshot: {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}) {
  return snapshot.critical + snapshot.high + snapshot.medium + snapshot.low + snapshot.info;
}
