import "server-only";
import { formatarData } from "@/lib/formato";
import { deBrasilia, hojeEmBrasilia } from "@/lib/os/tempo";
import {
  CATEGORIAS_DO_MODULO,
  type CategoriaDoModulo,
  MODULO_DOS_CHAMADOS,
  refDaEntrevista,
  rotaAplicar,
  tituloDoChamado,
} from "@/lib/sustentabilidade/entrevistas-chamados";
import {
  type ContratoControle,
  type EntrevistaResumo,
  type LinhaControle,
  linhasDoControle,
} from "@/lib/sustentabilidade/entrevistas-controle";
import type { ParametrosEntrevista } from "@/lib/sustentabilidade/situacao";
import { configDoSistema } from "@/server/os/automacao";
import { osAdmin } from "@/server/os/base";
import { type ChamadoCriado, criarChamadoSistema } from "@/server/os/criar";
import { cancelarPeloSistema } from "@/server/os/sistema";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, type Parametros, suAdmin } from "./base";
import { sincronizarContratos } from "./contratos";

// Rotinas diárias do Módulo Sustentabilidade (/api/cron/sustentabilidade) e
// os chamados que o módulo abre pelo sistema. Tudo pela service role, sem
// sessão: quem chama de uma ação confere a permissão antes.
//
// Para plugar uma rotina nova (clube, programas, RCC…): uma função
// `(agora: Date) => Promise<number>` (quantos registros criou ou mudou,
// idempotente) e uma linha em ROTINAS, no fim do arquivo.

const AUTOR = "Sistema (Sustentabilidade)";

// ---------------------------------------------------------------------------
// Categorias do módulo no Chamados (migration 20261116140000)
// ---------------------------------------------------------------------------

export interface CategoriaDoChamado {
  id: string;
  setorId: string;
}

/**
 * Categoria do Chamados pelo nome (as de CATEGORIAS_DO_MODULO), com o setor
 * dela. Procura no setor previsto e, se não achar, em Sustentabilidade (o
 * recolhimento fica lá quando não há o setor Operações). null se alguém
 * apagou a categoria.
 */
export async function categoriaDoModulo(
  nome: CategoriaDoModulo,
): Promise<CategoriaDoChamado | null> {
  const previsto =
    CATEGORIAS_DO_MODULO.find((c) => c.nome === nome)?.setor ??
    "Sustentabilidade";
  const { data, error } = await osAdmin()
    .from("categorias")
    .select("id, setor_id, setores!inner(nome)")
    .eq("nome", nome)
    .is("pai_id", null)
    .in("setores.nome", [previsto, "Sustentabilidade"]);
  if (error) throw new Error(`Categoria ${nome}: ${error.message}`);
  const linhas = (data ?? []) as unknown as {
    id: string;
    setor_id: string;
    setores: { nome: string };
  }[];
  const achada =
    linhas.find((l) => l.setores.nome === previsto) ?? linhas[0] ?? null;
  return achada ? { id: achada.id, setorId: achada.setor_id } : null;
}

/** Setor Sustentabilidade do Chamados (sem a categoria, o chamado vai para ele). */
async function setorSustentabilidade(): Promise<string> {
  const { data, error } = await osAdmin()
    .from("setores")
    .select("id")
    .eq("nome", "Sustentabilidade")
    .maybeSingle();
  if (error) throw new Error(`Setor Sustentabilidade: ${error.message}`);
  if (!data)
    throw new Error(
      "O setor Sustentabilidade não existe no Chamados: crie-o em Chamados › Configurações.",
    );
  return data.id;
}

/** Fim do expediente do dia (Brasília), como o prazo dos lembretes. */
export async function prazoNoDia(data: string): Promise<Date> {
  const { cal } = await configDoSistema();
  return deBrasilia(data, cal.expedienteFim);
}

// ---------------------------------------------------------------------------
// Chamado da entrevista
// ---------------------------------------------------------------------------

export interface ContratoDoChamado {
  id: string;
  loja_id: string | null;
  cliente_nome: string;
  lucs: string[];
}

/**
 * Abre o chamado "Entrevista de resíduos" do contrato, com prazo na data
 * dada (prevista ou validade), e guarda em contratos.chamado_id. O
 * "Executar" leva à tela de aplicar; só o módulo conclui.
 */
