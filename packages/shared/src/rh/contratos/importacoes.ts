import { z } from "zod";
import { tabelaCadastrada } from "./beneficios";

// Configurações › Importações: Extrato Mensal da folha (rh.folha) e tabela
// de faixas do plano (rh.beneficios). Enviar → conferir a prévia →
// confirmar; a confirmação relê o arquivo guardado (nada vem da tela).

export const folhaImportada = z.object({
  id: z.string(),
  competencia: z.string(),
  status: z.string(),
  ficticia: z.boolean(),
  pessoas: z.number(),
  arquivo: z.string().nullable(),
  importadaEm: z.string().nullable(),
});
export type FolhaImportada = z.infer<typeof folhaImportada>;

/** GET /rh/importacoes: cada bloco só vem para quem tem a permissão dele. */
export const respostaImportacoes = z.object({
  folha: z
    .object({
      folhas: z.array(folhaImportada),
      /** Rubricas que vieram na folha e ainda não dizem como entram no custo. */
      pendentes: z.array(
        z.object({ codigo: z.number(), descricao: z.string() }),
      ),
      /** rh.custo_pessoal.individual: abre a folha para ver e editar. */
      individual: z.boolean(),
    })
    .nullable(),
  plano: z
    .object({
      /** Planos e odontos ativos. */
      planos: z.array(z.object({ id: z.string(), nome: z.string() })),
      tabelas: z.array(tabelaCadastrada),
    })
    .nullable(),
});
export type RespostaImportacoes = z.infer<typeof respostaImportacoes>;

// ---------------------------------------------------------------------------
// Folha
// ---------------------------------------------------------------------------

const contagem = z.record(z.string(), z.number());

/** POST /rh/folhas/previa (multipart, campo `arquivo`). */
export const previaDaFolha = z.object({
  importacaoId: z.string(),
  arquivo: z.string(),
  competencia: z.string(),
  empresa: z.string().nullable(),
  pessoas: z.number(),
  porTipo: contagem,
  porSituacao: contagem,
  conferencia: z.object({
    itens: z.array(
      z.object({
        chave: z.string(),
        titulo: z.string(),
        ok: z.boolean().nullable(),
        importado: z.number().nullable(),
        resumo: z.number().nullable(),
        nota: z.string().optional(),
      }),
    ),
    coerentes: z.number(),
    incoerentes: z.array(z.object({ matricula: z.number(), nome: z.string() })),
  }),
  rubricasNovas: z.array(
    z.object({ codigo: z.number(), descricao: z.string() }),
  ),
  /** Matrícula sem par no Copiloto RH: fica fora da folha gravada. */
  foraDoCopiloto: z.array(
    z.object({ matricula: z.number(), nome: z.string() }),
  ),
  /** Códigos de departamento da folha sem departamento cadastrado. */
  departamentosSemCodigo: z.array(
    z.object({ codigo: z.number(), pessoas: z.number() }),
  ),
  /** Departamentos que ainda não têm código da folha (opções do de-para). */
  departamentosLivres: z.array(z.object({ id: z.string(), nome: z.string() })),
  folhaExistente: z.object({ status: z.string() }).nullable(),
});
export type PreviaDaFolha = z.infer<typeof previaDaFolha>;

/**
 * POST /rh/folhas/confirmar. `dep_<código da folha>` = id do departamento
 * escolhido no de-para; `substituir` é a caixa "on".
 */
export const entradaConfirmarFolha = z.record(z.string(), z.string());

export const pessoaParaEditar = z.object({
  colaborador_id: z.string(),
  nome: z.string(),
  matricula: z.number().nullable(),
  situacao: z.string(),
  tipo_contrato: z.string(),
  departamento_id: z.string().nullable(),
  cargo_id: z.string().nullable(),
  horas_mes_min: z.number().nullable(),
  salario: z.number().nullable(),
  liquido: z.number().nullable(),
  rubricas: z.array(
    z.object({
      codigo: z.number(),
      descricao: z.string(),
      grupo: z.string(),
      natureza: z.string(),
      referencia: z.number().nullable(),
      valor: z.number(),
    }),
  ),
});
export type PessoaParaEditar = z.infer<typeof pessoaParaEditar>;

/** GET /rh/folhas/:id (rh.folha e rh.custo_pessoal.individual). */
export const respostaFolhaParaEditar = z.object({
  folha: z.object({
    id: z.string(),
    competencia: z.string(),
    status: z.string(),
    ficticia: z.boolean(),
  }),
  departamentos: z.array(z.object({ id: z.string(), nome: z.string() })),
  cargos: z.array(z.object({ id: z.string(), nome: z.string() })),
  rubricas: z.array(
    z.object({ codigo: z.number(), descricao: z.string(), grupo: z.string() }),
  ),
  pessoas: z.array(pessoaParaEditar),
});
export type RespostaFolhaParaEditar = z.infer<typeof respostaFolhaParaEditar>;

/**
 * PATCH /rh/folhas/:id/pessoas/:colaborador. Campos do formulário como
 * texto; `codigo`, `natureza`, `referencia` e `valor` são listas (uma
 * posição por linha de rubrica).
 */
export const entradaPessoaDaFolha = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

// ---------------------------------------------------------------------------
// Tabela do plano
// ---------------------------------------------------------------------------

/** POST /rh/planos/previa (multipart: beneficio_id, vigencia, reajuste, arquivo). */
export const previaDoPlano = z.object({
  importacaoId: z.string(),
  arquivo: z.string(),
  beneficio: z.object({ id: z.string(), nome: z.string() }),
  vigencia: z.string(),
  reajuste: z.number().nullable(),
  faixas: z.array(
    z.object({
      idade_min: z.number(),
      idade_max: z.number().nullable(),
      mensalidade: z.number(),
    }),
  ),
  coparticipacao: z.array(
    z.object({
      meses_min: z.number(),
      meses_max: z.number().nullable(),
      colaborador_pct: z.number().nullable(),
      colaborador_valor_fixo: z.number().nullable(),
      periodo: z.string(),
    }),
  ),
  avisos: z.array(z.string()),
  substitui: z.boolean(),
});
export type PreviaDoPlano = z.infer<typeof previaDoPlano>;

/** "5", "5,5" ou vazio → número ou null. */
const percentual = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s.replace(",", "."));
}, z.number().min(0).max(100).nullable());

const mes = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "informe o mês de vigência");

/** Campos do envio da planilha (validados no service, com a mensagem de antes). */
export const entradaEnvioDoPlano = z.object({
  beneficio_id: z.uuid("escolha o benefício"),
  // <input type="month">: "2026-07"
  vigencia: mes,
  reajuste: percentual,
});

/** POST /rh/planos/confirmar */
export const entradaConfirmarPlano = z.record(z.string(), z.string());
export const confirmacaoDoPlano = z.object({
  importacao_id: z.uuid(),
  beneficio_id: z.uuid(),
  reajuste: percentual,
});

/** PATCH /rh/planos/tabelas/:id/faixas: listas idade_min, idade_max e mensalidade. */
export const entradaFaixasDoPlano = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);
