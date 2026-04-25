'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useProject, useScan, useScanCompare } from '@/features/analyses/hooks';
import { RiskBadge } from '../ui/RiskBadge';

export function ScanCompare({ id }: { id: string }) {
  const scan = useScan(id);
  const projectId = scan.data?.scan.repository?.projectId ?? '';
  const project = useProject(projectId);

  const candidates = useMemo(
    () => (project.data?.scans ?? []).filter((candidate) => candidate.id !== id),
    [id, project.data?.scans],
  );
  const [selectedScanId, setSelectedScanId] = useState('');
  const previousScanId = selectedScanId || candidates[0]?.id || null;
  const compare = useScanCompare(id, previousScanId);

  if (scan.isLoading || project.isLoading) {
    return (
      <div className="rounded-md border border-[var(--border)] p-6">Loading comparison...</div>
    );
  }

  if (scan.isError || !scan.data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Scan comparison is unavailable.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Compare Scans</p>
            <h1 className="mt-2 text-3xl font-semibold">What changed since last scan</h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-200">
              Compare normalized fingerprints to separate new risk, resolved issues and unchanged
              findings.
            </p>
          </div>
          <Link
            href={`/dashboard/scans/${id}`}
            className="inline-flex h-11 items-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            Back to scan
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <select
            value={previousScanId ?? ''}
            onChange={(event) => setSelectedScanId(event.target.value)}
            className="h-11 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            {candidates.length === 0 ? (
              <option value="">No previous scans available</option>
            ) : (
              candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.branch} | {new Date(candidate.createdAt).toLocaleString()} |{' '}
                  {candidate.riskScore ?? '--'}/100
                </option>
              ))
            )}
          </select>
          <RiskBadge level={scan.data.scan.riskLevel} />
        </div>
      </section>

      {!previousScanId ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--muted)]">
          Run at least two scans for this project to compare changes over time.
        </div>
      ) : compare.isLoading ? (
        <div className="rounded-md border border-[var(--border)] p-6">Comparing scans...</div>
      ) : compare.isError || !compare.data ? (
        <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
          Comparison failed.
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Metric label="Risk Delta" value={formatDelta(compare.data.riskDelta)} />
            <Metric label="Added" value={compare.data.summary.added} />
            <Metric label="Resolved" value={compare.data.summary.resolved} />
            <Metric label="Unchanged" value={compare.data.summary.unchanged} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <FindingColumn title="Added Risk" findings={compare.data.added} tone="rose" />
            <FindingColumn title="Resolved" findings={compare.data.resolved} tone="emerald" />
            <FindingColumn title="Still Open" findings={compare.data.unchanged} tone="slate" />
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FindingColumn({
  title,
  findings,
  tone,
}: {
  title: string;
  findings: Array<{ id: string; severity: string; message: string; tool: string }>;
  tone: 'rose' | 'emerald' | 'slate';
}) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-900'
      : tone === 'emerald'
        ? 'border-emerald-900'
        : 'border-[var(--border)]';

  return (
    <section className={`rounded-md border ${toneClass} bg-[var(--panel)] p-5`}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      <div className="grid gap-3">
        {findings.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No findings.</p>
        ) : (
          findings.slice(0, 10).map((finding) => (
            <article key={finding.id} className="rounded-md bg-[#0b1018] p-3 text-sm">
              <p className="font-medium">{finding.message}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-[var(--muted)]">
                {finding.severity} | {finding.tool}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function formatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }
  return `${delta}`;
}
