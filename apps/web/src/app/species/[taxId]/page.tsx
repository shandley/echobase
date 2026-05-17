import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSpeciesByTaxId,
  getProteinCountForSpecies,
  getGeneCountForSpecies,
  getRelatedSpecies,
  getPapersForSpecies,
  getPaperCountForSpecies,
  type Paper,
} from "@/lib/supabase/queries";
import { formatGenomeSize, formatNumber, stripHtml } from "@/lib/utils/format";
import type { Json } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ taxId: string }>;
}

interface SpeciesMeta {
  protein_coding_genes?: number;
  total_genes?: number;
  gc_percent?: number;
  scaffold_n50?: number;
  contig_n50?: number;
  sequencing_tech?: string;
  annotation_provider?: string;
  assembly_level?: string;
  release_date?: string;
}

function parseMeta(raw: Json): SpeciesMeta {
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as SpeciesMeta;
  }
  return {};
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { taxId } = await params;
  const species = await getSpeciesByTaxId(Number(taxId));
  if (!species) return { title: "Not found" };
  return { title: species.scientific_name };
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

function Stat({ label, value, mono = true, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  const inner = (
    <>
      <div style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: "1.25rem",
        fontWeight: 500,
        color: "var(--color-text)",
        letterSpacing: mono ? "-0.01em" : "-0.02em",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.2,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: "0.6875rem",
        fontWeight: 500,
        color: "var(--color-text-tertiary)",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        marginTop: "0.375rem",
      }}>
        {label}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        style={{
          display: "block",
          padding: "1.125rem 1.25rem",
          borderRight: "1px solid var(--color-border-subtle)",
          textDecoration: "none",
        }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div style={{
      padding: "1.125rem 1.25rem",
      borderRight: "1px solid var(--color-border-subtle)",
    }}>
      {inner}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "10rem 1fr",
      gap: "1rem",
      padding: "0.625rem 0",
      borderBottom: "1px solid var(--color-border-subtle)",
      fontSize: "0.875rem",
      alignItems: "start",
    }}>
      <span style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}

