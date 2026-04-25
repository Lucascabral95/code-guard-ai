'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useCreatePolicy, usePolicies } from '@/features/analyses/hooks';
import type { CreatePolicyRequest } from '@/features/analyses/types';
import { Button } from '../ui/Button';

const severities = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const actions = ['WARN', 'FAIL'] as const;

export function PolicyDashboard() {
  const policies = usePolicies();
  const createPolicy = useCreatePolicy();
  const [form, setForm] = useState({
    name: 'Block critical vulnerabilities',
    category: 'security',
    severity: 'CRITICAL',
    action: 'FAIL',
    description: 'Fails policy evaluation when open critical security findings are present.',
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: CreatePolicyRequest = {
      name: form.name,
      category: form.category,
      severity: form.severity as CreatePolicyRequest['severity'],
      action: form.action as CreatePolicyRequest['action'],
      description: form.description,
      enabled: true,
    };
    await createPolicy.mutateAsync(input);
  }

  if (policies.isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading policies...</div>;
  }

  if (policies.isError || !policies.data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Policies are unavailable.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Policy Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold">Release gates for repository risk</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-200">
          Policies turn findings into decisions: fail critical vulnerabilities, warn on medium
          quality drift, block secrets or track license risk.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={(event) => void submit(event)}
          className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            New Policy
          </h2>
          <div className="grid gap-3">
            <TextInput
              label="Name"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            <TextInput
              label="Category"
              value={form.category}
              onChange={(value) => setForm((current) => ({ ...current, category: value }))}
            />
            <label className="grid gap-2 text-sm">
              <span className="text-[var(--muted)]">Severity</span>
              <select
                value={form.severity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, severity: event.target.value }))
                }
                className="h-11 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 outline-none focus:border-[var(--accent)]"
              >
                {severities.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[var(--muted)]">Action</span>
              <select
                value={form.action}
                onChange={(event) =>
                  setForm((current) => ({ ...current, action: event.target.value }))
                }
                className="h-11 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 outline-none focus:border-[var(--accent)]"
              >
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[var(--muted)]">Description</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                className="min-h-24 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 py-2 outline-none focus:border-[var(--accent)]"
              />
            </label>
            <Button type="submit" disabled={createPolicy.isPending}>
              {createPolicy.isPending ? 'Creating...' : 'Create policy'}
            </Button>
          </div>
        </form>

        <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Active Rules
          </h2>
          <div className="grid gap-3">
            {policies.data.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No policies created yet.</p>
            ) : (
              policies.data.map((policy) => (
                <article key={policy.id} className="rounded-md bg-[#0b1018] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium">{policy.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {policy.description ?? 'No description'}
                      </p>
                    </div>
                    <span className={policy.enabled ? 'text-emerald-300' : 'text-slate-500'}>
                      {policy.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-[var(--muted)]">
                    {policy.category} | {policy.severity} | {policy.action}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[var(--border)] bg-[#0b1018] px-3 outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
