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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_manager_id: string | null
          cliente_nome: string
          created_at: string
          data_fim_contrato: string | null
          data_inicio_contrato: string
          health_score: number | null
          id: string
          notas: string | null
          oportunidade_id: string | null
          produtos_contratados: Json | null
          proxima_revisao: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          account_manager_id?: string | null
          cliente_nome: string
          created_at?: string
          data_fim_contrato?: string | null
          data_inicio_contrato?: string
          health_score?: number | null
          id?: string
          notas?: string | null
          oportunidade_id?: string | null
          produtos_contratados?: Json | null
          proxima_revisao?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          account_manager_id?: string | null
          cliente_nome?: string
          created_at?: string
          data_fim_contrato?: string | null
          data_inicio_contrato?: string
          health_score?: number | null
          id?: string
          notas?: string | null
          oportunidade_id?: string | null
          produtos_contratados?: Json | null
          proxima_revisao?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          account_id: string | null
          created_at: string
          data_pagamento: string | null
          forma_pagamento: string | null
          id: string
          nota_fiscal: string | null
          notas: string | null
          oportunidade_id: string | null
          parcela_num: number | null
          parcela_total: number | null
          status: Database["public"]["Enums"]["cobranca_status"]
          tipo: Database["public"]["Enums"]["cobranca_tipo"]
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          nota_fiscal?: string | null
          notas?: string | null
          oportunidade_id?: string | null
          parcela_num?: number | null
          parcela_total?: number | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          tipo: Database["public"]["Enums"]["cobranca_tipo"]
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          nota_fiscal?: string | null
          notas?: string | null
          oportunidade_id?: string | null
          parcela_num?: number | null
          parcela_total?: number | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          tipo?: Database["public"]["Enums"]["cobranca_tipo"]
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_atividades: {
        Row: {
          concluida: boolean
          created_at: string
          data_agendada: string | null
          data_conclusao: string | null
          descricao: string | null
          id: string
          lead_id: string | null
          oportunidade_id: string | null
          tipo: Database["public"]["Enums"]["atividade_tipo"]
          titulo: string | null
          usuario_id: string | null
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          data_agendada?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          tipo: Database["public"]["Enums"]["atividade_tipo"]
          titulo?: string | null
          usuario_id?: string | null
        }
        Update: {
          concluida?: boolean
          created_at?: string
          data_agendada?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          tipo?: Database["public"]["Enums"]["atividade_tipo"]
          titulo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_atividades_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_atividades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          arrematador: string | null
          canal: string | null
          cargo: string | null
          cidade: string | null
          created_at: string
          created_by: string | null
          data_aquisicao: string | null
          data_criacao_origem: string | null
          data_reuniao_agendada: string | null
          data_reuniao_realizada: string | null
          descricao: string | null
          documento_empresa: string | null
          email: string | null
          empresa: string | null
          estado: string | null
          etapa: Database["public"]["Enums"]["lead_etapa"]
          faturamento: string | null
          google_event_id: string | null
          google_event_link: string | null
          id: string
          instagram: string | null
          motivo_desqualificacao: string | null
          nome: string
          nome_produto: string | null
          notas: string | null
          origem: string | null
          pais: string | null
          qualificacao: string | null
          responsavel_id: string | null
          segmento: string | null
          site: string | null
          telefone: string | null
          temperatura: string | null
          tier: string | null
          tipo_produto: string | null
          updated_at: string
          urgencia: string | null
          valor_pago: number | null
        }
        Insert: {
          arrematador?: string | null
          canal?: string | null
          cargo?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          data_aquisicao?: string | null
          data_criacao_origem?: string | null
          data_reuniao_agendada?: string | null
          data_reuniao_realizada?: string | null
          descricao?: string | null
          documento_empresa?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          etapa?: Database["public"]["Enums"]["lead_etapa"]
          faturamento?: string | null
          google_event_id?: string | null
          google_event_link?: string | null
          id?: string
          instagram?: string | null
          motivo_desqualificacao?: string | null
          nome: string
          nome_produto?: string | null
          notas?: string | null
          origem?: string | null
          pais?: string | null
          qualificacao?: string | null
          responsavel_id?: string | null
          segmento?: string | null
          site?: string | null
          telefone?: string | null
          temperatura?: string | null
          tier?: string | null
          tipo_produto?: string | null
          updated_at?: string
          urgencia?: string | null
          valor_pago?: number | null
        }
        Update: {
          arrematador?: string | null
          canal?: string | null
          cargo?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          data_aquisicao?: string | null
          data_criacao_origem?: string | null
          data_reuniao_agendada?: string | null
          data_reuniao_realizada?: string | null
          descricao?: string | null
          documento_empresa?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          etapa?: Database["public"]["Enums"]["lead_etapa"]
          faturamento?: string | null
          google_event_id?: string | null
          google_event_link?: string | null
          id?: string
          instagram?: string | null
          motivo_desqualificacao?: string | null
          nome?: string
          nome_produto?: string | null
          notas?: string | null
          origem?: string | null
          pais?: string | null
          qualificacao?: string | null
          responsavel_id?: string | null
          segmento?: string | null
          site?: string | null
          telefone?: string | null
          temperatura?: string | null
          tier?: string | null
          tipo_produto?: string | null
          updated_at?: string
          urgencia?: string | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_oportunidades: {
        Row: {
          created_at: string
          data_fechamento_previsto: string | null
          data_fechamento_real: string | null
          data_proposta: string | null
          etapa: Database["public"]["Enums"]["oportunidade_etapa"]
          id: string
          lead_id: string | null
          motivo_perda: string | null
          nome_oportunidade: string
          notas: string | null
          responsavel_id: string | null
          resumo_reuniao: string | null
          temperatura: string | null
          transcricao_reuniao: string | null
          updated_at: string
          valor_ef: number | null
          valor_fee: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          data_fechamento_previsto?: string | null
          data_fechamento_real?: string | null
          data_proposta?: string | null
          etapa?: Database["public"]["Enums"]["oportunidade_etapa"]
          id?: string
          lead_id?: string | null
          motivo_perda?: string | null
          nome_oportunidade: string
          notas?: string | null
          responsavel_id?: string | null
          resumo_reuniao?: string | null
          temperatura?: string | null
          transcricao_reuniao?: string | null
          updated_at?: string
          valor_ef?: number | null
          valor_fee?: number | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          data_fechamento_previsto?: string | null
          data_fechamento_real?: string | null
          data_proposta?: string | null
          etapa?: Database["public"]["Enums"]["oportunidade_etapa"]
          id?: string
          lead_id?: string | null
          motivo_perda?: string | null
          nome_oportunidade?: string
          notas?: string | null
          responsavel_id?: string | null
          resumo_reuniao?: string | null
          temperatura?: string | null
          transcricao_reuniao?: string | null
          updated_at?: string
          valor_ef?: number | null
          valor_fee?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_oportunidades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_oportunidades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mix_goals: {
        Row: {
          ass_rate: number | null
          canal_mix: Json | null
          cpmql_target: number | null
          cr_rate: number | null
          created_at: string | null
          ef_avg: number | null
          ef_target: number | null
          id: string
          investment_target: number | null
          leads_target: number | null
          month: number
          pace_q1_dia_limite: number | null
          pace_q1_pct: number | null
          periodo_mix: Json | null
          ra_rate: number | null
          rr_rate: number | null
          tier_mix: Json | null
          updated_at: string | null
          year: number
        }
        Insert: {
          ass_rate?: number | null
          canal_mix?: Json | null
          cpmql_target?: number | null
          cr_rate?: number | null
          created_at?: string | null
          ef_avg?: number | null
          ef_target?: number | null
          id?: string
          investment_target?: number | null
          leads_target?: number | null
          month: number
          pace_q1_dia_limite?: number | null
          pace_q1_pct?: number | null
          periodo_mix?: Json | null
          ra_rate?: number | null
          rr_rate?: number | null
          tier_mix?: Json | null
          updated_at?: string | null
          year: number
        }
        Update: {
          ass_rate?: number | null
          canal_mix?: Json | null
          cpmql_target?: number | null
          cr_rate?: number | null
          created_at?: string | null
          ef_avg?: number | null
          ef_target?: number | null
          id?: string
          investment_target?: number | null
          leads_target?: number | null
          month?: number
          pace_q1_dia_limite?: number | null
          pace_q1_pct?: number | null
          periodo_mix?: Json | null
          ra_rate?: number | null
          rr_rate?: number | null
          tier_mix?: Json | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      monthly_goals: {
        Row: {
          contracts_goal: number
          cpmql_target: number | null
          cr_to_ra_rate: number | null
          created_at: string
          id: string
          investment_target: number | null
          month: number
          mql_to_cr_rate: number | null
          mrr_goal: number
          ra_to_rr_rate: number | null
          revenue_goal: number
          rr_to_ass_rate: number | null
          updated_at: string
          year: number
        }
        Insert: {
          contracts_goal?: number
          cpmql_target?: number | null
          cr_to_ra_rate?: number | null
          created_at?: string
          id?: string
          investment_target?: number | null
          month: number
          mql_to_cr_rate?: number | null
          mrr_goal?: number
          ra_to_rr_rate?: number | null
          revenue_goal?: number
          rr_to_ass_rate?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          contracts_goal?: number
          cpmql_target?: number | null
          cr_to_ra_rate?: number | null
          created_at?: string
          id?: string
          investment_target?: number | null
          month?: number
          mql_to_cr_rate?: number | null
          mrr_goal?: number
          ra_to_rr_rate?: number | null
          revenue_goal?: number
          rr_to_ass_rate?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          email_google: string | null
          expires_at: string | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email_google?: string | null
          expires_at?: string | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email_google?: string | null
          expires_at?: string | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_page_access: {
        Row: {
          id: string
          page_path: string
          user_id: string
        }
        Insert: {
          id?: string
          page_path: string
          user_id: string
        }
        Update: {
          id?: string
          page_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      marcar_cobrancas_atrasadas: { Args: never; Returns: undefined }
    }
    Enums: {
      account_status: "ativo" | "pausado" | "encerrado"
      app_role: "admin" | "user"
      atividade_tipo:
        | "ligacao"
        | "email"
        | "reuniao"
        | "nota"
        | "whatsapp"
        | "tarefa"
        | "mudanca_etapa"
        | "criacao"
      cobranca_status: "pendente" | "pago" | "atrasado" | "cancelado"
      cobranca_tipo: "fee_setup" | "fee_recorrente" | "ef"
      lead_etapa:
        | "entrada"
        | "tentativa_contato"
        | "contato_realizado"
        | "desqualificado"
        | "reuniao_agendada"
        | "reuniao_realizada"
        | "no_show"
      oportunidade_etapa:
        | "proposta"
        | "negociacao"
        | "fechado"
        | "follow_up_longo"
        | "perdido"
        | "contrato"
        | "fechado_ganho"
        | "fechado_perdido"
        | "follow_infinito"
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
    Enums: {
      account_status: ["ativo", "pausado", "encerrado"],
      app_role: ["admin", "user"],
      atividade_tipo: [
        "ligacao",
        "email",
        "reuniao",
        "nota",
        "whatsapp",
        "tarefa",
        "mudanca_etapa",
        "criacao",
      ],
      cobranca_status: ["pendente", "pago", "atrasado", "cancelado"],
      cobranca_tipo: ["fee_setup", "fee_recorrente", "ef"],
      lead_etapa: [
        "entrada",
        "tentativa_contato",
        "contato_realizado",
        "desqualificado",
        "reuniao_agendada",
        "reuniao_realizada",
        "no_show",
      ],
      oportunidade_etapa: [
        "proposta",
        "negociacao",
        "fechado",
        "follow_up_longo",
        "perdido",
        "contrato",
        "fechado_ganho",
        "fechado_perdido",
        "follow_infinito",
      ],
    },
  },
} as const
