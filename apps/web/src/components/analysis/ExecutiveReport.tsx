'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useExecutiveReport, useRemediationPlan } from '@/features/analyses/hooks';
import { CategoryBars, SeverityBars } from './EnterpriseCharts';
import { RiskBadge } from '../ui/RiskBadge';

export function ExecutiveReport({ id }: { id: string }) {
  const report = useExecutiveReport(id);
  const remediation = useRemediationPlan(id);

  if (report.isLoading || remediation.isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading report...</div>;
  }

  if (report.isError || !report.data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Executive report is unavailable.
      </div>
    );
  }

  const data = report.data;
  const remediationPlan = remediation.data;

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Executive Report</p>
            <h1 className="mt-2 text-3xl font-semibold">{data.repository.repoUrl}</h1>
            <p className="mt-3 max-w-4xl leading-7 text-slate-200">{data.executiveSummary}</p>
          </div>
          <Link
            href={`/dashboard/scans/${id}`}
            className="inline-flex h-11 items-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            Back to scan
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Risk Level" value={<RiskBadge level={data.risk.level} />} />
          <Metric label="Risk Score" value={`${data.risk.score ?? '--'}/100`} />
          <Metric label="Open Findings" value={data.risk.openFindings} />
          <Metric label="Critical + High" value={data.risk.criticalAndHigh} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Severity">
          <SeverityBars
            totals={{
              projects: 0,
              scans: 0,
              openFindings: data.risk.openFindings,
              critical: data.severity.CRITICAL,
              high: data.severity.HIGH,
              medium: data.severity.MEDIUM,
              low: data.severity.LOW,
              info: data.severity.INFO,
            }}
          />
        </Panel>
        <Panel title="Categories">
          <CategoryBars data={data.categories} />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Business Impact">
          <p className="leading-7 text-slate-200">{data.businessImpact}</p>
        </Panel>
        <Panel title="Policy Gates">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="Failed" value={data.policyEvaluation.failed} />
              <MiniMetric label="Warnings" value={data.policyEvaluation.warned} />
            </div>
            {data.policyEvaluation.policies.slice(0, 6).map((policy) => (
              <div key={policy.id} className="rounded-md bg-[#0b1018] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{policy.name}</span>
                  <span className={policy.passed ? 'text-emerald-300' : 'text-rose-300'}>
                    {policy.passed ? 'passed' : `${policy.violations} violation(s)`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {policy.category} | {policy.severity} | {policy.action}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Recommended Next Steps">
        <ol className="grid gap-3">
          {data.recommendedNextSteps.map((step, index) => (
            <li key={`${step}-${index}`} className="rounded-md bg-[#0b1018] p-4 text-sm">
              <span className="mr-3 text-[var(--accent)]">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Fix This First">
        <div className="grid gap-3">
          {(remediationPlan?.fixFirst ?? []).length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No prioritized remediation items yet.</p>
          ) : (
            remediationPlan?.fixFirst.map((item) => (
              <article key={item.finding.id} className="rounded-md bg-[#0b1018] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium">
                      #{item.rank} {item.finding.message}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.whyThisMatters}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    {item.ownerHint}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-200">{item.suggestedAction}</p>
              </article>
            ))
          )}
        </div>
      </Panel>
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
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
