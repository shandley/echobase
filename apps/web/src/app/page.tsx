import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start px-6 py-24">
      <div className="mb-3 text-xs font-semibold tracking-widest text-[var(--color-accent)] uppercase">
        Beta
      </div>
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-[var(--color-text)]">
        Unified genomics for bats
      </h1>
      <p className="mb-10 max-w-xl text-lg leading-relaxed text-[var(--color-text-muted)]">
        EchoBase integrates genome assemblies, protein sequences, and scientific
        literature across Chiroptera — searchable through embeddings and language
        models, not keyword matching.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/species"
          className="rounded-md bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-90 transition-opacity"
        >
          Browse species
        </Link>
        <a
          href="https://github.com/shandley/echobase"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          GitHub →
        </a>
      </div>
      <div className="mt-20 grid grid-cols-3 gap-6 w-full">
        {[
          { label: "Species", value: "50", note: "annotated genomes" },
          { label: "Proteins", value: "~1.3M", note: "loading now" },
          { label: "Papers", value: "—", note: "coming soon" },
        ].map(({ label, value, note }) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
            <div className="mt-1 text-xs font-medium text-[var(--color-accent)]">{label}</div>
            <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
