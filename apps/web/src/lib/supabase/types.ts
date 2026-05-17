export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      gene_papers: {
        Row: {
          gene_id: number
          paper_id: number
        }
        Insert: {
          gene_id: number
          paper_id: number
        }
        Update: {
          gene_id?: number
          paper_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gene_papers_gene_id_fkey"
            columns: ["gene_id"]
            isOneToOne: false
            referencedRelation: "genes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gene_papers_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      genes: {
        Row: {
          chromosome: string | null
          created_at: string | null
          description: string | null
          end_pos: number | null
          gene_biotype: string | null
          id: number
          name: string | null
          ncbi_gene_id: number | null
          species_id: number
          start_pos: number | null
          strand: string | null
          symbol: string | null
        }
        Insert: {
          chromosome?: string | null
          created_at?: string | null
          description?: string | null
          end_pos?: number | null
          gene_biotype?: string | null
          id?: number
          name?: string | null
          ncbi_gene_id?: number | null
          species_id: number
          start_pos?: number | null
          strand?: string | null
          symbol?: string | null
        }
        Update: {
          chromosome?: string | null
          created_at?: string | null
          description?: string | null
          end_pos?: number | null
          gene_biotype?: string | null
          id?: number
          name?: string | null
          ncbi_gene_id?: number | null
          species_id?: number
          start_pos?: number | null
          strand?: string | null
          symbol?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genes_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      orthologs: {
        Row: {
          alignment_score: number | null
          gene_id: number
          id: number
          ortholog_gene_id: number
          percent_identity: number | null
          source: string | null
        }
        Insert: {
          alignment_score?: number | null
          gene_id: number
          id?: number
          ortholog_gene_id: number
          percent_identity?: number | null
          source?: string | null
        }
        Update: {
          alignment_score?: number | null
          gene_id?: number
          id?: number
          ortholog_gene_id?: number
          percent_identity?: number | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orthologs_gene_id_fkey"
            columns: ["gene_id"]
            isOneToOne: false
            referencedRelation: "genes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orthologs_ortholog_gene_id_fkey"
            columns: ["ortholog_gene_id"]
            isOneToOne: false
            referencedRelation: "genes"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_entities: {
        Row: {
          created_at: string | null
          entity_name: string
          entity_type: string
          id: number
          normalized_id: string | null
          paper_id: number
        }
        Insert: {
          created_at?: string | null
          entity_name: string
          entity_type: string
          id?: number
          normalized_id?: string | null
          paper_id: number
        }
        Update: {
          created_at?: string | null
          entity_name?: string
          entity_type?: string
          id?: number
          normalized_id?: string | null
          paper_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "paper_entities_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          abstract: string | null
          authors: Json | null
          created_at: string | null
          doi: string | null
          embedding: string | null
          full_text_available: boolean | null
          id: number
          journal: string | null
          pmid: number
          title: string
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: Json | null
          created_at?: string | null
          doi?: string | null
          embedding?: string | null
          full_text_available?: boolean | null
          id?: number
          journal?: string | null
          pmid: number
          title: string
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: Json | null
          created_at?: string | null
          doi?: string | null
          embedding?: string | null
          full_text_available?: boolean | null
          id?: number
          journal?: string | null
          pmid?: number
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      proteins: {
        Row: {
          alphafold_url: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          gene_id: number | null
          id: number
          length: number | null
          ncbi_protein_accession: string
          sequence: string | null
          species_id: number
        }
        Insert: {
          alphafold_url?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          gene_id?: number | null
          id?: number
          length?: number | null
          ncbi_protein_accession: string
          sequence?: string | null
          species_id: number
        }
        Update: {
          alphafold_url?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          gene_id?: number | null
          id?: number
          length?: number | null
          ncbi_protein_accession?: string
          sequence?: string | null
          species_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "proteins_gene_id_fkey"
            columns: ["gene_id"]
            isOneToOne: false
            referencedRelation: "genes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proteins_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          annotation_status: string | null
          body_mass_g: number | null
          common_name: string | null
          created_at: string | null
          echolocation_type: string | null
          family: string | null
          genome_assembly_accession: string | null
          genome_size_bp: number | null
          genus: string | null
          id: number
          max_lifespan_years: number | null
          metadata: Json | null
          ncbi_tax_id: number
          refseq_category: string | null
          scientific_name: string
        }
        Insert: {
          annotation_status?: string | null
          body_mass_g?: number | null
          common_name?: string | null
          created_at?: string | null
          echolocation_type?: string | null
          family?: string | null
          genome_assembly_accession?: string | null
          genome_size_bp?: number | null
          genus?: string | null
          id?: number
          max_lifespan_years?: number | null
          metadata?: Json | null
          ncbi_tax_id: number
          refseq_category?: string | null
          scientific_name: string
        }
        Update: {
          annotation_status?: string | null
          body_mass_g?: number | null
          common_name?: string | null
          created_at?: string | null
          echolocation_type?: string | null
          family?: string | null
          genome_assembly_accession?: string | null
          genome_size_bp?: number | null
          genus?: string | null
          id?: number
          max_lifespan_years?: number | null
          metadata?: Json | null
          ncbi_tax_id?: number
          refseq_category?: string | null
          scientific_name?: string
        }
        Relationships: []
      }
      species_papers: {
        Row: {
          paper_id: number
          species_id: number
        }
        Insert: {
          paper_id: number
          species_id: number
        }
        Update: {
          paper_id?: number
          species_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "species_papers_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "species_papers_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy: {
        Row: {
          created_at: string | null
          id: number
          name: string
          ncbi_tax_id: number
          parent_tax_id: number | null
          rank: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
          ncbi_tax_id: number
          parent_tax_id?: number | null
          rank?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
          ncbi_tax_id?: number
          parent_tax_id?: number | null
          rank?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_papers: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          abstract: string
          doi: string
          id: number
          journal: string
          pmid: number
          similarity: number
          title: string
          year: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
