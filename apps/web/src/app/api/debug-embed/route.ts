import { NextResponse } from "next/server";

export async function GET() {
  const hfToken = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN;
  const voyageKey = process.env.VOYAGE_API_KEY;

  const results: Record<string, unknown> = {
    hf_token_set: !!hfToken,
    hf_token_prefix: hfToken ? hfToken.slice(0, 12) + "..." : null,
    voyage_key_set: !!voyageKey,
  };

  // Test bge-large via HF
  if (hfToken) {
    try {
      const r = await fetch(
        "https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${hfToken}` },
          body: JSON.stringify({ inputs: "test", options: { wait_for_model: true } }),
          signal: AbortSignal.timeout(15_000),
        }
      );
      const text = await r.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 200); }
      results.hf_status = r.status;
      results.hf_response_type = typeof parsed === "object" ? (Array.isArray(parsed) ? `array[${(parsed as unknown[]).length}]` : "object") : typeof parsed;
      if (Array.isArray(parsed) && parsed.length > 0) {
        results.hf_inner_type = Array.isArray(parsed[0]) ? `nested_array[${(parsed[0] as unknown[]).length}]` : typeof parsed[0];
      }
      results.hf_preview = text.slice(0, 100);
    } catch (e) {
      results.hf_error = String(e);
    }
  }

  // Test Voyage
  if (voyageKey) {
    try {
      const r = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${voyageKey}` },
        body: JSON.stringify({ model: "voyage-3", input: ["test"] }),
        signal: AbortSignal.timeout(10_000),
      });
      const text = await r.text();
      results.voyage_status = r.status;
      results.voyage_preview = text.slice(0, 150);
    } catch (e) {
      results.voyage_error = String(e);
    }
  }

  return NextResponse.json(results);
}