export async function abrirChamadoDaEntrevista(
  c: ContratoDoChamado,
  prazo: string | null,
  agora = new Date(),
): Promise<ChamadoCriado | null> {
  const [categoria, setorPadrao] = await Promise.all([
    categoriaDoModulo("Entrevista de resíduos"),
    setorSustentabilidade(),
  ]);
  const quando = prazo
    ? `Prevista para ${formatarData(prazo)}.`
    : "Sem data prevista: o contrato não tem data de inauguração. Corrija a data na ficha da entrevista.";
  const criado = await criarChamadoSistema(
    {
      setorId: categoria?.setorId ?? setorPadrao,
      categoriaId: categoria?.id ?? null,
      titulo: tituloDoChamado(c),
      descricao: `Entrevista de diagnóstico de resíduos do locatário. ${quando} Toque em Executar para abrir o questionário; o chamado fecha sozinho ao salvar a entrevista com as assinaturas.`,
      tipo: "tarefa",
      origem: "modulo",
      autorNome: AUTOR,
      prazo: prazo ? await prazoNoDia(prazo) : null,
      lojaId: c.loja_id,
      acaoUrl: rotaAplicar(c.id),
      acaoRotulo: "a entrevista",
      conclusaoExterna: true,
      origemModulo: MODULO_DOS_CHAMADOS,
      origemRef: refDaEntrevista(c.id),
    },
    agora,
  );
  if (criado) await guardarChamado(c.id, criado.id);
  return criado;
}

/** contratos.chamado_id (só a service role grava essa coluna). */
export async function guardarChamado(
  contratoId: string,
  chamadoId: string | null,
): Promise<void> {
  const { error } = await suAdmin()
    .from("contratos")
    .update({ chamado_id: chamadoId })
    .eq("id", contratoId);
  falhar(error);
}

