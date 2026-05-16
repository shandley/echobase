// Generated types for the EchoBase database schema.
// Regenerate with: supabase gen types typescript --project-id uigemskwjekuhsoazhul > src/lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      taxonomy: {
        Row: {
          id: number;
          ncbi_tax_id: number;
          name: string;
          rank: string | null;
          parent_tax_id: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["taxonomy"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["taxonomy"]["Insert"]>;
      };
      species: {
        Row: {
          id: number;
          ncbi_tax_id: number;
          scientific_name: string;
          common_name: string | null;
          family: string | null;
          genus: string | null;
          echolocation_type: string | null;
          max_lifespan_years: number | null;
          body_mass_g: number | null;
          genome_assembly_accession: string | null;
          genome_size_bp: number | null;
          annotation_status: string | null;
          refseq_category: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["species"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["species"]["Insert"]>;
      };
      genes: {
        Row: {
          id: number;
          ncbi_gene_id: number | null;
          symbol: string | null;
          name: string | null;
          species_id: number;
          chromosome: string | null;
          strand: string | null;
          start_pos: number | null;
          end_pos: number | null;
          gene_biotype: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["genes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["genes"]["Insert"]>;
      };
      proteins: {
        Row: {
          id: number;
          ncbi_protein_accession: string;
          gene_id: number | null;
          species_id: number;
          sequence: string | null;
          length: number | null;
          description: string | null;
          alphafold_url: string | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["proteins"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["proteins"]["Insert"]>;
      };
      papers: {
        Row: {
          id: number;
          pmid: number;
          title: string;
          abstract: string | null;
          journal: string | null;
          year: number | null;
          doi: string | null;
          authors: Json;
          full_text_available: boolean;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["papers"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["papers"]["Insert"]>;
      };
      paper_entities: {
        Row: {
          id: number;
          paper_id: number;
          entity_type: string;
          entity_name: string;
          normalized_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["paper_entities"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["paper_entities"]["Insert"]>;
      };
      gene_papers: {
        Row: { gene_id: number; paper_id: number };
        Insert: Database["public"]["Tables"]["gene_papers"]["Row"];
        Update: Partial<Database["public"]["Tables"]["gene_papers"]["Row"]>;
      };
      species_papers: {
        Row: { species_id: number; paper_id: number };
        Insert: Database["public"]["Tables"]["species_papers"]["Row"];
        Update: Partial<Database["public"]["Tables"]["species_papers"]["Row"]>;
      };
      orthologs: {
        Row: {
          id: number;
          gene_id: number;
          ortholog_gene_id: number;
          percent_identity: number | null;
          alignment_score: number | null;
          source: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orthologs"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["orthologs"]["Insert"]>;
      };
    };
  };
};
