'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useFinding, useUpdateFindingStatus } from '@/features/analyses/hooks';
import { FindingStatus } from '@/features/analyses/types';
import type { UpdateFindingStatusRequest } from '@/features/analyses/types';

export function FindingDetail({ id }: { id: string }) {
  const finding = useFinding(id);
  const updateStatus = useUpdateFindingStatus(finding.data?.scanId ?? '');

  if (finding.isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading finding...</div>;
  }

  if (finding.isError || !finding.data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Finding detail is unavailable.
      </div>
    );
  }

  const data = finding.data;

  function setStatus(input: UpdateFindingStatusRequest) {
    updateStatus.mutate({ id, input });
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Finding Detail</p>
            <h1 className="mt-2 text-3xl font-semibold">{data.message}</h1>
            <p className="mt-3 max-w-4xl leading-7 text-slate-200">
              {data.recommendation ?? 'Review the evidence and define a remediation owner.'}
            </p>
          </div>
          {data.scanId && (
            <Link
              href={`/dashboard/scans/${data.scanId}`}
              className="inline-flex h-11 items-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              Back to scan
            </Link>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Metric label="Severity" value={data.severity} />
          <Metric label="Status" value={data.status} />
          <Metric label="Tool" value={data.tool} />
          <Metric label="Category" value={data.category ?? data.type} />
          <Metric
            label="Confidence"
            value={data.confidence ? `${Math.round(data.confidence * 100)}%` : '--'}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setStatus({
                status: FindingStatus.AcceptedRisk,
                reason: 'Accepted from finding detail after manual evidence review.',
                acceptedUntil: acceptedUntilDefault(),
              })
            }
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            Accept risk
          </button>
          <button
            type="button"
            onClick={() =>
              setStatus({
                status: FindingStatus.FalsePositive,
                reason: 'Marked as false positive after manual evidence review.',
              })
            }
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            False positive
          </button>
          <button
            type="button"
            onClick={() => setStatus({ status: FindingStatus.Fixed })}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            Mark fixed
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Evidence">
          <div className="grid gap-3">
            {data.evidences?.length ? (
              data.evidences.map((evidence) => (
                <article key={evidence.id} className="rounded-md bg-[#0b1018] p-4 text-sm">
                  <p className="font-medium">{evidence.title}</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {evidence.file ?? 'no file'}{' '}
                    {evidence.lineStart ? `| line ${evidence.lineStart}` : ''}
                  </p>
                  {evidence.snippet && (
                    <pre className="mt-3 overflow-x-auto rounded-md bg-black/30 p-3 text-xs">
                      {evidence.snippet}
                    </pre>
                  )}
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No evidence attached.</p>
            )}
          </div>
        </Panel>

        <Panel title="Remediation">
          {data.remediation ? (
            <div className="rounded-md bg-[#0b1018] p-4">
              <p className="font-medium">{data.remediation.title}</p>
              <p className="mt-2 leading-7 text-slate-200">{data.remediation.description}</p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Priority {data.remediation.priority} | Effort {data.remediation.effort ?? 'unknown'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No remediation guidance attached.</p>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
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

function acceptedUntilDefault() {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 90);
  return expiration.toISOString();
}
