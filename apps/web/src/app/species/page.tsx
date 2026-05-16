import type { Metadata } from "next";
import Link from "next/link";
import { getAllSpecies } from "@/lib/supabase/queries";
import { assemblyLevelColor, formatGenomeSize, formatNumber } from "@/lib/utils/format";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Species" };

interface SpeciesMetadata {
  protein_coding_genes?: number;
  assembly_level?: string;
  gc_percent?: number;
  scaffold_n50?: number;
}

function parseMeta(raw: Json): SpeciesMetadata {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as SpeciesMetadata;
  }
  return {};
}

export default async function SpeciesListPage() {
  const species = await getAllSpecies();

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Species</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {species.length} annotated Chiroptera assemblies from NCBI
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                Species
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                Assembly
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">
                Genome
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">
                Protein-coding genes
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">
                GC %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {species.map((s) => {
              const meta = parseMeta(s.metadata);
              return (
                <tr
                  key={s.ncbi_tax_id}
                  className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/species/${s.ncbi_tax_id}`}
                      className="block"
                    >
                      <span className="font-medium italic text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">
                        {s.scientific_name}
                      </span>
                      {s.common_name && (
                        <span className="block text-xs text-[var(--color-text-muted)] not-italic">
                          {s.common_name}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-xs font-medium ${assemblyLevelColor(s.annotation_status)}`}
                      >
                        {s.annotation_status ?? "Unknown"}
                      </span>
                      {s.refseq_category && (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          reference
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-text)]">
                    {formatGenomeSize(s.genome_size_bp)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-text)]">
                    {formatNumber(meta.protein_coding_genes)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-text)]">
                    {meta.gc_percent != null ? `${meta.gc_percent}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
