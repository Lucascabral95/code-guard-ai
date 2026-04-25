'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useScan, useUpdateFindingStatus } from '@/features/analyses/hooks';
import { FindingStatus } from '@/features/analyses/types';
import type { Finding, UpdateFindingStatusRequest } from '@/features/analyses/types';
import { CategoryBars, SeverityBars } from './EnterpriseCharts';
import { Button } from '../ui/Button';
import { RiskBadge } from '../ui/RiskBadge';
import { StatusBadge } from '../ui/StatusBadge';

const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function ScanDetail({ id }: { id: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useScan(id);
  const updateStatus = useUpdateFindingStatus(id);

  const groupedFindings = useMemo(() => groupFindings(data?.findings ?? []), [data?.findings]);
  const severityTotals = useMemo(() => totalsFor(data?.findings ?? []), [data?.findings]);
  const categoryTotals = useMemo(() => categoriesFor(data?.findings ?? []), [data?.findings]);

  if (isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading scan...</div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Scan data is unavailable.
      </div>
    );
  }

  const { scan } = data;

  function setStatus(findingId: string, input: UpdateFindingStatusRequest) {
    updateStatus.mutate({ id: findingId, input });
  }

  function acceptedUntilDefault() {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 90);
    return expiration.toISOString();
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Scan Detail</h1>
            <p className="mt-2 break-all text-[var(--muted)]">
              {scan.repository?.repoUrl ?? 'Repository pending'}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {scan.branch} | {scan.currentStage ?? 'queued'} | Safe mode{' '}
              {scan.safeMode ? 'on' : 'off'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/scans/${scan.id}/report`}
              className="inline-flex h-11 items-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              Executive report
            </Link>
            <Link
              href={`/dashboard/scans/${scan.id}/compare`}
              className="inline-flex h-11 items-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              Compare
            </Link>
            <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Metric label="Status" value={<StatusBadge status={scan.status} />} />
          <Metric label="Risk Level" value={<RiskBadge level={scan.riskLevel} />} />
          <Metric label="Risk Score" value={`${scan.riskScore ?? '--'}/100`} />
          <Metric label="Stack" value={scan.detectedStack ?? 'pending'} />
          <Metric
            label="Completed"
            value={scan.completedAt ? new Date(scan.completedAt).toLocaleString() : 'Pending'}
          />
        </div>

        {scan.errorMessage && (
          <div className="mt-5 rounded-md border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-100">
            {scan.errorMessage}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Executive Summary
          </h2>
          <p className="mt-2 leading-7 text-slate-200">{scan.summary ?? 'Summary pending.'}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Severity Distribution">
          <SeverityBars totals={severityTotals} />
        </Panel>
        <Panel title="Finding Categories">
          <CategoryBars data={categoryTotals} />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tool Runs">
          <div className="grid gap-3">
            {data.toolRuns.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No tool runs recorded yet.</p>
            ) : (
              data.toolRuns.map((toolRun) => (
                <div key={toolRun.id} className="rounded-md bg-[#0b1018] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{toolRun.tool}</p>
                    <span className="text-xs text-[var(--muted)]">{toolRun.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {toolRun.stage} | {toolRun.summary ?? 'No summary'}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel title="SBOM Inventory">
          <div className="grid gap-2">
            {data.components.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No components detected yet.</p>
            ) : (
              data.components.slice(0, 12).map((component) => (
                <div
                  key={component.id}
                  className="grid grid-cols-[1fr_auto] gap-3 rounded-md bg-[#0b1018] p-3 text-sm"
                >
                  <span className="truncate">{component.name}</span>
                  <span className="text-[var(--muted)]">{component.version ?? 'unknown'}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      {data.licenseRisks.length > 0 && (
        <Panel title="License Risks">
          <div className="grid gap-3">
            {data.licenseRisks.map((licenseRisk) => (
              <div key={licenseRisk.id} className="rounded-md bg-[#0b1018] p-3 text-sm">
                <p className="font-medium">
                  {licenseRisk.component} | {licenseRisk.license}
                </p>
                <p className="mt-1 text-[var(--muted)]">{licenseRisk.risk}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Findings</h2>
        <div className="grid gap-4">
          {severityOrder.map((severity) => {
            const findings = groupedFindings[severity] ?? [];
            if (findings.length === 0) {
              return null;
            }

            return (
              <div
                key={severity}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5"
              >
                <h3 className="text-sm font-semibold text-[var(--muted)]">
                  {severity} | {findings.length}
                </h3>
                <div className="mt-4 grid gap-3">
                  {findings.map((finding) => (
                    <article key={finding.id} className="rounded-md bg-[var(--panel-muted)] p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <Link
                            href={`/dashboard/findings/${finding.id}`}
                            className="font-medium transition hover:text-[var(--accent)]"
                          >
                            {finding.message}
                          </Link>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {finding.tool} | {finding.category ?? finding.type} | {finding.status}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <FindingAction
                            label="Accept"
                            onClick={() =>
                              setStatus(finding.id, {
                                status: FindingStatus.AcceptedRisk,
                                reason:
                                  'Accepted from scan detail after manual review; tracked for expiration.',
                                acceptedUntil: acceptedUntilDefault(),
                              })
                            }
                          />
                          <FindingAction
                            label="False positive"
                            onClick={() =>
                              setStatus(finding.id, {
                                status: FindingStatus.FalsePositive,
                                reason: 'Marked as false positive after manual evidence review.',
                              })
                            }
                          />
                          <FindingAction
                            label="Fixed"
                            onClick={() => setStatus(finding.id, { status: FindingStatus.Fixed })}
                          />
                        </div>
                      </div>
                      {finding.recommendation && (
                        <p className="mt-2 text-sm text-[var(--muted)]">{finding.recommendation}</p>
                      )}
                      {finding.remediation && (
                        <div className="mt-3 rounded-md border border-[var(--border)] p-3 text-sm">
                          <p className="font-medium">{finding.remediation.title}</p>
                          <p className="mt-1 text-[var(--muted)]">
                            {finding.remediation.description}
                          </p>
                        </div>
                      )}
                      {finding.evidences?.length ? (
                        <div className="mt-3 grid gap-2">
                          {finding.evidences.map((evidence) => (
                            <p key={evidence.id} className="text-xs text-[var(--muted)]">
                              Evidence: {evidence.title}
                              {evidence.file ? ` | ${evidence.file}` : ''}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
          {data.findings.length === 0 && (
            <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--muted)]">
              Findings are not available yet.
            </div>
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

function FindingAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
    >
      {label}
    </button>
  );
}

function groupFindings(findings: Finding[]): Record<string, Finding[]> {
  return findings.reduce<Record<string, Finding[]>>((groups, finding) => {
    groups[finding.severity] = groups[finding.severity] ?? [];
    groups[finding.severity].push(finding);
    return groups;
  }, {});
}

function totalsFor(findings: Finding[]) {
  return {
    projects: 0,
    scans: 0,
    openFindings: findings.length,
    critical: findings.filter((finding) => finding.severity === 'CRITICAL').length,
    high: findings.filter((finding) => finding.severity === 'HIGH').length,
    medium: findings.filter((finding) => finding.severity === 'MEDIUM').length,
    low: findings.filter((finding) => finding.severity === 'LOW').length,
    info: findings.filter((finding) => finding.severity === 'INFO').length,
  };
}

function categoriesFor(findings: Finding[]) {
  const counts = findings.reduce<Record<string, number>>((accumulator, finding) => {
    const category = finding.category ?? 'uncategorized';
    accumulator[category] = (accumulator[category] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).map(([category, count]) => ({ category, count }));
}
