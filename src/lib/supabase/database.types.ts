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
  integracao: {
    Tables: {
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
          copiloto_id: string | null
          decisao_desligamento_copiloto: string | null
          criado_em: string
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
          copiloto_id?: string | null
          decisao_desligamento_copiloto?: string | null
          criado_em?: string
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
          copiloto_id?: string | null
          decisao_desligamento_copiloto?: string | null
          criado_em?: string
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
          criado_em: string
          id: string
          nascimento: string | null
          nome: string
          tem_odonto: boolean
          tem_plano: boolean
        }
        Insert: {
          atualizado_em?: string
          colaborador_id: string
          criado_em?: string
          id?: string
          nascimento?: string | null
          nome: string
          tem_odonto?: boolean
          tem_plano?: boolean
        }
        Update: {
          atualizado_em?: string
          colaborador_id?: string
          criado_em?: string
          id?: string
          nascimento?: string | null
          nome?: string
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
          tipo_contrato: Database["rh"]["Enums"]["tipo_contrato"]
        }[]
      }
      gravar_custos: {
        Args: { p_competencia: string; p_linhas: Json }
        Returns: number
      }
      importar_tabela_plano: {
        Args: {
          p_beneficio_id: string
          p_coparticipacao: Json
          p_faixas: Json
          p_importacao_id: string
          p_reajuste_pct: number | null
        }
        Returns: string
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
      importar_folha: {
        Args: {
          p_departamentos?: Json
          p_folha: Json
          p_importacao_id: string
          p_substituir?: boolean
        }
        Returns: Json
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
    }
    Enums: {
      grupo_rubrica:
        | "salario"
        | "pro_labore"
        | "adicional"
        | "hora_extra"
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
  integracao: {
    Enums: {
      status_sync: ["rodando", "sucesso", "erro"],
    },
  },
  rh: {
    Enums: {
      grupo_rubrica: [
        "salario",
        "pro_labore",
        "adicional",
        "hora_extra",
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
