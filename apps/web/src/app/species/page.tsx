import type { Metadata } from "next";
import Link from "next/link";
import { getAllSpecies } from "@/lib/supabase/queries";
import { formatGenomeSize, formatNumber } from "@/lib/utils/format";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Species" };

interface SpeciesMeta {
  protein_coding_genes?: number;
  gc_percent?: number;
}

function parseMeta(raw: Json): SpeciesMeta {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as SpeciesMeta;
  }
  return {};
}

function AssemblyBadge({ level }: { level: string | null }) {
  const l = level?.toLowerCase() ?? "";
  let bg: string;
  let color: string;

  if (l === "chromosome") {
    bg = "var(--color-badge-chromosome-bg)";
    color = "var(--color-badge-chromosome-text)";
  } else if (l === "scaffold") {
    bg = "var(--color-badge-scaffold-bg)";
    color = "var(--color-badge-scaffold-text)";
  } else {
    bg = "var(--color-badge-other-bg)";
    color = "var(--color-badge-other-text)";
  }

  return (
    <span style={{
      display: "inline-block",
      backgroundColor: bg,
      color,
      fontSize: "0.6875rem",
      fontWeight: 500,
      letterSpacing: "0.03em",
      padding: "0.2rem 0.45rem",
      borderRadius: "2px",
      lineHeight: 1.4,
      fontFamily: "var(--font-mono)",
    }}>
      {level ?? "—"}
    </span>
  );
}

export default async function SpeciesListPage() {
  const species = await getAllSpecies();

  return (
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{
          fontSize: "1.375rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--color-text)",
          margin: 0,
        }}>
          Species
        </h1>
        <p style={{
          marginTop: "0.375rem",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
        }}>
          {species.length} annotated Chiroptera assemblies from NCBI
        </p>
      </div>

      {/* Table */}
      <div style={{
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
        overflow: "hidden",
      }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.875rem",
        }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              {[
                { label: "Species", align: "left", width: "35%" },
                { label: "Assembly",  align: "left",  width: "18%" },
                { label: "Genome",    align: "right", width: "13%" },
                { label: "Protein-coding genes", align: "right", width: "19%" },
                { label: "GC", align: "right", width: "10%" },
              ].map(({ label, align, width }) => (
                <th
                  key={label}
                  style={{
                    width,
                    padding: "0.625rem 1rem",
                    textAlign: align as "left" | "right",
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--color-text-tertiary)",
                    backgroundColor: "var(--color-surface)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {species.map((s, i) => {
              const meta = parseMeta(s.metadata);
              const isEven = i % 2 === 0;
              return (
                <tr
                  key={s.ncbi_tax_id}
                  style={{
                    backgroundColor: isEven ? "var(--color-base)" : "var(--color-surface)",
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      "var(--color-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      isEven ? "var(--color-base)" : "var(--color-surface)";
                  }}
                >
                  {/* Species name */}
                  <td style={{ padding: "0.625rem 1rem" }}>
                    <Link
                      href={`/species/${s.ncbi_tax_id}`}
                      style={{ textDecoration: "none", display: "block" }}
                    >
                      <span style={{
                        fontStyle: "italic",
                        color: "var(--color-text)",
                        lineHeight: 1.4,
                        display: "block",
                      }}>
                        {s.scientific_name}
                      </span>
                      {s.common_name && (
                        <span style={{
                          fontStyle: "normal",
                          fontSize: "0.75rem",
                          color: "var(--color-text-secondary)",
                          marginTop: "0.1rem",
                          display: "block",
                        }}>
                          {s.common_name}
                        </span>
                      )}
                    </Link>
                  </td>

                  {/* Assembly */}
                  <td style={{ padding: "0.625rem 1rem", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <AssemblyBadge level={s.annotation_status} />
                      {s.refseq_category && (
                        <span style={{
                          fontSize: "0.6875rem",
                          color: "var(--color-text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "0.02em",
                        }}>
                          ref
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Genome size */}
                  <td style={{
                    padding: "0.625rem 1rem",
                    textAlign: "right",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text)",
                    fontVariantNumeric: "tabular-nums",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}>
                    {formatGenomeSize(s.genome_size_bp)}
                  </td>

                  {/* Protein-coding genes */}
                  <td style={{
                    padding: "0.625rem 1rem",
                    textAlign: "right",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text)",
                    fontVariantNumeric: "tabular-nums",
                    verticalAlign: "middle",
                  }}>
                    {formatNumber(meta.protein_coding_genes)}
                  </td>

                  {/* GC */}
                  <td style={{
                    padding: "0.625rem 1rem",
                    textAlign: "right",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}>
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
