/** Format base pairs as human-readable genome size: 2126220925 → "2.13 Gb" */
export function formatGenomeSize(bp: number | null): string {
  if (bp === null) return "—";
  if (bp >= 1e9) return `${(bp / 1e9).toFixed(2)} Gb`;
  if (bp >= 1e6) return `${(bp / 1e6).toFixed(1)} Mb`;
  if (bp >= 1e3) return `${(bp / 1e3).toFixed(0)} Kb`;
  return `${bp} bp`;
}

/** Format a number with thousands separators: 18287 → "18,287" */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

/** Strip HTML tags from PubMed titles: "<i>Leptospira</i>" → "Leptospira" */
export function stripHtml(text: string | null): string {
  if (!text) return "";
  return text.replace(/<[^>]+>/g, "");
}

/** Assembly level → color class mapping */
export function assemblyLevelColor(level: string | null): string {
  switch (level?.toLowerCase()) {
    case "chromosome":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "scaffold":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "contig":
      return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    default:
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}
