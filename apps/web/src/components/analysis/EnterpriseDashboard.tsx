'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePortfolioRisk, useProjects } from '@/features/analyses/hooks';
import { CategoryBars, RiskTrend, SeverityBars } from './EnterpriseCharts';
import { RiskBadge } from '../ui/RiskBadge';
import { StatusBadge } from '../ui/StatusBadge';

export function EnterpriseDashboard() {
  const portfolioRisk = usePortfolioRisk();
  const projects = useProjects();

  if (portfolioRisk.isLoading || projects.isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading portfolio...</div>;
  }

  if (portfolioRisk.isError || projects.isError || !portfolioRisk.data || !projects.data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Portfolio data is unavailable.
      </div>
    );
  }

  const data = portfolioRisk.data;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Projects" value={data.totals.projects} />
        <Metric label="Scans" value={data.totals.scans} />
        <Metric label="Open Findings" value={data.totals.openFindings} />
        <Metric label="Critical + High" value={data.totals.critical + data.totals.high} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Risk Trend">
          <RiskTrend snapshots={data.severityTrend} />
        </Panel>
        <Panel title="Open Findings">
          <SeverityBars totals={data.totals} />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Categories">
          <CategoryBars data={data.findingsByCategory} />
        </Panel>
        <Panel title="Latest Scans">
          <div className="grid gap-3">
            {data.latestScans.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No scans have run yet.</p>
            ) : (
              data.latestScans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/dashboard/scans/${scan.id}`}
                  className="rounded-md border border-[var(--border)] bg-[#0b1018] p-3 transition hover:border-[var(--accent)]"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {scan.repository?.repoUrl ?? 'Repository pending'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {scan.branch} | {new Date(scan.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={scan.status} />
                      <RiskBadge level={scan.riskLevel} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <span className="text-sm text-[var(--muted)]">Self-hosted portfolio view</span>
        </div>
        <div className="grid gap-4">
          {projects.data.length === 0 ? (
            <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-8 text-[var(--muted)]">
              No projects yet. Create a scan to import a public GitHub repository.
            </div>
          ) : (
            projects.data.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5 transition hover:border-[var(--accent)]"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {project.repositories?.[0]?.repoUrl ?? 'Repository not linked'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RiskBadge level={project.riskLevel} />
                    <span className="w-14 text-right text-sm text-[var(--muted)]">
                      {project.riskScore ?? '--'}/100
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      {children}
    </div>
  );
}
