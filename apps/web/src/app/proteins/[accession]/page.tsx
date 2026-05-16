import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProteinByAccession, getSpeciesById } from "@/lib/supabase/queries";
import { CopySequenceButton } from "./CopySequenceButton";

interface Props {
  params: Promise<{ accession: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accession } = await params;
  const protein = await getProteinByAccession(accession);
  if (!protein) return { title: "Not found" };
  return { title: protein.ncbi_protein_accession };
}

function formatSequence(seq: string, lineLen = 60): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < seq.length; i += lineLen) {
    chunks.push(seq.slice(i, i + lineLen));
  }
  return chunks;
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

export default async function ProteinDetailPage({ params }: Props) {
  const { accession } = await params;

  const protein = await getProteinByAccession(accession);
  if (!protein) notFound();

  const species = await getSpeciesById(protein.species_id);

  const sequenceLines = protein.sequence ? formatSequence(protein.sequence) : null;

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
        <span style={{ color: "var(--color-text-secondary)" }}>proteins</span>
        <span style={{ color: "var(--color-text-tertiary)" }}>/</span>
        <span style={{ color: "var(--color-text)" }}>{protein.ncbi_protein_accession}</span>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
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
          {protein.ncbi_protein_accession}
        </h1>
        {protein.description && (
          <p
            style={{
              margin: 0,
              fontSize: "1rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {protein.description}
          </p>
        )}
      </div>

      {/* Metadata row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          flexWrap: "wrap",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
          marginBottom: "2rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        {protein.length != null && (
          <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            {protein.length.toLocaleString()} aa
          </span>
        )}
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
        {/* Left: sequence + similarity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

          {/* Sequence section */}
          {sequenceLines && (
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.75rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                <h2
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-text-tertiary)",
                    margin: 0,
                  }}
                >
                  Sequence
                </h2>
                <CopySequenceButton sequence={protein.sequence!} />
              </div>
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8125rem",
                  color: "var(--color-text-secondary)",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "4px",
                  padding: "1rem",
                  margin: 0,
                  overflowX: "auto",
                  lineHeight: 1.6,
                  whiteSpace: "pre",
                }}
              >
                {sequenceLines.join("\n")}
              </pre>
            </section>
          )}

          {/* Similarity search placeholder */}
          <section>
            <SectionHeading>Sequence similarity search</SectionHeading>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-tertiary)",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              Sequence similarity search available once embeddings are indexed.
            </p>
          </section>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Details */}
          <section>
            <SectionHeading>Details</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <span style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>Accession</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {protein.ncbi_protein_accession}
                </span>
              </div>
              {protein.length != null && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>Length</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {protein.length.toLocaleString()} aa
                  </span>
                </div>
              )}
              {species && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}>Species</span>
                  <Link
                    href={`/species/${species.ncbi_tax_id}`}
                    style={{
                      fontStyle: "italic",
                      color: "var(--color-text)",
                      textDecoration: "none",
                      textAlign: "right",
                    }}
                  >
                    {species.scientific_name}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* External links */}
          <section>
            <SectionHeading>Links</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <a
                href={`https://www.ncbi.nlm.nih.gov/protein/${protein.ncbi_protein_accession}`}
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
                <span>NCBI Protein</span>
                <span style={{ color: "var(--color-text-tertiary)" }}>↗</span>
              </a>
              {species && (
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
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
