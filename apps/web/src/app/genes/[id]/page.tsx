import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGeneById, getSpeciesById } from "@/lib/supabase/queries";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const gene = await getGeneById(Number(id));
  if (!gene) return { title: "Not found" };
  return { title: gene.symbol ?? `Gene ${gene.id}` };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "0.6875rem",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-text-tertiary)",
        margin: "0 0 0.75rem",
        paddingBottom: "0.5rem",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      {children}
    </h2>
  );
}

function BiotypeBadge({ biotype }: { biotype: string | null }) {
  if (!biotype) return null;
  return (
    <span
      style={{
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
      }}
    >
      {biotype}
    </span>
  );
}

function formatChromosomeLocation(
  chromosome: string | null,
  startPos: number | null,
  endPos: number | null,
): string | null {
  if (!chromosome || startPos == null || endPos == null) return null;
  const start = startPos.toLocaleString();
  const end = endPos.toLocaleString();
  return `${chromosome}: ${start} – ${end}`;
}

export default async function GeneDetailPage({ params }: Props) {
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) notFound();

  const gene = await getGeneById(idNum);
  if (!gene) notFound();

  const species = await getSpeciesById(gene.species_id);

  const displayName = gene.symbol ?? `Gene id:${gene.id}`;
  const chromLocation = formatChromosomeLocation(
    gene.chromosome,
    gene.start_pos,
    gene.end_pos,
  );

  return (
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

      {/* Breadcrumb */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
          marginBottom: "1.75rem",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span style={{ color: "var(--color-text-secondary)" }}>genes</span>
        <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
        <span style={{ color: "var(--color-text)" }}>{displayName}</span>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "1.75rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--color-text)",
            margin: "0 0 0.5rem",
            lineHeight: 1.2,
          }}
        >
          {displayName}
        </h1>
        {gene.name && (
          <p
            style={{
              margin: 0,
              fontSize: "1rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {gene.name}
          </p>
        )}
      </div>

      {/* Metadata row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
          marginBottom: "2rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <BiotypeBadge biotype={gene.gene_biotype} />
        {species && (
          <>
            <span style={{ color: "var(--color-border)" }}>·</span>
            <Link
              href={`/species/${species.ncbi_tax_id}`}
              style={{
                fontStyle: "italic",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
            >
              {species.scientific_name}
            </Link>
          </>
        )}
        {chromLocation && (
          <>
            <span style={{ color: "var(--color-border)" }}>·</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
                color: "var(--color-text-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {chromLocation}
            </span>
          </>
        )}
      </div>

      {/* Two-column body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 16rem",
          gap: "2rem",
          alignItems: "start",
        }}
      >
        {/* Left: main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

          {/* Description */}
          {gene.description && (
            <section>
              <SectionHeading>Description</SectionHeading>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9375rem",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {gene.description}
              </p>
            </section>
          )}

          {/* Gene details */}
          <section>
            <SectionHeading>Details</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {gene.gene_biotype && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "10rem 1fr",
                    gap: "1rem",
                    padding: "0.625rem 0",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: "0.875rem",
                    alignItems: "start",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>Biotype</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                    {gene.gene_biotype}
                  </span>
                </div>
              )}
              {gene.chromosome && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "10rem 1fr",
                    gap: "1rem",
                    padding: "0.625rem 0",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: "0.875rem",
                    alignItems: "start",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>Chromosome</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                    {gene.chromosome}
                  </span>
                </div>
              )}
              {gene.start_pos != null && gene.end_pos != null && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "10rem 1fr",
                    gap: "1rem",
                    padding: "0.625rem 0",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: "0.875rem",
                    alignItems: "start",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>Position</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {gene.start_pos.toLocaleString()} &ndash; {gene.end_pos.toLocaleString()}
                  </span>
                </div>
              )}
              {gene.strand && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "10rem 1fr",
                    gap: "1rem",
                    padding: "0.625rem 0",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: "0.875rem",
                    alignItems: "start",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>Strand</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                    {gene.strand === "+" ? "+ (forward)" : gene.strand === "-" ? "− (reverse)" : gene.strand}
                  </span>
                </div>
              )}
              {gene.ncbi_gene_id != null && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "10rem 1fr",
                    gap: "1rem",
                    padding: "0.625rem 0",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    fontSize: "0.875rem",
                    alignItems: "start",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>NCBI Gene ID</span>
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/gene/${gene.ncbi_gene_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-accent)",
                      textDecoration: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {gene.ncbi_gene_id}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Proteins note */}
          <section>
            <SectionHeading>Proteins</SectionHeading>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--color-text-tertiary)",
                fontStyle: "italic",
              }}
            >
              Protein sequences for this gene are available in the proteins database.
            </p>
          </section>

        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Species */}
          {species && (
            <section>
              <SectionHeading>Species</SectionHeading>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.8125rem" }}>
                <Link
                  href={`/species/${species.ncbi_tax_id}`}
                  style={{
                    fontStyle: "italic",
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  {species.scientific_name}
                </Link>
                {species.common_name && (
                  <span style={{ color: "var(--color-text-tertiary)" }}>
                    {species.common_name}
                  </span>
                )}
              </div>
            </section>
          )}

          {/* External links */}
          {gene.ncbi_gene_id != null && (
            <section>
              <SectionHeading>Links</SectionHeading>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <a
                  href={`https://www.ncbi.nlm.nih.gov/gene/${gene.ncbi_gene_id}`}
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
                  <span>NCBI Gene</span>
                  <span style={{ color: "var(--color-text-tertiary)" }}>&#8599;</span>
                </a>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
