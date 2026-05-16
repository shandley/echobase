import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "EchoBase", template: "%s · EchoBase" },
  description: "Unified genomics for Chiroptera. Sequence search, protein embeddings, and literature synthesis across 50+ annotated bat genomes.",
};

const NAV_LINKS = [
  { href: "/species", label: "Species", active: true },
  { href: "/genes",    label: "Genes",    active: false },
  { href: "/proteins/search", label: "Proteins", active: true },
  { href: "/papers",   label: "Papers",   active: true },
  { href: "/search",   label: "Search",   active: true },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--color-border-subtle)",
            backgroundColor: "var(--color-base)",
            position: "sticky",
            top: 0,
            zIndex: 40,
          }}
        >
          <nav
            style={{
              maxWidth: "72rem",
              margin: "0 auto",
              padding: "0 1.5rem",
              height: "48px",
              display: "flex",
              alignItems: "center",
              gap: "1.75rem",
            }}
          >
            <Link
              href="/"
              style={{
                color: "var(--color-text)",
                fontWeight: 500,
                fontSize: "0.9375rem",
                letterSpacing: "-0.01em",
                textDecoration: "none",
                display: "flex",
                alignItems: "baseline",
                gap: "0.25rem",
              }}
            >
              EchoBase
              <sup style={{
                fontSize: "0.625rem",
                fontWeight: 400,
                color: "var(--color-text-secondary)",
                letterSpacing: 0,
                lineHeight: 1,
              }}>β</sup>
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              {NAV_LINKS.map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontSize: "0.875rem",
                    color: active ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                    textDecoration: "none",
                    transition: "color 150ms ease",
                    pointerEvents: active ? "auto" : "none",
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div style={{ marginLeft: "auto" }}>
              <SearchBox size="sm" placeholder="Search…" />
            </div>
          </nav>
        </header>

        <main style={{ flex: 1 }}>{children}</main>

        <footer
          style={{
            borderTop: "1px solid var(--color-border-subtle)",
            padding: "1.25rem 1.5rem",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.02em",
          }}
        >
          EchoBase · Chiroptera Genomics · Data: NCBI
        </footer>
      </body>
    </html>
  );
}
