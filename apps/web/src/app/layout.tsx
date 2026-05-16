import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "EchoBase", template: "%s | EchoBase" },
  description: "A unified knowledge platform for Chiroptera genomics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
            <Link
              href="/"
              className="text-sm font-semibold tracking-wide text-[var(--color-accent)] hover:opacity-80"
            >
              ECHOBASE
            </Link>
            <div className="h-4 w-px bg-[var(--color-border)]" />
            <div className="flex items-center gap-5 text-sm text-[var(--color-text-muted)]">
              <Link href="/species" className="hover:text-[var(--color-text)] transition-colors">
                Species
              </Link>
              <span className="opacity-30">Genes</span>
              <span className="opacity-30">Proteins</span>
              <span className="opacity-30">Search</span>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-text-muted)]">
          EchoBase · Chiroptera Genomics Platform · Data from NCBI
        </footer>
      </body>
    </html>
  );
}
