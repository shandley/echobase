"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { MatchedPaper } from "@/app/api/qa/route";

const EXAMPLE_QUESTIONS = [
  "What is known about STING pathway evolution in bats?",
  "How do bats tolerate viral infection?",
  "What makes bat immune systems unique?",
];

type QAResult = {
  answer: string;
  papers: MatchedPaper[];
};

export function QAInterface() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QAResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = (await res.json()) as
        | QAResult
        | { error: string };

      if (!res.ok || "error" in data) {
        setError(
          "error" in data ? data.error : "An unexpected error occurred.",
        );
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleExampleClick(q: string) {
    setQuestion(q);
    void handleSubmit(q);
  }

  const isEmpty = !loading && !result && !error;

  return (
    <div>
      {/* Question input */}
      <div style={{ marginBottom: "1.25rem" }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              void handleSubmit(question);
            }
          }}
          placeholder="Ask a question about bat biology..."
          rows={3}
          style={{
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            color: "var(--color-text)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.875rem",
            lineHeight: 1.6,
            padding: "0.75rem 1rem",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
          disabled={loading}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "0.625rem",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {loading ? null : "Cmd+Enter to submit"}
          </span>
          <button
            type="button"
            onClick={() => void handleSubmit(question)}
            disabled={loading || !question.trim()}
            style={{
              backgroundColor:
                loading || !question.trim()
                  ? "var(--color-elevated)"
                  : "var(--color-accent)",
              color:
                loading || !question.trim()
                  ? "var(--color-text-tertiary)"
                  : "oklch(10% 0.01 82)",
              border: "none",
              borderRadius: "3px",
              padding: "0.45rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor:
                loading || !question.trim() ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
              transition: "background-color 150ms ease",
            }}
          >
            {loading ? "Searching..." : "Ask"}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8125rem",
            letterSpacing: "0.04em",
          }}
        >
          Searching literature...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            backgroundColor: "var(--color-badge-other-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--color-badge-other-text)",
              fontSize: "0.875rem",
              fontFamily: "var(--font-mono)",
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Answer */}
      {result && (
        <div>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              padding: "1.25rem 1.5rem",
              marginBottom: "1.75rem",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                color: "var(--color-accent)",
                textTransform: "uppercase",
                margin: "0 0 0.75rem",
              }}
            >
              Answer
            </p>
            <div style={{
              color: "var(--color-text)",
              fontSize: "0.9375rem",
              lineHeight: 1.7,
            }}>
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "1rem 0 0.5rem", color: "var(--color-text)" }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "1rem 0 0.375rem", color: "var(--color-text)" }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: "0.75rem 0 0.25rem", color: "var(--color-text)" }}>{children}</h3>,
                  p: ({ children }) => <p style={{ margin: "0 0 0.75rem", color: "var(--color-text)" }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ fontWeight: 600, color: "var(--color-text)" }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                  ul: ({ children }) => <ul style={{ margin: "0 0 0.75rem 1.25rem", padding: 0 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: "0 0 0.75rem 1.25rem", padding: 0 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: "0.25rem", color: "var(--color-text)" }}>{children}</li>,
                  code: ({ children }) => <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.875em", backgroundColor: "var(--color-surface)", padding: "0.1em 0.3em", borderRadius: "2px" }}>{children}</code>,
                }}
              >
                {result.answer}
              </ReactMarkdown>
            </div>
          </div>

          {/* Source papers */}
          {result.papers.length > 0 && (
            <div>
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
                Sources
                <span
                  style={{
                    marginLeft: "0.625rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-accent)",
                  }}
                >
                  {result.papers.length}
                </span>
              </h2>
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                {result.papers.map((paper, i) => (
                  <div
                    key={paper.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "4rem 1fr auto",
                      gap: "1rem",
                      alignItems: "start",
                      padding: "0.625rem 1rem",
                      borderBottom:
                        i < result.papers.length - 1
                          ? "1px solid var(--color-border-subtle)"
                          : "none",
                      backgroundColor:
                        i % 2 === 0
                          ? "var(--color-base)"
                          : "var(--color-surface)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8125rem",
                        color: "var(--color-text-secondary)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                        paddingTop: "0.1rem",
                      }}
                    >
                      {paper.year ?? "—"}
                    </span>
                    <div>
                      <span
                        style={{
                          color: "var(--color-text)",
                          fontSize: "0.875rem",
                          display: "block",
                          lineHeight: 1.45,
                        }}
                      >
                        {paper.title?.replace(/<[^>]+>/g, "") ?? ""}
                      </span>
                      {paper.journal && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-text-tertiary)",
                            display: "block",
                            marginTop: "0.15rem",
                          }}
                        >
                          {paper.journal}
                        </span>
                      )}
                    </div>
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        paddingTop: "0.1rem",
                      }}
                    >
                      {paper.pmid}↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state: example questions */}
      {isEmpty && (
        <div style={{ marginTop: "2rem" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6875rem",
              letterSpacing: "0.08em",
              color: "var(--color-text-tertiary)",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            Example questions
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleExampleClick(q)}
                style={{
                  background: "none",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "3px",
                  padding: "0.5rem 0.875rem",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  fontSize: "0.875rem",
                  lineHeight: 1.45,
                  transition: "border-color 150ms ease, color 150ms ease",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
