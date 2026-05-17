import type { Metadata } from "next";
import Link from "next/link";
import { searchSpecies, searchPapers, searchGenes, type GeneWithSpecies } from "@/lib/supabase/queries";
import { semanticSearchPapers } from "@/lib/actions/search";
import type { SemanticPaperResult } from "@/lib/actions/search";
import { formatGenomeSize, stripHtml } from "@/lib/utils/format";
import { SearchBox } from "@/components/SearchBox";
import type { Json } from "@/lib/supabase/types";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search: ${q}` : "Search" };
}

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

type PaperSearchResult =
  | { kind: "semantic"; results: SemanticPaperResult[] }
  | { kind: "keyword"; results: Awaited<ReturnType<typeof searchPapers>> };

async function fetchPaperResults(query: string): Promise<PaperSearchResult> {
  try {
    const results = await semanticSearchPapers(query, 20);
    return { kind: "semantic", results };
  } catch {
    // HF API unavailable or rate-limited — fall back to keyword search
    const results = await searchPapers(query);
    return { kind: "keyword", results };
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [speciesResults, geneResults, paperSearch] = query
    ? await Promise.all([searchSpecies(query), searchGenes(query), fetchPaperResults(query)])
    : [[], [] as GeneWithSpecies[], { kind: "keyword" as const, results: [] }];

  const paperResults = paperSearch.results;
  const isSemantic = paperSearch.kind === "semantic";

  return (
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{
          fontSize: "1.375rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--color-text)",
          margin: "0 0 1rem",
        }}>
          Search
        </h1>
        <SearchBox initialQuery={query} />
        {!query && (
          <p style={{
            marginTop: "0.75rem",
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
          }}>
            Search across species, genes, and literature
          </p>
        )}
      </div>

      {/* Results */}
      {query && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

          {/* Species section */}
          <section>
            <h2 style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              margin: "0 0 0.75rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}>
              Species
              <span style={{
                marginLeft: "0.625rem",
                fontFamily: "var(--font-mono)",
                color: speciesResults.length > 0 ? "var(--color-accent)" : "var(--color-text-tertiary)",
              }}>
                {speciesResults.length}
              </span>
            </h2>

            {speciesResults.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)" }}>
                No species matched &ldquo;{query}&rdquo;
              </p>
            ) : (
              <div style={{
                border: "1px solid var(--color-border)",
                borderRadius: "4px",
                overflow: "hidden",
              }}>
                {speciesResults.map((s, i) => {
                  const meta = parseMeta(s.metadata);
                  const isEven = i % 2 === 0;
                  return (
                    <Link
                      key={s.ncbi_tax_id}
                      href={`/species/${s.ncbi_tax_id}`}
                      className={isEven ? "species-row-even" : "species-row-odd"}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto",
                        gap: "1rem",
                        alignItems: "center",
                        padding: "0.625rem 1rem",
                        borderBottom: i < speciesResults.length - 1
                          ? "1px solid var(--color-border-subtle)"
                          : "none",
                        textDecoration: "none",
                      }}
                    >
                      {/* Name */}
                      <div>
                        <span style={{
                          fontStyle: "italic",
                          color: "var(--color-text)",
                          fontSize: "0.875rem",
                          display: "block",
                          lineHeight: 1.4,
                        }}>
                          {s.scientific_name}
                        </span>
                        {s.common_name && (
                          <span style={{
                            fontStyle: "normal",
                            fontSize: "0.75rem",
                            color: "var(--color-text-secondary)",
                            display: "block",
                            marginTop: "0.1rem",
                          }}>
                            {s.common_name}
                          </span>
                        )}
                      </div>

                      {/* Assembly badge */}
                      <AssemblyBadge level={s.annotation_status} />

                      {/* Genome size */}
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8125rem",
                        color: "var(--color-text-secondary)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}>
                        {formatGenomeSize(s.genome_size_bp)}
                      </span>

                      {/* Protein-coding gene count */}
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        color: "var(--color-text-tertiary)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}>
                        {meta.protein_coding_genes != null
                          ? `${meta.protein_coding_genes.toLocaleString()} genes`
                          : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Genes section */}
          <section>
            <h2 style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              margin: "0 0 0.75rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}>
              Genes
              <span style={{
                marginLeft: "0.625rem",
                fontFamily: "var(--font-mono)",
                color: geneResults.length > 0 ? "var(--color-accent)" : "var(--color-text-tertiary)",
              }}>
                {geneResults.length}
              </span>
            </h2>

            {geneResults.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)" }}>
                No genes matched &ldquo;{query}&rdquo;
              </p>
            ) : (
              <div style={{
                border: "1px solid var(--color-border)",
                borderRadius: "4px",
                overflow: "hidden",
              }}>
                {geneResults.map((gene, i) => (
                  <Link
                    key={gene.id}
                    href={`/genes/${gene.id}`}
                    className={i % 2 === 0 ? "gene-row-even" : "gene-row-odd"}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "8rem 1fr auto auto",
                      gap: "1rem",
                      alignItems: "center",
                      padding: "0.625rem 1rem",
                      borderBottom: i < geneResults.length - 1
                        ? "1px solid var(--color-border-subtle)"
                        : "none",
                      textDecoration: "none",
                    }}
                  >
                    {/* Symbol */}
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "var(--color-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {gene.symbol ?? `gene:${gene.id}`}
                    </span>

                    {/* Gene name */}
                    <span style={{
                      fontSize: "0.8125rem",
                      color: "var(--color-text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {gene.name ?? ""}
                    </span>

                    {/* Biotype badge */}
                    {gene.gene_biotype ? (
                      <span style={{
                        display: "inline-block",
                        backgroundColor: "var(--color-badge-other-bg)",
                        color: "var(--color-badge-other-text)",
                        fontSize: "0.6875rem",
                        fontWeight: 500,
                        letterSpacing: "0.03em",
                        padding: "0.2rem 0.45rem",
                        borderRadius: "2px",
                        lineHeight: 1.4,
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "nowrap",
                      }}>
                        {gene.gene_biotype}
                      </span>
                    ) : (
                      <span />
                    )}

                    {/* Species name (italic) */}
                    <span style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-tertiary)",
                      fontStyle: "italic",
                      whiteSpace: "nowrap",
                    }}>
                      {gene.species?.scientific_name ?? ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Papers section */}
          <section>
            <h2 style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              margin: "0 0 0.75rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}>
              Literature
              <span style={{
                marginLeft: "0.625rem",
                fontFamily: "var(--font-mono)",
                color: paperResults.length > 0 ? "var(--color-accent)" : "var(--color-text-tertiary)",
              }}>
                {paperResults.length}
              </span>
              {isSemantic && (
                <span style={{
                  marginLeft: "0.75rem",
                  fontSize: "0.6875rem",
                  fontWeight: 400,
                  letterSpacing: "0.02em",
                  textTransform: "none",
                  color: "var(--color-text-tertiary)",
                  fontStyle: "italic",
                }}>
                  Results ranked by semantic similarity
                </span>
              )}
            </h2>

            {paperResults.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)" }}>
                No papers matched &ldquo;{query}&rdquo;
              </p>
            ) : (
              <div style={{
                border: "1px solid var(--color-border)",
                borderRadius: "4px",
                overflow: "hidden",
              }}>
                {paperResults.map((paper, i) => {
                  const similarity = isSemantic
                    ? (paper as SemanticPaperResult).similarity
                    : null;
                  return (
                    <Link
                      key={paper.id}
                      href={`/papers/${paper.pmid}`}
                      className={i % 2 === 0 ? "paper-row-even" : "paper-row-odd"}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "4rem 1fr auto",
                        gap: "1rem",
                        alignItems: "start",
                        padding: "0.625rem 1rem",
                        borderBottom: i < paperResults.length - 1
                          ? "1px solid var(--color-border-subtle)"
                          : "none",
                        textDecoration: "none",
                      }}
                    >
                      {/* Year */}
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8125rem",
                        color: "var(--color-text-secondary)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                        paddingTop: "0.1rem",
                      }}>
                        {paper.year ?? "—"}
                      </span>

                      {/* Title + journal + semantic label */}
                      <div>
                        <span style={{
                          color: "var(--color-text)",
                          fontSize: "0.875rem",
                          display: "block",
                          lineHeight: 1.45,
                        }}>
                          {stripHtml(paper.title)}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.15rem" }}>
                          {paper.journal && (
                            <span style={{
                              fontSize: "0.75rem",
                              color: "var(--color-text-tertiary)",
                            }}>
                              {paper.journal}
                            </span>
                          )}
                          {similarity !== null && (
                            <span style={{
                              fontSize: "0.6875rem",
                              color: "var(--color-text-tertiary)",
                              fontFamily: "var(--font-mono)",
                              fontVariantNumeric: "tabular-nums",
                            }}>
                              {Math.round(similarity * 100)}% match
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <span style={{ color: "var(--color-text-tertiary)", paddingTop: "0.1rem" }}>↗</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      )}

    </div>
  );
}
