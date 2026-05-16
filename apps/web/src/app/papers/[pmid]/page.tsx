import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPaperByPmid,
  getPaperEntities,
  getSpeciesForPaper,
} from "@/lib/supabase/queries";
import type { PaperEntity } from "@/lib/supabase/queries";
import { stripHtml } from "@/lib/utils/format";

interface Props {
  params: Promise<{ pmid: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pmid } = await params;
  const paper = await getPaperByPmid(Number(pmid));
  if (!paper) return { title: "Not found" };
  return { title: paper.title };
}

type EntityType = "gene" | "species" | "disease" | "chemical" | "variant" | "cell_line";

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

function entityTypeLabel(type: string): string {
  switch (type) {
    case "gene":      return "Genes mentioned";
    case "species":   return "Species mentioned";
    case "disease":   return "Diseases mentioned";
    case "chemical":  return "Chemicals mentioned";
    case "variant":   return "Variants mentioned";
    case "cell_line": return "Cell lines mentioned";
    default:          return type;
  }
}

function EntityBadge({ entity }: { entity: PaperEntity }) {
  const { bg, color } = entityTypeStyle(entity.entity_type);

  const inner = (
    <span style={{
      display: "inline-block",
      backgroundColor: bg,
      color,
      fontSize: "0.75rem",
      fontWeight: 500,
      padding: "0.2rem 0.5rem",
      borderRadius: "2px",
      lineHeight: 1.5,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.02em",
    }}>
      {entity.entity_name}
    </span>
  );

  // Species with a normalized_id → link to species page
  if (entity.entity_type === "species" && entity.normalized_id) {
    return (
      <Link
        href={`/species/${entity.normalized_id}`}
        style={{ textDecoration: "none" }}
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

const ENTITY_TYPE_ORDER: EntityType[] = [
  "gene", "species", "disease", "chemical", "variant", "cell_line",
];

function groupEntitiesByType(entities: PaperEntity[]): Map<string, PaperEntity[]> {
  const map = new Map<string, PaperEntity[]>();
  for (const entity of entities) {
    const existing = map.get(entity.entity_type);
    if (existing) {
      existing.push(entity);
    } else {
      map.set(entity.entity_type, [entity]);
    }
  }
  return map;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </h2>
  );
}

export default async function PaperDetailPage({ params }: Props) {
  const { pmid } = await params;
  const pmidNum = Number(pmid);
  if (Number.isNaN(pmidNum)) notFound();

  const paper = await getPaperByPmid(pmidNum);
  if (!paper) notFound();

  const [entities, relatedSpecies] = await Promise.all([
    getPaperEntities(paper.id),
    getSpeciesForPaper(paper.id),
  ]);

  const grouped = groupEntitiesByType(entities);
  const cleanTitle = stripHtml(paper.title);
  const titleTruncated = cleanTitle.length > 60
    ? cleanTitle.slice(0, 60).trimEnd() + "…"
    : cleanTitle;

  return (
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Breadcrumb */}
      <nav style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.8125rem",
        color: "var(--color-text-secondary)",
        marginBottom: "1.75rem",
        fontFamily: "var(--font-mono)",
      }}>
        <Link href="/papers" style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}>
          papers
        </Link>
        <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
        <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {titleTruncated}
        </span>
      </nav>

      {/* Title */}
      <h1 style={{
        fontSize: "1.5rem",
        fontWeight: 600,
        letterSpacing: "-0.025em",
        color: "var(--color-text)",
        margin: "0 0 1rem",
        lineHeight: 1.3,
        fontStyle: "normal",
      }}>
        {cleanTitle}
      </h1>

      {/* Meta row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        flexWrap: "wrap",
        fontSize: "0.875rem",
        color: "var(--color-text-secondary)",
        marginBottom: "2rem",
      }}>
        {paper.year && (
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            {paper.year}
          </span>
        )}
        {paper.journal && (
          <>
            <span style={{ color: "var(--color-border)" }}>·</span>
            <span>{paper.journal}</span>
          </>
        )}
        {paper.doi && (
          <>
            <span style={{ color: "var(--color-border)" }}>·</span>
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--color-accent)",
                textDecoration: "none",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
              }}
            >
              {paper.doi}
            </a>
          </>
        )}
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 16rem", gap: "2.5rem", alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

          {/* Abstract */}
          {paper.abstract && (
            <section>
              <SectionHeading>Abstract</SectionHeading>
              <p style={{
                fontSize: "0.875rem",
                color: "var(--color-text-secondary)",
                lineHeight: 1.7,
                margin: 0,
              }}>
                {paper.abstract}
              </p>
            </section>
          )}

          {/* Entity annotations */}
          {entities.length > 0 && (
            <section>
              <SectionHeading>Entity annotations</SectionHeading>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {ENTITY_TYPE_ORDER.filter((type) => grouped.has(type)).map((type) => {
                  const typeEntities = grouped.get(type)!;
                  return (
                    <div key={type}>
                      <div style={{
                        fontSize: "0.6875rem",
                        fontWeight: 500,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--color-text-tertiary)",
                        marginBottom: "0.5rem",
                      }}>
                        {entityTypeLabel(type)}
                        <span style={{
                          marginLeft: "0.5rem",
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-tertiary)",
                        }}>
                          {typeEntities.length}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                        {typeEntities.map((entity) => (
                          <EntityBadge key={entity.id} entity={entity} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Related bat species */}
          {relatedSpecies.length > 0 && (
            <section>
              <SectionHeading>Related bat species</SectionHeading>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {relatedSpecies.map((s) => (
                  <Link
                    key={s.ncbi_tax_id}
                    href={`/species/${s.ncbi_tax_id}`}
                    style={{
                      display: "inline-block",
                      fontSize: "0.8125rem",
                      fontStyle: "italic",
                      color: "var(--color-text-secondary)",
                      textDecoration: "none",
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "3px",
                      padding: "0.25rem 0.625rem",
                    }}
                  >
                    {s.scientific_name}
                    {s.common_name && (
                      <span style={{
                        fontStyle: "normal",
                        marginLeft: "0.4rem",
                        color: "var(--color-text-tertiary)",
                        fontSize: "0.75rem",
                      }}>
                        ({s.common_name})
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* External links */}
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
              Links
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>PubMed</span>
                <span style={{ color: "var(--color-text-tertiary)" }}>↗</span>
              </a>
              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Full text (DOI)</span>
                  <span style={{ color: "var(--color-text-tertiary)" }}>↗</span>
                </a>
              )}
            </div>
          </section>

          {/* Paper metadata */}
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
              Details
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <span style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>PMID</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
                  {paper.pmid}
                </span>
              </div>
              {paper.year && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>Year</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                    {paper.year}
                  </span>
                </div>
              )}
              {entities.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>Entities</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                    {entities.length}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
