'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useCreateScan, useProject } from '@/features/analyses/hooks';
import { RiskTrend } from './EnterpriseCharts';
import { Button } from '../ui/Button';
import { RiskBadge } from '../ui/RiskBadge';
import { StatusBadge } from '../ui/StatusBadge';

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useProject(id);
  const createScan = useCreateScan(id);
  const [branch, setBranch] = useState('');

  if (isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading project...</div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Project data is unavailable.
      </div>
    );
  }

  const defaultBranch = data.repositories[0]?.defaultBranch ?? 'main';

  async function runScan() {
    const result = await createScan.mutateAsync({ branch: branch || defaultBranch });
    router.push(`/dashboard/scans/${result.scan.id}`);
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{data.project.name}</h1>
            <p className="mt-2 break-all text-[var(--muted)]">
              {data.repositories[0]?.repoUrl ?? 'Repository not linked'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_auto]">
            <input
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder={defaultBranch}
              className="h-11 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button onClick={() => void runScan()} disabled={createScan.isPending}>
              {createScan.isPending ? 'Starting...' : 'Run Scan'}
            </Button>
            <Link
              href={`/dashboard/projects/${id}/risk`}
              className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] sm:col-span-2"
            >
              Risk history
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Risk Level" value={<RiskBadge level={data.project.riskLevel} />} />
          <Metric label="Risk Score" value={`${data.project.riskScore ?? '--'}/100`} />
          <Metric label="Scans" value={data.scans.length} />
          <Metric label="Default Branch" value={defaultBranch} />
        </div>
      </section>

      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Historical Risk
        </h2>
        <RiskTrend snapshots={data.project.snapshots ?? []} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Scan Timeline</h2>
        <div className="grid gap-3">
          {data.scans.length === 0 ? (
            <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--muted)]">
              No scans have been created for this project yet.
            </div>
          ) : (
            data.scans.map((scan) => (
              <Link
                key={scan.id}
                href={`/dashboard/scans/${scan.id}`}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent)]"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{scan.branch}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {scan.currentStage ?? 'queued'} | {new Date(scan.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={scan.status} />
                    <RiskBadge level={scan.riskLevel} />
                    <span className="w-14 text-right text-sm text-[var(--muted)]">
                      {scan.riskScore ?? '--'}/100
                    </span>
                  </div>
                </div>
              </Link>
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
