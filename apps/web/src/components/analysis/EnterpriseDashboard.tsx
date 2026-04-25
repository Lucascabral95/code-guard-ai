'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PortfolioRiskResponse, Project } from '@/features/analyses/types';
import { usePortfolioRisk, useProjects } from '@/features/analyses/hooks';
import {
  AgingBuckets,
  CategoryBars,
  LicenseDistribution,
  RiskTrend,
  SeverityBars,
  ToolHealth,
} from './EnterpriseCharts';
import { RiskBadge } from '../ui/RiskBadge';
import { StatusBadge } from '../ui/StatusBadge';

const emptyPortfolio: PortfolioRiskResponse = {
  totals: {
    projects: 0,
    scans: 0,
    openFindings: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  },
  topRiskProjects: [],
  severityTrend: [],
  latestScans: [],
  findingsByCategory: [],
  toolHealth: [],
  licenseDistribution: [],
  aging: {
    under7Days: 0,
    between7And30Days: 0,
    over30Days: 0,
  },
};

export function EnterpriseDashboard() {
  const portfolioRisk = usePortfolioRisk();
  const projects = useProjects();

  const data = portfolioRisk.data ?? emptyPortfolio;
  const projectList = projects.data ?? [];
  const hasError = portfolioRisk.isError || projects.isError;
  const hasPortfolioData =
    data.totals.scans > 0 || data.totals.openFindings > 0 || projectList.length > 0;

  if ((portfolioRisk.isLoading || projects.isLoading) && !hasPortfolioData) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading portfolio...</div>;
  }

  return (
    <div className="grid gap-6">
      {hasError ? (
        <WarningBanner>
          Live portfolio data could not be refreshed. The dashboard below is showing a safe empty
          state until the API responds again.
        </WarningBanner>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Projects" value={data.totals.projects} />
        <Metric label="Scans" value={data.totals.scans} />
        <Metric label="Open Findings" value={data.totals.openFindings} />
        <Metric label="Critical + High" value={data.totals.critical + data.totals.high} />
      </section>

      {!hasPortfolioData ? (
        <EmptyPortfolioState />
      ) : (
        <>
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

          <section className="grid gap-4 lg:grid-cols-3">
            <Panel title="Finding Aging">
              <AgingBuckets aging={data.aging ?? emptyPortfolio.aging!} />
            </Panel>
            <Panel title="License Distribution">
              <LicenseDistribution data={data.licenseDistribution ?? []} />
            </Panel>
            <Panel title="Tool Health">
              <ToolHealth data={data.toolHealth ?? []} />
            </Panel>
          </section>
        </>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <span className="text-sm text-[var(--muted)]">Self-hosted portfolio view</span>
        </div>
        <div className="grid gap-4">
          {projectList.length === 0 ? (
            <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-8 text-[var(--muted)]">
              No projects yet. Create a scan to import a public GitHub repository and start building
              portfolio history.
            </div>
          ) : (
            projectList.map((project) => <ProjectCard key={project.id} project={project} />)
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyPortfolioState() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Portfolio Status">
        <p className="text-lg font-semibold text-slate-100">No scans have been executed yet.</p>
        <p className="mt-3 max-w-3xl leading-7 text-slate-200">
          The enterprise dashboard becomes useful after the first repository scan. Once evidence is
          ingested, CodeGuard AI will show risk trends, category breakdowns, aging and remediation
          priorities here.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/analyses/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#061013] hover:bg-[#62e3d8]"
          >
            Create first scan
          </Link>
          <Link
            href="/dashboard/projects"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-slate-100 hover:border-[var(--accent)]"
          >
            Open project portfolio
          </Link>
        </div>
      </Panel>
      <Panel title="What you get">
        <div className="grid gap-3 text-sm text-slate-200">
          <ChecklistItem title="Risk scoring and change over time per project and scan" />
          <ChecklistItem title="Security, supply-chain and repository posture evidence" />
          <ChecklistItem title="Prioritized remediation work instead of flat generic findings" />
          <ChecklistItem title="Artifacts such as Markdown reports, SBOM and normalized JSON" />
        </div>
      </Panel>
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
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
  );
}

function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-100">
      {children}
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

function ChecklistItem({ title }: { title: string }) {
  return (
    <div className="rounded-md bg-[#0b1018] p-3">
      <span className="mr-2 text-[var(--accent)]">-</span>
      {title}
    </div>
  );
}
