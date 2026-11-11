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
    PostgrestVersion: "14.18"
  }
  calendario: {
    Tables: {
      itens: {
        Row: {
          atualizado_em: string
          cargos: string[]
          concluido_em: string | null
          concluido_por: string | null
          criado_em: string
          criado_por: string | null
          descricao: string | null
          fim: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          inicio: string
          local: string | null
          recorrencia: string | null
          recorrencia_ate: string | null
          responsavel_id: string | null
          setores: string[]
          tipo_id: string
          titulo: string
          usuarios: string[]
          visibilidade: string
        }
        Insert: {
          atualizado_em?: string
          cargos?: string[]
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          fim: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inicio: string
          local?: string | null
          recorrencia?: string | null
          recorrencia_ate?: string | null
          responsavel_id?: string | null
          setores?: string[]
          tipo_id: string
          titulo: string
          usuarios?: string[]
          visibilidade?: string
        }
        Update: {
          atualizado_em?: string
          cargos?: string[]
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          fim?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          inicio?: string
          local?: string | null
          recorrencia?: string | null
          recorrencia_ate?: string | null
          responsavel_id?: string | null
          setores?: string[]
          tipo_id?: string
          titulo?: string
          usuarios?: string[]
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cor: string
          criado_em: string
          descricao: string | null
          icone: string
          id: string
          nome: string
          ordem: number
          usa_conclusao: boolean
          usa_horario: boolean
          usa_local: boolean
          usa_periodo: boolean
          usa_recorrencia: boolean
          usa_responsavel: boolean
          visibilidade_padrao: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cor: string
          criado_em?: string
          descricao?: string | null
          icone?: string
          id?: string
          nome: string
          ordem?: number
          usa_conclusao?: boolean
          usa_horario?: boolean
          usa_local?: boolean
          usa_periodo?: boolean
          usa_recorrencia?: boolean
          usa_responsavel?: boolean
          visibilidade_padrao?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string
          criado_em?: string
          descricao?: string | null
          icone?: string
          id?: string
          nome?: string
          ordem?: number
          usa_conclusao?: boolean
          usa_horario?: boolean
          usa_local?: boolean
          usa_periodo?: boolean
          usa_recorrencia?: boolean
          usa_responsavel?: boolean
          visibilidade_padrao?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      concluir: {
        Args: { p_feito: boolean; p_item: string }
        Returns: undefined
      }
      meu_cargo: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  comercial: {
    Tables: {
      censo_convites: {
        Row: {
          bloco: string | null
          criado_em: string
          criado_por: string | null
          empresa_nome: string
          enviado_em: string | null
          exemplo: boolean
          id: string
          locatario_enet_id: string | null
          luc: string | null
          rodada_id: string
          token: string
        }
        Insert: {
          bloco?: string | null
          criado_em?: string
          criado_por?: string | null
          empresa_nome: string
          enviado_em?: string | null
          exemplo?: boolean
          id?: string
          locatario_enet_id?: string | null
          luc?: string | null
          rodada_id: string
          token?: string
        }
        Update: {
          bloco?: string | null
          criado_em?: string
          criado_por?: string | null
          empresa_nome?: string
          enviado_em?: string | null
          exemplo?: boolean
          id?: string
          locatario_enet_id?: string | null
          luc?: string | null
          rodada_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "censo_convites_rodada_id_fkey"
            columns: ["rodada_id"]
            isOneToOne: false
            referencedRelation: "censo_rodadas"
            referencedColumns: ["id"]
          },
        ]
      }
      censo_respostas: {
        Row: {
          atualizado_em: string
          bloco: string | null
          colaboradores: number | null
          considerada: boolean
          conversoes_dia: number | null
          convite_id: string | null
          dias_uso: number | null
          email: string | null
          empresa_nome: string
          exemplo: boolean
          expectativas: string[]
          id: string
          importacao_id: string | null
          lancada_por: string | null
          locatario_enet_id: string | null
          luc: string | null
          mensalidade: boolean | null
          origem: string
          respondida_em: string
          rodada_id: string
          segmento: string | null
          sugestao: string | null
          ticket: number | null
          ticket_ajustado: number | null
          visitantes_dia: number | null
        }
        Insert: {
          atualizado_em?: string
          bloco?: string | null
          colaboradores?: number | null
          considerada?: boolean
          conversoes_dia?: number | null
          convite_id?: string | null
          dias_uso?: number | null
          email?: string | null
          empresa_nome: string
          exemplo?: boolean
          expectativas?: string[]
          id?: string
          importacao_id?: string | null
          lancada_por?: string | null
          locatario_enet_id?: string | null
          luc?: string | null
          mensalidade?: boolean | null
          origem?: string
          respondida_em?: string
          rodada_id: string
          segmento?: string | null
          sugestao?: string | null
          ticket?: number | null
          ticket_ajustado?: number | null
          visitantes_dia?: number | null
        }
        Update: {
          atualizado_em?: string
          bloco?: string | null
          colaboradores?: number | null
          considerada?: boolean
          conversoes_dia?: number | null
          convite_id?: string | null
          dias_uso?: number | null
          email?: string | null
          empresa_nome?: string
          exemplo?: boolean
          expectativas?: string[]
          id?: string
          importacao_id?: string | null
          lancada_por?: string | null
          locatario_enet_id?: string | null
          luc?: string | null
          mensalidade?: boolean | null
          origem?: string
          respondida_em?: string
          rodada_id?: string
          segmento?: string | null
          sugestao?: string | null
          ticket?: number | null
          ticket_ajustado?: number | null
          visitantes_dia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "censo_respostas_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: true
            referencedRelation: "censo_convites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "censo_respostas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "censo_respostas_rodada_id_fkey"
            columns: ["rodada_id"]
            isOneToOne: false
            referencedRelation: "censo_rodadas"
            referencedColumns: ["id"]
          },
        ]
      }
      censo_rodadas: {
        Row: {
          atualizado_em: string
          criada_em: string
          criada_por: string | null
          encerrada_em: string | null
          encerrada_por: string | null
          exemplo: boolean
          fim: string
          id: string
          importacao_id: string | null
          inicio: string
          nome: string
          situacao: string
        }
        Insert: {
          atualizado_em?: string
          criada_em?: string
          criada_por?: string | null
          encerrada_em?: string | null
          encerrada_por?: string | null
          exemplo?: boolean
          fim: string
          id?: string
          importacao_id?: string | null
          inicio: string
          nome: string
          situacao?: string
        }
        Update: {
          atualizado_em?: string
          criada_em?: string
          criada_por?: string | null
          encerrada_em?: string | null
          encerrada_por?: string | null
          exemplo?: boolean
          fim?: string
          id?: string
          importacao_id?: string | null
          inicio?: string
          nome?: string
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "censo_rodadas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      censo_sugestao_temas: {
        Row: {
          contato_id: string | null
          criado_em: string
          exemplo: boolean
          id: string
          movido_em: string | null
          movido_por: string | null
          origem: string
          resposta_id: string | null
          tema_id: string
          trecho: string | null
        }
        Insert: {
          contato_id?: string | null
          criado_em?: string
          exemplo?: boolean
          id?: string
          movido_em?: string | null
          movido_por?: string | null
          origem?: string
          resposta_id?: string | null
          tema_id: string
          trecho?: string | null
        }
        Update: {
          contato_id?: string | null
          criado_em?: string
          exemplo?: boolean
          id?: string
          movido_em?: string | null
          movido_por?: string | null
          origem?: string
          resposta_id?: string | null
          tema_id?: string
          trecho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "censo_sugestao_temas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "censo_sugestao_temas_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "censo_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "censo_sugestao_temas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "censo_temas"
            referencedColumns: ["id"]
          },
        ]
      }
      censo_temas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          exemplo: boolean
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          exemplo?: boolean
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          exemplo?: boolean
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      contatos: {
        Row: {
          atualizado_em: string
          bloco: string | null
          canal: string
          contrato_enet_id: string | null
          data: string
          descricao: string
          exemplo: boolean
          id: string
          importacao_id: string | null
          locatario_enet_id: string | null
          locatario_nome: string
          luc: string | null
          precisa_outro_setor: boolean
          registrado_em: string
          registrado_por: string | null
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          bloco?: string | null
          canal: string
          contrato_enet_id?: string | null
          data?: string
          descricao: string
          exemplo?: boolean
          id?: string
          importacao_id?: string | null
          locatario_enet_id?: string | null
          locatario_nome: string
          luc?: string | null
          precisa_outro_setor?: boolean
          registrado_em?: string
          registrado_por?: string | null
          tipo: string
        }
        Update: {
          atualizado_em?: string
          bloco?: string | null
          canal?: string
          contrato_enet_id?: string | null
          data?: string
          descricao?: string
          exemplo?: boolean
          id?: string
          importacao_id?: string | null
          locatario_enet_id?: string | null
          locatario_nome?: string
          luc?: string | null
          precisa_outro_setor?: boolean
          registrado_em?: string
          registrado_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contatos_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_anexos: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          contrato_id: string
          enviado_em: string
          enviado_por: string | null
          id: string
          tamanho: number | null
          tipo: string
          tipo_mime: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          contrato_id: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          tamanho?: number | null
          tipo: string
          tipo_mime?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          contrato_id?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          tamanho?: number | null
          tipo?: string
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_anexos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_kit: {
        Row: {
          contrato_id: string
          versao_id: string
        }
        Insert: {
          contrato_id: string
          versao_id: string
        }
        Update: {
          contrato_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_kit_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_kit_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "kit_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_versoes: {
        Row: {
          conteudo: Json
          contrato_id: string
          em: string
          etapa_atual: number
          id: number
          por: string | null
          status: string
          versao: number
        }
        Insert: {
          conteudo: Json
          contrato_id: string
          em?: string
          etapa_atual: number
          id?: never
          por?: string | null
          status: string
          versao: number
        }
        Update: {
          conteudo?: Json
          contrato_id?: string
          em?: string
          etapa_atual?: number
          id?: never
          por?: string | null
          status?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_versoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          aluguel: number | null
          area_m2: number | null
          atualizado_em: string
          atualizado_por: string | null
          bloco: string | null
          contrato_enet_id: string | null
          criado_em: string
          criado_por: string | null
          dados: Json
          etapa_atual: number
          exemplo: boolean
          ficha_id: string | null
          garantia: string | null
          gerado_em: string | null
          gerado_por: string | null
          id: string
          inicio: string | null
          locatario_nome: string | null
          lucs: string[]
          parte_tipo: string | null
          status: string
          termino: string | null
          tipo: string
          versao: number
        }
        Insert: {
          aluguel?: number | null
          area_m2?: number | null
          atualizado_em?: string
          atualizado_por?: string | null
          bloco?: string | null
          contrato_enet_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          etapa_atual?: number
          exemplo?: boolean
          ficha_id?: string | null
          garantia?: string | null
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          inicio?: string | null
          locatario_nome?: string | null
          lucs?: string[]
          parte_tipo?: string | null
          status?: string
          termino?: string | null
          tipo: string
          versao?: number
        }
        Update: {
          aluguel?: number | null
          area_m2?: number | null
          atualizado_em?: string
          atualizado_por?: string | null
          bloco?: string | null
          contrato_enet_id?: string | null
          criado_em?: string
          criado_por?: string | null
          dados?: Json
          etapa_atual?: number
          exemplo?: boolean
          ficha_id?: string | null
          garantia?: string | null
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          inicio?: string | null
          locatario_nome?: string | null
          lucs?: string[]
          parte_tipo?: string | null
          status?: string
          termino?: string | null
          tipo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      faixas_evento: {
        Row: {
          area_ate: number
          area_de: number
          atualizado_em: string
          fixo: boolean
          id: string
          nome: string
          ordem: number
          valor_comum: number
          valor_sazonal: number
        }
        Insert: {
          area_ate: number
          area_de: number
          atualizado_em?: string
          fixo?: boolean
          id?: string
          nome: string
          ordem: number
          valor_comum: number
          valor_sazonal: number
        }
        Update: {
          area_ate?: number
          area_de?: number
          atualizado_em?: string
          fixo?: boolean
          id?: string
          nome?: string
          ordem?: number
          valor_comum?: number
          valor_sazonal?: number
        }
        Relationships: []
      }
      ficha_acessos: {
        Row: {
          acao: string
          em: string
          ficha_id: string
          id: number
          usuario_id: string
        }
        Insert: {
          acao?: string
          em?: string
          ficha_id: string
          id?: never
          usuario_id?: string
        }
        Update: {
          acao?: string
          em?: string
          ficha_id?: string
          id?: never
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficha_acessos_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_dados: {
        Row: {
          assinatura_nome: string | null
          atualizado_em: string
          documento: string | null
          ficha_id: string
          respostas: Json
        }
        Insert: {
          assinatura_nome?: string | null
          atualizado_em?: string
          documento?: string | null
          ficha_id: string
          respostas?: Json
        }
        Update: {
          assinatura_nome?: string | null
          atualizado_em?: string
          documento?: string | null
          ficha_id?: string
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ficha_dados_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: true
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_documentos: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          documento: string
          enviado_em: string
          ficha_id: string
          id: string
          tamanho: number | null
          tipo_mime: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          documento: string
          enviado_em?: string
          ficha_id: string
          id?: string
          tamanho?: number | null
          tipo_mime?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          documento?: string
          enviado_em?: string
          ficha_id?: string
          id?: string
          tamanho?: number | null
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ficha_documentos_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas: {
        Row: {
          atualizado_em: string
          cancelada_em: string | null
          consentimento_em: string | null
          exemplo: boolean
          expira_em: string | null
          ficha_principal_id: string | null
          gerada_em: string
          gerada_por: string | null
          id: string
          importacao_id: string | null
          iniciada_em: string | null
          luc: string | null
          nome: string | null
          origem: string
          rd_oportunidade: string | null
          recebida_em: string | null
          situacao: string
          tipo: string | null
          token: string
          ultimo_acesso_em: string | null
          usada_em: string | null
        }
        Insert: {
          atualizado_em?: string
          cancelada_em?: string | null
          consentimento_em?: string | null
          exemplo?: boolean
          expira_em?: string | null
          ficha_principal_id?: string | null
          gerada_em?: string
          gerada_por?: string | null
          id?: string
          importacao_id?: string | null
          iniciada_em?: string | null
          luc?: string | null
          nome?: string | null
          origem?: string
          rd_oportunidade?: string | null
          recebida_em?: string | null
          situacao?: string
          tipo?: string | null
          token?: string
          ultimo_acesso_em?: string | null
          usada_em?: string | null
        }
        Update: {
          atualizado_em?: string
          cancelada_em?: string | null
          consentimento_em?: string | null
          exemplo?: boolean
          expira_em?: string | null
          ficha_principal_id?: string | null
          gerada_em?: string
          gerada_por?: string | null
          id?: string
          importacao_id?: string | null
          iniciada_em?: string | null
          luc?: string | null
          nome?: string | null
          origem?: string
          rd_oportunidade?: string | null
          recebida_em?: string | null
          situacao?: string
          tipo?: string | null
          token?: string
          ultimo_acesso_em?: string | null
          usada_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fichas_ficha_principal_id_fkey"
            columns: ["ficha_principal_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      fontes_de_para: {
        Row: {
          atualizado_em: string
          fonte_ajustada: string
          fonte_rd: string
        }
        Insert: {
          atualizado_em?: string
          fonte_ajustada: string
          fonte_rd: string
        }
        Update: {
          atualizado_em?: string
          fonte_ajustada?: string
          fonte_rd?: string
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          arquivo_sha256: string
          atualizado_em: string
          avisos: Json
          com_aviso: number
          confirmado_em: string | null
          confirmado_por: string | null
          criado_em: string
          desfeito_em: string | null
          desfeito_por: string | null
          duplicadas: number
          enviado_por: string | null
          id: string
          linhas: number
          status: string
          tipo: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          arquivo_sha256: string
          atualizado_em?: string
          avisos?: Json
          com_aviso?: number
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string
          desfeito_em?: string | null
          desfeito_por?: string | null
          duplicadas?: number
          enviado_por?: string | null
          id?: string
          linhas?: number
          status?: string
          tipo: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          arquivo_sha256?: string
          atualizado_em?: string
          avisos?: Json
          com_aviso?: number
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string
          desfeito_em?: string | null
          desfeito_por?: string | null
          duplicadas?: number
          enviado_por?: string | null
          id?: string
          linhas?: number
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      kit_documentos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          blocos: string[]
          categoria: string
          criado_em: string
          id: string
          nome: string
          ordem: number
          todo_contrato: boolean
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          blocos?: string[]
          categoria: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          todo_contrato?: boolean
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          blocos?: string[]
          categoria?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          todo_contrato?: boolean
        }
        Relationships: []
      }
      kit_versoes: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          atual: boolean
          atualizado_em: string
          data: string | null
          documento_id: string
          enviado_em: string
          enviado_por: string | null
          id: string
          paginas: number | null
          tamanho: number | null
          validade: string | null
          versao: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          atual?: boolean
          atualizado_em?: string
          data?: string | null
          documento_id: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          paginas?: number | null
          tamanho?: number | null
          validade?: string | null
          versao: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          atual?: boolean
          atualizado_em?: string
          data?: string | null
          documento_id?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          paginas?: number | null
          tamanho?: number | null
          validade?: string | null
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "kit_versoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "kit_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      listas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          extra: Json
          id: string
          lista: string
          ordem: number
          valor: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          extra?: Json
          id?: string
          lista: string
          ordem?: number
          valor: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          extra?: Json
          id?: string
          lista?: string
          ordem?: number
          valor?: string
        }
        Relationships: []
      }
      ocupacao_fotos: {
        Row: {
          abl_locada: number
          abl_total: number
          clientes_ativos: number | null
          exemplo: boolean
          gravada_em: string
          lucs: number
          lucs_locados: number
          mes: string
          por_bloco: Json
          por_tipo: Json
        }
        Insert: {
          abl_locada: number
          abl_total: number
          clientes_ativos?: number | null
          exemplo?: boolean
          gravada_em?: string
          lucs: number
          lucs_locados: number
          mes: string
          por_bloco?: Json
          por_tipo?: Json
        }
        Update: {
          abl_locada?: number
          abl_total?: number
          clientes_ativos?: number | null
          exemplo?: boolean
          gravada_em?: string
          lucs?: number
          lucs_locados?: number
          mes?: string
          por_bloco?: Json
          por_tipo?: Json
        }
        Relationships: []
      }
      parametros: {
        Row: {
          atualizado_em: string
          capitalizacao_prazo_dias: number
          caucao_alugueis: number
          caucao_prazo_dias: number
          censo_dias_mensalidade: number
          consumo_agua_padrao: boolean
          curva_a_pct: number
          curva_b_pct: number
          dia_vencimento_padrao: number
          empreendimento_nome: string
          endereco_bairro: string
          endereco_cep: string
          endereco_cidade: string
          endereco_complemento: string | null
          endereco_logradouro: string
          endereco_numero: string
          endereco_uf: string
          entrega_padrao: string
          entrega_prazo_implantacao_dias: number
          entrega_tipo_imovel: string
          evento_area_texto: string
          evento_condicao_pagamento: string
          evento_desconto_pct: number
          evento_desmontagem: string
          evento_fechamento_dias_uteis: number
          evento_horario: string
          evento_m2_por_agente: number
          evento_montagem: string
          evento_notas: string[]
          evento_pessoas_por_seguranca: number
          evento_reajuste_pct: number
          evento_validade_dias: number
          ficha_boas_vindas: string
          ficha_termo_lgpd: string
          ficha_validade_dias: number
          funil_padrao: string
          id: boolean
          indice_padrao: string
          kit_aviso_dias: number
          lembrete_aniversario_dias: number
          multa_alugueis: number
          nc004_versao: string
          obras_projetos_dias: number
          obras_retirada_dias: number
          obras_tapume_dias: number
          obrigatorios_garantia: Json
          pesquisa_faixas_m2: number[]
          reajuste_previsto_dias: number
          transferencia_dias: number
          vaga_promocional_padrao: number
          vencimento_faixa1_dias: number
          vencimento_faixa2_dias: number
        }
        Insert: {
          atualizado_em?: string
          capitalizacao_prazo_dias?: number
          caucao_alugueis?: number
          caucao_prazo_dias?: number
          censo_dias_mensalidade?: number
          consumo_agua_padrao?: boolean
          curva_a_pct?: number
          curva_b_pct?: number
          dia_vencimento_padrao?: number
          empreendimento_nome?: string
          endereco_bairro?: string
          endereco_cep?: string
          endereco_cidade?: string
          endereco_complemento?: string | null
          endereco_logradouro?: string
          endereco_numero?: string
          endereco_uf?: string
          entrega_padrao?: string
          entrega_prazo_implantacao_dias?: number
          entrega_tipo_imovel?: string
          evento_area_texto?: string
          evento_condicao_pagamento?: string
          evento_desconto_pct?: number
          evento_desmontagem?: string
          evento_fechamento_dias_uteis?: number
          evento_horario?: string
          evento_m2_por_agente?: number
          evento_montagem?: string
          evento_notas?: string[]
          evento_pessoas_por_seguranca?: number
          evento_reajuste_pct?: number
          evento_validade_dias?: number
          ficha_boas_vindas?: string
          ficha_termo_lgpd?: string
          ficha_validade_dias?: number
          funil_padrao?: string
          id?: boolean
          indice_padrao?: string
          kit_aviso_dias?: number
          lembrete_aniversario_dias?: number
          multa_alugueis?: number
          nc004_versao?: string
          obras_projetos_dias?: number
          obras_retirada_dias?: number
          obras_tapume_dias?: number
          obrigatorios_garantia?: Json
          pesquisa_faixas_m2?: number[]
          reajuste_previsto_dias?: number
          transferencia_dias?: number
          vaga_promocional_padrao?: number
          vencimento_faixa1_dias?: number
          vencimento_faixa2_dias?: number
        }
        Update: {
          atualizado_em?: string
          capitalizacao_prazo_dias?: number
          caucao_alugueis?: number
          caucao_prazo_dias?: number
          censo_dias_mensalidade?: number
          consumo_agua_padrao?: boolean
          curva_a_pct?: number
          curva_b_pct?: number
          dia_vencimento_padrao?: number
          empreendimento_nome?: string
          endereco_bairro?: string
          endereco_cep?: string
          endereco_cidade?: string
          endereco_complemento?: string | null
          endereco_logradouro?: string
          endereco_numero?: string
          endereco_uf?: string
          entrega_padrao?: string
          entrega_prazo_implantacao_dias?: number
          entrega_tipo_imovel?: string
          evento_area_texto?: string
          evento_condicao_pagamento?: string
          evento_desconto_pct?: number
          evento_desmontagem?: string
          evento_fechamento_dias_uteis?: number
          evento_horario?: string
          evento_m2_por_agente?: number
          evento_montagem?: string
          evento_notas?: string[]
          evento_pessoas_por_seguranca?: number
          evento_reajuste_pct?: number
          evento_validade_dias?: number
          ficha_boas_vindas?: string
          ficha_termo_lgpd?: string
          ficha_validade_dias?: number
          funil_padrao?: string
          id?: boolean
          indice_padrao?: string
          kit_aviso_dias?: number
          lembrete_aniversario_dias?: number
          multa_alugueis?: number
          nc004_versao?: string
          obras_projetos_dias?: number
          obras_retirada_dias?: number
          obras_tapume_dias?: number
          obrigatorios_garantia?: Json
          pesquisa_faixas_m2?: number[]
          reajuste_previsto_dias?: number
          transferencia_dias?: number
          vaga_promocional_padrao?: number
          vencimento_faixa1_dias?: number
          vencimento_faixa2_dias?: number
        }
        Relationships: []
      }
      pesquisa_imoveis: {
        Row: {
          aluguel: number
          area_m2: number
          atualizado_em: string
          bairro: string
          cep: string | null
          condominio: number | null
          criado_em: string
          criado_por: string | null
          custo_m2: number | null
          custo_total: number | null
          data_pesquisa: string
          endereco: string
          exemplo: boolean
          fonte: string | null
          id: string
          importacao_id: string | null
          iptu: number | null
          observacao: string | null
          tipo: string
          vagas: number | null
          valor_m2: number | null
        }
        Insert: {
          aluguel: number
          area_m2: number
          atualizado_em?: string
          bairro: string
          cep?: string | null
          condominio?: number | null
          criado_em?: string
          criado_por?: string | null
          custo_m2?: never
          custo_total?: never
          data_pesquisa: string
          endereco: string
          exemplo?: boolean
          fonte?: string | null
          id?: string
          importacao_id?: string | null
          iptu?: number | null
          observacao?: string | null
          tipo: string
          vagas?: number | null
          valor_m2?: never
        }
        Update: {
          aluguel?: number
          area_m2?: number
          atualizado_em?: string
          bairro?: string
          cep?: string | null
          condominio?: number | null
          criado_em?: string
          criado_por?: string | null
          custo_m2?: never
          custo_total?: never
          data_pesquisa?: string
          endereco?: string
          exemplo?: boolean
          fonte?: string | null
          id?: string
          importacao_id?: string | null
          iptu?: number | null
          observacao?: string | null
          tipo?: string
          vagas?: number | null
          valor_m2?: never
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_imoveis_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas_evento: {
        Row: {
          agentes_limpeza: number | null
          area_evento: string | null
          area_m2: number
          atualizado_em: string
          calculo: Json
          cliente: string
          condicao_pagamento: string | null
          criado_em: string
          criado_por: string | null
          data_evento: string | null
          data_evento_fim: string | null
          desconto_pct: number
          desconto_primeira_edicao: number
          desmontagem: string | null
          dias: number
          exemplo: boolean
          fechamento_ate: string | null
          horario: string | null
          id: string
          montagem: string | null
          notas: string[]
          observacoes: string[]
          oportunidade_rd: string | null
          pessoas: number | null
          segurancas: number | null
          status: string
          tipo_data: string
          validade: string | null
          valor_final: number
          valor_original: number
          valor_parceria: number
        }
        Insert: {
          agentes_limpeza?: number | null
          area_evento?: string | null
          area_m2: number
          atualizado_em?: string
          calculo?: Json
          cliente: string
          condicao_pagamento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_evento?: string | null
          data_evento_fim?: string | null
          desconto_pct?: number
          desconto_primeira_edicao?: number
          desmontagem?: string | null
          dias?: number
          exemplo?: boolean
          fechamento_ate?: string | null
          horario?: string | null
          id?: string
          montagem?: string | null
          notas?: string[]
          observacoes?: string[]
          oportunidade_rd?: string | null
          pessoas?: number | null
          segurancas?: number | null
          status?: string
          tipo_data?: string
          validade?: string | null
          valor_final: number
          valor_original: number
          valor_parceria: number
        }
        Update: {
          agentes_limpeza?: number | null
          area_evento?: string | null
          area_m2?: number
          atualizado_em?: string
          calculo?: Json
          cliente?: string
          condicao_pagamento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_evento?: string | null
          data_evento_fim?: string | null
          desconto_pct?: number
          desconto_primeira_edicao?: number
          desmontagem?: string | null
          dias?: number
          exemplo?: boolean
          fechamento_ate?: string | null
          horario?: string | null
          id?: string
          montagem?: string | null
          notas?: string[]
          observacoes?: string[]
          oportunidade_rd?: string | null
          pessoas?: number | null
          segurancas?: number | null
          status?: string
          tipo_data?: string
          validade?: string | null
          valor_final?: number
          valor_original?: number
          valor_parceria?: number
        }
        Relationships: []
      }
      rd_oportunidades: {
        Row: {
          atualizado_em: string
          contatos: Json
          dados: Json
          id: string
        }
        Insert: {
          atualizado_em?: string
          contatos?: Json
          dados: Json
          id: string
        }
        Update: {
          atualizado_em?: string
          contatos?: Json
          dados?: Json
          id?: string
        }
        Relationships: []
      }
      tipos_luc: {
        Row: {
          atualizado_em: string
          conta_ocupacao: boolean
          ordem: number
          receita: string | null
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          conta_ocupacao?: boolean
          ordem?: number
          receita?: string | null
          tipo: string
        }
        Update: {
          atualizado_em?: string
          conta_ocupacao?: boolean
          ordem?: number
          receita?: string | null
          tipo?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      desfazer_importacao: { Args: { p_id: string }; Returns: number }
      gravar_ficha_pelo_link: {
        Args: {
          p_assinatura: string | null
          p_documento: string | null
          p_enviar: boolean
          p_luc: string | null
          p_nome: string | null
          p_respostas: Json
          p_tipo: string | null
          p_token: string
        }
        Returns: string
      }
      pode_importar: { Args: { p_tipo: string }; Returns: boolean }
      remover_exemplos: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  core: {
    Tables: {
      auditoria: {
        Row: {
          acao: string
          antes: Json | null
          depois: Json | null
          em: string
          id: number
          registro_id: string
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          depois?: Json | null
          em?: string
          id?: never
          registro_id: string
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          depois?: Json | null
          em?: string
          id?: never
          registro_id?: string
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      cargo_permissoes: {
        Row: {
          cargo_id: string
          permissao: string
        }
        Insert: {
          cargo_id: string
          permissao: string
        }
        Update: {
          cargo_id?: string
          permissao?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_permissoes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_permissoes_permissao_fkey"
            columns: ["permissao"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      cargos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      empresa: {
        Row: {
          atualizado_em: string
          cep: string | null
          cidade: string | null
          cnpj: string | null
          email: string | null
          endereco: string | null
          id: boolean
          nome: string
          razao_social: string | null
          site: string | null
          telefone: string | null
          uf: string | null
        }
        Insert: {
          atualizado_em?: string
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          email?: string | null
          endereco?: string | null
          id?: boolean
          nome: string
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          atualizado_em?: string
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          email?: string | null
          endereco?: string | null
          id?: boolean
          nome?: string
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          arquivo_sha256: string
          atualizado_em: string
          avisos: Json
          confirmado_em: string | null
          confirmado_por: string | null
          criado_em: string
          enviado_por: string | null
          id: string
          referencia: string
          status: Database["core"]["Enums"]["status_importacao"]
          tipo: Database["core"]["Enums"]["tipo_importacao"]
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          arquivo_sha256: string
          atualizado_em?: string
          avisos?: Json
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string
          enviado_por?: string | null
          id?: string
          referencia: string
          status?: Database["core"]["Enums"]["status_importacao"]
          tipo: Database["core"]["Enums"]["tipo_importacao"]
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          arquivo_sha256?: string
          atualizado_em?: string
          avisos?: Json
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string
          enviado_por?: string | null
          id?: string
          referencia?: string
          status?: Database["core"]["Enums"]["status_importacao"]
          tipo?: Database["core"]["Enums"]["tipo_importacao"]
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacoes_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          descricao: string
          detalhes: Json
          em: string
          evento: string
          id: number
          modulo: string
          usuario_id: string | null
        }
        Insert: {
          descricao: string
          detalhes?: Json
          em?: string
          evento: string
          id?: never
          modulo: string
          usuario_id?: string | null
        }
        Update: {
          descricao?: string
          detalhes?: Json
          em?: string
          evento?: string
          id?: never
          modulo?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      metas: {
        Row: {
          atualizado_em: string
          criado_em: string
          direcao: Database["core"]["Enums"]["direcao_meta"]
          id: string
          indicador: string
          limite_atencao: number | null
          meta: number
          vigente_desde: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          direcao: Database["core"]["Enums"]["direcao_meta"]
          id?: string
          indicador: string
          limite_atencao?: number | null
          meta: number
          vigente_desde: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          direcao?: Database["core"]["Enums"]["direcao_meta"]
          id?: string
          indicador?: string
          limite_atencao?: number | null
          meta?: number
          vigente_desde?: string
        }
        Relationships: []
      }
      permissoes: {
        Row: {
          codigo: string
          descricao: string
        }
        Insert: {
          codigo: string
          descricao: string
        }
        Update: {
          codigo?: string
          descricao?: string
        }
        Relationships: []
      }
      preferencias: {
        Row: {
          atualizado_em: string
          chave: string
          usuario_id: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          usuario_id: string
          valor: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          usuario_id?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_permissoes: {
        Row: {
          concedida_em: string
          concedida_por: string | null
          permissao: string
          usuario_id: string
        }
        Insert: {
          concedida_em?: string
          concedida_por?: string | null
          permissao: string
          usuario_id: string
        }
        Update: {
          concedida_em?: string
          concedida_por?: string | null
          permissao?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_permissoes_concedida_por_fkey"
            columns: ["concedida_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_permissoes_permissao_fkey"
            columns: ["permissao"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "usuario_permissoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cargo_id: string | null
          criado_em: string
          email: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cargo_id?: string | null
          criado_em?: string
          email: string
          id: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cargo_id?: string | null
          criado_em?: string
          email?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      estado_integracoes: {
        Args: never
        Returns: {
          ativa: boolean
          sistema: string
          testado_em: string
          teste_ok: boolean
        }[]
      }
      historico: {
        Args: {
          p_ate?: string
          p_busca?: string
          p_de?: string
          p_deslocamento?: number
          p_limite?: number
          p_modulo?: string
          p_tabelas?: string[]
          p_tipo?: string
          p_usuario?: string
        }
        Returns: {
          acao: string
          antes: Json
          depois: Json
          descricao: string
          em: string
          id: string
          modulo: string
          objeto: string
          registro_id: string
          tipo: string
          total: number
          usuario_id: string
          usuario_nome: string
        }[]
      }
      historico_autores: {
        Args: never
        Returns: {
          id: string
          nome: string
        }[]
      }
      historico_integracoes: {
        Args: { p_limite?: number }
        Returns: {
          avisos: Json
          erro: string
          finalizado_em: string
          iniciado_em: string
          recurso: string
          registros: number
          sistema: string
          status: Database["integracao"]["Enums"]["status_sync"]
        }[]
      }
      integracoes_configuradas: {
        Args: never
        Returns: {
          ativa: boolean
          configurado_em: string
          configurado_por: string
          parametros: Json
          sistema: string
          testado_em: string
          teste_mensagem: string
          teste_ok: boolean
        }[]
      }
      minhas_permissoes: { Args: never; Returns: string[] }
      modulo_da_auditoria: {
        Args: { p_linha: Json; p_tabela: string }
        Returns: string
      }
      pode: { Args: { p: string }; Returns: boolean }
      pode_importar: {
        Args: { t: Database["core"]["Enums"]["tipo_importacao"] }
        Returns: boolean
      }
      pode_modulo: { Args: { modulo: string }; Returns: boolean }
      registrar_teste_integracao: {
        Args: { p_mensagem: string; p_ok: boolean; p_sistema: string }
        Returns: undefined
      }
      remover_integracao: { Args: { p_sistema: string }; Returns: undefined }
      salvar_integracao: {
        Args: {
          p_ativa: boolean
          p_parametros: Json
          p_segredo_cifrado: string
          p_sistema: string
        }
        Returns: undefined
      }
      saude_integracoes: {
        Args: never
        Returns: {
          finalizado_em: string
          iniciado_em: string
          recurso: string
          registros: number
          sistema: string
          status: Database["integracao"]["Enums"]["status_sync"]
          ultimo_sucesso: string
        }[]
      }
      sem_acento: { Args: { t: string }; Returns: string }
    }
    Enums: {
      direcao_meta: "maior_melhor" | "menor_melhor"
      status_importacao: "previa" | "confirmada" | "substituida" | "revertida"
      tipo_importacao: "folha" | "plano_saude"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  financeiro: {
    Tables: {
      estacionamento_movimento: {
        Row: {
          atualizado_em: string
          data: string
          entradas: number
          estacionamento_id: number
          saidas: number
          sync_run_id: string | null
          tipo_veiculo: string
        }
        Insert: {
          atualizado_em?: string
          data: string
          entradas?: number
          estacionamento_id: number
          saidas?: number
          sync_run_id?: string | null
          tipo_veiculo: string
        }
        Update: {
          atualizado_em?: string
          data?: string
          entradas?: number
          estacionamento_id?: number
          saidas?: number
          sync_run_id?: string | null
          tipo_veiculo?: string
        }
        Relationships: []
      }
      estacionamento_pagamentos: {
        Row: {
          atualizado_em: string
          data: string
          estacionamento_id: number
          forma_pagamento: string
          forma_pagamento_codigo: number
          grupos: string[]
          pago_em: string
          parcial: number
          recibo: string
          sync_run_id: string | null
          tarifa: string | null
          terminal: string | null
          ticket: string | null
          tipo_cliente: string
          valor_bruto: number
          valor_desconto: number
          valor_liquido: number
          wps_codigo: number
        }
        Insert: {
          atualizado_em?: string
          data: string
          estacionamento_id: number
          forma_pagamento: string
          forma_pagamento_codigo: number
          grupos: string[]
          pago_em: string
          parcial?: number
          recibo: string
          sync_run_id?: string | null
          tarifa?: string | null
          terminal?: string | null
          ticket?: string | null
          tipo_cliente: string
          valor_bruto: number
          valor_desconto?: number
          valor_liquido: number
          wps_codigo: number
        }
        Update: {
          atualizado_em?: string
          data?: string
          estacionamento_id?: number
          forma_pagamento?: string
          forma_pagamento_codigo?: number
          grupos?: string[]
          pago_em?: string
          parcial?: number
          recibo?: string
          sync_run_id?: string | null
          tarifa?: string | null
          terminal?: string | null
          ticket?: string | null
          tipo_cliente?: string
          valor_bruto?: number
          valor_desconto?: number
          valor_liquido?: number
          wps_codigo?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gravar_estacionamento: {
        Args: {
          p_dias: Json
          p_estacionamento_id: number
          p_sync_run_id: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  formularios: {
    Tables: {
      formularios: {
        Row: {
          atualizado_em: string
          campos: Json
          criado_em: string
          criado_por: string | null
          descricao: string
          encerra_em: string | null
          id: string
          limite_respostas: number | null
          mensagem_final: string
          publicado_em: string | null
          situacao: string
          titulo: string
          token: string
          total_respostas: number
          ultima_resposta_em: string | null
        }
        Insert: {
          atualizado_em?: string
          campos?: Json
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          encerra_em?: string | null
          id?: string
          limite_respostas?: number | null
          mensagem_final?: string
          publicado_em?: string | null
          situacao?: string
          titulo: string
          token?: string
          total_respostas?: number
          ultima_resposta_em?: string | null
        }
        Update: {
          atualizado_em?: string
          campos?: Json
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          encerra_em?: string | null
          id?: string
          limite_respostas?: number | null
          mensagem_final?: string
          publicado_em?: string | null
          situacao?: string
          titulo?: string
          token?: string
          total_respostas?: number
          ultima_resposta_em?: string | null
        }
        Relationships: []
      }
      respostas: {
        Row: {
          enviada_em: string
          formulario_id: string
          id: string
          perguntas: Json
          respostas: Json
        }
        Insert: {
          enviada_em?: string
          formulario_id: string
          id?: string
          perguntas?: Json
          respostas: Json
        }
        Update: {
          enviada_em?: string
          formulario_id?: string
          id?: string
          perguntas?: Json
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "respostas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      responder: {
        Args: { p_perguntas: Json; p_respostas: Json; p_token: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  integracao: {
    Tables: {
      camera_contagens: {
        Row: {
          deviceid: string
          entradas: number
          fim: string
          inicio: string
          recebido_em: string
          saidas: number
        }
        Insert: {
          deviceid: string
          entradas: number
          fim: string
          inicio: string
          recebido_em?: string
          saidas: number
        }
        Update: {
          deviceid?: string
          entradas?: number
          fim?: string
          inicio?: string
          recebido_em?: string
          saidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "camera_contagens_deviceid_fkey"
            columns: ["deviceid"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["deviceid"]
          },
        ]
      }
      cameras: {
        Row: {
          criado_em: string
          deviceid: string
          ultimo_contato: string
        }
        Insert: {
          criado_em?: string
          deviceid: string
          ultimo_contato?: string
        }
        Update: {
          criado_em?: string
          deviceid?: string
          ultimo_contato?: string
        }
        Relationships: []
      }
      credenciais: {
        Row: {
          ativa: boolean
          configurado_em: string
          configurado_por: string | null
          parametros: Json
          segredo_cifrado: string
          sistema: string
          testado_em: string | null
          teste_mensagem: string | null
          teste_ok: boolean | null
        }
        Insert: {
          ativa?: boolean
          configurado_em?: string
          configurado_por?: string | null
          parametros?: Json
          segredo_cifrado: string
          sistema: string
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_ok?: boolean | null
        }
        Update: {
          ativa?: boolean
          configurado_em?: string
          configurado_por?: string | null
          parametros?: Json
          segredo_cifrado?: string
          sistema?: string
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_ok?: boolean | null
        }
        Relationships: []
      }
      cursores: {
        Row: {
          atualizado_em: string
          cursor: Json
          recurso: string
          sistema: string
        }
        Insert: {
          atualizado_em?: string
          cursor: Json
          recurso: string
          sistema: string
        }
        Update: {
          atualizado_em?: string
          cursor?: Json
          recurso?: string
          sistema?: string
        }
        Relationships: []
      }
      registros_brutos: {
        Row: {
          chave_externa: string
          hash: string
          payload: Json
          recebido_em: string
          recurso: string
          sistema: string
          sync_run_id: string | null
        }
        Insert: {
          chave_externa: string
          hash: string
          payload: Json
          recebido_em?: string
          recurso: string
          sistema: string
          sync_run_id?: string | null
        }
        Update: {
          chave_externa?: string
          hash?: string
          payload?: Json
          recebido_em?: string
          recurso?: string
          sistema?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_brutos_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          cursor_antes: Json | null
          cursor_depois: Json | null
          erro: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          recurso: string
          registros: number
          sistema: string
          status: Database["integracao"]["Enums"]["status_sync"]
        }
        Insert: {
          cursor_antes?: Json | null
          cursor_depois?: Json | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          recurso: string
          registros?: number
          sistema: string
          status?: Database["integracao"]["Enums"]["status_sync"]
        }
        Update: {
          cursor_antes?: Json | null
          cursor_depois?: Json | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          recurso?: string
          registros?: number
          sistema?: string
          status?: Database["integracao"]["Enums"]["status_sync"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      status_sync: "rodando" | "sucesso" | "erro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  marketing: {
    Tables: {
      landing_pages: {
        Row: {
          atualizado_em: string
          identificador: string
          interesse: string | null
          nome: string
        }
        Insert: {
          atualizado_em?: string
          identificador: string
          interesse?: string | null
          nome: string
        }
        Update: {
          atualizado_em?: string
          identificador?: string
          interesse?: string | null
          nome?: string
        }
        Relationships: []
      }
      locatarios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          criado_em: string
          entrada_em: string
          forma_acesso: string
          id: string
          nome: string
          perfil_url: string | null
          saida_em: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria: string
          criado_em?: string
          entrada_em?: string
          forma_acesso?: string
          id?: string
          nome: string
          perfil_url?: string | null
          saida_em?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          entrada_em?: string
          forma_acesso?: string
          id?: string
          nome?: string
          perfil_url?: string | null
          saida_em?: string | null
        }
        Relationships: []
      }
      marca_arquivos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          atual: boolean
          descricao: string | null
          enviado_em: string
          enviado_por: string | null
          grupo: string
          id: string
          tamanho: number | null
          tipo_mime: string | null
          titulo: string
          versao: number
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          atual?: boolean
          descricao?: string | null
          enviado_em?: string
          enviado_por?: string | null
          grupo: string
          id?: string
          tamanho?: number | null
          tipo_mime?: string | null
          titulo: string
          versao?: number
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          atual?: boolean
          descricao?: string | null
          enviado_em?: string
          enviado_por?: string | null
          grupo?: string
          id?: string
          tamanho?: number | null
          tipo_mime?: string | null
          titulo?: string
          versao?: number
        }
        Relationships: []
      }
      marca_blocos: {
        Row: {
          aba: string
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          conteudo: Json
          descricao: string | null
          ordem: number
          tipo: string
          titulo: string
          versao: number
        }
        Insert: {
          aba: string
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          conteudo: Json
          descricao?: string | null
          ordem: number
          tipo: string
          titulo: string
          versao?: number
        }
        Update: {
          aba?: string
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          conteudo?: Json
          descricao?: string | null
          ordem?: number
          tipo?: string
          titulo?: string
          versao?: number
        }
        Relationships: []
      }
      marca_versoes: {
        Row: {
          antes: Json | null
          bloco: string
          depois: Json
          desfaz: number | null
          em: string
          id: number
          por: string | null
          versao: number
        }
        Insert: {
          antes?: Json | null
          bloco: string
          depois: Json
          desfaz?: number | null
          em?: string
          id?: number
          por?: string | null
          versao: number
        }
        Update: {
          antes?: Json | null
          bloco?: string
          depois?: Json
          desfaz?: number | null
          em?: string
          id?: number
          por?: string | null
          versao?: number
        }
        Relationships: []
      }
      parametros: {
        Row: {
          asana_projeto_calendario: string | null
          asana_projeto_ronda: string | null
          asana_projetos_marketing: string[]
          asana_tag_gratuita: string | null
          asana_tag_locatario: string | null
          asana_tag_paga: string | null
          asana_tag_terceiro: string | null
          atualizado_em: string
          estrelas_reclamacao: number[]
          id: boolean
          janela_reputacao_dias: number
          nota_atencao: number
          reclamacoes_alerta: number
          reclamacoes_atencao: number
          sinalizacao_antiga_dias: number
        }
        Insert: {
          asana_projeto_calendario?: string | null
          asana_projeto_ronda?: string | null
          asana_projetos_marketing?: string[]
          asana_tag_gratuita?: string | null
          asana_tag_locatario?: string | null
          asana_tag_paga?: string | null
          asana_tag_terceiro?: string | null
          atualizado_em?: string
          estrelas_reclamacao?: number[]
          id?: boolean
          janela_reputacao_dias?: number
          nota_atencao?: number
          reclamacoes_alerta?: number
          reclamacoes_atencao?: number
          sinalizacao_antiga_dias?: number
        }
        Update: {
          asana_projeto_calendario?: string | null
          asana_projeto_ronda?: string | null
          asana_projetos_marketing?: string[]
          asana_tag_gratuita?: string | null
          asana_tag_locatario?: string | null
          asana_tag_paga?: string | null
          asana_tag_terceiro?: string | null
          atualizado_em?: string
          estrelas_reclamacao?: number[]
          id?: boolean
          janela_reputacao_dias?: number
          nota_atencao?: number
          reclamacoes_alerta?: number
          reclamacoes_atencao?: number
          sinalizacao_antiga_dias?: number
        }
        Relationships: []
      }
      rd_contatos: {
        Row: {
          atualizado_em: string
          cidade: string
          criado_em: string | null
          email: string
          etapa: string
          nome: string
          tags: string[]
          telefone: string
          uf: string
          ultima_conversao: string | null
          uuid: string
        }
        Insert: {
          atualizado_em?: string
          cidade?: string
          criado_em?: string | null
          email?: string
          etapa?: string
          nome?: string
          tags?: string[]
          telefone?: string
          uf?: string
          ultima_conversao?: string | null
          uuid: string
        }
        Update: {
          atualizado_em?: string
          cidade?: string
          criado_em?: string | null
          email?: string
          etapa?: string
          nome?: string
          tags?: string[]
          telefone?: string
          uf?: string
          ultima_conversao?: string | null
          uuid?: string
        }
        Relationships: []
      }
      rd_conversoes: {
        Row: {
          campanha: string
          contato_uuid: string
          convertido_em: string
          id: string
          identificador: string
          meio: string
          origem: string
        }
        Insert: {
          campanha?: string
          contato_uuid: string
          convertido_em: string
          id: string
          identificador: string
          meio?: string
          origem?: string
        }
        Update: {
          campanha?: string
          contato_uuid?: string
          convertido_em?: string
          id?: string
          identificador?: string
          meio?: string
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_conversoes_contato_uuid_fkey"
            columns: ["contato_uuid"]
            isOneToOne: false
            referencedRelation: "rd_contatos"
            referencedColumns: ["uuid"]
          },
        ]
      }
      rd_landing_pages_dia: {
        Row: {
          conversoes: number
          dia: string
          identificador: string
          nome: string
          visitas: number
        }
        Insert: {
          conversoes?: number
          dia: string
          identificador: string
          nome?: string
          visitas?: number
        }
        Update: {
          conversoes?: number
          dia?: string
          identificador?: string
          nome?: string
          visitas?: number
        }
        Relationships: []
      }
      redes_dia: {
        Row: {
          alcance: number | null
          atualizado_em: string
          contas_engajadas: number | null
          dia: string
          interacoes: number | null
          rede: string
          seguidores: number | null
          toques_links: number | null
          visualizacoes: number | null
        }
        Insert: {
          alcance?: number | null
          atualizado_em?: string
          contas_engajadas?: number | null
          dia: string
          interacoes?: number | null
          rede: string
          seguidores?: number | null
          toques_links?: number | null
          visualizacoes?: number | null
        }
        Update: {
          alcance?: number | null
          atualizado_em?: string
          contas_engajadas?: number | null
          dia?: string
          interacoes?: number | null
          rede?: string
          seguidores?: number | null
          toques_links?: number | null
          visualizacoes?: number | null
        }
        Relationships: []
      }
      regras_alerta: {
        Row: {
          ativa: boolean
          atualizado_em: string
          limite: number | null
          nivel: string
          regra: string
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          limite?: number | null
          nivel: string
          regra: string
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          limite?: number | null
          nivel?: string
          regra?: string
        }
        Relationships: []
      }
      ronda_codigos: {
        Row: {
          area: string
          atualizado_em: string
          codigo: string
          descricao: string
        }
        Insert: {
          area: string
          atualizado_em?: string
          codigo: string
          descricao: string
        }
        Update: {
          area?: string
          atualizado_em?: string
          codigo?: string
          descricao?: string
        }
        Relationships: []
      }
      temas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      desfazer_versao: { Args: { p_versao: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  operacoes: {
    Tables: {
      agua_contas: {
        Row: {
          atualizado_em: string
          consumo_m3: number | null
          data_anterior: string | null
          data_atual: string | null
          exemplo: boolean
          id: string
          importacao_id: string
          leitura_anterior: number | null
          leitura_atual: number | null
          matricula: string
          observacao: string | null
          referencia: string
          total: number
          valor_agua: number | null
          valor_esgoto: number | null
          vencimento: string | null
          vigente: boolean
        }
        Insert: {
          atualizado_em?: string
          consumo_m3?: number | null
          data_anterior?: string | null
          data_atual?: string | null
          exemplo?: boolean
          id?: string
          importacao_id: string
          leitura_anterior?: number | null
          leitura_atual?: number | null
          matricula: string
          observacao?: string | null
          referencia: string
          total: number
          valor_agua?: number | null
          valor_esgoto?: number | null
          vencimento?: string | null
          vigente?: boolean
        }
        Update: {
          atualizado_em?: string
          consumo_m3?: number | null
          data_anterior?: string | null
          data_atual?: string | null
          exemplo?: boolean
          id?: string
          importacao_id?: string
          leitura_anterior?: number | null
          leitura_atual?: number | null
          matricula?: string
          observacao?: string | null
          referencia?: string
          total?: number
          valor_agua?: number | null
          valor_esgoto?: number | null
          vencimento?: string | null
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agua_contas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      agua_leituras: {
        Row: {
          bloco: string
          cliente: string
          consumo: number
          data_anterior: string | null
          data_atual: string | null
          dias: number | null
          exemplo: boolean
          foto: string | null
          hidrometro: string
          id: string
          importacao_id: string
          leitura_anterior: number | null
          leitura_atual: number | null
          linha_arquivo: number | null
          referencia: string
          sala: string
          tipo: string
          vigente: boolean
          volume_faturado: number
        }
        Insert: {
          bloco: string
          cliente?: string
          consumo?: number
          data_anterior?: string | null
          data_atual?: string | null
          dias?: number | null
          exemplo?: boolean
          foto?: string | null
          hidrometro: string
          id?: string
          importacao_id: string
          leitura_anterior?: number | null
          leitura_atual?: number | null
          linha_arquivo?: number | null
          referencia: string
          sala?: string
          tipo: string
          vigente?: boolean
          volume_faturado?: number
        }
        Update: {
          bloco?: string
          cliente?: string
          consumo?: number
          data_anterior?: string | null
          data_atual?: string | null
          dias?: number | null
          exemplo?: boolean
          foto?: string | null
          hidrometro?: string
          id?: string
          importacao_id?: string
          leitura_anterior?: number | null
          leitura_atual?: number | null
          linha_arquivo?: number | null
          referencia?: string
          sala?: string
          tipo?: string
          vigente?: boolean
          volume_faturado?: number
        }
        Relationships: [
          {
            foreignKeyName: "agua_leituras_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      agua_valores: {
        Row: {
          leitura_id: string
          valor: number
        }
        Insert: {
          leitura_id: string
          valor: number
        }
        Update: {
          leitura_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "agua_valores_leitura_id_fkey"
            columns: ["leitura_id"]
            isOneToOne: true
            referencedRelation: "agua_leituras"
            referencedColumns: ["id"]
          },
        ]
      }
      agua_vinculos: {
        Row: {
          bloco: string
          criado_em: string
          criado_por: string | null
          desde: string
          hidrometro: string
          id: string
          motivo: string
          sala: string
        }
        Insert: {
          bloco: string
          criado_em?: string
          criado_por?: string | null
          desde: string
          hidrometro: string
          id?: string
          motivo: string
          sala: string
        }
        Update: {
          bloco?: string
          criado_em?: string
          criado_por?: string | null
          desde?: string
          hidrometro?: string
          id?: string
          motivo?: string
          sala?: string
        }
        Relationships: []
      }
      caixa_ocupantes: {
        Row: {
          caixa_id: string
          criado_em: string
          criado_por: string | null
          documento: string | null
          entrada: string | null
          id: string
          nome: string
          origem: string
          saida: string | null
        }
        Insert: {
          caixa_id: string
          criado_em?: string
          criado_por?: string | null
          documento?: string | null
          entrada?: string | null
          id?: string
          nome: string
          origem?: string
          saida?: string | null
        }
        Update: {
          caixa_id?: string
          criado_em?: string
          criado_por?: string | null
          documento?: string | null
          entrada?: string | null
          id?: string
          nome?: string
          origem?: string
          saida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_ocupantes_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
        ]
      }
      caixas: {
        Row: {
          atualizado_em: string
          coluna: number
          contrato: string | null
          criado_em: string
          disjuntor_amperes: number | null
          disjuntor_texto: string | null
          exemplo: boolean
          id: string
          lado: string
          ligacao: string | null
          linha: number
          locatario_novo: boolean
          medidor_numero: string | null
          medidor_situacao: string | null
          modulo: string | null
          numero: string
          numero_antigo: string | null
          observacoes: string | null
          ocupante: string | null
          ocupante_desde: string | null
          ocupante_documento: string | null
          ocupante_origem: string | null
          pavimento: string | null
          quadro_id: string
          rota: string | null
          sala_id: string | null
          salas_texto: string | null
          status: string
          termo_externo: boolean
        }
        Insert: {
          atualizado_em?: string
          coluna?: number
          contrato?: string | null
          criado_em?: string
          disjuntor_amperes?: number | null
          disjuntor_texto?: string | null
          exemplo?: boolean
          id?: string
          lado?: string
          ligacao?: string | null
          linha?: number
          locatario_novo?: boolean
          medidor_numero?: string | null
          medidor_situacao?: string | null
          modulo?: string | null
          numero: string
          numero_antigo?: string | null
          observacoes?: string | null
          ocupante?: string | null
          ocupante_desde?: string | null
          ocupante_documento?: string | null
          ocupante_origem?: string | null
          pavimento?: string | null
          quadro_id: string
          rota?: string | null
          sala_id?: string | null
          salas_texto?: string | null
          status?: string
          termo_externo?: boolean
        }
        Update: {
          atualizado_em?: string
          coluna?: number
          contrato?: string | null
          criado_em?: string
          disjuntor_amperes?: number | null
          disjuntor_texto?: string | null
          exemplo?: boolean
          id?: string
          lado?: string
          ligacao?: string | null
          linha?: number
          locatario_novo?: boolean
          medidor_numero?: string | null
          medidor_situacao?: string | null
          modulo?: string | null
          numero?: string
          numero_antigo?: string | null
          observacoes?: string | null
          ocupante?: string | null
          ocupante_desde?: string | null
          ocupante_documento?: string | null
          ocupante_origem?: string | null
          pavimento?: string | null
          quadro_id?: string
          rota?: string | null
          sala_id?: string | null
          salas_texto?: string | null
          status?: string
          termo_externo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "caixas_quadro_id_fkey"
            columns: ["quadro_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_cadastros: {
        Row: {
          atualizado_em: string
          cadastros: Json | null
          empresa: Json | null
          id: boolean
        }
        Insert: {
          atualizado_em?: string
          cadastros?: Json | null
          empresa?: Json | null
          id?: boolean
        }
        Update: {
          atualizado_em?: string
          cadastros?: Json | null
          empresa?: Json | null
          id?: boolean
        }
        Relationships: []
      }
      diario_obras: {
        Row: {
          atualizado_em: string
          dados: Json
          data_fim: string | null
          data_inicio: string | null
          exemplo: boolean
          grupo: string | null
          id: string
          lista_de_tarefas: Json | null
          modificado_no_app: string | null
          nome: string
          prazo_a_vencer: number | null
          prazo_contratual: number | null
          prazo_decorrido: number | null
          realizado: number | null
          responsavel: string | null
          status_id: number
          tarefas: Json | null
        }
        Insert: {
          atualizado_em?: string
          dados: Json
          data_fim?: string | null
          data_inicio?: string | null
          exemplo?: boolean
          grupo?: string | null
          id: string
          lista_de_tarefas?: Json | null
          modificado_no_app?: string | null
          nome: string
          prazo_a_vencer?: number | null
          prazo_contratual?: number | null
          prazo_decorrido?: number | null
          realizado?: number | null
          responsavel?: string | null
          status_id: number
          tarefas?: Json | null
        }
        Update: {
          atualizado_em?: string
          dados?: Json
          data_fim?: string | null
          data_inicio?: string | null
          exemplo?: boolean
          grupo?: string | null
          id?: string
          lista_de_tarefas?: Json | null
          modificado_no_app?: string | null
          nome?: string
          prazo_a_vencer?: number | null
          prazo_contratual?: number | null
          prazo_decorrido?: number | null
          realizado?: number | null
          responsavel?: string | null
          status_id?: number
          tarefas?: Json | null
        }
        Relationships: []
      }
      diario_relatorios: {
        Row: {
          app: string | null
          atualizado_em: string
          autor: string | null
          autor_cargo: string | null
          autor_id: string | null
          criado_no_app: string | null
          dados: Json | null
          data: string
          data_fim: string | null
          detalhado_em: string | null
          exemplo: boolean
          id: string
          modelo: string | null
          modelo_id: string | null
          modificado_no_app: string | null
          numero: number
          obra_id: string
          resumo: Json | null
          status_id: number
        }
        Insert: {
          app?: string | null
          atualizado_em?: string
          autor?: string | null
          autor_cargo?: string | null
          autor_id?: string | null
          criado_no_app?: string | null
          dados?: Json | null
          data: string
          data_fim?: string | null
          detalhado_em?: string | null
          exemplo?: boolean
          id: string
          modelo?: string | null
          modelo_id?: string | null
          modificado_no_app?: string | null
          numero: number
          obra_id: string
          resumo?: Json | null
          status_id: number
        }
        Update: {
          app?: string | null
          atualizado_em?: string
          autor?: string | null
          autor_cargo?: string | null
          autor_id?: string | null
          criado_no_app?: string | null
          dados?: Json | null
          data?: string
          data_fim?: string | null
          detalhado_em?: string | null
          exemplo?: boolean
          id?: string
          modelo?: string | null
          modelo_id?: string | null
          modificado_no_app?: string | null
          numero?: number
          obra_id?: string
          resumo?: Json | null
          status_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "diario_relatorios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "diario_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      energia_fatura_itens: {
        Row: {
          aliquota_icms: number | null
          base_icms: number | null
          descricao: string
          fatura_id: string
          icms: number | null
          id: string
          mes_geracao: string | null
          ordem: number
          origem: string | null
          pis_cofins: number | null
          preco_unitario: number | null
          quantidade: number | null
          tarifa_unitaria: number | null
          tipo: string
          unidade: string | null
          valor: number
        }
        Insert: {
          aliquota_icms?: number | null
          base_icms?: number | null
          descricao: string
          fatura_id: string
          icms?: number | null
          id?: string
          mes_geracao?: string | null
          ordem: number
          origem?: string | null
          pis_cofins?: number | null
          preco_unitario?: number | null
          quantidade?: number | null
          tarifa_unitaria?: number | null
          tipo: string
          unidade?: string | null
          valor: number
        }
        Update: {
          aliquota_icms?: number | null
          base_icms?: number | null
          descricao?: string
          fatura_id?: string
          icms?: number | null
          id?: string
          mes_geracao?: string | null
          ordem?: number
          origem?: string | null
          pis_cofins?: number | null
          preco_unitario?: number | null
          quantidade?: number | null
          tarifa_unitaria?: number | null
          tipo?: string
          unidade?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "energia_fatura_itens_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "energia_faturas"
            referencedColumns: ["id"]
          },
        ]
      }
      energia_faturas: {
        Row: {
          arquivo: string | null
          bandeira: string | null
          classificacao_gd: string | null
          compensado_kwh: number
          consumo_kwh: number
          dias: number | null
          exemplo: boolean
          expirar_kwh: number | null
          icms: number
          id: string
          iluminacao_publica: number
          importacao_id: string | null
          importado_em: string
          importado_por: string | null
          injetada_kwh: number | null
          leitura_anterior: number | null
          leitura_anterior_data: string | null
          leitura_atual: number | null
          leitura_atual_data: string | null
          matricula: string
          medidor: string | null
          nota_fiscal: string | null
          observacao: string | null
          pis_cofins: number
          proxima_leitura: string | null
          referencia: string
          saldo_kwh: number | null
          sha256: string | null
          total: number
          valor_bandeira: number
          valor_compensado: number
          valor_consumo: number
          vencimento: string | null
          vigente: boolean
        }
        Insert: {
          arquivo?: string | null
          bandeira?: string | null
          classificacao_gd?: string | null
          compensado_kwh?: number
          consumo_kwh?: number
          dias?: number | null
          exemplo?: boolean
          expirar_kwh?: number | null
          icms?: number
          id?: string
          iluminacao_publica?: number
          importacao_id?: string | null
          importado_em?: string
          importado_por?: string | null
          injetada_kwh?: number | null
          leitura_anterior?: number | null
          leitura_anterior_data?: string | null
          leitura_atual?: number | null
          leitura_atual_data?: string | null
          matricula: string
          medidor?: string | null
          nota_fiscal?: string | null
          observacao?: string | null
          pis_cofins?: number
          proxima_leitura?: string | null
          referencia: string
          saldo_kwh?: number | null
          sha256?: string | null
          total: number
          valor_bandeira?: number
          valor_compensado?: number
          valor_consumo?: number
          vencimento?: string | null
          vigente?: boolean
        }
        Update: {
          arquivo?: string | null
          bandeira?: string | null
          classificacao_gd?: string | null
          compensado_kwh?: number
          consumo_kwh?: number
          dias?: number | null
          exemplo?: boolean
          expirar_kwh?: number | null
          icms?: number
          id?: string
          iluminacao_publica?: number
          importacao_id?: string | null
          importado_em?: string
          importado_por?: string | null
          injetada_kwh?: number | null
          leitura_anterior?: number | null
          leitura_anterior_data?: string | null
          leitura_atual?: number | null
          leitura_atual_data?: string | null
          matricula?: string
          medidor?: string | null
          nota_fiscal?: string | null
          observacao?: string | null
          pis_cofins?: number
          proxima_leitura?: string | null
          referencia?: string
          saldo_kwh?: number | null
          sha256?: string | null
          total?: number
          valor_bandeira?: number
          valor_compensado?: number
          valor_consumo?: number
          vencimento?: string | null
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "energia_faturas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "energia_faturas_matricula_fkey"
            columns: ["matricula"]
            isOneToOne: false
            referencedRelation: "energia_unidades"
            referencedColumns: ["matricula"]
          },
        ]
      }
      energia_unidades: {
        Row: {
          apelido: string | null
          ativa: boolean
          classificacao: string | null
          criado_em: string
          endereco: string | null
          exemplo: boolean
          ligacao: string | null
          matricula: string
          papel: string
        }
        Insert: {
          apelido?: string | null
          ativa?: boolean
          classificacao?: string | null
          criado_em?: string
          endereco?: string | null
          exemplo?: boolean
          ligacao?: string | null
          matricula: string
          papel?: string
        }
        Update: {
          apelido?: string | null
          ativa?: boolean
          classificacao?: string | null
          criado_em?: string
          endereco?: string | null
          exemplo?: boolean
          ligacao?: string | null
          matricula?: string
          papel?: string
        }
        Relationships: []
      }
      importacao_valores: {
        Row: {
          importacao_id: string
          por_bloco: Json
          valor_arquivo: number | null
          valor_lido: number | null
        }
        Insert: {
          importacao_id: string
          por_bloco?: Json
          valor_arquivo?: number | null
          valor_lido?: number | null
        }
        Update: {
          importacao_id?: string
          por_bloco?: Json
          valor_arquivo?: number | null
          valor_lido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "importacao_valores_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: true
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          arquivos: Json
          avisos: Json
          bate: boolean | null
          confirmado_em: string | null
          confirmado_por: string | null
          criado_em: string
          criado_por: string | null
          desfeito_em: string | null
          desfeito_por: string | null
          exemplo: boolean
          id: string
          incompleta: boolean
          motivo: string | null
          referencia: string
          resumo: Json
          status: string
          substitui: string | null
          tipo: string
        }
        Insert: {
          arquivos?: Json
          avisos?: Json
          bate?: boolean | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          desfeito_em?: string | null
          desfeito_por?: string | null
          exemplo?: boolean
          id?: string
          incompleta?: boolean
          motivo?: string | null
          referencia: string
          resumo?: Json
          status?: string
          substitui?: string | null
          tipo: string
        }
        Update: {
          arquivos?: Json
          avisos?: Json
          bate?: boolean | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          desfeito_em?: string | null
          desfeito_por?: string | null
          exemplo?: boolean
          id?: string
          incompleta?: boolean
          motivo?: string | null
          referencia?: string
          resumo?: Json
          status?: string
          substitui?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_substitui_fkey"
            columns: ["substitui"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      limpeza_anexos: {
        Row: {
          caminho: string
          enviado_em: string
          enviado_por: string | null
          id: string
          nome: string
          referencia: string
          tipo: string
        }
        Insert: {
          caminho: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          nome: string
          referencia: string
          tipo?: string
        }
        Update: {
          caminho?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          nome?: string
          referencia?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "limpeza_anexos_referencia_fkey"
            columns: ["referencia"]
            isOneToOne: false
            referencedRelation: "limpeza_meses"
            referencedColumns: ["referencia"]
          },
        ]
      }
      limpeza_contrato: {
        Row: {
          descricao: string
          entra_conferencia: boolean
          id: string
          ordem: number
          referencia: string
          valor: number
        }
        Insert: {
          descricao: string
          entra_conferencia?: boolean
          id?: string
          ordem?: number
          referencia: string
          valor: number
        }
        Update: {
          descricao?: string
          entra_conferencia?: boolean
          id?: string
          ordem?: number
          referencia?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "limpeza_contrato_referencia_fkey"
            columns: ["referencia"]
            isOneToOne: false
            referencedRelation: "limpeza_meses"
            referencedColumns: ["referencia"]
          },
        ]
      }
      limpeza_equipe: {
        Row: {
          blocos: string[]
          funcao: string | null
          grupo: string
          id: string
          minutos_dia: number | null
          nome: string
          ordem: number
          referencia: string
          turno: string | null
        }
        Insert: {
          blocos?: string[]
          funcao?: string | null
          grupo: string
          id?: string
          minutos_dia?: number | null
          nome: string
          ordem?: number
          referencia: string
          turno?: string | null
        }
        Update: {
          blocos?: string[]
          funcao?: string | null
          grupo?: string
          id?: string
          minutos_dia?: number | null
          nome?: string
          ordem?: number
          referencia?: string
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "limpeza_equipe_referencia_fkey"
            columns: ["referencia"]
            isOneToOne: false
            referencedRelation: "limpeza_meses"
            referencedColumns: ["referencia"]
          },
        ]
      }
      limpeza_extras: {
        Row: {
          descricao: string
          id: string
          ordem: number
          quantidade: number | null
          referencia: string
          valor: number
          valor_unitario: number | null
        }
        Insert: {
          descricao: string
          id?: string
          ordem?: number
          quantidade?: number | null
          referencia: string
          valor: number
          valor_unitario?: number | null
        }
        Update: {
          descricao?: string
          id?: string
          ordem?: number
          quantidade?: number | null
          referencia?: string
          valor?: number
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "limpeza_extras_referencia_fkey"
            columns: ["referencia"]
            isOneToOne: false
            referencedRelation: "limpeza_meses"
            referencedColumns: ["referencia"]
          },
        ]
      }
      limpeza_meses: {
        Row: {
          apontamento: string | null
          atualizado_em: string
          base_composicao: string | null
          criado_em: string
          criado_por: string | null
          enviado_em: string | null
          enviado_por: string | null
          exemplo: boolean
          fechado_em: string | null
          fechado_por: string | null
          func_area_comum: number | null
          func_base: number | null
          func_rateados: number | null
          importacao_id: string | null
          incompleto: boolean
          origem: string
          reaberto_em: string | null
          reaberto_motivo: string | null
          reaberto_por: string | null
          referencia: string
          regra_bl04: string
          status: string
          valor_base: number | null
          valores_planilha: Json | null
        }
        Insert: {
          apontamento?: string | null
          atualizado_em?: string
          base_composicao?: string | null
          criado_em?: string
          criado_por?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          exemplo?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          func_area_comum?: number | null
          func_base?: number | null
          func_rateados?: number | null
          importacao_id?: string | null
          incompleto?: boolean
          origem?: string
          reaberto_em?: string | null
          reaberto_motivo?: string | null
          reaberto_por?: string | null
          referencia: string
          regra_bl04?: string
          status?: string
          valor_base?: number | null
          valores_planilha?: Json | null
        }
        Update: {
          apontamento?: string | null
          atualizado_em?: string
          base_composicao?: string | null
          criado_em?: string
          criado_por?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          exemplo?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          func_area_comum?: number | null
          func_base?: number | null
          func_rateados?: number | null
          importacao_id?: string | null
          incompleto?: boolean
          origem?: string
          reaberto_em?: string | null
          reaberto_motivo?: string | null
          reaberto_por?: string | null
          referencia?: string
          regra_bl04?: string
          status?: string
          valor_base?: number | null
          valores_planilha?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "limpeza_meses_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      limpeza_minutos: {
        Row: {
          bloco: string
          limpeza: number
          manutencao: number
          referencia: string
        }
        Insert: {
          bloco: string
          limpeza?: number
          manutencao?: number
          referencia: string
        }
        Update: {
          bloco?: string
          limpeza?: number
          manutencao?: number
          referencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "limpeza_minutos_referencia_fkey"
            columns: ["referencia"]
            isOneToOne: false
            referencedRelation: "limpeza_meses"
            referencedColumns: ["referencia"]
          },
        ]
      }
      obra_realizado: {
        Row: {
          anexo: string | null
          descricao: string | null
          etapa: string
          exemplo: boolean
          id: string
          importacao_id: string | null
          lancado_em: string
          lancado_por: string | null
          mes: string
          obra_id: string
          origem: string
          valor: number
        }
        Insert: {
          anexo?: string | null
          descricao?: string | null
          etapa: string
          exemplo?: boolean
          id?: string
          importacao_id?: string | null
          lancado_em?: string
          lancado_por?: string | null
          mes: string
          obra_id: string
          origem?: string
          valor: number
        }
        Update: {
          anexo?: string | null
          descricao?: string | null
          etapa?: string
          exemplo?: boolean
          id?: string
          importacao_id?: string | null
          lancado_em?: string
          lancado_por?: string | null
          mes?: string
          obra_id?: string
          origem?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_realizado_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_realizado_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          ativa: boolean
          criado_em: string
          diario_obra_id: string | null
          exemplo: boolean
          id: string
          nome: string
          responsavel: string | null
        }
        Insert: {
          ativa?: boolean
          criado_em?: string
          diario_obra_id?: string | null
          exemplo?: boolean
          id?: string
          nome: string
          responsavel?: string | null
        }
        Update: {
          ativa?: boolean
          criado_em?: string
          diario_obra_id?: string | null
          exemplo?: boolean
          id?: string
          nome?: string
          responsavel?: string | null
        }
        Relationships: []
      }
      orcamento_etapas: {
        Row: {
          id: string
          nome: string
          observacao: string | null
          ordem: number
          revisao_id: string
        }
        Insert: {
          id?: string
          nome: string
          observacao?: string | null
          ordem: number
          revisao_id: string
        }
        Update: {
          id?: string
          nome?: string
          observacao?: string | null
          ordem?: number
          revisao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_etapas_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "orcamento_revisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_previsto: {
        Row: {
          etapa_id: string
          mes: string
          valor: number
        }
        Insert: {
          etapa_id: string
          mes: string
          valor: number
        }
        Update: {
          etapa_id?: string
          mes?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_previsto_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_revisoes: {
        Row: {
          codigo: string
          criado_em: string
          data: string | null
          exemplo: boolean
          id: string
          importacao_id: string | null
          obra_id: string
          titulo: string | null
          total: number
          total_arquivo: number | null
          vigente: boolean
        }
        Insert: {
          codigo: string
          criado_em?: string
          data?: string | null
          exemplo?: boolean
          id?: string
          importacao_id?: string | null
          obra_id: string
          titulo?: string | null
          total: number
          total_arquivo?: number | null
          vigente?: boolean
        }
        Update: {
          codigo?: string
          criado_em?: string
          data?: string | null
          exemplo?: boolean
          id?: string
          importacao_id?: string | null
          obra_id?: string
          titulo?: string | null
          total?: number
          total_arquivo?: number | null
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_revisoes_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_revisoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros: {
        Row: {
          agua_blocos: string[]
          agua_limite_m3: number
          agua_modelo: Json
          agua_parceiro: string
          agua_tolerancia: number
          agua_variacao_meses: number
          agua_variacao_min_m3: number
          agua_variacao_pct: number
          atualizado_em: string
          atualizado_por: string | null
          energia_alerta_pct: number
          energia_disjuntores: string[]
          energia_ligacoes: string[]
          energia_medidor_situacoes: string[]
          id: boolean
          limpeza_blocos: string[]
          limpeza_dia_util_envio: number
          limpeza_empresa: string
          limpeza_extras_padrao: Json
          limpeza_func_area_comum: number
          limpeza_func_base: number
          limpeza_func_rateados: number
          obras_dias_relatorio: number[]
          obras_intervalo_min: number
          obras_limite_desvio: number
          obras_limite_orcamento_pct: number
          solar_fonte: string
          termo_cidade: string
          termo_cnpj: string
          termo_endereco: string
          termo_nome_arquivo: string
          termo_qualificacao_cnpj: string
          termo_qualificacao_cpf: string
          termo_razao_social: string
        }
        Insert: {
          agua_blocos?: string[]
          agua_limite_m3?: number
          agua_modelo?: Json
          agua_parceiro?: string
          agua_tolerancia?: number
          agua_variacao_meses?: number
          agua_variacao_min_m3?: number
          agua_variacao_pct?: number
          atualizado_em?: string
          atualizado_por?: string | null
          energia_alerta_pct?: number
          energia_disjuntores?: string[]
          energia_ligacoes?: string[]
          energia_medidor_situacoes?: string[]
          id?: boolean
          limpeza_blocos?: string[]
          limpeza_dia_util_envio?: number
          limpeza_empresa?: string
          limpeza_extras_padrao?: Json
          limpeza_func_area_comum?: number
          limpeza_func_base?: number
          limpeza_func_rateados?: number
          obras_dias_relatorio?: number[]
          obras_intervalo_min?: number
          obras_limite_desvio?: number
          obras_limite_orcamento_pct?: number
          solar_fonte?: string
          termo_cidade?: string
          termo_cnpj?: string
          termo_endereco?: string
          termo_nome_arquivo?: string
          termo_qualificacao_cnpj?: string
          termo_qualificacao_cpf?: string
          termo_razao_social?: string
        }
        Update: {
          agua_blocos?: string[]
          agua_limite_m3?: number
          agua_modelo?: Json
          agua_parceiro?: string
          agua_tolerancia?: number
          agua_variacao_meses?: number
          agua_variacao_min_m3?: number
          agua_variacao_pct?: number
          atualizado_em?: string
          atualizado_por?: string | null
          energia_alerta_pct?: number
          energia_disjuntores?: string[]
          energia_ligacoes?: string[]
          energia_medidor_situacoes?: string[]
          id?: boolean
          limpeza_blocos?: string[]
          limpeza_dia_util_envio?: number
          limpeza_empresa?: string
          limpeza_extras_padrao?: Json
          limpeza_func_area_comum?: number
          limpeza_func_base?: number
          limpeza_func_rateados?: number
          obras_dias_relatorio?: number[]
          obras_intervalo_min?: number
          obras_limite_desvio?: number
          obras_limite_orcamento_pct?: number
          solar_fonte?: string
          termo_cidade?: string
          termo_cnpj?: string
          termo_endereco?: string
          termo_nome_arquivo?: string
          termo_qualificacao_cnpj?: string
          termo_qualificacao_cpf?: string
          termo_razao_social?: string
        }
        Relationships: []
      }
      quadros: {
        Row: {
          armario: string | null
          ativo: boolean
          atualizado_em: string
          bloco: string
          codigo: string
          criado_em: string
          disjuntor_geral: string | null
          espacos: number | null
          exemplo: boolean
          fotos: string[]
          id: string
          nome: string
          observacoes: string | null
          ordem: number
          projeto: string | null
          roteiro_base: string | null
          subestacao: string | null
        }
        Insert: {
          armario?: string | null
          ativo?: boolean
          atualizado_em?: string
          bloco: string
          codigo: string
          criado_em?: string
          disjuntor_geral?: string | null
          espacos?: number | null
          exemplo?: boolean
          fotos?: string[]
          id?: string
          nome: string
          observacoes?: string | null
          ordem?: number
          projeto?: string | null
          roteiro_base?: string | null
          subestacao?: string | null
        }
        Update: {
          armario?: string | null
          ativo?: boolean
          atualizado_em?: string
          bloco?: string
          codigo?: string
          criado_em?: string
          disjuntor_geral?: string | null
          espacos?: number | null
          exemplo?: boolean
          fotos?: string[]
          id?: string
          nome?: string
          observacoes?: string | null
          ordem?: number
          projeto?: string | null
          roteiro_base?: string | null
          subestacao?: string | null
        }
        Relationships: []
      }
      salas: {
        Row: {
          armario: string | null
          atualizado_em: string
          bloco: string
          codigo: string
          criado_em: string
          disjuntor: string | null
          exemplo: boolean
          id: string
          observacoes: string | null
          pavimento: string | null
          projeto: string | null
          rota: string | null
          sala: string
        }
        Insert: {
          armario?: string | null
          atualizado_em?: string
          bloco: string
          codigo: string
          criado_em?: string
          disjuntor?: string | null
          exemplo?: boolean
          id?: string
          observacoes?: string | null
          pavimento?: string | null
          projeto?: string | null
          rota?: string | null
          sala: string
        }
        Update: {
          armario?: string | null
          atualizado_em?: string
          bloco?: string
          codigo?: string
          criado_em?: string
          disjuntor?: string | null
          exemplo?: boolean
          id?: string
          observacoes?: string | null
          pavimento?: string | null
          projeto?: string | null
          rota?: string | null
          sala?: string
        }
        Relationships: []
      }
      termos: {
        Row: {
          amperes: number | null
          armario: string | null
          bloco: string
          caixa_id: string
          data_emissao: string
          documento: string
          docx: string | null
          emitido_em: string
          emitido_por: string | null
          id: string
          ligacao: string | null
          locatario: string
          observacao_tecnica: string | null
          pavimento: string | null
          pdf: string
          projeto: string | null
          qualificacao: string | null
          rota: string | null
          sala: string
          versao: number
        }
        Insert: {
          amperes?: number | null
          armario?: string | null
          bloco: string
          caixa_id: string
          data_emissao: string
          documento: string
          docx?: string | null
          emitido_em?: string
          emitido_por?: string | null
          id?: string
          ligacao?: string | null
          locatario: string
          observacao_tecnica?: string | null
          pavimento?: string | null
          pdf: string
          projeto?: string | null
          qualificacao?: string | null
          rota?: string | null
          sala: string
          versao: number
        }
        Update: {
          amperes?: number | null
          armario?: string | null
          bloco?: string
          caixa_id?: string
          data_emissao?: string
          documento?: string
          docx?: string | null
          emitido_em?: string
          emitido_por?: string | null
          id?: string
          ligacao?: string | null
          locatario?: string
          observacao_tecnica?: string | null
          pavimento?: string | null
          pdf?: string
          projeto?: string | null
          qualificacao?: string | null
          rota?: string | null
          sala?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "termos_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acessa: { Args: never; Returns: boolean }
      confirmar_importacao: {
        Args: { p_id: string; p_motivo?: string }
        Returns: undefined
      }
      desfazer_importacao: { Args: { p_id: string }; Returns: number }
      enet_contratos: { Args: never; Returns: Json }
      gravar_fatura_energisa: {
        Args: { p_arquivo: string; p_fatura: Json; p_importacao: string; p_itens: Json; p_sha256: string }
        Returns: string
      }
      liberar_caixa: {
        Args: { p_caixa: string; p_saida: string; p_status?: string }
        Returns: undefined
      }
      limpeza_aberto: { Args: { p_ref: string }; Returns: boolean }
      limpeza_enviar: { Args: { p_ref: string }; Returns: undefined }
      limpeza_fechar: { Args: { p_ref: string }; Returns: undefined }
      limpeza_gravar_previa: {
        Args: { p_importacao: string; p_meses: Json }
        Returns: number
      }
      limpeza_reabrir: {
        Args: { p_motivo: string; p_ref: string }
        Returns: undefined
      }
      limpeza_salvar: {
        Args: { p_dados: Json; p_ref: string }
        Returns: undefined
      }
      pode_importar: { Args: { p_tipo: string }; Returns: boolean }
      proxima_versao_termo: { Args: { p_caixa: string }; Returns: number }
      registrar_termo: {
        Args: { p_amperes: number; p_armario: string; p_bloco: string; p_caixa: string; p_data_emissao: string; p_documento: string; p_docx: string; p_ligacao: string; p_locatario: string; p_observacao_tecnica: string; p_pavimento: string; p_pdf: string; p_projeto: string; p_qualificacao: string; p_rota: string; p_sala: string; p_versao: number }
        Returns: string
      }
      remover_exemplos: { Args: never; Returns: undefined }
      resumo_quadros: { Args: never; Returns: Json }
      trocar_locatario: {
        Args: { p_caixa: string; p_contrato?: string; p_desde: string; p_documento: string; p_nome: string; p_origem?: string }
        Returns: undefined
      }
      ve_importacao: { Args: { p_tipo: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  os: {
    Tables: {
      agenda_bloqueios: {
        Row: {
          agenda_id: string
          criado_em: string
          criado_por: string | null
          fim: string
          id: string
          inicio: string
          motivo: string
        }
        Insert: {
          agenda_id: string
          criado_em?: string
          criado_por?: string | null
          fim: string
          id?: string
          inicio: string
          motivo: string
        }
        Update: {
          agenda_id?: string
          criado_em?: string
          criado_por?: string | null
          fim?: string
          id?: string
          inicio?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_bloqueios_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          agenda_id: string
          atualizado_em: string
          chamado_id: string | null
          criado_em: string
          criado_por: string | null
          fim: string
          id: string
          inicio: string
          loja_id: string | null
          observacao: string | null
          status: Database["os"]["Enums"]["status_agendamento"]
        }
        Insert: {
          agenda_id: string
          atualizado_em?: string
          chamado_id?: string | null
          criado_em?: string
          criado_por?: string | null
          fim: string
          id?: string
          inicio: string
          loja_id?: string | null
          observacao?: string | null
          status?: Database["os"]["Enums"]["status_agendamento"]
        }
        Update: {
          agenda_id?: string
          atualizado_em?: string
          chamado_id?: string | null
          criado_em?: string
          criado_por?: string | null
          fim?: string
          id?: string
          inicio?: string
          loja_id?: string | null
          observacao?: string | null
          status?: Database["os"]["Enums"]["status_agendamento"]
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendas: {
        Row: {
          antecedencia_dias: number
          ativo: boolean
          atualizado_em: string
          criado_em: string
          dias_semana: number[]
          duracao_min: number
          hora_fim: string
          hora_inicio: string
          id: string
          limite_por_dia: number
          nome: string
          orientacao: string | null
        }
        Insert: {
          antecedencia_dias?: number
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dias_semana?: number[]
          duracao_min?: number
          hora_fim: string
          hora_inicio: string
          id?: string
          limite_por_dia: number
          nome: string
          orientacao?: string | null
        }
        Update: {
          antecedencia_dias?: number
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dias_semana?: number[]
          duracao_min?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          limite_por_dia?: number
          nome?: string
          orientacao?: string | null
        }
        Relationships: []
      }
      anexos: {
        Row: {
          ordem_id: string | null
          ambiente_id: string | null
          ativo_id: string | null
          categoria: string
          chamado_id: string | null
          em: string
          enviado_por: string | null
          enviado_por_nome: string | null
          evento_id: number | null
          id: string
          mime: string | null
          nome: string
          path: string
          tamanho: number | null
          visivel_lojista: boolean
          vistoria_id: string | null
        }
        Insert: {
          ordem_id?: string | null
          ambiente_id?: string | null
          ativo_id?: string | null
          categoria?: string
          chamado_id?: string | null
          em?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          evento_id?: number | null
          id?: string
          mime?: string | null
          nome: string
          path: string
          tamanho?: number | null
          visivel_lojista?: boolean
          vistoria_id?: string | null
        }
        Update: {
          ordem_id?: string | null
          ambiente_id?: string | null
          ativo_id?: string | null
          categoria?: string
          chamado_id?: string | null
          em?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          evento_id?: number | null
          id?: string
          mime?: string | null
          nome?: string
          path?: string
          tamanho?: number | null
          visivel_lojista?: boolean
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anexos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "vistoria_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      ativo_categorias: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          vida_util_padrao_anos: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          vida_util_padrao_anos?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          vida_util_padrao_anos?: number | null
        }
        Relationships: []
      }
      ativo_saidas: {
        Row: {
          anexos: string[]
          ativo_id: string
          data: string
          desfeita_em: string | null
          desfeita_motivo: string | null
          desfeita_por: string | null
          destinatario_documento: string | null
          destinatario_nome: string | null
          forma_recebimento: string | null
          id: string
          motivo: string | null
          nota_fiscal: boolean
          nota_fiscal_numero: string | null
          observacoes: string | null
          planos_pausados: string[]
          quantidade: string | null
          recebido_por: string | null
          registrado_em: string
          registrado_por: string | null
          responsavel_id: string | null
          situacao_anterior: Database["os"]["Enums"]["situacao_ativo"]
          tipo: string
          valor: number | null
        }
        Insert: {
          anexos?: string[]
          ativo_id: string
          data: string
          desfeita_em?: string | null
          desfeita_motivo?: string | null
          desfeita_por?: string | null
          destinatario_documento?: string | null
          destinatario_nome?: string | null
          forma_recebimento?: string | null
          id?: string
          motivo?: string | null
          nota_fiscal?: boolean
          nota_fiscal_numero?: string | null
          observacoes?: string | null
          planos_pausados?: string[]
          quantidade?: string | null
          recebido_por?: string | null
          registrado_em?: string
          registrado_por?: string | null
          responsavel_id?: string | null
          situacao_anterior: Database["os"]["Enums"]["situacao_ativo"]
          tipo: string
          valor?: number | null
        }
        Update: {
          anexos?: string[]
          ativo_id?: string
          data?: string
          desfeita_em?: string | null
          desfeita_motivo?: string | null
          desfeita_por?: string | null
          destinatario_documento?: string | null
          destinatario_nome?: string | null
          forma_recebimento?: string | null
          id?: string
          motivo?: string | null
          nota_fiscal?: boolean
          nota_fiscal_numero?: string | null
          observacoes?: string | null
          planos_pausados?: string[]
          quantidade?: string | null
          recebido_por?: string | null
          registrado_em?: string
          registrado_por?: string | null
          responsavel_id?: string | null
          situacao_anterior?: Database["os"]["Enums"]["situacao_ativo"]
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ativo_saidas_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      ativo_situacoes: {
        Row: {
          ate: string | null
          ativo_id: string
          desde: string
          id: string
          situacao: Database["os"]["Enums"]["situacao_ativo"]
          usuario_id: string | null
        }
        Insert: {
          ate?: string | null
          ativo_id: string
          desde?: string
          id?: string
          situacao: Database["os"]["Enums"]["situacao_ativo"]
          usuario_id?: string | null
        }
        Update: {
          ate?: string | null
          ativo_id?: string
          desde?: string
          id?: string
          situacao?: Database["os"]["Enums"]["situacao_ativo"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ativo_situacoes_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      ativos: {
        Row: {
          area: string | null
          atualizado_em: string
          baixa_data: string | null
          baixa_motivo: string | null
          bloco: string | null
          categoria_id: string | null
          codigo: string
          compra_data: string | null
          compra_valor: number | null
          criado_em: string
          fabricante: string | null
          fornecedor_id: string | null
          garantia_fim: string | null
          id: string
          legado_id: string | null
          loja_id: string | null
          modelo: string | null
          nome: string
          numero_serie: string | null
          observacao: string | null
          ponto: string | null
          responsavel_id: string | null
          setor_id: string | null
          situacao: Database["os"]["Enums"]["situacao_ativo"]
          valor_reposicao: number | null
          vida_util_anos: number | null
        }
        Insert: {
          area?: string | null
          atualizado_em?: string
          baixa_data?: string | null
          baixa_motivo?: string | null
          bloco?: string | null
          categoria_id?: string | null
          codigo?: string
          compra_data?: string | null
          compra_valor?: number | null
          criado_em?: string
          fabricante?: string | null
          fornecedor_id?: string | null
          garantia_fim?: string | null
          id?: string
          legado_id?: string | null
          loja_id?: string | null
          modelo?: string | null
          nome: string
          numero_serie?: string | null
          observacao?: string | null
          ponto?: string | null
          responsavel_id?: string | null
          setor_id?: string | null
          situacao?: Database["os"]["Enums"]["situacao_ativo"]
          valor_reposicao?: number | null
          vida_util_anos?: number | null
        }
        Update: {
          area?: string | null
          atualizado_em?: string
          baixa_data?: string | null
          baixa_motivo?: string | null
          bloco?: string | null
          categoria_id?: string | null
          codigo?: string
          compra_data?: string | null
          compra_valor?: number | null
          criado_em?: string
          fabricante?: string | null
          fornecedor_id?: string | null
          garantia_fim?: string | null
          id?: string
          legado_id?: string | null
          loja_id?: string | null
          modelo?: string | null
          nome?: string
          numero_serie?: string | null
          observacao?: string | null
          ponto?: string | null
          responsavel_id?: string | null
          setor_id?: string | null
          situacao?: Database["os"]["Enums"]["situacao_ativo"]
          valor_reposicao?: number | null
          vida_util_anos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ativos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "ativo_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          agenda_id: string | null
          ativo: boolean
          atualizado_em: string
          campos: Json
          checklist: Json
          cor: string | null
          criado_em: string
          icone: string
          id: string
          no_portal: boolean
          nome: string
          ordem: number
          orientacao_portal: string | null
          pai_id: string | null
          prazo_terceirizado_dias: number | null
          prazo_unidade: Database["os"]["Enums"]["unidade_prazo"]
          prazo_valor: number | null
          precisa_confirmacao: boolean
          preventiva: boolean
          prioridade_padrao: Database["os"]["Enums"]["prioridade"]
          registrar_tempo: boolean
          responsavel_padrao_id: string | null
          resposta_horas: number | null
          setor_id: string
          tipo_padrao: Database["os"]["Enums"]["tipo_chamado"]
          vincular_ativo: boolean
          vincular_loja: boolean
        }
        Insert: {
          agenda_id?: string | null
          ativo?: boolean
          atualizado_em?: string
          campos?: Json
          checklist?: Json
          cor?: string | null
          criado_em?: string
          icone?: string
          id?: string
          no_portal?: boolean
          nome: string
          ordem?: number
          orientacao_portal?: string | null
          pai_id?: string | null
          prazo_terceirizado_dias?: number | null
          prazo_unidade?: Database["os"]["Enums"]["unidade_prazo"]
          prazo_valor?: number | null
          precisa_confirmacao?: boolean
          preventiva?: boolean
          prioridade_padrao?: Database["os"]["Enums"]["prioridade"]
          registrar_tempo?: boolean
          responsavel_padrao_id?: string | null
          resposta_horas?: number | null
          setor_id: string
          tipo_padrao?: Database["os"]["Enums"]["tipo_chamado"]
          vincular_ativo?: boolean
          vincular_loja?: boolean
        }
        Update: {
          agenda_id?: string | null
          ativo?: boolean
          atualizado_em?: string
          campos?: Json
          checklist?: Json
          cor?: string | null
          criado_em?: string
          icone?: string
          id?: string
          no_portal?: boolean
          nome?: string
          ordem?: number
          orientacao_portal?: string | null
          pai_id?: string | null
          prazo_terceirizado_dias?: number | null
          prazo_unidade?: Database["os"]["Enums"]["unidade_prazo"]
          prazo_valor?: number | null
          precisa_confirmacao?: boolean
          preventiva?: boolean
          prioridade_padrao?: Database["os"]["Enums"]["prioridade"]
          registrar_tempo?: boolean
          responsavel_padrao_id?: string | null
          resposta_horas?: number | null
          setor_id?: string
          tipo_padrao?: Database["os"]["Enums"]["tipo_chamado"]
          vincular_ativo?: boolean
          vincular_loja?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "categorias_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_profissionais: {
        Row: {
          ordem_id: string
          profissional_id: string
        }
        Insert: {
          ordem_id: string
          profissional_id: string
        }
        Update: {
          ordem_id?: string
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_profissionais_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_profissionais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          aberto_por: string | null
          aguardando_desde: string | null
          aguardando_min: number
          aguardando_motivo: string | null
          aguardando_tipo: Database["os"]["Enums"]["motivo_aguardando"] | null
          ambiente_id: string | null
          ativo_id: string | null
          atualizado_em: string
          avaliacao: number | null
          avaliacao_comentario: string | null
          avaliado_em: string | null
          campos: Json
          cancelado_em: string | null
          cancelado_por: string | null
          categoria_id: string | null
          causa_falha: string | null
          checklist: Json
          concluido_em: string | null
          concluido_por: string | null
          criado_em: string
          descricao: string | null
          destinos_em_ordem: boolean
          etiquetas: string[]
          fechado_automatico: boolean
          fechado_em: string | null
          fechado_por: string | null
          id: string
          iniciado_em: string | null
          legado_id: string | null
          legado_origem: string | null
          loja_id: string | null
          motivo_cancelamento: string | null
          numero: number
          origem: Database["os"]["Enums"]["origem_chamado"]
          pessoal: boolean
          prazo: string | null
          precisa_confirmacao: boolean
          primeira_resposta_em: string | null
          prioridade: Database["os"]["Enums"]["prioridade"]
          reaberto_vezes: number
          recorrencia: Json | null
          responsavel_id: string | null
          serie_data: string | null
          serie_id: string | null
          setor_id: string
          solicitante_nome: string | null
          solicitante_telefone: string | null
          solucao: string | null
          status: Database["os"]["Enums"]["status_chamado"]
          tipo: Database["os"]["Enums"]["tipo_chamado"]
          titulo: string
          ultimo_motivo_reabertura: string | null
          vinculado_a_id: string | null
          vistoria_id: string | null
        }
        Insert: {
          aberto_por?: string | null
          aguardando_desde?: string | null
          aguardando_min?: number
          aguardando_motivo?: string | null
          aguardando_tipo?: Database["os"]["Enums"]["motivo_aguardando"] | null
          ambiente_id?: string | null
          ativo_id?: string | null
          atualizado_em?: string
          avaliacao?: number | null
          avaliacao_comentario?: string | null
          avaliado_em?: string | null
          campos?: Json
          cancelado_em?: string | null
          cancelado_por?: string | null
          categoria_id?: string | null
          causa_falha?: string | null
          checklist?: Json
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          descricao?: string | null
          destinos_em_ordem?: boolean
          etiquetas?: string[]
          fechado_automatico?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          iniciado_em?: string | null
          legado_id?: string | null
          legado_origem?: string | null
          loja_id?: string | null
          motivo_cancelamento?: string | null
          numero?: number
          origem?: Database["os"]["Enums"]["origem_chamado"]
          pessoal?: boolean
          prazo?: string | null
          precisa_confirmacao?: boolean
          primeira_resposta_em?: string | null
          prioridade?: Database["os"]["Enums"]["prioridade"]
          reaberto_vezes?: number
          recorrencia?: Json | null
          responsavel_id?: string | null
          serie_data?: string | null
          serie_id?: string | null
          setor_id: string
          solicitante_nome?: string | null
          solicitante_telefone?: string | null
          solucao?: string | null
          status?: Database["os"]["Enums"]["status_chamado"]
          tipo: Database["os"]["Enums"]["tipo_chamado"]
          titulo: string
          ultimo_motivo_reabertura?: string | null
          vinculado_a_id?: string | null
          vistoria_id?: string | null
        }
        Update: {
          aberto_por?: string | null
          aguardando_desde?: string | null
          aguardando_min?: number
          aguardando_motivo?: string | null
          aguardando_tipo?: Database["os"]["Enums"]["motivo_aguardando"] | null
          ambiente_id?: string | null
          ativo_id?: string | null
          atualizado_em?: string
          avaliacao?: number | null
          avaliacao_comentario?: string | null
          avaliado_em?: string | null
          campos?: Json
          cancelado_em?: string | null
          cancelado_por?: string | null
          categoria_id?: string | null
          causa_falha?: string | null
          checklist?: Json
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          descricao?: string | null
          destinos_em_ordem?: boolean
          etiquetas?: string[]
          fechado_automatico?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          iniciado_em?: string | null
          legado_id?: string | null
          legado_origem?: string | null
          loja_id?: string | null
          motivo_cancelamento?: string | null
          numero?: number
          origem?: Database["os"]["Enums"]["origem_chamado"]
          pessoal?: boolean
          prazo?: string | null
          precisa_confirmacao?: boolean
          primeira_resposta_em?: string | null
          prioridade?: Database["os"]["Enums"]["prioridade"]
          reaberto_vezes?: number
          recorrencia?: Json | null
          responsavel_id?: string | null
          serie_data?: string | null
          serie_id?: string | null
          setor_id?: string
          solicitante_nome?: string | null
          solicitante_telefone?: string | null
          solucao?: string | null
          status?: Database["os"]["Enums"]["status_chamado"]
          tipo?: Database["os"]["Enums"]["tipo_chamado"]
          titulo?: string
          ultimo_motivo_reabertura?: string | null
          vinculado_a_id?: string | null
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "vistoria_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_vinculado_a_id_fkey"
            columns: ["vinculado_a_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos: {
        Row: {
          atualizado_em: string
          criado_em: string
          empresa: string | null
          id: string
          legado_id: string | null
          nome: string
          observacao: string | null
          telefone: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          empresa?: string | null
          id?: string
          legado_id?: string | null
          nome: string
          observacao?: string | null
          telefone: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          empresa?: string | null
          id?: string
          legado_id?: string | null
          nome?: string
          observacao?: string | null
          telefone?: string
        }
        Relationships: []
      }
      destinatarios: {
        Row: {
          ordem_id: string | null
          atualizado_em: string
          chamado_id: string | null
          concluido_em: string | null
          concluido_por: string | null
          criado_em: string
          id: string
          lido_em: string | null
          observacao: string | null
          ordem: number
          prazo: string | null
          responsavel_id: string | null
          setor_id: string | null
          status: Database["os"]["Enums"]["status_destino"]
          titulo: string | null
          usuario_id: string | null
        }
        Insert: {
          ordem_id?: string | null
          atualizado_em?: string
          chamado_id?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          id?: string
          lido_em?: string | null
          observacao?: string | null
          ordem?: number
          prazo?: string | null
          responsavel_id?: string | null
          setor_id?: string | null
          status?: Database["os"]["Enums"]["status_destino"]
          titulo?: string | null
          usuario_id?: string | null
        }
        Update: {
          ordem_id?: string | null
          atualizado_em?: string
          chamado_id?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          id?: string
          lido_em?: string | null
          observacao?: string | null
          ordem?: number
          prazo?: string | null
          responsavel_id?: string | null
          setor_id?: string | null
          status?: Database["os"]["Enums"]["status_destino"]
          titulo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "destinatarios_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinatarios_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinatarios_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      disparos: {
        Row: {
          automatico: boolean
          chamado_id: string | null
          disparado_por: string | null
          em: string
          id: string
          loja_id: string
          modelo_id: string
        }
        Insert: {
          automatico?: boolean
          chamado_id?: string | null
          disparado_por?: string | null
          em?: string
          id?: string
          loja_id: string
          modelo_id: string
        }
        Update: {
          automatico?: boolean
          chamado_id?: string | null
          disparado_por?: string | null
          em?: string
          id?: string
          loja_id?: string
          modelo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disparos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disparos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disparos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cnpj: string | null
          contato: string | null
          criado_em: string
          email: string | null
          id: string
          legado_id: string | null
          nome: string
          prazo_retorno_dias: number | null
          servicos: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          contato?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          legado_id?: string | null
          nome: string
          prazo_retorno_dias?: number | null
          servicos?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cnpj?: string | null
          contato?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          legado_id?: string | null
          nome?: string
          prazo_retorno_dias?: number | null
          servicos?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          ordem_id: string | null
          autor_id: string | null
          autor_nome: string | null
          chamado_id: string | null
          dados: Json
          em: string
          id: number
          texto: string | null
          tipo: string
          visivel_lojista: boolean
        }
        Insert: {
          ordem_id?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          chamado_id?: string | null
          dados?: Json
          em?: string
          id?: never
          texto?: string | null
          tipo: string
          visivel_lojista?: boolean
        }
        Update: {
          ordem_id?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          chamado_id?: string | null
          dados?: Json
          em?: string
          id?: never
          texto?: string | null
          tipo?: string
          visivel_lojista?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "eventos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          data: string
          nome: string
        }
        Insert: {
          data: string
          nome: string
        }
        Update: {
          data?: string
          nome?: string
        }
        Relationships: []
      }
      leituras: {
        Row: {
          chamado_id: string
          lido_em: string
          usuario_id: string
        }
        Insert: {
          chamado_id: string
          lido_em?: string
          usuario_id?: string
        }
        Update: {
          chamado_id?: string
          lido_em?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leituras_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          atualizado_em: string
          bloco: string | null
          cnpj: string | null
          contrato: string | null
          criado_em: string
          enet_id: string | null
          fim: string | null
          id: string
          inicio: string | null
          locatario: string | null
          luc: string
          nome: string
          situacao: string
          telefone: string | null
          tem_vaga: boolean | null
        }
        Insert: {
          atualizado_em?: string
          bloco?: string | null
          cnpj?: string | null
          contrato?: string | null
          criado_em?: string
          enet_id?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          locatario?: string | null
          luc: string
          nome: string
          situacao?: string
          telefone?: string | null
          tem_vaga?: boolean | null
        }
        Update: {
          atualizado_em?: string
          bloco?: string | null
          cnpj?: string | null
          contrato?: string | null
          criado_em?: string
          enet_id?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          locatario?: string | null
          luc?: string
          nome?: string
          situacao?: string
          telefone?: string | null
          tem_vaga?: boolean | null
        }
        Relationships: []
      }
      materiais: {
        Row: {
          ordem_id: string
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          quantidade: number
          unidade: string | null
        }
        Insert: {
          ordem_id: string
          criado_em?: string
          criado_por?: string | null
          descricao: string
          id?: string
          quantidade: number
          unidade?: string | null
        }
        Update: {
          ordem_id?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          quantidade?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiais_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      material_valores: {
        Row: {
          material_id: string
          valor_unitario: number
        }
        Insert: {
          material_id: string
          valor_unitario: number
        }
        Update: {
          material_id?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_valores_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          atualizado_em: string
          categoria_id: string | null
          criado_em: string
          id: string
          indicador: string
          limite_atencao: number | null
          meta: number
          setor_id: string | null
        }
        Insert: {
          atualizado_em?: string
          categoria_id?: string | null
          criado_em?: string
          id?: string
          indicador: string
          limite_atencao?: number | null
          meta: number
          setor_id?: string | null
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string | null
          criado_em?: string
          id?: string
          indicador?: string
          limite_atencao?: number | null
          meta?: number
          setor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_itens: {
        Row: {
          acao: string
          atualizado_em: string
          categoria_id: string | null
          condicao: string
          criado_em: string
          descricao: string | null
          id: string
          modelo_id: string
          ordem: number
          prazo_dias: number
          responsavel_id: string | null
          setor_id: string
          titulo: string
        }
        Insert: {
          acao?: string
          atualizado_em?: string
          categoria_id?: string | null
          condicao?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          modelo_id: string
          ordem?: number
          prazo_dias?: number
          responsavel_id?: string | null
          setor_id: string
          titulo: string
        }
        Update: {
          acao?: string
          atualizado_em?: string
          categoria_id?: string | null
          condicao?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          modelo_id?: string
          ordem?: number
          prazo_dias?: number
          responsavel_id?: string | null
          setor_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelo_itens_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_itens_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          gatilho: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          gatilho: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          gatilho?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          ordem_id: string | null
          chamado_id: string | null
          chave: string | null
          criado_em: string
          href: string
          id: number
          lida_em: string | null
          texto: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          ordem_id?: string | null
          chamado_id?: string | null
          chave?: string | null
          criado_em?: string
          href: string
          id?: never
          lida_em?: string | null
          texto?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          ordem_id?: string | null
          chamado_id?: string | null
          chave?: string | null
          criado_em?: string
          href?: string
          id?: never
          lida_em?: string | null
          texto?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens: {
        Row: {
          aberto_por: string | null
          aguardando_desde: string | null
          aguardando_min: number
          aguardando_motivo: string | null
          aguardando_tipo: Database["os"]["Enums"]["motivo_aguardando"] | null
          ambiente_id: string | null
          assinado_em: string | null
          assinatura_nome: string | null
          assinatura_path: string | null
          ativo_id: string | null
          ativo_parado: boolean
          atualizado_em: string
          avaliacao: number | null
          avaliacao_comentario: string | null
          avaliado_em: string | null
          bloco: string | null
          campos: Json
          cancelado_em: string | null
          cancelado_por: string | null
          categoria_id: string | null
          causa_falha: string | null
          checklist: Json
          cobranca_avisada_em: string | null
          concluido_em: string | null
          concluido_por: string | null
          criado_em: string
          descricao: string | null
          destinos_em_ordem: boolean
          empresa_id: string | null
          etiquetas: string[]
          execucao: Database["os"]["Enums"]["execucao"]
          fechado_automatico: boolean
          fechado_em: string | null
          fechado_por: string | null
          id: string
          iniciado_em: string | null
          legado_id: string | null
          legado_origem: string | null
          local: string | null
          loja_id: string | null
          motivo_cancelamento: string | null
          numero: number
          origem: Database["os"]["Enums"]["origem_chamado"]
          pessoal: boolean
          plano_data: string | null
          plano_id: string | null
          prazo: string | null
          prazo_terceirizado: string | null
          precisa_confirmacao: boolean
          primeira_resposta_em: string | null
          prioridade: Database["os"]["Enums"]["prioridade"]
          rateio: boolean
          reaberto_vezes: number
          recorrencia: Json | null
          responsavel_id: string | null
          serie_data: string | null
          serie_id: string | null
          setor_id: string
          solicitante_nome: string | null
          solicitante_telefone: string | null
          solucao: string | null
          status: Database["os"]["Enums"]["status_chamado"]
          tipo: Database["os"]["Enums"]["tipo_chamado"]
          titulo: string
          ultimo_motivo_reabertura: string | null
          vinculado_a_id: string | null
          visita_data: string | null
          visita_periodo: Database["os"]["Enums"]["periodo_visita"] | null
          vistoria_id: string | null
        }
        Insert: {
          aberto_por?: string | null
          aguardando_desde?: string | null
          aguardando_min?: number
          aguardando_motivo?: string | null
          aguardando_tipo?: Database["os"]["Enums"]["motivo_aguardando"] | null
          ambiente_id?: string | null
          assinado_em?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          ativo_id?: string | null
          ativo_parado?: boolean
          atualizado_em?: string
          avaliacao?: number | null
          avaliacao_comentario?: string | null
          avaliado_em?: string | null
          bloco?: string | null
          campos?: Json
          cancelado_em?: string | null
          cancelado_por?: string | null
          categoria_id?: string | null
          causa_falha?: string | null
          checklist?: Json
          cobranca_avisada_em?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          descricao?: string | null
          destinos_em_ordem?: boolean
          empresa_id?: string | null
          etiquetas?: string[]
          execucao?: Database["os"]["Enums"]["execucao"]
          fechado_automatico?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          iniciado_em?: string | null
          legado_id?: string | null
          legado_origem?: string | null
          local?: string | null
          loja_id?: string | null
          motivo_cancelamento?: string | null
          numero?: number
          origem?: Database["os"]["Enums"]["origem_chamado"]
          pessoal?: boolean
          plano_data?: string | null
          plano_id?: string | null
          prazo?: string | null
          prazo_terceirizado?: string | null
          precisa_confirmacao?: boolean
          primeira_resposta_em?: string | null
          prioridade?: Database["os"]["Enums"]["prioridade"]
          rateio?: boolean
          reaberto_vezes?: number
          recorrencia?: Json | null
          responsavel_id?: string | null
          serie_data?: string | null
          serie_id?: string | null
          setor_id: string
          solicitante_nome?: string | null
          solicitante_telefone?: string | null
          solucao?: string | null
          status?: Database["os"]["Enums"]["status_chamado"]
          tipo?: Database["os"]["Enums"]["tipo_chamado"]
          titulo: string
          ultimo_motivo_reabertura?: string | null
          vinculado_a_id?: string | null
          visita_data?: string | null
          visita_periodo?: Database["os"]["Enums"]["periodo_visita"] | null
          vistoria_id?: string | null
        }
        Update: {
          aberto_por?: string | null
          aguardando_desde?: string | null
          aguardando_min?: number
          aguardando_motivo?: string | null
          aguardando_tipo?: Database["os"]["Enums"]["motivo_aguardando"] | null
          ambiente_id?: string | null
          assinado_em?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          ativo_id?: string | null
          ativo_parado?: boolean
          atualizado_em?: string
          avaliacao?: number | null
          avaliacao_comentario?: string | null
          avaliado_em?: string | null
          bloco?: string | null
          campos?: Json
          cancelado_em?: string | null
          cancelado_por?: string | null
          categoria_id?: string | null
          causa_falha?: string | null
          checklist?: Json
          cobranca_avisada_em?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string
          descricao?: string | null
          destinos_em_ordem?: boolean
          empresa_id?: string | null
          etiquetas?: string[]
          execucao?: Database["os"]["Enums"]["execucao"]
          fechado_automatico?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          iniciado_em?: string | null
          legado_id?: string | null
          legado_origem?: string | null
          local?: string | null
          loja_id?: string | null
          motivo_cancelamento?: string | null
          numero?: number
          origem?: Database["os"]["Enums"]["origem_chamado"]
          pessoal?: boolean
          plano_data?: string | null
          plano_id?: string | null
          prazo?: string | null
          prazo_terceirizado?: string | null
          precisa_confirmacao?: boolean
          primeira_resposta_em?: string | null
          prioridade?: Database["os"]["Enums"]["prioridade"]
          rateio?: boolean
          reaberto_vezes?: number
          recorrencia?: Json | null
          responsavel_id?: string | null
          serie_data?: string | null
          serie_id?: string | null
          setor_id?: string
          solicitante_nome?: string | null
          solicitante_telefone?: string | null
          solucao?: string | null
          status?: Database["os"]["Enums"]["status_chamado"]
          tipo?: Database["os"]["Enums"]["tipo_chamado"]
          titulo?: string
          ultimo_motivo_reabertura?: string | null
          vinculado_a_id?: string | null
          visita_data?: string | null
          visita_periodo?: Database["os"]["Enums"]["periodo_visita"] | null
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "vistoria_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_preventivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_vinculado_a_id_fkey"
            columns: ["vinculado_a_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      os_custos: {
        Row: {
          atualizado_em: string
          calculado_em: string | null
          ordem_id: string
          completo: boolean | null
          custo_mao_obra: number | null
          custo_materiais: number | null
          custo_total: number | null
          legado_minuto_homem: number | null
          legado_minutos: number | null
          legado_valor: number | null
          legado_valor_rateio: number | null
          memoria: Json
          minuto_homem: number | null
          minutos: number | null
          orcamento_aprovado_em: string | null
          orcamento_aprovado_por: string | null
          orcamento_numero: string | null
          outros_custos: Json
          rateio_regra: Database["os"]["Enums"]["regra_rateio"] | null
          rateio_valor: number | null
          valor_rateio: number | null
          valor_terceirizado: number | null
        }
        Insert: {
          atualizado_em?: string
          calculado_em?: string | null
          ordem_id: string
          completo?: boolean | null
          custo_mao_obra?: number | null
          custo_materiais?: number | null
          custo_total?: number | null
          legado_minuto_homem?: number | null
          legado_minutos?: number | null
          legado_valor?: number | null
          legado_valor_rateio?: number | null
          memoria?: Json
          minuto_homem?: number | null
          minutos?: number | null
          orcamento_aprovado_em?: string | null
          orcamento_aprovado_por?: string | null
          orcamento_numero?: string | null
          outros_custos?: Json
          rateio_regra?: Database["os"]["Enums"]["regra_rateio"] | null
          rateio_valor?: number | null
          valor_rateio?: number | null
          valor_terceirizado?: number | null
        }
        Update: {
          atualizado_em?: string
          calculado_em?: string | null
          ordem_id?: string
          completo?: boolean | null
          custo_mao_obra?: number | null
          custo_materiais?: number | null
          custo_total?: number | null
          legado_minuto_homem?: number | null
          legado_minutos?: number | null
          legado_valor?: number | null
          legado_valor_rateio?: number | null
          memoria?: Json
          minuto_homem?: number | null
          minutos?: number | null
          orcamento_aprovado_em?: string | null
          orcamento_aprovado_por?: string | null
          orcamento_numero?: string | null
          outros_custos?: Json
          rateio_regra?: Database["os"]["Enums"]["regra_rateio"] | null
          rateio_valor?: number | null
          valor_rateio?: number | null
          valor_terceirizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_custos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: true
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros: {
        Row: {
          aceite_dias_uteis: number
          almoco_fim: string
          almoco_inicio: string
          ativos_saida_formas: string[]
          ativos_saida_tipos: string[]
          atualizado_em: string
          aviso_vencimento_horas: number
          causas_falha: string[]
          confirmacao_alerta_dias: number
          dias_uteis: number[]
          expediente_fim: string
          expediente_inicio: string
          garantia_aviso_dias: number
          id: number
          mensagens: Json
          portal_boas_vindas: string
          preventiva_antecedencia_dias: number
          recorrencia_antecedencia_dias: number
          sinal_corretivas_avaliar: number
          sinal_corretivas_trocar: number
          sinal_idade_avaliar_pct: number
          sinal_idade_trocar_pct: number
          sinal_peso_avaliar: number
          sinal_peso_trocar: number
          terceirizado_prazo_dias: number
          teto_terceirizado: number | null
          vistoria_ambientes: string[]
          vistoria_locador: string
          vistoria_local: string
          vistoria_textos: Json
        }
        Insert: {
          aceite_dias_uteis?: number
          almoco_fim?: string
          almoco_inicio?: string
          ativos_saida_formas?: string[]
          ativos_saida_tipos?: string[]
          atualizado_em?: string
          aviso_vencimento_horas?: number
          causas_falha?: string[]
          confirmacao_alerta_dias?: number
          dias_uteis?: number[]
          expediente_fim?: string
          expediente_inicio?: string
          garantia_aviso_dias?: number
          id?: number
          mensagens?: Json
          portal_boas_vindas?: string
          preventiva_antecedencia_dias?: number
          recorrencia_antecedencia_dias?: number
          sinal_corretivas_avaliar?: number
          sinal_corretivas_trocar?: number
          sinal_idade_avaliar_pct?: number
          sinal_idade_trocar_pct?: number
          sinal_peso_avaliar?: number
          sinal_peso_trocar?: number
          terceirizado_prazo_dias?: number
          teto_terceirizado?: number | null
          vistoria_ambientes?: string[]
          vistoria_locador?: string
          vistoria_local?: string
          vistoria_textos?: Json
        }
        Update: {
          aceite_dias_uteis?: number
          almoco_fim?: string
          almoco_inicio?: string
          ativos_saida_formas?: string[]
          ativos_saida_tipos?: string[]
          atualizado_em?: string
          aviso_vencimento_horas?: number
          causas_falha?: string[]
          confirmacao_alerta_dias?: number
          dias_uteis?: number[]
          expediente_fim?: string
          expediente_inicio?: string
          garantia_aviso_dias?: number
          id?: number
          mensagens?: Json
          portal_boas_vindas?: string
          preventiva_antecedencia_dias?: number
          recorrencia_antecedencia_dias?: number
          sinal_corretivas_avaliar?: number
          sinal_corretivas_trocar?: number
          sinal_idade_avaliar_pct?: number
          sinal_idade_trocar_pct?: number
          sinal_peso_avaliar?: number
          sinal_peso_trocar?: number
          terceirizado_prazo_dias?: number
          teto_terceirizado?: number | null
          vistoria_ambientes?: string[]
          vistoria_locador?: string
          vistoria_local?: string
          vistoria_textos?: Json
        }
        Relationships: []
      }
      participantes: {
        Row: {
          id: number
          ordem_id: string | null
          chamado_id: string | null
          criado_em: string
          motivo: string
          usuario_id: string
        }
        Insert: {
          id?: never
          ordem_id?: string | null
          chamado_id?: string | null
          criado_em?: string
          motivo?: string
          usuario_id: string
        }
        Update: {
          id?: never
          ordem_id?: string | null
          chamado_id?: string | null
          criado_em?: string
          motivo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participantes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_preventivos: {
        Row: {
          antecedencia_dias: number | null
          ativo: boolean
          ativo_id: string
          atualizado_em: string
          categoria_id: string | null
          checklist: Json
          criado_em: string
          descricao: string | null
          frequencia_dias: number | null
          frequencia_meses: number | null
          id: string
          proxima_data: string
          responsavel_id: string | null
          setor_id: string
          titulo: string
        }
        Insert: {
          antecedencia_dias?: number | null
          ativo?: boolean
          ativo_id: string
          atualizado_em?: string
          categoria_id?: string | null
          checklist?: Json
          criado_em?: string
          descricao?: string | null
          frequencia_dias?: number | null
          frequencia_meses?: number | null
          id?: string
          proxima_data: string
          responsavel_id?: string | null
          setor_id: string
          titulo: string
        }
        Update: {
          antecedencia_dias?: number | null
          ativo?: boolean
          ativo_id?: string
          atualizado_em?: string
          categoria_id?: string | null
          checklist?: Json
          criado_em?: string
          descricao?: string | null
          frequencia_dias?: number | null
          frequencia_meses?: number | null
          id?: string
          proxima_data?: string
          responsavel_id?: string | null
          setor_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_preventivos_ativo_id_fkey"
            columns: ["ativo_id"]
            isOneToOne: false
            referencedRelation: "ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_preventivos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_preventivos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_links: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          criado_em: string
          criado_por: string | null
          enviado_em: string | null
          id: string
          loja_id: string
          token: string
          ultimo_acesso_em: string | null
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          enviado_em?: string | null
          id?: string
          loja_id: string
          token: string
          ultimo_acesso_em?: string | null
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          enviado_em?: string | null
          id?: string
          loja_id?: string
          token?: string
          ultimo_acesso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_links_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_sessoes: {
        Row: {
          criado_em: string
          encerrado_em: string | null
          encerrado_por: string | null
          expira_em: string
          id: string
          loja_id: string
          token: string
          ultimo_acesso_em: string | null
        }
        Insert: {
          criado_em?: string
          encerrado_em?: string | null
          encerrado_por?: string | null
          expira_em: string
          id?: string
          loja_id: string
          token: string
          ultimo_acesso_em?: string | null
        }
        Update: {
          criado_em?: string
          encerrado_em?: string | null
          encerrado_por?: string | null
          expira_em?: string
          id?: string
          loja_id?: string
          token?: string
          ultimo_acesso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_sessoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_tentativas: {
        Row: {
          criado_em: string
          id: string
          ip: string
        }
        Insert: {
          criado_em?: string
          id?: string
          ip: string
        }
        Update: {
          criado_em?: string
          id?: string
          ip?: string
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          empresa_id: string
          id: string
          legado_id: string | null
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          empresa_id: string
          id?: string
          legado_id?: string | null
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          empresa_id?: string
          id?: string
          legado_id?: string | null
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_tecnicos: {
        Row: {
          sessao_id: string
          tecnico_id: string
        }
        Insert: {
          sessao_id: string
          tecnico_id: string
        }
        Update: {
          sessao_id?: string
          tecnico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessao_tecnicos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_tecnicos_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          almoco_fim: string | null
          almoco_inicio: string | null
          atualizado_em: string
          ordem_id: string
          criado_em: string
          criado_por: string | null
          data: string
          fim: string | null
          id: string
          inicio: string
          observacao: string | null
        }
        Insert: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          atualizado_em?: string
          ordem_id: string
          criado_em?: string
          criado_por?: string | null
          data: string
          fim?: string | null
          id?: string
          inicio: string
          observacao?: string | null
        }
        Update: {
          almoco_fim?: string | null
          almoco_inicio?: string | null
          atualizado_em?: string
          ordem_id?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          fim?: string | null
          id?: string
          inicio?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
        ]
      }
      setor_membros: {
        Row: {
          gestor: boolean
          setor_id: string
          usuario_id: string
        }
        Insert: {
          gestor?: boolean
          setor_id: string
          usuario_id: string
        }
        Update: {
          gestor?: boolean
          setor_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setor_membros_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cor: string
          criado_em: string
          icone: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string
          criado_em?: string
          icone?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string
          criado_em?: string
          icone?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      tecnico_valores: {
        Row: {
          criado_em: string
          id: string
          tecnico_id: string
          valor_minuto: number
          vigente_desde: string
        }
        Insert: {
          criado_em?: string
          id?: string
          tecnico_id: string
          valor_minuto: number
          vigente_desde: string
        }
        Update: {
          criado_em?: string
          id?: string
          tecnico_id?: string
          valor_minuto?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "tecnico_valores_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      tecnicos: {
        Row: {
          atualizado_em: string
          criado_em: string
          desligado_em: string | null
          id: string
          legado_id: string | null
          nome: string
          setor_id: string | null
          usuario_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          desligado_em?: string | null
          id?: string
          legado_id?: string | null
          nome: string
          setor_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          desligado_em?: string | null
          id?: string
          legado_id?: string | null
          nome?: string
          setor_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tecnicos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      terceirizado_links: {
        Row: {
          aceito_em: string | null
          assinado_em: string | null
          assinatura_documento: string | null
          assinatura_nome: string | null
          assinatura_path: string | null
          cancelado_em: string | null
          ordem_id: string
          chegada_em: string | null
          chegada_local: Json | null
          criado_em: string
          criado_por: string | null
          empresa_id: string | null
          id: string
          orcamento_numero: string | null
          recusa_motivo: string | null
          recusado_em: string | null
          saida_em: string | null
          saida_local: Json | null
          solucao: string | null
          terminado_em: string | null
          token: string
          ultimo_acesso_em: string | null
          valor_informado: number | null
        }
        Insert: {
          aceito_em?: string | null
          assinado_em?: string | null
          assinatura_documento?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          cancelado_em?: string | null
          ordem_id: string
          chegada_em?: string | null
          chegada_local?: Json | null
          criado_em?: string
          criado_por?: string | null
          empresa_id?: string | null
          id?: string
          orcamento_numero?: string | null
          recusa_motivo?: string | null
          recusado_em?: string | null
          saida_em?: string | null
          saida_local?: Json | null
          solucao?: string | null
          terminado_em?: string | null
          token: string
          ultimo_acesso_em?: string | null
          valor_informado?: number | null
        }
        Update: {
          aceito_em?: string | null
          assinado_em?: string | null
          assinatura_documento?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          cancelado_em?: string | null
          ordem_id?: string
          chegada_em?: string | null
          chegada_local?: Json | null
          criado_em?: string
          criado_por?: string | null
          empresa_id?: string | null
          id?: string
          orcamento_numero?: string | null
          recusa_motivo?: string | null
          recusado_em?: string | null
          saida_em?: string | null
          saida_local?: Json | null
          solucao?: string | null
          terminado_em?: string | null
          token?: string
          ultimo_acesso_em?: string | null
          valor_informado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "terceirizado_links_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceirizado_links_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vistoria_ambientes: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          entrada_ambiente_id: string | null
          id: string
          ordem: number
          problema: boolean
          resposta: Database["os"]["Enums"]["resposta_ambiente"]
          titulo: string
          vistoria_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          entrada_ambiente_id?: string | null
          id?: string
          ordem?: number
          problema?: boolean
          resposta?: Database["os"]["Enums"]["resposta_ambiente"]
          titulo: string
          vistoria_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          entrada_ambiente_id?: string | null
          id?: string
          ordem?: number
          problema?: boolean
          resposta?: Database["os"]["Enums"]["resposta_ambiente"]
          titulo?: string
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoria_ambientes_entrada_ambiente_id_fkey"
            columns: ["entrada_ambiente_id"]
            isOneToOne: false
            referencedRelation: "vistoria_ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoria_ambientes_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      vistorias: {
        Row: {
          assinado_em: string | null
          assinatura_locador_path: string | null
          assinatura_locatario_path: string | null
          assinatura_enviada_em: string | null
          assinatura_token: string | null
          locatario_assinado_em: string | null
          locatario_assinatura_documento: string | null
          locatario_assinatura_nome: string | null
          atualizado_em: string
          bloco: string
          campo_tipo: string | null
          codigo: string
          comparar_no_laudo: boolean
          consideracoes: string | null
          criado_em: string
          criado_por: string | null
          data: string
          entrada_id: string | null
          hora: string | null
          id: string
          itens_anteriores: string | null
          legado_id: string | null
          locador: string
          local_data: string
          locatario: string
          loja_id: string | null
          observacao: string
          rascunho: boolean
          status: Database["os"]["Enums"]["status_vistoria"]
          termo: string
          tipo: Database["os"]["Enums"]["tipo_vistoria"]
          unidade: string
          vistoriador_id: string | null
          vistoriador_nome: string
        }
        Insert: {
          assinado_em?: string | null
          assinatura_locador_path?: string | null
          assinatura_locatario_path?: string | null
          assinatura_enviada_em?: string | null
          assinatura_token?: string | null
          locatario_assinado_em?: string | null
          locatario_assinatura_documento?: string | null
          locatario_assinatura_nome?: string | null
          atualizado_em?: string
          bloco: string
          campo_tipo?: string | null
          codigo?: string
          comparar_no_laudo?: boolean
          consideracoes?: string | null
          criado_em?: string
          criado_por?: string | null
          data: string
          entrada_id?: string | null
          hora?: string | null
          id?: string
          itens_anteriores?: string | null
          legado_id?: string | null
          locador: string
          local_data?: string
          locatario: string
          loja_id?: string | null
          observacao?: string
          rascunho?: boolean
          status?: Database["os"]["Enums"]["status_vistoria"]
          termo?: string
          tipo: Database["os"]["Enums"]["tipo_vistoria"]
          unidade: string
          vistoriador_id?: string | null
          vistoriador_nome: string
        }
        Update: {
          assinado_em?: string | null
          assinatura_locador_path?: string | null
          assinatura_locatario_path?: string | null
          assinatura_enviada_em?: string | null
          assinatura_token?: string | null
          locatario_assinado_em?: string | null
          locatario_assinatura_documento?: string | null
          locatario_assinatura_nome?: string | null
          atualizado_em?: string
          bloco?: string
          campo_tipo?: string | null
          codigo?: string
          comparar_no_laudo?: boolean
          consideracoes?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          entrada_id?: string | null
          hora?: string | null
          id?: string
          itens_anteriores?: string | null
          legado_id?: string | null
          locador?: string
          local_data?: string
          locatario?: string
          loja_id?: string | null
          observacao?: string
          rascunho?: boolean
          status?: Database["os"]["Enums"]["status_vistoria"]
          termo?: string
          tipo?: Database["os"]["Enums"]["tipo_vistoria"]
          unidade?: string
          vistoriador_id?: string | null
          vistoriador_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_entrada_id_fkey"
            columns: ["entrada_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ajustar_numeracao: { Args: never; Returns: number }
      ativos_para_vincular: {
        Args: never
        Returns: {
          codigo: string
          id: string
          local: string
          nome: string
          situacao: Database["os"]["Enums"]["situacao_ativo"]
        }[]
      }
      carga_das_ordens: {
        Args: {
          p_aberto_por?: string
          p_agora: string
          p_categoria?: string
          p_criado_ate?: string
          p_criado_desde?: string
          p_etiqueta?: string
          p_prioridade?: Database["os"]["Enums"]["prioridade"]
          p_responsavel?: string
          p_setor: string
          p_status?: Database["os"]["Enums"]["status_chamado"][]
        }
        Returns: {
          abertos: number
          atrasados: number
          responsavel_id: string
        }[]
      }
      carga_do_setor: {
        Args: {
          p_aberto_por?: string
          p_agora: string
          p_categoria?: string
          p_criado_ate?: string
          p_criado_desde?: string
          p_etiqueta?: string
          p_prioridade?: Database["os"]["Enums"]["prioridade"]
          p_responsavel?: string
          p_setor: string
          p_status?: Database["os"]["Enums"]["status_chamado"][]
          p_tipos?: Database["os"]["Enums"]["tipo_chamado"][]
        }
        Returns: {
          abertos: number
          atrasados: number
          responsavel_id: string
        }[]
      }
      desfazer_saida_ativo: {
        Args: { p_motivo: string; p_saida: string }
        Returns: undefined
      }
      edita_chamado: {
        Args: {
          p_aberto_por: string
          p_id: string
          p_responsavel: string
          p_setor: string
        }
        Returns: boolean
      }
      envolvido: { Args: { p_chamado: string }; Returns: boolean }
      envolvido_na_ordem: { Args: { p_ordem: string }; Returns: boolean }
      gerencia: { Args: { p_setor: string }; Returns: boolean }
      gravar_calculo_os: {
        Args: { p_ordem: string; p_resultado: Json }
        Returns: undefined
      }
      leitores_dos_avisos: {
        Args: { p_chamados: string[] }
        Returns: {
          chamado_id: string
          usuario_id: string
        }[]
      }
      lido_por_mim: {
        Args: { c: Database["os"]["Tables"]["chamados"]["Row"] }
        Returns: boolean
      }
      meus_chamados_envolvidos: { Args: never; Returns: string[] }
      meus_setores: { Args: never; Returns: string[] }
      minhas_ordens_envolvidas: { Args: never; Returns: string[] }
      pessoas: {
        Args: never
        Returns: {
          id: string
          nome: string
          setores: string[]
        }[]
      }
      pode_editar_chamado: { Args: { p_chamado: string }; Returns: boolean }
      pode_editar_ordem: { Args: { p_ordem: string }; Returns: boolean }
      pode_ver_chamado: { Args: { p_chamado: string }; Returns: boolean }
      pode_ver_ordem: { Args: { p_ordem: string }; Returns: boolean }
      proximo_codigo_vistoria: { Args: never; Returns: string }
      registrar_saida_ativo: {
        Args: { p_anexos?: string[]; p_ativo: string; p_data: string; p_destinatario: string; p_documento: string; p_forma: string; p_motivo: string; p_nf: boolean; p_nf_numero: string; p_observacoes: string; p_quantidade: string; p_recebido_por: string; p_responsavel: string; p_tipo: string; p_valor: number }
        Returns: string
      }
      registrar_saida_sobra: {
        Args: {
          p_anexos?: string[]
          p_area: string
          p_bloco: string
          p_categoria: string
          p_data: string
          p_destinatario: string
          p_documento: string
          p_forma: string
          p_motivo: string
          p_nf: boolean
          p_nf_numero: string
          p_nome: string
          p_observacoes: string
          p_quantidade: string
          p_recebido_por: string
          p_responsavel: string
          p_tipo: string
          p_valor: number
        }
        Returns: {
          ativo_id: string
          saida_id: string
        }[]
      }
      reservar_horario: {
        Args: {
          p_agenda: string
          p_chamado: string
          p_fim: string
          p_inicio: string
          p_loja: string
          p_observacao?: string
        }
        Returns: string
      }
      todos_leram: {
        Args: { c: Database["os"]["Tables"]["chamados"]["Row"] }
        Returns: boolean
      }
      resumo_ativos: {
        Args: { p_desde: string }
        Returns: {
          ativo_id: string
          corretivas_periodo: number
          custo_periodo: number
          custo_total: number
          os_abertas: number
          preventivas_periodo: number
          ultima_os: string
        }[]
      }
      ve_chamado: {
        Args: {
          p_aberto_por: string
          p_id: string
          p_responsavel: string
          p_setor: string
        }
        Returns: boolean
      }
    }
    Enums: {
      execucao: "interna" | "terceirizada"
      motivo_aguardando:
        | "material"
        | "terceirizado"
        | "lojista"
        | "aprovacao"
        | "outro"
      origem_chamado:
        | "sistema"
        | "portal"
        | "modelo"
        | "preventiva"
        | "recorrencia"
        | "vistoria"
        | "importacao"
      periodo_visita: "manha" | "tarde" | "noite"
      prioridade: "baixa" | "media" | "alta" | "urgente"
      regra_rateio: "hora_trabalhada" | "manual" | "percentual" | "terceirizado"
      resposta_ambiente: "respondido" | "nao_se_aplica" | "pendente"
      situacao_ativo: "em_uso" | "em_manutencao" | "parado" | "baixado"
      status_agendamento: "marcado" | "remarcar" | "cancelado" | "realizado"
      status_chamado:
        | "aberto"
        | "em_andamento"
        | "aguardando"
        | "concluido"
        | "fechado"
        | "cancelado"
      status_destino: "aberto" | "em_andamento" | "aguardando" | "concluido"
      status_vistoria: "andamento" | "finalizado" | "cancelado"
      tipo_chamado: "tarefa" | "solicitacao" | "os" | "aviso"
      tipo_vistoria: "entrada" | "saida" | "preventiva" | "extraordinaria"
      unidade_prazo: "horas" | "dias_uteis"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  rh: {
    Tables: {
      afastamentos: {
        Row: {
          atualizado_em: string
          colaborador_id: string
          fim: string
          id: string
          inicio: string
          justificativa: string | null
          motivo: string | null
          secullum_id: number | null
        }
        Insert: {
          atualizado_em?: string
          colaborador_id: string
          fim: string
          id?: string
          inicio: string
          justificativa?: string | null
          motivo?: string | null
          secullum_id?: number | null
        }
        Update: {
          atualizado_em?: string
          colaborador_id?: string
          fim?: string
          id?: string
          inicio?: string
          justificativa?: string | null
          motivo?: string | null
          secullum_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficio_contratos: {
        Row: {
          ate: string | null
          atualizado_em: string
          beneficio_id: string
          criado_em: string
          desde: string
          id: string
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
        }
        Insert: {
          ate?: string | null
          atualizado_em?: string
          beneficio_id: string
          criado_em?: string
          desde: string
          id?: string
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
        }
        Update: {
          ate?: string | null
          atualizado_em?: string
          beneficio_id?: string
          criado_em?: string
          desde?: string
          id?: string
          tipo_contrato?: Database["rh"]["Enums"]["tipo_contrato"]
        }
        Relationships: [
          {
            foreignKeyName: "beneficio_contratos_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficio_valores_mensais: {
        Row: {
          atualizado_em: string
          beneficio_id: string
          colaborador_id: string
          competencia: string
          criado_em: string
          id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          beneficio_id: string
          colaborador_id: string
          competencia: string
          criado_em?: string
          id?: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          beneficio_id?: string
          colaborador_id?: string
          competencia?: string
          criado_em?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "beneficio_valores_mensais_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficio_valores_mensais_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          dependente_regra: Database["rh"]["Enums"]["regra_dependente"]
          dependente_valor: number | null
          id: string
          nome: string
          rubricas_desconto: number[]
          rubricas_desconto_dependente: number[]
          tipo: Database["rh"]["Enums"]["tipo_beneficio"]
          valor_padrao: number | null
          valor_por_mes: boolean
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dependente_regra?: Database["rh"]["Enums"]["regra_dependente"]
          dependente_valor?: number | null
          id?: string
          nome: string
          rubricas_desconto?: number[]
          rubricas_desconto_dependente?: number[]
          tipo: Database["rh"]["Enums"]["tipo_beneficio"]
          valor_padrao?: number | null
          valor_por_mes?: boolean
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dependente_regra?: Database["rh"]["Enums"]["regra_dependente"]
          dependente_valor?: number | null
          id?: string
          nome?: string
          rubricas_desconto?: number[]
          rubricas_desconto_dependente?: number[]
          tipo?: Database["rh"]["Enums"]["tipo_beneficio"]
          valor_padrao?: number | null
          valor_por_mes?: boolean
        }
        Relationships: []
      }
      cargos: {
        Row: {
          atualizado_em: string
          cbo: string | null
          codigo_folha: number | null
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          atualizado_em?: string
          cbo?: string | null
          codigo_folha?: number | null
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          atualizado_em?: string
          cbo?: string | null
          codigo_folha?: number | null
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      colaborador_beneficios: {
        Row: {
          ate: string | null
          atualizado_em: string
          beneficio_id: string
          colaborador_id: string
          criado_em: string
          desde: string
          id: string
          valor_manual: number | null
        }
        Insert: {
          ate?: string | null
          atualizado_em?: string
          beneficio_id: string
          colaborador_id: string
          criado_em?: string
          desde: string
          id?: string
          valor_manual?: number | null
        }
        Update: {
          ate?: string | null
          atualizado_em?: string
          beneficio_id?: string
          colaborador_id?: string
          criado_em?: string
          desde?: string
          id?: string
          valor_manual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_beneficios_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_beneficios_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          admissao: string | null
          atualizado_em: string
          cargo_id: string | null
          copiloto_id: string
          criado_em: string
          decisao_desligamento_copiloto: string | null
          departamento_id: string | null
          desligamento: string | null
          fora_do_ponto: boolean
          id: string
          matricula: number | null
          motivo_desligamento_copiloto: string | null
          motivo_desligamento_id: string | null
          nascimento: string | null
          nome: string
          secullum_id: number | null
          situacao_copiloto: string | null
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"] | null
        }
        Insert: {
          admissao?: string | null
          atualizado_em?: string
          cargo_id?: string | null
          copiloto_id: string
          criado_em?: string
          decisao_desligamento_copiloto?: string | null
          departamento_id?: string | null
          desligamento?: string | null
          fora_do_ponto?: boolean
          id?: string
          matricula?: number | null
          motivo_desligamento_copiloto?: string | null
          motivo_desligamento_id?: string | null
          nascimento?: string | null
          nome: string
          secullum_id?: number | null
          situacao_copiloto?: string | null
          tipo_contrato?: Database["rh"]["Enums"]["tipo_contrato"] | null
        }
        Update: {
          admissao?: string | null
          atualizado_em?: string
          cargo_id?: string | null
          copiloto_id?: string
          criado_em?: string
          decisao_desligamento_copiloto?: string | null
          departamento_id?: string | null
          desligamento?: string | null
          fora_do_ponto?: boolean
          id?: string
          matricula?: number | null
          motivo_desligamento_copiloto?: string | null
          motivo_desligamento_id?: string | null
          nascimento?: string | null
          nome?: string
          secullum_id?: number | null
          situacao_copiloto?: string | null
          tipo_contrato?: Database["rh"]["Enums"]["tipo_contrato"] | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_motivo_desligamento_id_fkey"
            columns: ["motivo_desligamento_id"]
            isOneToOne: false
            referencedRelation: "motivos_desligamento"
            referencedColumns: ["id"]
          },
        ]
      }
      custos_colaborador: {
        Row: {
          beneficios: number
          calculado_em: string
          cargo_id: string | null
          colaborador_id: string
          competencia: string
          custo_hora: number | null
          custo_total: number
          departamento_id: string | null
          encargos: number
          jornada_min: number | null
          memoria: Json
          multa_rescisoria: number
          provisao_13: number
          provisao_ferias: number
          reembolsos: number
          remuneracao: number
          rescisao: number
          salario_hora: number | null
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
          valor_informado: boolean
        }
        Insert: {
          beneficios?: number
          calculado_em?: string
          cargo_id?: string | null
          colaborador_id: string
          competencia: string
          custo_hora?: number | null
          custo_total: number
          departamento_id?: string | null
          encargos?: number
          jornada_min?: number | null
          memoria: Json
          multa_rescisoria?: number
          provisao_13?: number
          provisao_ferias?: number
          reembolsos?: number
          remuneracao?: number
          rescisao?: number
          salario_hora?: number | null
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
          valor_informado?: boolean
        }
        Update: {
          beneficios?: number
          calculado_em?: string
          cargo_id?: string | null
          colaborador_id?: string
          competencia?: string
          custo_hora?: number | null
          custo_total?: number
          departamento_id?: string | null
          encargos?: number
          jornada_min?: number | null
          memoria?: Json
          multa_rescisoria?: number
          provisao_13?: number
          provisao_ferias?: number
          reembolsos?: number
          remuneracao?: number
          rescisao?: number
          salario_hora?: number | null
          tipo_contrato?: Database["rh"]["Enums"]["tipo_contrato"]
          valor_informado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "custos_colaborador_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custos_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custos_colaborador_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_financeiros_mensais: {
        Row: {
          atualizado_em: string
          competencia: string
          criado_em: string
          custo_despesa_total: number | null
          custos_operacionais_sem_pessoal: number | null
          endomarketing: number | null
          faturamento_bruto: number | null
          lucro: number | null
          origem: Database["rh"]["Enums"]["origem_valor"]
        }
        Insert: {
          atualizado_em?: string
          competencia: string
          criado_em?: string
          custo_despesa_total?: number | null
          custos_operacionais_sem_pessoal?: number | null
          endomarketing?: number | null
          faturamento_bruto?: number | null
          lucro?: number | null
          origem?: Database["rh"]["Enums"]["origem_valor"]
        }
        Update: {
          atualizado_em?: string
          competencia?: string
          criado_em?: string
          custo_despesa_total?: number | null
          custos_operacionais_sem_pessoal?: number | null
          endomarketing?: number | null
          faturamento_bruto?: number | null
          lucro?: number | null
          origem?: Database["rh"]["Enums"]["origem_valor"]
        }
        Relationships: []
      }
      departamentos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo_folha: number | null
          criado_em: string
          id: string
          nome: string
          secullum_id: number | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo_folha?: number | null
          criado_em?: string
          id?: string
          nome: string
          secullum_id?: number | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo_folha?: number | null
          criado_em?: string
          id?: string
          nome?: string
          secullum_id?: number | null
        }
        Relationships: []
      }
      dependentes: {
        Row: {
          atualizado_em: string
          colaborador_id: string
          copiloto_id: string
          criado_em: string
          id: string
          nascimento: string | null
          nome: string
          parentesco: string | null
          tem_odonto: boolean
          tem_plano: boolean
        }
        Insert: {
          atualizado_em?: string
          colaborador_id: string
          copiloto_id: string
          criado_em?: string
          id?: string
          nascimento?: string | null
          nome: string
          parentesco?: string | null
          tem_odonto?: boolean
          tem_plano?: boolean
        }
        Update: {
          atualizado_em?: string
          colaborador_id?: string
          copiloto_id?: string
          criado_em?: string
          id?: string
          nascimento?: string | null
          nome?: string
          parentesco?: string | null
          tem_odonto?: boolean
          tem_plano?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dependentes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      encargos_por_contrato: {
        Row: {
          aplica_rat: boolean
          atualizado_em: string
          criado_em: string
          fgts_pct: number
          inss_patronal_pct: number
          multa_rescisoria_pct: number
          provisiona_13: boolean
          provisiona_ferias: boolean
          provisiona_recesso: boolean
          terceiros_pct: number
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
          vigente_desde: string
        }
        Insert: {
          aplica_rat: boolean
          atualizado_em?: string
          criado_em?: string
          fgts_pct: number
          inss_patronal_pct: number
          multa_rescisoria_pct: number
          provisiona_13: boolean
          provisiona_ferias: boolean
          provisiona_recesso?: boolean
          terceiros_pct: number
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
          vigente_desde: string
        }
        Update: {
          aplica_rat?: boolean
          atualizado_em?: string
          criado_em?: string
          fgts_pct?: number
          inss_patronal_pct?: number
          multa_rescisoria_pct?: number
          provisiona_13?: boolean
          provisiona_ferias?: boolean
          provisiona_recesso?: boolean
          terceiros_pct?: number
          tipo_contrato?: Database["rh"]["Enums"]["tipo_contrato"]
          vigente_desde?: string
        }
        Relationships: []
      }
      folha_colaboradores: {
        Row: {
          base_fgts: number | null
          base_inss: number | null
          cargo_id: string | null
          colaborador_id: string
          departamento_codigo_folha: number | null
          departamento_id: string | null
          folha_id: string
          horas_mes_min: number | null
          liquido: number | null
          salario: number | null
          situacao: Database["rh"]["Enums"]["situacao_folha"]
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
          valor_fgts: number | null
        }
        Insert: {
          base_fgts?: number | null
          base_inss?: number | null
          cargo_id?: string | null
          colaborador_id: string
          departamento_codigo_folha?: number | null
          departamento_id?: string | null
          folha_id: string
          horas_mes_min?: number | null
          liquido?: number | null
          salario?: number | null
          situacao: Database["rh"]["Enums"]["situacao_folha"]
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
          valor_fgts?: number | null
        }
        Update: {
          base_fgts?: number | null
          base_inss?: number | null
          cargo_id?: string | null
          colaborador_id?: string
          departamento_codigo_folha?: number | null
          departamento_id?: string | null
          folha_id?: string
          horas_mes_min?: number | null
          liquido?: number | null
          salario?: number | null
          situacao?: Database["rh"]["Enums"]["situacao_folha"]
          tipo_contrato?: Database["rh"]["Enums"]["tipo_contrato"]
          valor_fgts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_colaboradores_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_colaboradores_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_colaboradores_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_colaboradores_folha_id_fkey"
            columns: ["folha_id"]
            isOneToOne: false
            referencedRelation: "folhas"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_rubricas: {
        Row: {
          colaborador_id: string
          folha_id: string
          id: number
          natureza: Database["rh"]["Enums"]["natureza_rubrica"]
          referencia: number | null
          rubrica_codigo: number
          valor: number
        }
        Insert: {
          colaborador_id: string
          folha_id: string
          id?: never
          natureza: Database["rh"]["Enums"]["natureza_rubrica"]
          referencia?: number | null
          rubrica_codigo: number
          valor: number
        }
        Update: {
          colaborador_id?: string
          folha_id?: string
          id?: never
          natureza?: Database["rh"]["Enums"]["natureza_rubrica"]
          referencia?: number | null
          rubrica_codigo?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_rubricas_folha_id_colaborador_id_fkey"
            columns: ["folha_id", "colaborador_id"]
            isOneToOne: false
            referencedRelation: "folha_colaboradores"
            referencedColumns: ["folha_id", "colaborador_id"]
          },
          {
            foreignKeyName: "folha_rubricas_rubrica_codigo_fkey"
            columns: ["rubrica_codigo"]
            isOneToOne: false
            referencedRelation: "rubricas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      folhas: {
        Row: {
          atualizado_em: string
          competencia: string
          criado_em: string
          fechada_em: string | null
          fechada_por: string | null
          ficticia: boolean
          id: string
          importacao_id: string | null
          resumo_empresa: Json
          status: Database["rh"]["Enums"]["status_folha"]
        }
        Insert: {
          atualizado_em?: string
          competencia: string
          criado_em?: string
          fechada_em?: string | null
          fechada_por?: string | null
          ficticia?: boolean
          id?: string
          importacao_id?: string | null
          resumo_empresa?: Json
          status?: Database["rh"]["Enums"]["status_folha"]
        }
        Update: {
          atualizado_em?: string
          competencia?: string
          criado_em?: string
          fechada_em?: string | null
          fechada_por?: string | null
          ficticia?: boolean
          id?: string
          importacao_id?: string | null
          resumo_empresa?: Json
          status?: Database["rh"]["Enums"]["status_folha"]
        }
        Relationships: []
      }
      jornadas: {
        Row: {
          atualizado_em: string
          cargo_id: string | null
          colaborador_id: string | null
          criado_em: string
          departamento_id: string | null
          horas_mes_min: number
          id: string
          vigente_desde: string
        }
        Insert: {
          atualizado_em?: string
          cargo_id?: string | null
          colaborador_id?: string | null
          criado_em?: string
          departamento_id?: string | null
          horas_mes_min: number
          id?: string
          vigente_desde: string
        }
        Update: {
          atualizado_em?: string
          cargo_id?: string | null
          colaborador_id?: string | null
          criado_em?: string
          departamento_id?: string | null
          horas_mes_min?: number
          id?: string
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_desligamento: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string
          id: string
          secullum_id: number | null
          tipo_turnover: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao: string
          id?: string
          secullum_id?: number | null
          tipo_turnover?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string
          id?: string
          secullum_id?: number | null
          tipo_turnover?: string | null
        }
        Relationships: []
      }
      notas_pj: {
        Row: {
          atualizado_em: string
          colaborador_id: string
          competencia: string
          criado_em: string
          id: string
          numero_documento: string
          origem: Database["rh"]["Enums"]["origem_valor"]
          valor: number
        }
        Insert: {
          atualizado_em?: string
          colaborador_id: string
          competencia: string
          criado_em?: string
          id?: string
          numero_documento: string
          origem?: Database["rh"]["Enums"]["origem_valor"]
          valor: number
        }
        Update: {
          atualizado_em?: string
          colaborador_id?: string
          competencia?: string
          criado_em?: string
          id?: string
          numero_documento?: string
          origem?: Database["rh"]["Enums"]["origem_valor"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_pj_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_endomarketing: {
        Row: {
          ano: number
          atualizado_em: string
          criado_em: string
          valor: number
        }
        Insert: {
          ano: number
          atualizado_em?: string
          criado_em?: string
          valor: number
        }
        Update: {
          ano?: number
          atualizado_em?: string
          criado_em?: string
          valor?: number
        }
        Relationships: []
      }
      parametros_empresa: {
        Row: {
          atualizado_em: string
          banco_horas_adicional_pct: number
          banco_horas_fim: string
          banco_horas_inicio: string
          criado_em: string
          fap: number
          rat_pct: number
          regime_tributario: string | null
          vigente_desde: string
        }
        Insert: {
          atualizado_em?: string
          banco_horas_adicional_pct?: number
          banco_horas_fim: string
          banco_horas_inicio: string
          criado_em?: string
          fap: number
          rat_pct: number
          regime_tributario?: string | null
          vigente_desde: string
        }
        Update: {
          atualizado_em?: string
          banco_horas_adicional_pct?: number
          banco_horas_fim?: string
          banco_horas_inicio?: string
          criado_em?: string
          fap?: number
          rat_pct?: number
          regime_tributario?: string | null
          vigente_desde?: string
        }
        Relationships: []
      }
      parametros_turnover: {
        Row: {
          acordo_conta_como: string
          atualizado_em: string
          criado_em: string
          formula_acordo: string | null
          formula_geral: string
          formula_involuntario: string | null
          formula_voluntario: string | null
          id: boolean
          motivos_involuntarios: string[]
          motivos_voluntarios: string[]
        }
        Insert: {
          acordo_conta_como?: string
          atualizado_em?: string
          criado_em?: string
          formula_acordo?: string | null
          formula_geral?: string
          formula_involuntario?: string | null
          formula_voluntario?: string | null
          id?: boolean
          motivos_involuntarios?: string[]
          motivos_voluntarios?: string[]
        }
        Update: {
          acordo_conta_como?: string
          atualizado_em?: string
          criado_em?: string
          formula_acordo?: string | null
          formula_geral?: string
          formula_involuntario?: string | null
          formula_voluntario?: string | null
          id?: boolean
          motivos_involuntarios?: string[]
          motivos_voluntarios?: string[]
        }
        Relationships: []
      }
      plano_coparticipacao: {
        Row: {
          colaborador_pct: number | null
          colaborador_valor_fixo: number | null
          meses_max: number | null
          meses_min: number
          tabela_id: string
        }
        Insert: {
          colaborador_pct?: number | null
          colaborador_valor_fixo?: number | null
          meses_max?: number | null
          meses_min: number
          tabela_id: string
        }
        Update: {
          colaborador_pct?: number | null
          colaborador_valor_fixo?: number | null
          meses_max?: number | null
          meses_min?: number
          tabela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_coparticipacao_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "plano_tabelas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_faixas_etarias: {
        Row: {
          idade_max: number | null
          idade_min: number
          mensalidade: number
          tabela_id: string
        }
        Insert: {
          idade_max?: number | null
          idade_min: number
          mensalidade: number
          tabela_id: string
        }
        Update: {
          idade_max?: number | null
          idade_min?: number
          mensalidade?: number
          tabela_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_faixas_etarias_tabela_id_fkey"
            columns: ["tabela_id"]
            isOneToOne: false
            referencedRelation: "plano_tabelas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_tabelas: {
        Row: {
          atualizado_em: string
          beneficio_id: string
          criado_em: string
          id: string
          importacao_id: string | null
          reajuste_pct: number | null
          vigente_desde: string
        }
        Insert: {
          atualizado_em?: string
          beneficio_id: string
          criado_em?: string
          id?: string
          importacao_id?: string | null
          reajuste_pct?: number | null
          vigente_desde: string
        }
        Update: {
          atualizado_em?: string
          beneficio_id?: string
          criado_em?: string
          id?: string
          importacao_id?: string | null
          reajuste_pct?: number | null
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_tabelas_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_diario: {
        Row: {
          abonos_min: Json
          atrasos_min: number
          atualizado_em: string
          banco_creditos_min: number
          banco_debitos_min: number
          banco_saldo_min: number
          batidas: Json
          colaborador_id: string
          competencia: string
          data: string
          extras_min: Json
          faltas_min: number
          normais_min: number
          noturnas_min: number
          ocorrencia: string | null
          previstas_min: number
          sync_run_id: string | null
        }
        Insert: {
          abonos_min?: Json
          atrasos_min?: number
          atualizado_em?: string
          banco_creditos_min?: number
          banco_debitos_min?: number
          banco_saldo_min?: number
          batidas?: Json
          colaborador_id: string
          competencia: string
          data: string
          extras_min?: Json
          faltas_min?: number
          normais_min?: number
          noturnas_min?: number
          ocorrencia?: string | null
          previstas_min?: number
          sync_run_id?: string | null
        }
        Update: {
          abonos_min?: Json
          atrasos_min?: number
          atualizado_em?: string
          banco_creditos_min?: number
          banco_debitos_min?: number
          banco_saldo_min?: number
          batidas?: Json
          colaborador_id?: string
          competencia?: string
          data?: string
          extras_min?: Json
          faltas_min?: number
          normais_min?: number
          noturnas_min?: number
          ocorrencia?: string | null
          previstas_min?: number
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_diario_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_mensal: {
        Row: {
          abonos_min: Json
          atrasos_min: number
          atualizado_em: string
          banco_creditos_min: number
          banco_debitos_min: number
          banco_saldo_min: number
          colaborador_id: string
          competencia: string
          departamento_id: string | null
          dsr_debito_min: number
          extras_min: Json
          faltas_dias: number
          faltas_min: number
          normais_min: number
          noturnas_min: number
          previstas_min: number
          sync_run_id: string | null
        }
        Insert: {
          abonos_min?: Json
          atrasos_min?: number
          atualizado_em?: string
          banco_creditos_min?: number
          banco_debitos_min?: number
          banco_saldo_min?: number
          colaborador_id: string
          competencia: string
          departamento_id?: string | null
          dsr_debito_min?: number
          extras_min?: Json
          faltas_dias?: number
          faltas_min?: number
          normais_min?: number
          noturnas_min?: number
          previstas_min?: number
          sync_run_id?: string | null
        }
        Update: {
          abonos_min?: Json
          atrasos_min?: number
          atualizado_em?: string
          banco_creditos_min?: number
          banco_debitos_min?: number
          banco_saldo_min?: number
          colaborador_id?: string
          competencia?: string
          departamento_id?: string | null
          dsr_debito_min?: number
          extras_min?: Json
          faltas_dias?: number
          faltas_min?: number
          normais_min?: number
          noturnas_min?: number
          previstas_min?: number
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_mensal_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_mensal_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      rubricas: {
        Row: {
          atualizado_em: string
          classificada_em: string | null
          classificada_por: string | null
          codigo: number
          criado_em: string
          descricao: string
          grupo: Database["rh"]["Enums"]["grupo_rubrica"]
        }
        Insert: {
          atualizado_em?: string
          classificada_em?: string | null
          classificada_por?: string | null
          codigo: number
          criado_em?: string
          descricao: string
          grupo?: Database["rh"]["Enums"]["grupo_rubrica"]
        }
        Update: {
          atualizado_em?: string
          classificada_em?: string | null
          classificada_por?: string | null
          codigo?: number
          criado_em?: string
          descricao?: string
          grupo?: Database["rh"]["Enums"]["grupo_rubrica"]
        }
        Relationships: []
      }
      valores_pj: {
        Row: {
          atualizado_em: string
          colaborador_id: string
          sync_run_id: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string
          colaborador_id: string
          sync_run_id?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string
          colaborador_id?: string
          sync_run_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "valores_pj_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: true
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      banco_horas_em_reais: {
        Args: { p_competencia: string }
        Returns: {
          adicional_pct: number
          colaboradores: number
          departamento_id: string
          folha: string
          positivo_min: number
          sem_salario: number
          valor: number
        }[]
      }
      custo_agregado: {
        Args: { fim: string; inicio: string }
        Returns: {
          beneficios: number
          cargo_id: string
          colaboradores: number
          competencia: string
          custo_total: number
          departamento_id: string
          encargos: number
          provisoes: number
          reembolsos: number
          remuneracao: number
          rescisao: number
          sem_valor: number
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
        }[]
      }
      excluir_folha: { Args: { p_folha_id: string }; Returns: string }
      gravar_custos: {
        Args: { p_competencia: string; p_linhas: Json }
        Returns: number
      }
      importar_folha: {
        Args: {
          p_departamentos?: Json
          p_folha: Json
          p_importacao_id: string
          p_substituir?: boolean
        }
        Returns: Json
      }
      importar_tabela_plano: {
        Args: {
          p_beneficio_id: string
          p_coparticipacao: Json
          p_faixas: Json
          p_importacao_id: string
          p_reajuste_pct: number
        }
        Returns: string
      }
      ponto_dos_dias: {
        Args: { ate: string; de: string }
        Returns: {
          abonos_min: Json
          atrasos_min: number
          banco_creditos_min: number
          banco_debitos_min: number
          banco_saldo_min: number
          colaborador_id: string
          departamento: string
          departamento_id: string
          extras_min: Json
          faltas_dias: number
          faltas_min: number
          matricula: number
          nome: string
          noturnas_min: number
          previstas_min: number
          primeiro_dia: string
        }[]
      }
      quadro_mensal: {
        Args: { fim: string; inicio: string }
        Returns: {
          colaboradores: number
          competencia: string
          departamento_id: string
          situacao: Database["rh"]["Enums"]["situacao_folha"]
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
        }[]
      }
      salvar_faixas_plano: {
        Args: { p_faixas: Json; p_tabela_id: string }
        Returns: undefined
      }
      salvar_pessoa_folha: {
        Args: {
          p_colaborador_id: string
          p_folha_id: string
          p_pessoa: Json
          p_rubricas: Json
        }
        Returns: undefined
      }
      socios: { Args: never; Returns: string[] }
    }
    Enums: {
      grupo_rubrica:
        | "salario"
        | "pro_labore"
        | "adicional"
        | "hora_extra"
        | "faltas_atrasos"
        | "afastamento_empresa"
        | "banco_horas"
        | "verbas_sem_encargos"
        | "adiantamento"
        | "afastamento"
        | "rescisao"
        | "pagamento_provisionado"
        | "beneficio_desconto"
        | "desconto_terceiros"
        | "imposto_funcionario"
        | "arredondamento"
        | "reembolso_inss"
        | "informativa"
        | "nao_classificada"
      natureza_rubrica: "provento" | "desconto" | "informativa"
      origem_valor: "manual" | "enet"
      regra_dependente: "nao_paga" | "percentual" | "valor_fixo"
      situacao_folha:
        | "trabalhando"
        | "ferias"
        | "doenca"
        | "acidente"
        | "aposentadoria"
        | "demitido"
      status_folha: "importada" | "conferida" | "fechada"
      tipo_beneficio:
        | "plano_saude"
        | "odonto"
        | "alimentacao"
        | "transporte"
        | "seguro"
        | "outro"
      tipo_contrato: "clt" | "aprendiz" | "estagiario" | "pj" | "pro_labore"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  calendario: {
    Enums: {},
  },
  comercial: {
    Enums: {},
  },
  core: {
    Enums: {
      direcao_meta: ["maior_melhor", "menor_melhor"],
      status_importacao: ["previa", "confirmada", "substituida", "revertida"],
      tipo_importacao: ["folha", "plano_saude"],
    },
  },
  financeiro: {
    Enums: {},
  },
  formularios: {
    Enums: {},
  },
  integracao: {
    Enums: {
      status_sync: ["rodando", "sucesso", "erro"],
    },
  },
  marketing: {
    Enums: {},
  },
  operacoes: {
    Enums: {},
  },
  os: {
    Enums: {
      execucao: ["interna", "terceirizada"],
      motivo_aguardando: [
        "material",
        "terceirizado",
        "lojista",
        "aprovacao",
        "outro",
      ],
      origem_chamado: [
        "sistema",
        "portal",
        "modelo",
        "preventiva",
        "recorrencia",
        "vistoria",
        "importacao",
      ],
      periodo_visita: ["manha", "tarde", "noite"],
      prioridade: ["baixa", "media", "alta", "urgente"],
      regra_rateio: ["hora_trabalhada", "manual", "percentual", "terceirizado"],
      resposta_ambiente: ["respondido", "nao_se_aplica", "pendente"],
      situacao_ativo: ["em_uso", "em_manutencao", "parado", "baixado"],
      status_agendamento: ["marcado", "remarcar", "cancelado", "realizado"],
      status_chamado: [
        "aberto",
        "em_andamento",
        "aguardando",
        "concluido",
        "fechado",
        "cancelado",
      ],
      status_destino: ["aberto", "em_andamento", "aguardando", "concluido"],
      status_vistoria: ["andamento", "finalizado", "cancelado"],
      tipo_chamado: ["tarefa", "solicitacao", "os", "aviso"],
      tipo_vistoria: ["entrada", "saida", "preventiva", "extraordinaria"],
      unidade_prazo: ["horas", "dias_uteis"],
    },
  },
  rh: {
    Enums: {
      grupo_rubrica: [
        "salario",
        "pro_labore",
        "adicional",
        "hora_extra",
        "faltas_atrasos",
        "afastamento_empresa",
        "banco_horas",
        "verbas_sem_encargos",
        "adiantamento",
        "afastamento",
        "rescisao",
        "pagamento_provisionado",
        "beneficio_desconto",
        "desconto_terceiros",
        "imposto_funcionario",
        "arredondamento",
        "reembolso_inss",
        "informativa",
        "nao_classificada",
      ],
      natureza_rubrica: ["provento", "desconto", "informativa"],
      origem_valor: ["manual", "enet"],
      regra_dependente: ["nao_paga", "percentual", "valor_fixo"],
      situacao_folha: [
        "trabalhando",
        "ferias",
        "doenca",
        "acidente",
        "aposentadoria",
        "demitido",
      ],
      status_folha: ["importada", "conferida", "fechada"],
      tipo_beneficio: [
        "plano_saude",
        "odonto",
        "alimentacao",
        "transporte",
        "seguro",
        "outro",
      ],
      tipo_contrato: ["clt", "aprendiz", "estagiario", "pj", "pro_labore"],
    },
  },
} as const