export default async function SpeciesDetailPage({ params }: Props) {
  const { taxId } = await params;
  const taxIdNum = Number(taxId);
  if (Number.isNaN(taxIdNum)) notFound();

  const species = await getSpeciesByTaxId(taxIdNum);
  if (!species) notFound();

  const [relatedSpecies, proteinCount, geneCount, recentPapers, paperCount] = await Promise.all([
    getRelatedSpecies(species.genus ?? "", taxIdNum),
    getProteinCountForSpecies(species.id),
    getGeneCountForSpecies(species.id),
    getPapersForSpecies(species.id, 6),
    getPaperCountForSpecies(species.id),
  ]);

  const meta = parseMeta(species.metadata);

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
        <Link href="/species" style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}>
          species
        </Link>
        <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
        {species.genus && (
          <>
            <span style={{ fontStyle: "italic" }}>{species.genus}</span>
            <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
          </>
        )}
        <span style={{ color: "var(--color-text)", fontStyle: "italic" }}>
          {species.scientific_name}
        </span>
      </nav>

      {/* Title row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "2rem",
        marginBottom: "1.75rem",
      }}>
        <div>
          <h1 style={{
            fontSize: "1.875rem",
            fontWeight: 600,
            fontStyle: "italic",
            letterSpacing: "-0.03em",
            color: "var(--color-text)",
            margin: 0,
            lineHeight: 1.15,
          }}>
            {species.scientific_name}
          </h1>
          {species.common_name && (
            <p style={{
              margin: "0.375rem 0 0",
              fontStyle: "normal",
              fontSize: "1rem",
              color: "var(--color-text-secondary)",
            }}>
              {species.common_name}
            </p>
          )}
          <div style={{ marginTop: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AssemblyBadge level={species.annotation_status} />
            {species.refseq_category && (
              <span style={{
                fontSize: "0.6875rem",
                fontFamily: "var(--font-mono)",
                color: "var(--color-accent)",
                letterSpacing: "0.04em",
              }}>
                {species.refseq_category}
              </span>
            )}
          </div>
        </div>
        <div style={{
          textAlign: "right",
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          color: "var(--color-text-tertiary)",
          lineHeight: 1.6,
          flexShrink: 0,
        }}>
          <div>{species.genome_assembly_accession}</div>
          <div>taxid:{species.ncbi_tax_id}</div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
        overflow: "hidden",
        marginBottom: "2rem",
      }}>
        <Stat label="Genome size" value={formatGenomeSize(species.genome_size_bp)} />
        <Stat label="Protein-coding" value={formatNumber(meta.protein_coding_genes)} />
        <Stat label="Gene count" value={geneCount > 0 ? formatNumber(geneCount) : "—"} />
        <Stat
          label="Proteins"
          value={proteinCount > 0 ? formatNumber(proteinCount) : "Loading"}
          href={`/species/${taxIdNum}/proteins`}
        />
        <div style={{ padding: "1.125rem 1.25rem" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "1.25rem",
            fontWeight: 500,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}>
            {meta.gc_percent != null ? `${meta.gc_percent}%` : "—"}
          </div>
          <div style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginTop: "0.375rem",
          }}>
            GC content
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 16rem", gap: "2rem", alignItems: "start" }}>

        {/* Left: details */}
        <div>
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              margin: "0 0 0.75rem",
            }}>
              Assembly
            </h2>
            <div>
              <Field label="Accession" value={species.genome_assembly_accession} />
              <Field label="Assembly level" value={species.annotation_status} />
              <Field label="Release date" value={meta.release_date} />
              <Field
                label="Sequencing"
                value={meta.sequencing_tech}
              />
              <Field label="Annotator" value={meta.annotation_provider} />
              <Field
                label="Scaffold N50"
                value={meta.scaffold_n50 ? formatGenomeSize(meta.scaffold_n50) : null}
              />
              <Field
                label="Contig N50"
                value={meta.contig_n50 ? formatGenomeSize(meta.contig_n50) : null}
              />
            </div>
          </section>

          <section>
            <h2 style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              margin: "0 0 0.75rem",
            }}>
              Gene annotation
            </h2>
            <div>
              <Field label="Protein-coding" value={formatNumber(meta.protein_coding_genes)} />
              <Field label="Total genes" value={formatNumber(meta.total_genes)} />
              <Field label="Annotator" value={meta.annotation_provider} />
            </div>
          </section>
        </div>

        {/* Right: sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Taxonomy */}
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
              Taxonomy
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>Order</span>
                <span style={{ fontStyle: "italic", color: "var(--color-text)" }}>Chiroptera</span>
              </div>
              {species.genus && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Genus</span>
                  <span style={{ fontStyle: "italic", color: "var(--color-text)" }}>{species.genus}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>Tax ID</span>
                <a
                  href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${species.ncbi_tax_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    color: "var(--color-accent)",
                    textDecoration: "none",
                  }}
                >
                  {species.ncbi_tax_id}
                </a>
              </div>
              <div style={{ paddingTop: "0.5rem" }}>
                <Link
                  href="/taxonomy"
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  View in taxonomy browser →
                </Link>
              </div>
            </div>
          </section>

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
              {species.genome_assembly_accession && (
                <a
                  href={`https://www.ncbi.nlm.nih.gov/datasets/genome/${species.genome_assembly_accession}/`}
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
                  <span>NCBI Genome</span>
                  <span style={{ color: "var(--color-text-tertiary)" }}>↗</span>
                </a>
              )}
              <a
                href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${species.ncbi_tax_id}`}
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
                <span>NCBI Taxonomy</span>
                <span style={{ color: "var(--color-text-tertiary)" }}>↗</span>
              </a>
            </div>
          </section>

          {/* Related */}
          {relatedSpecies.length > 0 && (
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
                Same genus
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {relatedSpecies.map((rel) => (
                  <Link
                    key={rel.ncbi_tax_id}
                    href={`/species/${rel.ncbi_tax_id}`}
                    style={{
                      fontSize: "0.8125rem",
                      fontStyle: "italic",
                      color: "var(--color-text-secondary)",
                      textDecoration: "none",
                    }}
                  >
                    {rel.scientific_name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Recent literature */}
      {recentPapers.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: "1rem",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}>
            <h2 style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              margin: 0,
            }}>
              Literature
            </h2>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {paperCount.toLocaleString()} papers
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {recentPapers.map((paper: Paper, i: number) => (
              <Link
                key={paper.pmid}
                href={`/papers/${paper.pmid}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  backgroundColor: i % 2 === 0 ? "transparent" : "transparent",
                }}
              >
                <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6875rem",
                    color: "var(--color-text-tertiary)",
                    flexShrink: 0,
                    paddingTop: "0.125rem",
                    minWidth: "2.5rem",
                  }}>
                    {paper.year ?? "—"}
                  </span>
                  <div>
                    <div style={{
                      fontSize: "0.875rem",
                      color: "var(--color-text)",
                      lineHeight: 1.4,
                    }}>
                      {stripHtml(paper.title)}
                    </div>
                    {paper.journal && (
                      <div style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                        marginTop: "0.25rem",
                        fontStyle: "italic",
                      }}>
                        {paper.journal}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
