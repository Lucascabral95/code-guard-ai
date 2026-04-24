'use client';

import { useMemo } from 'react';
import { useAnalysis } from '@/features/analyses/hooks';
import type { Finding } from '@/features/analyses/types';
import { Button } from '../ui/Button';
import { RiskBadge } from '../ui/RiskBadge';
import { StatusBadge } from '../ui/StatusBadge';

const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function AnalysisDetail({ id }: { id: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useAnalysis(id);
  const findingsBySeverity = useMemo(() => groupFindings(data?.findings ?? []), [data?.findings]);

  if (isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading analysis...</div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Analysis detail is unavailable.
      </div>
    );
  }

  const { analysis, logs } = data;

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="break-all text-xl font-semibold">{analysis.repoUrl}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Branch {analysis.branch} · Stack {analysis.detectedStack ?? 'pending'} · Safe mode{' '}
              {analysis.safeMode ? 'on' : 'off'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Status" value={<StatusBadge status={analysis.status} />} />
          <Metric label="Risk Level" value={<RiskBadge level={analysis.riskLevel} />} />
          <Metric label="Risk Score" value={`${analysis.riskScore ?? '--'}/100`} />
          <Metric
            label="Completed"
            value={
              analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : 'Pending'
            }
          />
        </div>

        {analysis.errorMessage && (
          <div className="mt-5 rounded-md border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-100">
            {analysis.errorMessage}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Summary
          </h2>
          <p className="mt-2 leading-7 text-slate-200">{analysis.summary ?? 'Summary pending.'}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Findings</h2>
        <div className="grid gap-4">
          {severityOrder.map((severity) => {
            const findings = findingsBySeverity[severity] ?? [];
            if (findings.length === 0) {
              return null;
            }

            return (
              <div
                key={severity}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5"
              >
                <h3 className="text-sm font-semibold text-[var(--muted)]">
                  {severity} · {findings.length}
                </h3>
                <div className="mt-4 grid gap-3">
                  {findings.map((finding) => (
                    <article key={finding.id} className="rounded-md bg-[var(--panel-muted)] p-4">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <p className="font-medium">{finding.message}</p>
                        <span className="text-xs text-[var(--muted)]">{finding.tool}</span>
                      </div>
                      {finding.recommendation && (
                        <p className="mt-2 text-sm text-[var(--muted)]">{finding.recommendation}</p>
                      )}
                      {finding.file && (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {finding.file}
                          {finding.line ? `:${finding.line}` : ''}
                        </p>
                      )}
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Technical Logs</h2>
        <div className="rounded-md border border-[var(--border)] bg-[#070b11] p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-[var(--muted)]">No logs recorded yet.</p>
          ) : (
            logs.map((log) => (
              <p key={log.id} className="break-words py-1 text-slate-300">
                [{new Date(log.createdAt).toLocaleTimeString()}] {log.level} {log.message}
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <div className="mt-2 min-h-7 text-lg font-semibold">{value}</div>
    </div>
  );
}

function groupFindings(findings: Finding[]): Record<string, Finding[]> {
  return findings.reduce<Record<string, Finding[]>>((groups, finding) => {
    groups[finding.severity] = groups[finding.severity] ?? [];
    groups[finding.severity].push(finding);
    return groups;
  }, {});
}
