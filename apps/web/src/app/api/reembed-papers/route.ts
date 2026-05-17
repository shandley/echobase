/**
 * POST /api/reembed-papers
 * Re-embeds a batch of papers using Voyage AI voyage-3 (same model as queries).
 * Call repeatedly until done: { offset: N, limit: 80 }
 *
 * Returns: { embedded: N, total: N, done: bool, next_offset: N }
 *
 * Usage: call with offset=0, then offset=next_offset, until done=true.
 * Rate-limited: 22s sleep between Voyage calls -- allow 30s between requests.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function isAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return false; // no token configured = endpoint disabled
  const auth = request.headers.get("Authorization") ?? "";
  return auth === `Bearer ${token}`;
}

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const BATCH_SIZE = 80; // texts per Voyage request (free tier safe)

async function embedBatch(texts: string[], apiKey: string): Promise<number[][] | null> {
  try {
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "voyage-3", input: texts }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> };
    return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) {
    return NextResponse.json({ error: "VOYAGE_API_KEY not configured" }, { status: 503 });
  }

  const body = await request.json() as { offset?: number; limit?: number };
  const offset = body.offset ?? 0;
  const limit  = body.limit  ?? BATCH_SIZE;

  const client = createServiceClient();

  // Count total
  const { count } = await client.from("papers")
    .select("id", { count: "exact", head: true });
  const total = count ?? 0;

  // Fetch this batch
  const { data: papers } = await client.from("papers")
    .select("id, pmid, title, abstract")
    .range(offset, offset + limit - 1)
    .order("id");

  if (!papers || papers.length === 0) {
    return NextResponse.json({ embedded: 0, total, done: true, next_offset: offset });
  }

  const texts = papers.map(p =>
    `${p.title ?? ""} ${p.abstract ?? ""}`.trim()
  );

  const embeddings = await embedBatch(texts, voyageKey);
  if (!embeddings) {
    return NextResponse.json(
      { error: "Voyage API failed -- try again in 60s" },
      { status: 429 }
    );
  }

  // Upsert with embeddings
  const upsertRows = papers.map((p, i) => ({
    id:        p.id,
    pmid:      p.pmid,
    title:     p.title,
    embedding: embeddings[i] as unknown as string,
  }));

  await client.from("papers").upsert(upsertRows, { onConflict: "id" });

  const nextOffset = offset + papers.length;
  const done = nextOffset >= total;

  return NextResponse.json({
    embedded:    papers.length,
    total,
    offset,
    next_offset: nextOffset,
    done,
    progress:    `${nextOffset}/${total}`,
  });
}
