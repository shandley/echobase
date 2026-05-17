import type { Metadata } from "next";
import { QAInterface } from "./QAInterface";

export const metadata: Metadata = {
  title: "Ask EchoBase",
  description:
    "AI-assisted Q&A over 9,999 bat biology papers using semantic search and Claude.",
};

export default function QAPage() {
  return (
    <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.6875rem",
          letterSpacing: "0.08em",
          color: "var(--color-accent)",
          textTransform: "uppercase",
          marginBottom: "1rem",
        }}
      >
        AI Literature Q&amp;A
      </p>

      <h1
        style={{
          fontSize: "1.625rem",
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: "-0.025em",
          color: "var(--color-text)",
          margin: "0 0 0.625rem",
        }}
      >
        Ask about bat biology
      </h1>

      <p
        style={{
          fontSize: "0.9375rem",
          lineHeight: 1.65,
          color: "var(--color-text-secondary)",
          margin: "0 0 2rem",
          maxWidth: "40rem",
        }}
      >
        Semantic search across 9,999 bat biology papers. Claude synthesizes an
        answer from the most relevant abstracts and cites its sources.
      </p>

      <QAInterface />
    </div>
  );
}
