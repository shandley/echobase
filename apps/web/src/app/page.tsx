import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils/format";

async function getStats() {
  const client = await createClient();
  const [species, proteins, papers] = await Promise.all([
    client.from("species").select("id", { count: "exact", head: true }),
    client.from("proteins").select("id", { count: "exact", head: true }),
    client.from("papers").select("id", { count: "exact", head: true }),
  ]);
  return {
    species: species.count ?? 50,
    proteins: proteins.count ?? 0,
    papers: papers.count ?? 0,
  };
}

export default async function Home() {
  const stats = await getStats();

  const statItems = [
    { label: "Species", value: formatNumber(stats.species), sub: "annotated assemblies", href: "/species" },
    { label: "Proteins", value: formatNumber(stats.proteins), sub: "sequences indexed", href: null },
    { label: "Literature", value: formatNumber(stats.papers), sub: "bat biology papers", href: "/papers" },
  ];

  return (
    <div style={{ maxWidth: "42rem", margin: "0 auto", padding: "5rem 1.5rem" }}>
      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.6875rem",
        letterSpacing: "0.08em",
        color: "var(--color-accent)",
        textTransform: "uppercase",
        marginBottom: "1.25rem",
      }}>
        Chiroptera · Genomics Platform
      </p>

      <h1 style={{
        fontSize: "2rem",
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: "-0.025em",
        color: "var(--color-text)",
        margin: "0 0 1rem",
      }}>
        Genomic knowledge for bat biology
      </h1>

      <p style={{
        fontSize: "1rem",
        lineHeight: 1.7,
        color: "var(--color-text-secondary)",
        maxWidth: "36rem",
        margin: "0 0 2.5rem",
      }}>
        EchoBase integrates annotated genome assemblies, protein sequences, and
        scientific literature across 50 Chiroptera species. Sequence similarity
        via language model embeddings; cross-database entity linking; AI-assisted
        literature synthesis; interactive{" "}
        <a
          href="/taxonomy"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          phylogeny browser
        </a>{" "}
        for the full order.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <Link
          href="/species"
          style={{
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: "var(--color-accent)",
            color: "oklch(10% 0.01 82)",
            padding: "0.5rem 1rem",
            borderRadius: "3px",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          Browse species
        </Link>
        <Link
          href="/qa"
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
            textDecoration: "none",
            border: "1px solid var(--color-border)",
            padding: "0.5rem 1rem",
            borderRadius: "3px",
          }}
        >
          Ask a question
        </Link>
        <a
          href="https://github.com/shandley/echobase"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-text-tertiary)",
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
          }}
        >
          GitHub
        </a>
      </div>

      <div
        style={{
          marginTop: "4rem",
          paddingTop: "2rem",
          borderTop: "1px solid var(--color-border-subtle)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0",
        }}
      >
        {statItems.map(({ label, value, sub, href }, i) => {
          const content = (
            <>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "1.5rem",
                fontWeight: 500,
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}>
                {value}
              </div>
              <div style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                color: "var(--color-accent)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: "0.25rem",
              }}>
                {label}
              </div>
              <div style={{
                fontSize: "0.75rem",
                color: "var(--color-text-tertiary)",
                marginTop: "0.125rem",
              }}>
                {sub}
              </div>
            </>
          );

          const wrapStyle = {
            padding: "1.25rem 0",
            paddingLeft: i > 0 ? "1.5rem" : 0,
            borderLeft: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
            marginLeft: i > 0 ? "1.5rem" : 0,
            textDecoration: "none",
            display: "block",
          };

          return href ? (
            <Link key={label} href={href} style={wrapStyle}>{content}</Link>
          ) : (
            <div key={label} style={wrapStyle}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
