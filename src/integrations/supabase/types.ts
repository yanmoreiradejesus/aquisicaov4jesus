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
          contract_validation: Json | null
          contract_validation_at: string | null
          contract_validation_url: string | null
          created_at: string
          data_fim_contrato: string | null
          data_inicio_contrato: string
          growth_class_ata: string | null
          growth_class_data_agendada: string | null
          growth_class_data_realizada: string | null
          growth_class_expectativas: string | null
          growth_class_google_event_id: string | null
          growth_class_meet_link: string | null
          growth_class_oportunidades_monetizacao: string | null
          growth_class_proximos_passos: string | null
          growth_class_responsavel_id: string | null
          growth_class_transcricao_reuniao: string | null
          health_score: number | null
          id: string
          notas: string | null
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          oportunidade_id: string | null
          pre_growth_class_gerado_em: string | null
          pre_growth_class_relatorio: string | null
          produtos_contratados: Json | null
          proxima_revisao: string | null
          status: Database["public"]["Enums"]["account_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_manager_id?: string | null
          cliente_nome: string
          contract_validation?: Json | null
          contract_validation_at?: string | null
          contract_validation_url?: string | null
          created_at?: string
          data_fim_contrato?: string | null
          data_inicio_contrato?: string
          growth_class_ata?: string | null
          growth_class_data_agendada?: string | null
          growth_class_data_realizada?: string | null
          growth_class_expectativas?: string | null
          growth_class_google_event_id?: string | null
          growth_class_meet_link?: string | null
          growth_class_oportunidades_monetizacao?: string | null
          growth_class_proximos_passos?: string | null
          growth_class_responsavel_id?: string | null
          growth_class_transcricao_reuniao?: string | null
          health_score?: number | null
          id?: string
          notas?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          oportunidade_id?: string | null
          pre_growth_class_gerado_em?: string | null
          pre_growth_class_relatorio?: string | null
          produtos_contratados?: Json | null
          proxima_revisao?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          account_manager_id?: string | null
          cliente_nome?: string
          contract_validation?: Json | null
          contract_validation_at?: string | null
          contract_validation_url?: string | null
          created_at?: string
          data_fim_contrato?: string | null
          data_inicio_contrato?: string
          growth_class_ata?: string | null
          growth_class_data_agendada?: string | null
          growth_class_data_realizada?: string | null
          growth_class_expectativas?: string | null
          growth_class_google_event_id?: string | null
          growth_class_meet_link?: string | null
          growth_class_oportunidades_monetizacao?: string | null
          growth_class_proximos_passos?: string | null
          growth_class_responsavel_id?: string | null
          growth_class_transcricao_reuniao?: string | null
          health_score?: number | null
          id?: string
          notas?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          oportunidade_id?: string | null
          pre_growth_class_gerado_em?: string | null
          pre_growth_class_relatorio?: string | null
          produtos_contratados?: Json | null
          proxima_revisao?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tenant_id?: string
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
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "cobrancas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          google_event_id: string | null
          google_resource_type: string | null
          google_sync_error: string | null
          google_sync_status: string | null
          id: string
          lead_id: string | null
          oportunidade_id: string | null
          tenant_id: string
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
          google_event_id?: string | null
          google_resource_type?: string | null
          google_sync_error?: string | null
          google_sync_status?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          tenant_id?: string
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
          google_event_id?: string | null
          google_resource_type?: string | null
          google_sync_error?: string | null
          google_sync_status?: string | null
          id?: string
          lead_id?: string | null
          oportunidade_id?: string | null
          tenant_id?: string
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
            foreignKeyName: "crm_atividades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      crm_call_events: {
        Row: {
          call_id: string | null
          created_at: string
          duracao_seg: number | null
          event_type: string
          gravacao_url: string | null
          id: string
          lead_id: string | null
          operador: string | null
          provider: string
          raw_payload: Json
          resumo: string | null
          resumo_status: string | null
          status: string | null
          telefone: string | null
          telefone_normalizado: string | null
          tenant_id: string
          transcricao: string | null
          transcricao_error: string | null
          transcricao_status: string | null
          user_id: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          duracao_seg?: number | null
          event_type: string
          gravacao_url?: string | null
          id?: string
          lead_id?: string | null
          operador?: string | null
          provider?: string
          raw_payload?: Json
          resumo?: string | null
          resumo_status?: string | null
          status?: string | null
          telefone?: string | null
          telefone_normalizado?: string | null
          tenant_id?: string
          transcricao?: string | null
          transcricao_error?: string | null
          transcricao_status?: string | null
          user_id?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string
          duracao_seg?: number | null
          event_type?: string
          gravacao_url?: string | null
          id?: string
          lead_id?: string | null
          operador?: string | null
          provider?: string
          raw_payload?: Json
          resumo?: string | null
          resumo_status?: string | null
          status?: string | null
          telefone?: string | null
          telefone_normalizado?: string | null
          tenant_id?: string
          transcricao?: string | null
          transcricao_error?: string | null
          transcricao_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_call_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_call_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_copilot_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          oportunidade_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          oportunidade_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          oportunidade_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_copilot_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          arrematador: string | null
          briefing_mercado: Json | null
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
          outbound_tag: string | null
          outbound_tag_color: string | null
          pais: string | null
          pesquisa_pre_qualificacao: Json | null
          pipe: Database["public"]["Enums"]["lead_pipe"]
          qualificacao: string | null
          responsavel_id: string | null
          segmento: string | null
          site: string | null
          telefone: string | null
          temperatura: string | null
          tenant_id: string
          tier: string | null
          tipo_produto: string | null
          ultimo_contato_telefonico: string | null
          updated_at: string
          urgencia: string | null
          valor_pago: number | null
        }
        Insert: {
          arrematador?: string | null
          briefing_mercado?: Json | null
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
          outbound_tag?: string | null
          outbound_tag_color?: string | null
          pais?: string | null
          pesquisa_pre_qualificacao?: Json | null
          pipe?: Database["public"]["Enums"]["lead_pipe"]
          qualificacao?: string | null
          responsavel_id?: string | null
          segmento?: string | null
          site?: string | null
          telefone?: string | null
          temperatura?: string | null
          tenant_id?: string
          tier?: string | null
          tipo_produto?: string | null
          ultimo_contato_telefonico?: string | null
          updated_at?: string
          urgencia?: string | null
          valor_pago?: number | null
        }
        Update: {
          arrematador?: string | null
          briefing_mercado?: Json | null
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
          outbound_tag?: string | null
          outbound_tag_color?: string | null
          pais?: string | null
          pesquisa_pre_qualificacao?: Json | null
          pipe?: Database["public"]["Enums"]["lead_pipe"]
          qualificacao?: string | null
          responsavel_id?: string | null
          segmento?: string | null
          site?: string | null
          telefone?: string | null
          temperatura?: string | null
          tenant_id?: string
          tier?: string | null
          tipo_produto?: string | null
          ultimo_contato_telefonico?: string | null
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
          {
            foreignKeyName: "crm_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_oportunidades: {
        Row: {
          contrato_url: string | null
          created_at: string
          data_fechamento_previsto: string | null
          data_fechamento_real: string | null
          data_proposta: string | null
          etapa: Database["public"]["Enums"]["oportunidade_etapa"]
          grau_exigencia: string | null
          id: string
          info_deal: string | null
          lead_id: string | null
          motivo_perda: string | null
          nivel_consciencia: string | null
          nome_oportunidade: string
          notas: string | null
          oportunidades_monetizacao: string | null
          responsavel_id: string | null
          resumo_reuniao: string | null
          temperatura: string | null
          tenant_id: string
          transcricao_reuniao: string | null
          updated_at: string
          valor_ef: number | null
          valor_fee: number | null
          valor_total: number | null
        }
        Insert: {
          contrato_url?: string | null
          created_at?: string
          data_fechamento_previsto?: string | null
          data_fechamento_real?: string | null
          data_proposta?: string | null
          etapa?: Database["public"]["Enums"]["oportunidade_etapa"]
          grau_exigencia?: string | null
          id?: string
          info_deal?: string | null
          lead_id?: string | null
          motivo_perda?: string | null
          nivel_consciencia?: string | null
          nome_oportunidade: string
          notas?: string | null
          oportunidades_monetizacao?: string | null
          responsavel_id?: string | null
          resumo_reuniao?: string | null
          temperatura?: string | null
          tenant_id?: string
          transcricao_reuniao?: string | null
          updated_at?: string
          valor_ef?: number | null
          valor_fee?: number | null
          valor_total?: number | null
        }
        Update: {
          contrato_url?: string | null
          created_at?: string
          data_fechamento_previsto?: string | null
          data_fechamento_real?: string | null
          data_proposta?: string | null
          etapa?: Database["public"]["Enums"]["oportunidade_etapa"]
          grau_exigencia?: string | null
          id?: string
          info_deal?: string | null
          lead_id?: string | null
          motivo_perda?: string | null
          nivel_consciencia?: string | null
          nome_oportunidade?: string
          notas?: string | null
          oportunidades_monetizacao?: string | null
          responsavel_id?: string | null
          resumo_reuniao?: string | null
          temperatura?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "crm_oportunidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          tier_mix?: Json | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "mix_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_tenant_id: string | null
          approved: boolean
          avatar_url: string | null
          cargo: string | null
          created_at: string
          departamento: string | null
          email: string
          full_name: string | null
          id: string
          telefone: string | null
          tenant_id: string
        }
        Insert: {
          active_tenant_id?: string | null
          approved?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          email: string
          full_name?: string | null
          id: string
          telefone?: string | null
          tenant_id?: string
        }
        Update: {
          active_tenant_id?: string | null
          approved?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          email?: string
          full_name?: string | null
          id?: string
          telefone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_access_templates: {
        Row: {
          cargo: string
          pages: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cargo: string
          pages?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cargo?: string
          pages?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_access_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_enabled_pages: {
        Row: {
          created_at: string
          page_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          page_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          page_path?: string
          tenant_id?: string
        }
        Relationships: []
      }
      tenant_versions: {
        Row: {
          build_hash: string
          created_at: string
          id: string
          notes: string | null
          tenant_id: string
          version_number: number
        }
        Insert: {
          build_hash: string
          created_at?: string
          id?: string
          notes?: string | null
          tenant_id: string
          version_number: number
        }
        Update: {
          build_hash?: string
          created_at?: string
          id?: string
          notes?: string | null
          tenant_id?: string
          version_number?: number
        }
        Relationships: []
      }
      tenants: {
        Row: {
          active: boolean
          app_base_url: string | null
          client_logo_url: string | null
          client_name: string
          client_slug: string
          created_at: string
          id: string
          internal_notes: string | null
          primary_color_hsl: string | null
          provisioned_at: string | null
          sheet_ids: Json
          status: string
          updated_at: string
          v4_contact: string | null
          voip_provider: string | null
        }
        Insert: {
          active?: boolean
          app_base_url?: string | null
          client_logo_url?: string | null
          client_name: string
          client_slug: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          primary_color_hsl?: string | null
          provisioned_at?: string | null
          sheet_ids?: Json
          status?: string
          updated_at?: string
          v4_contact?: string | null
          voip_provider?: string | null
        }
        Update: {
          active?: boolean
          app_base_url?: string | null
          client_logo_url?: string | null
          client_name?: string
          client_slug?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          primary_color_hsl?: string | null
          provisioned_at?: string | null
          sheet_ids?: Json
          status?: string
          updated_at?: string
          v4_contact?: string | null
          voip_provider?: string | null
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_google_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_page_access: {
        Row: {
          id: string
          page_path: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          page_path: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          id?: string
          page_path?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_page_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      voip_accounts: {
        Row: {
          agent_id: string | null
          apelido: string | null
          ativo: boolean
          created_at: string
          id: string
          operador_id: string
          provider: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          apelido?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          operador_id: string
          provider?: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          apelido?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          operador_id?: string
          provider?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voip_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_mark_onboarding_atrasada: { Args: never; Returns: undefined }
      backfill_3cplus_call_events: {
        Args: never
        Returns: {
          linked: number
          processed: number
          updated: number
        }[]
      }
      current_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      marcar_cobrancas_atrasadas: { Args: never; Returns: undefined }
      normalize_phone_br: { Args: { phone: string }; Returns: string }
      promote_jesus_version_to_tenant: {
        Args: { p_target_tenant: string }
        Returns: {
          build_hash: string
          created_at: string
          id: string
          notes: string | null
          tenant_id: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "tenant_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_version_if_new: {
        Args: { p_build_hash: string }
        Returns: {
          build_hash: string
          created_at: string
          id: string
          notes: string | null
          tenant_id: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "tenant_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_tenant_by_hostname: {
        Args: { _hostname: string }
        Returns: {
          active: boolean
          app_base_url: string
          client_logo_url: string
          client_name: string
          client_slug: string
          id: string
          primary_color_hsl: string
          sheet_ids: Json
          voip_provider: string
        }[]
      }
    }
    Enums: {
      account_status: "ativo" | "pausado" | "encerrado"
      app_role: "admin" | "user" | "super_admin_v4"
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
      lead_pipe: "inbound" | "outbound"
      onboarding_status: "entrada" | "atrasada" | "concluida" | "churn_m0"
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
      app_role: ["admin", "user", "super_admin_v4"],
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
      lead_pipe: ["inbound", "outbound"],
      onboarding_status: ["entrada", "atrasada", "concluida", "churn_m0"],
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
