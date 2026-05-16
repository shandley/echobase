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
  // Papers table is currently empty; wired up for when the literature pipeline loads.
  void query;
  return [];
}
