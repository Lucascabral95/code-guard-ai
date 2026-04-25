'use client';

import Link from 'next/link';
import { useProjects } from '@/features/analyses/hooks';
import { RiskBadge } from '../ui/RiskBadge';

export function ProjectsList() {
  const projects = useProjects();

  if (projects.isLoading) {
    return <div className="rounded-md border border-[var(--border)] p-6">Loading projects...</div>;
  }

  if (projects.isError || !projects.data) {
    return (
      <div className="rounded-md border border-rose-900 bg-rose-950/30 p-6 text-rose-100">
        Projects are unavailable.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold">Repository security portfolio</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-200">
          Track each repository as a project, compare scans over time and prove whether risk is
          going down after remediation.
        </p>
      </section>

      <section className="grid gap-4">
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
                  <p className="mt-1 break-all text-sm text-[var(--muted)]">
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
      </section>
    </div>
  );
}
