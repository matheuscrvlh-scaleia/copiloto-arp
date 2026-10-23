"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import {
  lerFiltros,
  PREFERENCIA_FILTROS,
  PREFERENCIA_SEU_DIA,
  TELAS,
  type Tela,
} from "@/lib/os/lista";
import { passosDoMovimento } from "@/lib/os/quadro";
import { MOTIVOS_AGUARDANDO, PRIORIDADES, STATUS } from "@/lib/os/rotulos";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Json } from "@/lib/supabase/database.types";
import { primeiroErro } from "@/server/acoes";
import { contexto } from "@/server/os/base";
import {
  assumirOuIniciar,
  executarAcao,
  lerChamado,
} from "@/server/os/chamados";
import { gravarPreferencia } from "@/server/os/preferencias";
import {
  estadoDaLista,
  estadoDoQuadro,
  exportacaoDaLista,
  exportacaoDoQuadro,
} from "@/server/os/visoes";
import { alterarChamado } from "./chamados/actions";

// Ações das visões do dia a dia (listas, quadro e calendário): alterações
// rápidas, ações em lote, confirmar/reabrir na linha e as preferências da
// tela. O ciclo e as alterações passam pelas mesmas funções do detalhe do
// chamado (mesmas regras, textos na linha do tempo e notificações); o banco
// confere de novo quem pode (RLS e os.validar_chamado).

const SEM_ACESSO: EstadoAcao = { erro: "Você não tem acesso ao módulo." };
const id = z.uuid("chamado inválido");
const ids = z.array(id).min(1, "escolha ao menos um").max(200, "no máximo 200");

async function podeUsar(): Promise<boolean> {
  return (await contexto()).pode("os.acessar");
}

/** Resultado de várias alterações: "3 alterados" ou o que falhou. */
function resumo(
  resultados: EstadoAcao[],
  feito: (n: number) => string,
): EstadoAcao {
  const erros = resultados.filter((r) => r.erro);
  const certos = resultados.length - erros.length;
  if (!erros.length) return { ok: feito(certos) };
  const motivo = erros[0]?.erro ?? "Não foi possível alterar.";
  if (!certos) return { erro: motivo };
  return {
    erro: `${feito(certos)}; ${erros.length} não ${erros.length === 1 ? "pôde" : "puderam"}: ${motivo}`,
  };
}

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

// ---------------------------------------------------------------------------
// Alterações rápidas e em lote (responsável, prazo, prioridade)
// ---------------------------------------------------------------------------

async function alterarVarios(
  lista: string[],
  campos: Record<string, string>,
): Promise<EstadoAcao[]> {
  const resultados: EstadoAcao[] = [];
  // Um por vez: cada um passa pelas regras e vai para a linha do tempo.
  for (const chamado of lista) {
    const form = new FormData();
    form.set("id", chamado);
    for (const [k, v] of Object.entries(campos)) form.set(k, v);
    resultados.push(await alterarChamado({}, form));
  }
  return resultados;
}

const atribuicao = z.object({
  ids,
  responsavel: z.union([id, z.null()]),
});

/** Troca o responsável (null: volta para a fila do setor). */
export async function atribuirResponsavel(
  lista: string[],
  responsavel: string | null,
): Promise<EstadoAcao> {
  if (!(await podeUsar())) return SEM_ACESSO;
  const d = atribuicao.safeParse({ ids: lista, responsavel });
  if (!d.success) return primeiroErro(d.error);
  const r = resumo(
    await alterarVarios(d.data.ids, { responsavel: d.data.responsavel ?? "" }),
    (n) => plural(n, "chamado atribuído", "chamados atribuídos"),
  );
  refresh();
  return r;
}

const novoPrazo = z.object({
  ids,
  // "aaaa-mm-ddTHH:MM" em Brasília; null tira o prazo.
  prazo: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "data inválida"),
    z.null(),
  ]),
});

export async function mudarPrazo(
  lista: string[],
  prazo: string | null,
): Promise<EstadoAcao> {
  if (!(await podeUsar())) return SEM_ACESSO;
  const d = novoPrazo.safeParse({ ids: lista, prazo });
  if (!d.success) return primeiroErro(d.error, { prazo: "Prazo" });
  const r = resumo(
    await alterarVarios(d.data.ids, { prazo: d.data.prazo ?? "" }),
    (n) => plural(n, "prazo alterado", "prazos alterados"),
  );
  refresh();
  return r;
}

const novaPrioridade = z.object({
  ids,
  prioridade: z.enum(Object.keys(PRIORIDADES) as [keyof typeof PRIORIDADES]),
});

export async function mudarPrioridade(
  lista: string[],
  prioridade: string,
): Promise<EstadoAcao> {
  if (!(await podeUsar())) return SEM_ACESSO;
  const d = novaPrioridade.safeParse({ ids: lista, prioridade });
  if (!d.success) return primeiroErro(d.error, { prioridade: "Prioridade" });
  const r = resumo(
    await alterarVarios(d.data.ids, { prioridade: d.data.prioridade }),
    (n) => plural(n, "prioridade alterada", "prioridades alteradas"),
  );
  refresh();
  return r;
}

// ---------------------------------------------------------------------------
// Ciclo: confirmar e reabrir na linha; arrastar no quadro
// ---------------------------------------------------------------------------

