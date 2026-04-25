'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { RemediationOverviewResponse } from '@/features/analyses/types';
import { useRemediationOverview } from '@/features/analyses/hooks';
import { RiskBadge } from '../ui/RiskBadge';
import { StatusBadge } from '../ui/StatusBadge';

const emptyRemediation: RemediationOverviewResponse = {
  generatedAt: new Date(0).toISOString(),
  totals: {
    projects: 0,
    scans: 0,
    openFindings: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    staleOver30Days: 0,
    activePolicyFailures: 0,
  },
  summary: {
    itemsReadyForRemediation: 0,
    failingScans: 0,
    projectsAtRisk: 0,
  },
  fixFirst: [],
  staleFindings: [],
  policyFailures: [],
  latestScans: [],
};

export function RemediationCenter() {
  const remediation = useRemediationOverview();
  const data = remediation.data ?? emptyRemediation;
  const hasData =
    data.fixFirst.length > 0 ||
    data.staleFindings.length > 0 ||
    data.policyFailures.length > 0 ||
    data.latestScans.length > 0;

  if (remediation.isLoading && !hasData) {
    return (
      <div className="rounded-md border border-[var(--border)] p-6">Loading remediation...</div>
    );
  }

  return (
    <div className="grid gap-6">
      {remediation.isError ? (
        <WarningBanner>
          Remediation data could not be refreshed. The page below is showing a safe empty state
          until the API responds again.
        </WarningBanner>
      ) : null}

      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Remediation Center</p>
        <h1 className="mt-2 text-3xl font-semibold">Fix the highest risk evidence first</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-200">
          Use the remediation queue to prioritize actionable evidence, stale risk, failing policy
          gates and the scans that still need attention.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Metric label="Open Findings" value={data.totals.openFindings} />
          <Metric label="Critical" value={data.totals.critical} />
          <Metric label="High" value={data.totals.high} />
          <Metric label="Stale >30d" value={data.totals.staleOver30Days} />
          <Metric label="Policy Failures" value={data.totals.activePolicyFailures} />
        </div>
      </section>

      {!hasData ? (
        <EmptyRemediationState />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Panel title="Fix This First">
              <div className="grid gap-3">
                {data.fixFirst.map((item) => (
                  <Link
                    key={item.finding.id}
                    href={`/dashboard/findings/${item.finding.id}`}
                    className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4 transition hover:border-[var(--accent)]"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                          #{item.rank}
                        </span>
                        <RiskBadge
                          level={item.scan?.riskLevel ?? item.project?.riskLevel ?? null}
                        />
                        <span className="text-xs text-[var(--muted)]">{item.ownerHint}</span>
                        <span className="text-xs text-[var(--muted)]">{item.ageDays}d open</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-100">{item.finding.message}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {item.repository?.repoUrl ?? 'Repository pending'}
                        </p>
                      </div>
                      <p className="text-sm leading-6 text-slate-200">{item.whyThisMatters}</p>
                      <p className="text-sm text-[var(--muted)]">{item.suggestedAction}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel title="Policy Failures">
              <div className="grid gap-3">
                {data.policyFailures.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No failing policy gates are currently blocking remediation flow.
                  </p>
                ) : (
                  data.policyFailures.map((policyFailure) => (
                    <Link
                      key={policyFailure.scanId}
                      href={`/dashboard/scans/${policyFailure.scanId}/report`}
                      className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4 transition hover:border-[var(--accent)]"
                    >
                      <p className="font-medium text-slate-100">{policyFailure.repoUrl}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                        <RiskBadge level={policyFailure.riskLevel} />
                        <span>{policyFailure.failed} fail</span>
                        <span>{policyFailure.warned} warn</span>
                        <span>{policyFailure.riskScore ?? '--'}/100</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title="Stale Findings">
              <div className="grid gap-3">
                {data.staleFindings.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No stale findings are currently waiting past the normal remediation window.
                  </p>
                ) : (
                  data.staleFindings.map((item) => (
                    <Link
                      key={`stale-${item.finding.id}`}
                      href={`/dashboard/findings/${item.finding.id}`}
                      className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4 transition hover:border-[var(--accent)]"
                    >
                      <p className="font-medium text-slate-100">{item.finding.message}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.repository?.repoUrl ?? 'Repository pending'} | {item.ageDays} days
                        open
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Latest Reports">
              <div className="grid gap-3">
                {data.latestScans.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No scans available yet.</p>
                ) : (
                  data.latestScans.map((scan) => (
                    <Link
                      key={scan.id}
                      href={`/dashboard/scans/${scan.id}/report`}
                      className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4 transition hover:border-[var(--accent)]"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="break-all font-medium">
                            {scan.repository?.repoUrl ?? 'Repository pending'}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
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
        </>
      )}
    </div>
  );
}

function EmptyRemediationState() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel title="No remediation queue yet">
        <p className="text-lg font-semibold text-slate-100">
          There is no scan evidence to prioritize.
        </p>
        <p className="mt-3 max-w-3xl leading-7 text-slate-200">
          After the first scan, this page will rank what to fix first, show old unresolved findings
          and highlight policy gates that should block release decisions.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/analyses/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#061013] hover:bg-[#62e3d8]"
          >
            Run first scan
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-slate-100 hover:border-[var(--accent)]"
          >
            Return to dashboard
          </Link>
        </div>
      </Panel>

      <Panel title="How this page helps">
        <div className="grid gap-3 text-sm text-slate-200">
          <ChecklistItem title="Prioritizes the findings with the highest operational impact" />
          <ChecklistItem title="Separates fresh issues from stale unresolved risk" />
          <ChecklistItem title="Surfaces failing policy gates per scan" />
          <ChecklistItem title="Links every remediation item back to evidence and reports" />
        </div>
      </Panel>
    </section>
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
    <div className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      {children}
    </section>
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
