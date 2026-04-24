import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[#090d14]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-base font-semibold tracking-wide">
            CodeGuard AI
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/dashboard" className="hover:text-[var(--text)]">
              Portfolio
            </Link>
            <Link href="/dashboard/analyses/new" className="hover:text-[var(--text)]">
              New Scan
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