export async function confirmarChamado(chamado: string): Promise<EstadoAcao> {
  if (!(await podeUsar())) return SEM_ACESSO;
  if (!id.safeParse(chamado).success) return { erro: "Chamado inválido." };
  const r = await executarAcao(chamado, "confirmar");
  if (r.erro) return r;
  refresh();
  return { ok: "Confirmado e fechado." };
}

const reabertura = z.object({
  chamado: id,
  motivo: z
    .string()
    .trim()
    .min(3, "conte por que está reabrindo")
    .max(1000, "máximo de 1000 caracteres"),
});

export async function reabrirChamado(
  chamado: string,
  motivo: string,
): Promise<EstadoAcao> {
  if (!(await podeUsar())) return SEM_ACESSO;
  const d = reabertura.safeParse({ chamado, motivo });
  if (!d.success) return primeiroErro(d.error, { motivo: "Motivo" });
  const r = await executarAcao(d.data.chamado, "reabrir", {
    motivo: d.data.motivo,
  });
  if (r.erro) return r;
  refresh();
  return { ok: "Reaberto. O responsável foi avisado." };
}

const movimento = z.object({
  chamado: id,
  para: z.enum(Object.keys(STATUS) as [keyof typeof STATUS]),
  aguardandoTipo: z
    .enum(Object.keys(MOTIVOS_AGUARDANDO) as [keyof typeof MOTIVOS_AGUARDANDO])
    .optional(),
  motivo: z.string().trim().max(1000, "máximo de 1000 caracteres").optional(),
});

/**
 * Cartão solto noutra coluna do quadro: vira as ações do detalhe (iniciar,
 * aguardar, concluir, confirmar, reabrir, devolver), na ordem.
 */
export async function moverChamado(entrada: {
  chamado: string;
  para: string;
  aguardandoTipo?: string;
  motivo?: string;
}): Promise<EstadoAcao> {
  if (!(await podeUsar())) return SEM_ACESSO;
  const d = movimento.safeParse(entrada);
  if (!d.success) return primeiroErro(d.error, { motivo: "Motivo" });
  const ch = await lerChamado(d.data.chamado);
  if (!ch) return { erro: "Chamado não encontrado ou sem acesso." };
  const passos = passosDoMovimento(ch.status, d.data.para);
  if (!passos.length)
    return {
      erro: `Não dá para passar de ${STATUS[ch.status]} para ${STATUS[d.data.para]}.`,
    };
  for (const passo of passos) {
    const r =
      passo === "iniciar"
        ? await assumirOuIniciar(ch.id)
        : await executarAcao(ch.id, passo, {
            aguardandoTipo: d.data.aguardandoTipo,
            motivo: d.data.motivo,
          });
    if (r.erro) {
      refresh();
      return r;
    }
  }
  refresh();
  return { ok: "Movido." };
}

// ---------------------------------------------------------------------------
// Exportação das listas paginadas: o resultado filtrado inteiro, no clique
// ---------------------------------------------------------------------------

const telaLista = z.enum(["caixa", "setor", "abertos"]);
/** Parâmetros da URL da tela (filtros, cartão, busca, ordem). */
const parametrosDaUrl = z
  .record(z.string().max(40), z.string().max(400))
  .refine((p) => Object.keys(p).length <= 40, "parâmetros demais");

interface Planilha {
  colunas: ColunaExportar[];
  linhas: CelulaExportar[][];
}

async function podeExportar(): Promise<boolean> {
  const ctx = await contexto();
  return ctx.pode("os.acessar") && ctx.pode("os.exportar");
}

/**
 * Minha caixa, Meu setor e Abertos por mim: lê com os mesmos filtros da
 * tela (a URL, ou os lembrados), em lotes de 1000. Lança se não puder: o
 * botão mostra o erro.
 */
export async function exportarLista(
  tela: string,
  busca: Record<string, string>,
): Promise<Planilha> {
  const t = telaLista.safeParse(tela);
  const p = parametrosDaUrl.safeParse(busca);
  if (!t.success || !p.success) throw new Error("Pedido inválido.");
  if (!(await podeExportar())) throw new Error("Sem permissão para exportar.");
  return exportacaoDaLista(await estadoDaLista(t.data, p.data));
}

/** Quadro: todas as colunas consultadas, inteiras. */
export async function exportarQuadro(
  busca: Record<string, string>,
): Promise<Planilha> {
  const p = parametrosDaUrl.safeParse(busca);
  if (!p.success) throw new Error("Pedido inválido.");
  if (!(await podeExportar())) throw new Error("Sem permissão para exportar.");
  return exportacaoDoQuadro(await estadoDoQuadro(p.data));
}

// ---------------------------------------------------------------------------
// Preferências da tela
// ---------------------------------------------------------------------------

const tela = z.enum(Object.keys(TELAS) as [Tela, ...Tela[]]);

/** Lembra os filtros da tela para a próxima visita (só os válidos). */
export async function lembrarFiltros(
  qual: string,
  valores: Record<string, string>,
): Promise<void> {
  const t = tela.safeParse(qual);
  if (!t.success || !(await podeUsar())) return;
  await gravarPreferencia(
    PREFERENCIA_FILTROS[t.data],
    lerFiltros(t.data, valores) as Json,
  );
}

/** "Seu dia" visto hoje: não aparece de novo até amanhã. */
export async function marcarSeuDiaVisto(): Promise<void> {
  if (!(await podeUsar())) return;
  await gravarPreferencia(PREFERENCIA_SEU_DIA, {
    dia: hojeEmBrasilia(new Date()),
  });
}
