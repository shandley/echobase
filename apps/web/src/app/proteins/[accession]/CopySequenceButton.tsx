"use client";

import { useState } from "react";

interface Props {
  sequence: string;
}

export function CopySequenceButton({ sequence }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(sequence).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: do nothing if clipboard is unavailable
    });
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontSize: "0.75rem",
        fontFamily: "var(--font-mono)",
        color: copied ? "var(--color-accent)" : "var(--color-text-secondary)",
        background: "none",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "3px",
        padding: "0.2rem 0.6rem",
        cursor: "pointer",
        transition: "color 150ms ease, border-color 150ms ease",
        letterSpacing: "0.02em",
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
