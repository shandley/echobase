import Link from "next/link";

export default function Home() {
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
        literature synthesis.
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
        <a
          href="https://github.com/shandley/echobase"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-text-secondary)",
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
          }}
        >
          github/shandley/echobase
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
        {[
          { label: "Species", value: "50", sub: "annotated assemblies" },
          { label: "Proteins", value: "~1.3M", sub: "loading" },
          { label: "Literature", value: "—", sub: "coming soon" },
        ].map(({ label, value, sub }, i) => (
          <div
            key={label}
            style={{
              padding: "1.25rem 0",
              paddingLeft: i > 0 ? "1.5rem" : 0,
              borderLeft: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
              marginLeft: i > 0 ? "1.5rem" : 0,
            }}
          >
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
          </div>
        ))}
      </div>
    </div>
  );
}
