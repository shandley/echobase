import type { Metadata } from "next";
import Link from "next/link";
import { getPapers, getEntityCountsForPapers } from "@/lib/supabase/queries";
import type { Paper } from "@/lib/supabase/queries";
import { stripHtml } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Papers" };

function entityTypeStyle(type: string): { bg: string; color: string } {
  switch (type) {
    case "gene":
      return { bg: "oklch(14% 0.04 250)", color: "oklch(68% 0.12 250)" };
    case "species":
      return { bg: "var(--color-badge-chromosome-bg)", color: "var(--color-badge-chromosome-text)" };
    case "disease":
      return { bg: "oklch(14% 0.04 20)", color: "oklch(65% 0.12 20)" };
    case "chemical":
      return { bg: "oklch(14% 0.04 82)", color: "oklch(72% 0.14 82)" };
    case "variant":
      return { bg: "oklch(14% 0.04 55)", color: "oklch(68% 0.13 55)" };
    case "cell_line":
      return { bg: "oklch(14% 0.02 248)", color: "oklch(60% 0.08 248)" };
    default:
      return { bg: "oklch(14% 0.02 250)", color: "oklch(57% 0.016 248)" };
  }
}

function EntityChip({ type, count }: { type: string; count: number }) {
  const { bg, color } = entityTypeStyle(type);
  const label = type === "cell_line" ? "cell lines" : `${type}s`;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.25rem",
      backgroundColor: bg,
      color,
      fontSize: "0.625rem",
      fontWeight: 500,
      letterSpacing: "0.04em",
      padding: "0.15rem 0.4rem",
      borderRadius: "2px",
      lineHeight: 1.5,
      fontFamily: "var(--font-mono)",
      whiteSpace: "nowrap",
      textTransform: "uppercase",
    }}>
      {count} {label}
    </span>
  );
}

function AuthorList({ authors }: { authors: Paper["authors"] }) {
  if (!Array.isArray(authors) || authors.length === 0) return null;
  const names = authors as string[];
  if (names.length === 1) return <>{names[0]}</>;
  if (names.length <= 3) return <>{names.join(", ")}</>;
  return <>{names[0]}, et al.</>;
}

export default async function PapersListPage() {
  const papers = await getPapers(100);
  const ids = papers.map((p) => p.id);
  const entityCounts = await getEntityCountsForPapers(ids);

  // Build per-paper entity type breakdown for chips
  // We only have total counts here -- for type breakdown we need a different query
  // Use total count as a single chip for now since we fetched only paper_id
  // (getEntityCountsForPapers returns totals -- sufficient for list view)

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
          Papers
        </h1>
        <p style={{
          marginTop: "0.375rem",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
        }}>
          {papers.length} bat biology papers with entity annotations
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
                { label: "Year",    align: "left",  width: "5rem" },
                { label: "Title",   align: "left",  width: "auto" },
                { label: "Journal", align: "left",  width: "14rem" },
                { label: "Entities", align: "right", width: "7rem" },
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
            {papers.map((paper, i) => {
              const count = entityCounts.get(paper.id) ?? 0;
              const isEven = i % 2 === 0;
              return (
                <tr
                  key={paper.id}
                  className={isEven ? "paper-row-even" : "paper-row-odd"}
                  style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                >
                  {/* Year */}
                  <td style={{
                    padding: "0.625rem 1rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}>
                    {paper.year ?? "—"}
                  </td>

                  {/* Title + authors */}
                  <td style={{ padding: "0.625rem 1rem", verticalAlign: "top" }}>
                    <Link
                      href={`/papers/${paper.pmid}`}
                      style={{ textDecoration: "none", display: "block" }}
                    >
                      <span style={{
                        color: "var(--color-text)",
                        lineHeight: 1.45,
                        display: "block",
                        fontSize: "0.875rem",
                      }}>
                        {stripHtml(paper.title)}
                      </span>
                    </Link>
                    <span style={{
                      display: "block",
                      marginTop: "0.2rem",
                      fontSize: "0.75rem",
                      color: "var(--color-text-tertiary)",
                    }}>
                      <AuthorList authors={paper.authors} />
                    </span>
                  </td>

                  {/* Journal */}
                  <td style={{
                    padding: "0.625rem 1rem",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    verticalAlign: "top",
                    lineHeight: 1.4,
                  }}>
                    {paper.journal ?? "—"}
                  </td>

                  {/* Entity count */}
                  <td style={{
                    padding: "0.625rem 1rem",
                    textAlign: "right",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}>
                    {count > 0 && (
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8125rem",
                        color: "var(--color-text-secondary)",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {count}
                      </span>
                    )}
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
