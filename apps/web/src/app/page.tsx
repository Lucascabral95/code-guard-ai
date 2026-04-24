import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';

export default function HomePage() {
  return (
    <AppShell>
      <section className="grid min-h-[70vh] content-center gap-8">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            DevSecOps Review Platform
          </p>
          <h1 className="text-5xl font-semibold leading-tight md:text-6xl">CodeGuard AI</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Automated repository analysis with safe execution defaults, risk scoring, technical
            findings and optional local AI summaries.
          </p>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-[#061013] hover:bg-[#62e3d8]"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
