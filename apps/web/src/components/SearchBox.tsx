"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

interface SearchBoxProps {
  initialQuery?: string;
  placeholder?: string;
  size?: "sm" | "md";
}

export function SearchBox({
  initialQuery = "",
  placeholder = "Search species, genes, literature…",
  size = "md",
}: SearchBoxProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  const isSm = size === "sm";

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center" }}>
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: isSm ? "0.75rem" : "0.875rem",
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
          borderRadius: "3px",
          padding: isSm ? "0.3125rem 0.625rem" : "0.5rem 0.875rem",
          outline: "none",
          width: isSm ? "14rem" : "22rem",
          letterSpacing: "0.01em",
          transition: "border-color 150ms ease",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-accent)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border)";
        }}
      />
    </form>
  );
}
