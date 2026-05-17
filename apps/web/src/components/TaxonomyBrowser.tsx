"use client";

import { useState } from "react";

export function TaxonomyBrowser() {
  const [loading, setLoading] = useState<boolean>(true);

  return (
    <div
      style={{
        position: "relative",
        height: "calc(100vh - 48px)",
        backgroundColor: "var(--color-base)",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8125rem",
            letterSpacing: "0.04em",
            zIndex: 1,
          }}
        >
          Loading phylogeny…
        </div>
      )}
      <iframe
        src="https://www.onezoom.org/life/@Chiroptera=9397?img=true&anim=flight&vis=spiral"
        title="Chiroptera phylogenetic tree — OneZoom"
        allow="fullscreen"
        onLoad={() => setLoading(false)}
        style={{
          border: 0,
          width: "100%",
          height: "100%",
          display: "block",
          backgroundColor: "var(--color-base)",
        }}
      />
    </div>
  );
}
