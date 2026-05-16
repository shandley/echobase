import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSpeciesByTaxId,
  getProteinCountForSpecies,
  getRelatedSpecies,
} from "@/lib/supabase/queries";
import { assemblyLevelColor, formatGenomeSize, formatNumber } from "@/lib/utils/format";
import type { Json } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ taxId: string }>;
}

interface SpeciesMetadata {
  protein_coding_genes?: number;
  total_genes?: number;
  gc_percent?: number;
  scaffold_n50?: number;
  contig_n50?: number;
  sequencing_tech?: string;
  annotation_provider?: string;
  assembly_level?: string;
  release_date?: string;
  genome_coverage?: string;
}

function parseMeta(raw: Json): SpeciesMetadata {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as SpeciesMetadata;
  }
  return {};
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { taxId } = await params;
  const species = await getSpeciesByTaxId(Number(taxId));
  if (!species) return { title: "Species not found" };
  return { title: species.scientific_name };
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xl font-bold font-mono text-[var(--color-text)]">{value}</div>
      <div className="mt-1 text-xs font-medium text-[var(--color-accent)]">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</div>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4 py-3 text-sm border-b border-[var(--color-border-subtle)] last:border-0">
      <span className="w-44 shrink-0 text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[var(--color-text)]">{value}</span>
    </div>
  );
}

export default async function SpeciesDetailPage({ params }: Props) {
  const { taxId } = await params;
  const taxIdNum = Number(taxId);

  if (Number.isNaN(taxIdNum)) notFound();

  const [species, proteinCount] = await Promise.all([
    getSpeciesByTaxId(taxIdNum),
    getProteinCountForSpecies(0), // placeholder -- gets real count once species loads
  ]);

  if (!species) notFound();

  const [relatedSpecies, realProteinCount] = await Promise.all([
    getRelatedSpecies(species.genus ?? "", taxIdNum),
    getProteinCountForSpecies(species.id),
  ]);

  const meta = parseMeta(species.metadata);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/species" className="hover:text-[var(--color-text)] transition-colors">
          Species
        </Link>
        <span>/</span>
        {species.genus && (
          <>
            <span>{species.genus}</span>
            <span>/</span>
          </>
        )}
        <span className="italic text-[var(--color-text)]">{species.scientific_name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tight text-[var(--color-text)]">
            {species.scientific_name}
          </h1>
          {species.common_name && (
            <p className="mt-1 text-base not-italic text-[var(--color-text-muted)]">
              {species.common_name}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${assemblyLevelColor(species.annotation_status)}`}
            >
              {species.annotation_status ?? "Unknown assembly level"}
            </span>
            {species.refseq_category && (
              <span className="rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                {species.refseq_category}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-[var(--color-text-muted)]">
          <div className="font-mono">{species.genome_assembly_accession}</div>
          <div className="mt-0.5">NCBI Tax ID: {species.ncbi_tax_id}</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Genome size"
          value={formatGenomeSize(species.genome_size_bp)}
        />
        <StatCard
          label="Protein-coding genes"
          value={formatNumber(meta.protein_coding_genes)}
        />
        <StatCard
          label="Proteins in EchoBase"
          value={realProteinCount > 0 ? formatNumber(realProteinCount) : "Loading…"}
        />
        <StatCard
          label="GC content"
          value={meta.gc_percent != null ? `${meta.gc_percent}%` : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Genome assembly */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
              Genome assembly
            </h2>
            <DetailRow label="Accession" value={species.genome_assembly_accession} />
            <DetailRow label="Assembly level" value={species.annotation_status} />
            <DetailRow label="Release date" value={meta.release_date} />
            <DetailRow label="Sequencing technology" value={meta.sequencing_tech} />
            <DetailRow label="Annotation provider" value={meta.annotation_provider} />
            <DetailRow
              label="Scaffold N50"
              value={meta.scaffold_n50 ? formatGenomeSize(meta.scaffold_n50) : null}
            />
            <DetailRow
              label="Contig N50"
              value={meta.contig_n50 ? formatGenomeSize(meta.contig_n50) : null}
            />
          </section>

          {/* Gene annotation */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
              Gene annotation
            </h2>
            <DetailRow
              label="Protein-coding genes"
              value={meta.protein_coding_genes ? formatNumber(meta.protein_coding_genes) : null}
            />
            <DetailRow
              label="Total annotated genes"
              value={meta.total_genes ? formatNumber(meta.total_genes) : null}
            />
            <DetailRow label="Annotation provider" value={meta.annotation_provider} />
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Taxonomy */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
              Taxonomy
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Order</span>
                <span className="italic text-[var(--color-text)]">Chiroptera</span>
              </div>
              {species.genus && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Genus</span>
                  <span className="italic text-[var(--color-text)]">{species.genus}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">NCBI Tax ID</span>
                <a
                  href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${species.ncbi_tax_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[var(--color-accent)] hover:opacity-80"
                >
                  {species.ncbi_tax_id}
                </a>
              </div>
            </div>
          </section>

          {/* External links */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
              External resources
            </h2>
            <div className="space-y-2 text-sm">
              {species.genome_assembly_accession && (
                <a
                  href={`https://www.ncbi.nlm.nih.gov/datasets/genome/${species.genome_assembly_accession}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  <span>NCBI Genome</span>
                  <span>→</span>
                </a>
              )}
              <a
                href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${species.ncbi_tax_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                <span>NCBI Taxonomy</span>
                <span>→</span>
              </a>
            </div>
          </section>

          {/* Related species */}
          {relatedSpecies.length > 0 && (
            <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
                Same genus
              </h2>
              <div className="space-y-2">
                {relatedSpecies.map((rel) => (
                  <Link
                    key={rel.ncbi_tax_id}
                    href={`/species/${rel.ncbi_tax_id}`}
                    className="block text-sm italic text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    {rel.scientific_name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
