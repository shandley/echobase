import type { Metadata } from "next";
import { TaxonomyBrowser } from "@/components/TaxonomyBrowser";

export const metadata: Metadata = {
  title: "Taxonomy",
  description:
    "Interactive phylogenetic tree of Chiroptera (bats) — all 1,400+ species across the order, rendered via OneZoom.",
};

export default function TaxonomyPage() {
  return (
    <>
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
          padding: "1.5rem 1.5rem 1rem",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            Chiroptera Phylogeny
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.8125rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Full order tree via OneZoom. Click any species to explore on OneZoom. Use
            the{" "}
            <a
              href="/species"
              style={{ color: "var(--color-accent)", textDecoration: "none" }}
            >
              species browser
            </a>{" "}
            to view EchoBase data.
          </p>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          Chiroptera · taxid:9397
        </span>
      </div>

      <TaxonomyBrowser />
    </>
  );
}
