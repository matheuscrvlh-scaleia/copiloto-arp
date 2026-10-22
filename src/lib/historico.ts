import { z } from "zod";
import { dataValida } from "@/lib/periodo";

// Histórico de alterações (Administração): nomes na tela, filtros da URL e
// o que mudou entre o antes e o depois. Funções puras; a consulta fica no
// banco (core.historico).

export const MODULOS = {
  acesso: "Acesso",
  admin: "Administração",
  rh: "RH",
  financeiro: "Financeiro",
  integracoes: "Integrações",
} as const;
export type Modulo = keyof typeof MODULOS;

export const TIPOS = {
  alteracao: "Alteração de dados",
  evento: "Evento do sistema",
  sincronizacao: "Sincronização",
} as const;
export type Tipo = keyof typeof TIPOS;

/** Nome na tela de cada tabela que vai para a auditoria. */
export const TABELAS: Record<string, string> = {
  "core.usuarios": "Usuário",
  "core.usuario_permissoes": "Permissão individual",
  "core.cargos": "Cargo de acesso",
  "core.cargo_permissoes": "Permissão do cargo",
  "core.empresa": "Dados da empresa",
  "core.metas": "Metas",
  "core.importacoes": "Importação de arquivo",
  "integracao.credenciais": "Credencial de integração",
  "rh.parametros_empresa": "Empresa (RAT, FAP, banco de horas)",
  "rh.parametros_turnover": "Configuração do turnover",
  "rh.encargos_por_contrato": "Encargos",
  "rh.departamentos": "Departamentos",
  "rh.motivos_desligamento": "Motivos de desligamento",
  "rh.rubricas": "Rubricas",
  "rh.jornadas": "Jornadas",
  "rh.beneficios": "Benefícios",
  "rh.colaborador_beneficios": "Benefício de funcionário",
  "rh.plano_tabelas": "Tabela do plano de saúde",
  "rh.plano_faixas_etarias": "Faixas do plano de saúde",
  "rh.folha_colaboradores": "Folha (pessoa editada)",
  "rh.dados_financeiros_mensais": "Faturamento e dados financeiros",
  "rh.orcamento_endomarketing": "Orçamento de endomarketing",
};

const ACOES_ALTERACAO: Record<string, string> = {
  insert: "Criou",
  update: "Alterou",
  delete: "Removeu",
};

const STATUS_SYNC: Record<string, string> = {
  sucesso: "Concluída",
  erro: "Falhou",
  rodando: "Rodando",
};

/** Eventos gravados em core.logs pelo servidor (src/server/logs.ts). */
export const EVENTOS = {
  login: "Entrou",
  login_falhou: "Errou o login",
  logout: "Saiu",
  senha_definida: "Definiu a própria senha",
  usuario_criado: "Criou usuário",
  senha_trocada: "Trocou a senha de usuário",
  integracao_testada: "Testou a conexão",
  sincronizacao_pedida: "Pediu sincronização",
  custo_recalculado: "Recalculou o custo",
} as const;
export type Evento = keyof typeof EVENTOS;

export interface LinhaHistorico {
  tipo: Tipo;
  id: string;
  em: string;
  modulo: Modulo;
  usuarioId: string | null;
  usuarioNome: string | null;
  acao: string;
  /** Tabela (alteração) ou sistema (sincronização). */
  objeto: string | null;
  registroId: string | null;
  descricao: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

export function rotuloDaAcao(l: Pick<LinhaHistorico, "tipo" | "acao">) {
  if (l.tipo === "alteracao") return ACOES_ALTERACAO[l.acao] ?? l.acao;
  if (l.tipo === "sincronizacao") return STATUS_SYNC[l.acao] ?? l.acao;
  return EVENTOS[l.acao as Evento] ?? l.acao;
}

export const rotuloDaTabela = (tabela: string) => TABELAS[tabela] ?? tabela;

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tabelas cujo nome na tela contém o que foi buscado (sem acento). */
export function tabelasQueCasam(busca: string): string[] {
  const termo = sem(busca.trim());
  if (!termo) return [];
  return Object.entries(TABELAS)
    .filter(([, nome]) => sem(nome).includes(termo))
    .map(([tabela]) => tabela);
}

// ---------------------------------------------------------------------------
// Filtros na URL (?q=…&modulo=rh&tipo=evento&quem=<uuid>&de=…&ate=…&pagina=2)
// ---------------------------------------------------------------------------

export const POR_PAGINA = 50;

export interface FiltrosHistorico {
  busca: string;
  modulo: Modulo | null;
  tipo: Tipo | null;
  usuario: string | null;
  de: string | null;
  ate: string | null;
  pagina: number;
}

const primeiro = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const daLista = <T extends string>(lista: Record<T, string>) =>
  z.preprocess(
    primeiro,
    z
      .string()
      .refine((v): v is T => v in lista)
      .nullable()
      .catch(null),
  );

const esquema = z.object({
  q: z.preprocess(primeiro, z.string().trim().max(100).catch("")),
  modulo: daLista(MODULOS),
  tipo: daLista(TIPOS),
  quem: z.preprocess(primeiro, z.uuid().nullable().catch(null)),
  de: z.preprocess(
    primeiro,
    z.string().refine(dataValida).nullable().catch(null),
  ),
  ate: z.preprocess(
    primeiro,
    z.string().refine(dataValida).nullable().catch(null),
  ),
  pagina: z.preprocess(
    primeiro,
    z.coerce.number().int().min(1).max(10_000).catch(1),
  ),
});

export function lerFiltrosHistorico(
  busca: Record<string, string | string[] | undefined>,
): FiltrosHistorico {
  // Valor inválido na URL vira "sem filtro", nunca erro.
  const f = esquema.parse(busca);
  // Datas trocadas viram o intervalo certo.
  const [de, ate] =
    f.de && f.ate && f.de > f.ate ? [f.ate, f.de] : [f.de, f.ate];
  return {
    busca: f.q,
    modulo: f.modulo as Modulo | null,
    tipo: f.tipo as Tipo | null,
    usuario: f.quem,
    de,
    ate,
    pagina: f.pagina,
  };
}

/** Link da mesma busca em outra página. */
export function urlDaPagina(f: FiltrosHistorico, pagina: number): string {
  const p = new URLSearchParams();
  if (f.busca) p.set("q", f.busca);
  if (f.modulo) p.set("modulo", f.modulo);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.usuario) p.set("quem", f.usuario);
  if (f.de) p.set("de", f.de);
  if (f.ate) p.set("ate", f.ate);
  if (pagina > 1) p.set("pagina", String(pagina));
  const qs = p.toString();
  return qs ? `?${qs}` : "?";
}

// ---------------------------------------------------------------------------
// O que mudou
// ---------------------------------------------------------------------------

/** Colunas que mudam sozinhas e não dizem nada a quem lê. */
const IGNORAR = new Set(["atualizado_em", "criado_em"]);

export interface Diferenca {
  campo: string;
  antes: string | null;
  depois: string | null;
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "sim" : "não";
  return JSON.stringify(v);
}

/**
 * Campos que mudaram. Ao criar, todos os preenchidos; ao remover, todos os
 * que havia; ao alterar, só os diferentes.
 */
export function diferencas(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): Diferenca[] {
  const campos = [
    ...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]),
  ].filter((c) => !IGNORAR.has(c));
  return campos
    .map((campo) => ({
      campo,
      antes: antes ? texto(antes[campo]) : null,
      depois: depois ? texto(depois[campo]) : null,
    }))
    .filter((d) =>
      antes && depois
        ? d.antes !== d.depois
        : d.antes !== null || d.depois !== null,
    );
}
