import { createClient } from "./server";
import type { Database } from "./types";

export type Species = Database["public"]["Tables"]["species"]["Row"];
export type SpeciesSummary = Pick<
  Species,
  | "id"
  | "ncbi_tax_id"
  | "scientific_name"
  | "common_name"
  | "genus"
  | "genome_assembly_accession"
  | "genome_size_bp"
  | "annotation_status"
  | "refseq_category"
  | "metadata"
>;

export type Paper = Database["public"]["Tables"]["papers"]["Row"];
export type PaperEntity = Database["public"]["Tables"]["paper_entities"]["Row"];

export async function getAllSpecies(): Promise<SpeciesSummary[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("species")
    .select(
      "id, ncbi_tax_id, scientific_name, common_name, genus, genome_assembly_accession, genome_size_bp, annotation_status, refseq_category, metadata",
    )
    .order("scientific_name");

  if (error) throw new Error(`Failed to fetch species: ${error.message}`);
  return (data ?? []) as SpeciesSummary[];
}

export async function getSpeciesByTaxId(taxId: number): Promise<Species | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("species")
    .select("*")
    .eq("ncbi_tax_id", taxId)
    .single();

  if (error) return null;
  return data as Species;
}

export async function getProteinCountForSpecies(speciesId: number): Promise<number> {
  const client = await createClient();
  const { count } = await client
    .from("proteins")
    .select("id", { count: "exact", head: true })
    .eq("species_id", speciesId);

  return count ?? 0;
}

export async function getRelatedSpecies(genus: string, excludeTaxId: number): Promise<SpeciesSummary[]> {
  const client = await createClient();
  const { data } = await client
    .from("species")
    .select(
      "id, ncbi_tax_id, scientific_name, common_name, genus, genome_assembly_accession, genome_size_bp, annotation_status, refseq_category, metadata",
    )
    .eq("genus", genus)
    .neq("ncbi_tax_id", excludeTaxId)
    .order("scientific_name")
    .limit(5);

  return (data ?? []) as SpeciesSummary[];
}

export async function searchSpecies(query: string): Promise<SpeciesSummary[]> {
  const client = await createClient();
  const { data } = await client
    .from("species")
    .select(
      "id, ncbi_tax_id, scientific_name, common_name, genus, genome_assembly_accession, genome_size_bp, annotation_status, refseq_category, metadata",
    )
    .or(
      `scientific_name.plfts(english).${query},common_name.plfts(english).${query},genus.plfts(english).${query}`,
    )
    .order("scientific_name")
    .limit(20);

  return (data ?? []) as SpeciesSummary[];
}

export async function searchPapers(query: string): Promise<Paper[]> {
  const client = await createClient();
  const { data } = await client
    .from("papers")
    .select("*")
    .or(`title.plfts(english).${query},abstract.plfts(english).${query}`)
    .order("year", { ascending: false, nullsFirst: false })
    .limit(20);

  return (data ?? []) as Paper[];
}

export async function getPapers(limit = 100): Promise<Paper[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("papers")
    .select("*")
    .order("year", { ascending: false, nullsFirst: false })
    .range(0, limit - 1);

  if (error) throw new Error(`Failed to fetch papers: ${error.message}`);
  return (data ?? []) as Paper[];
}

export async function getPaperByPmid(pmid: number): Promise<Paper | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("papers")
    .select("*")
    .eq("pmid", pmid)
    .single();

  if (error) return null;
  return data as Paper;
}

export async function getPaperEntities(paperId: number): Promise<PaperEntity[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("paper_entities")
    .select("*")
    .eq("paper_id", paperId)
    .order("entity_type")
    .order("entity_name");

  if (error) throw new Error(`Failed to fetch paper entities: ${error.message}`);
  return (data ?? []) as PaperEntity[];
}

export async function getSpeciesForPaper(paperId: number): Promise<SpeciesSummary[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("species_papers")
    .select("species(id, ncbi_tax_id, scientific_name, common_name, genus, genome_assembly_accession, genome_size_bp, annotation_status, refseq_category, metadata)")
    .eq("paper_id", paperId);

  if (error) throw new Error(`Failed to fetch species for paper: ${error.message}`);
  return (data ?? [])
    .map((row) => (row as { species: SpeciesSummary | null }).species)
    .filter((s): s is SpeciesSummary => s !== null);
}

export async function getEntityCountsForPapers(
  paperIds: number[],
): Promise<Map<number, number>> {
  if (paperIds.length === 0) return new Map();
  const client = await createClient();
  const { data } = await client
    .from("paper_entities")
    .select("paper_id")
    .in("paper_id", paperIds);

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    const id = (row as { paper_id: number }).paper_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function getPapersForSpecies(speciesId: number, limit = 8): Promise<Paper[]> {
  const client = await createClient();
  const { data } = await client
    .from("species_papers")
    .select("papers(id, pmid, title, journal, year, abstract, doi, authors, full_text_available, embedding, created_at)")
    .eq("species_id", speciesId)
    .limit(limit);

  return (data ?? [])
    .map((row) => (row as { papers: Paper | null }).papers)
    .filter((p): p is Paper => p !== null)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export async function getPaperCountForSpecies(speciesId: number): Promise<number> {
  const client = await createClient();
  const { count } = await client
    .from("species_papers")
    .select("paper_id", { count: "exact", head: true })
    .eq("species_id", speciesId);
  return count ?? 0;
}