/** Muda o prazo do chamado aberto (ativação corrigida, prazo específico). */
export async function mudarPrazoDoChamado(
  chamadoId: string,
  prazo: string | null,
): Promise<void> {
  const { error } = await osAdmin()
    .from("chamados")
    .update({ prazo: prazo ? (await prazoNoDia(prazo)).toISOString() : null })
    .eq("id", chamadoId)
    .in("status", ["aberto", "em_andamento", "aguardando"]);
  if (error) throw new Error(`Prazo do chamado: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Situação dos contratos sem sessão (rotina e ações que mexem no chamado)
// ---------------------------------------------------------------------------

export interface ConfigDaEntrevista {
  p: Parametros;
  entrevista: ParametrosEntrevista;
}

/** Parâmetros lidos pela service role (a rotina não tem sessão). */
export async function parametrosDoSistema(): Promise<ConfigDaEntrevista> {
  const db = suAdmin();
  const [p, s] = await Promise.all([
    db.from("parametros").select("*").eq("id", true).single(),
    db.from("setor_validades").select("setor, meses"),
  ]);
  falhar(p.error);
  falhar(s.error);
  return {
    p: p.data,
    entrevista: {
      mesesPrimeira: p.data.meses_primeira_entrevista,
      validadePadraoMeses: p.data.validade_padrao_meses,
      validadePorSetor: Object.fromEntries(
        s.data.map((x) => [x.setor, x.meses]),
      ),
      avisoDias: p.data.aviso_dias,
    },
  };
}

export const COLUNAS_CONTRATO =
  "id, loja_id, contrato, cliente_nome, cliente_doc, lucs, bloco, tipo_loja, ramo, ativacao, inicio, rescisao, situacao, ativacao_corrigida, validade_meses_especifica, dispensada_motivo, dispensada_em, chamado_id, exemplo" as const;

export const COLUNAS_RESUMO_ENTREVISTA =
  "id, contrato_id, data, tipo, setor, entrevistador_id, valida_ate, origem, formulario_versao, exemplo" as const;

/**
 * Linha do controle de um ou de todos os contratos, pela service role.
 * Só as entrevistas salvas contam.
 */
export async function situacaoDosContratos(
  hoje: string,
  contratoIds?: string[],
): Promise<{ linhas: LinhaControle[]; contratos: ContratoControle[] }> {
  const db = suAdmin();
  const [cfg, contratos, entrevistas] = await Promise.all([
    parametrosDoSistema(),
    lerTudo(() => {
      const q = db.from("contratos").select(COLUNAS_CONTRATO);
      return (contratoIds ? q.in("id", contratoIds) : q).order("id");
    }),
    lerTudo(() => {
      const q = db
        .from("entrevistas")
        .select(COLUNAS_RESUMO_ENTREVISTA)
        .eq("situacao", "salva");
      return (contratoIds ? q.in("contrato_id", contratoIds) : q).order("id");
    }),
  ]);
  const resumo: EntrevistaResumo[] = entrevistas.map((e) => ({
    ...e,
    tem_pdf: false,
  }));
  return {
    contratos,
    linhas: linhasDoControle({
      contratos,
      entrevistas: resumo,
      chamados: new Map(),
      nomes: new Map(),
      config: {
        hoje,
        parametros: cfg.entrevista,
        tiposLojaDispensados: cfg.p.tipos_loja_dispensados,
        dataInauguracao: cfg.p.data_inauguracao,
      },
    }),
  };
}

/** Chamados abertos das entrevistas, por contrato. */
async function chamadosAbertos(): Promise<Map<string, string>> {
  const linhas = await lerTudo(() =>
    osAdmin()
      .from("chamados")
      .select("id, origem_ref")
      .eq("origem_modulo", MODULO_DOS_CHAMADOS)
      .like("origem_ref", "entrevista:%")
      .in("status", ["aberto", "em_andamento", "aguardando"])
      .order("criado_em")
      .order("id"),
  );
  const mapa = new Map<string, string>();
  for (const l of linhas) {
    const contrato = l.origem_ref?.slice("entrevista:".length);
    if (contrato && !mapa.has(contrato)) mapa.set(contrato, l.id);
  }
  return mapa;
}

/** Motivo do cancelamento quando o contrato deixou de precisar da entrevista. */
export function motivoDoCancelamento(l: LinhaControle): string {
  if (l.situacao === "dispensada")
    return `Entrevista dispensada: ${l.dispensa ?? "sem motivo"}`;
  return `${l.fora ?? "Contrato fora da lista de entrevistas"}: a entrevista não é mais necessária.`;
}

/** Precisa de chamado aberto: na lista, não dispensado e sem entrevista em dia. */
export function precisaDeChamado(l: LinhaControle): boolean {
  return l.naLista && l.situacao !== "dispensada" && l.situacao !== "em_dia";
}

/**
 * Rotina diária das entrevistas: sincroniza os contratos; abre o chamado de
 * quem entra na lista sem entrevista válida (aguardando, pendente, vencida)
 * ou com a validade terminando (a vencer), com prazo na data prevista;
 * cancela o aberto de quem foi rescindido, encerrado, virou tipo dispensado
 * ou foi dispensado. Contratos de exemplo ficam de fora. Idempotente.
 */
export async function rotinaEntrevistas(agora: Date): Promise<number> {
  await sincronizarContratos(agora);
  const hoje = hojeEmBrasilia(agora);
  const [{ linhas, contratos }, abertos] = await Promise.all([
    situacaoDosContratos(hoje),
    chamadosAbertos(),
  ]);
  const porId = new Map(contratos.map((c) => [c.id, c]));
  let mudou = 0;
  for (const l of linhas) {
    const c = porId.get(l.id);
    if (!c || c.exemplo) continue;
    const aberto = abertos.get(l.id) ?? null;
    try {
      if (aberto && (!l.naLista || l.situacao === "dispensada")) {
        if (
          await cancelarPeloSistema({
            chamadoId: aberto,
            motivo: motivoDoCancelamento(l),
            autorNome: AUTOR,
          })
        )
          mudou++;
        if (c.chamado_id) await guardarChamado(c.id, null);
      } else if (!aberto && precisaDeChamado(l)) {
        if (await abrirChamadoDaEntrevista(c, l.dataPrevista, agora)) mudou++;
      } else if (aberto && c.chamado_id !== aberto) {
        await guardarChamado(c.id, aberto);
      } else if (!aberto && c.chamado_id) {
        await guardarChamado(c.id, null);
      }
    } catch (erro) {
      // Um contrato com problema não para os outros.
      console.error("rotina das entrevistas", c.id, erro);
    }
  }
  return mudou;
}

// ---------------------------------------------------------------------------
// Lista das rotinas (o cron roda todas, uma depois da outra)
// ---------------------------------------------------------------------------

export interface ResultadoRotina {
  chave: string;
  rotulo: string;
  ok: boolean;
  registros: number;
  erro?: string;
  ms: number;
}

export interface RotinaDoModulo {
  chave: string;
  rotulo: string;
  rodar: (agora: Date) => Promise<number>;
}

/** Plugue aqui as rotinas do clube, dos programas, do RCC… */
export const ROTINAS: RotinaDoModulo[] = [
  {
    chave: "entrevistas",
    rotulo: "Contratos e chamados das entrevistas",
    rodar: rotinaEntrevistas,
  },
  // import() na hora: clube.ts e programas.ts importam este arquivo.
  {
    chave: "clube",
    rotulo: "Chamados de renovação do termo do Clube",
    rodar: async (agora) => (await import("./clube")).rotinaClube(agora),
  },
  {
    chave: "programas",
    rotulo: "Chamados de cobrança de lançamento dos parceiros",
    rodar: async (agora) => {
      const r = await (await import("./programas")).rotinaProgramas(agora);
      return r.criados + r.concluidos + r.cancelados;
    },
  },
];

/** Roda todas; uma falha não impede as outras. */
export async function rodarRotinasSustentabilidade(
  agora = new Date(),
): Promise<ResultadoRotina[]> {
  const resultados: ResultadoRotina[] = [];
  for (const r of ROTINAS) {
    const inicio = Date.now();
    try {
      const registros = await r.rodar(agora);
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: true,
        registros,
        ms: Date.now() - inicio,
      });
    } catch (erro) {
      console.error("rotina do Sustentabilidade", r.chave, erro);
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: false,
        registros: 0,
        erro: erro instanceof Error ? erro.message : "falha desconhecida",
        ms: Date.now() - inicio,
      });
    }
  }
  return resultados;
}
