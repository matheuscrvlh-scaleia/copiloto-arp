import type { RespostaContextoSu } from "@arp/shared/sustentabilidade/contratos/base";
import {
  lucsDoTexto,
  type ParametrosEntrevista,
} from "@arp/shared/sustentabilidade/situacao";
import type { Selectable } from "kysely";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type {
  SustentabilidadeColetores,
  SustentabilidadeParametros,
} from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { contextoSu, exigirModulo } from "./acesso";
import * as repo from "./base.repository";

// Base do Módulo Sustentabilidade (o `base.ts` e o `contratos.ts` do sistema
// antigo): as configurações (parâmetros, validades por setor, coletores) e a
// cópia de leitura dos contratos. Padrão em docs/arquitetura.md; contrato do
// banco em docs/sustentabilidade.md.
//
// As funções que recebem `tx` rodam no escopo de quem chama. Com a `tx` do
// `comoUsuario`, o RLS dessas tabelas já é "alguma permissão do módulo"
// (sustentabilidade.acessa): quem não usa o módulo não lê. Com a `tx` do
// `comoServico` (rotina, link do parceiro), quem chama já conferiu o acesso.
// A API não guarda cache: cada pedido lê de novo.

export type Parametros = Selectable<SustentabilidadeParametros>;
export type Coletor = Selectable<SustentabilidadeColetores>;

/** Parâmetros do módulo (linha única). */
export async function parametros(tx: Tx): Promise<Parametros> {
  const p = await repo.parametros(tx);
  if (!p) throw new ErroDePermissao("Sem acesso ao módulo Sustentabilidade.");
  return p;
}

/** Validade da entrevista por setor econômico (meses). */
export async function validadesPorSetor(
  tx: Tx,
): Promise<Record<string, number>> {
  const linhas = await repo.validades(tx);
  return Object.fromEntries(linhas.map((s) => [s.setor, s.meses]));
}

/** Parâmetros no formato das regras de situação (@arp/shared/sustentabilidade). */
export async function parametrosDaEntrevista(
  tx: Tx,
): Promise<ParametrosEntrevista> {
  const p = await parametros(tx);
  const validadePorSetor = await validadesPorSetor(tx);
  return {
    mesesPrimeira: p.meses_primeira_entrevista,
    validadePadraoMeses: p.validade_padrao_meses,
    validadePorSetor,
    avisoDias: p.aviso_dias,
  };
}

/** Coletores cadastrados (ativos e inativos), na ordem da ronda. */
export function coletores(tx: Tx): Promise<Coletor[]> {
  return repo.coletores(tx);
}

// ------------------------------------------------------------ o que a tela lê

/** GET /contexto: os programas em que a pessoa lança e a data de hoje. */
export function contextoDaTela(ctx: Contexto): Promise<RespostaContextoSu> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const su = await contextoSu(tx, ctx);
    return { programas: su.programas, hoje: su.hoje, dadosDe: su.dadosDe };
  });
}

/** GET /parametros: a linha de parâmetros, para quem usa o módulo. */
export function parametrosDaTela(ctx: Contexto): Promise<Parametros> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    await exigirModulo(tx);
    return parametros(tx);
  });
}

/** GET /coletores: os coletores, para quem usa o módulo. */
export function coletoresDaTela(ctx: Contexto): Promise<Coletor[]> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    await exigirModulo(tx);
    return coletores(tx);
  });
}

// ---------------------------------------------------------------- contratos
// Cópia de leitura de os.lojas (o ENET não tem API; o cadastro das lojas é a
// fonte) em sustentabilidade.contratos, uma linha por loja (contrato), com
// as LUCs separadas. Nada aqui consulta o ENET nem grava em os.lojas. As
// colunas do módulo (ativação corrigida, validade específica, dispensa,
// chamado) não são tocadas, e os contratos de exemplo (loja_id null) ficam
// como estão.
//
// Service role, sem conferir permissão: quem chama já conferiu (a rotina
// diária, ou a tela de controle depois de ver que a pessoa usa entrevistas).

/** No máximo uma sincronização a cada tantos minutos ao abrir a tela. */
const INTERVALO_MIN = 10;
const LOTE = 500;

async function copiarLojas(tx: Tx, agora: Date): Promise<number> {
  const lojas = await repo.lojas(tx);
  const sincronizado_em = agora.toISOString();
  const linhas = lojas.map((l) => ({
    loja_id: l.id,
    contrato: l.contrato,
    cliente_nome: (l.locatario?.trim() || l.nome).slice(0, 300),
    cliente_doc: l.cnpj?.replace(/\D/g, "") || null,
    lucs: lucsDoTexto(l.luc),
    bloco: l.bloco,
    tipo_loja: l.tipo_loja,
    ramo: l.ramo,
    ativacao: l.ativacao,
    inicio: l.inicio,
    rescisao: l.rescisao,
    situacao: l.situacao === "encerrado" ? "encerrado" : "vigente",
    sincronizado_em,
  }));
  for (let i = 0; i < linhas.length; i += LOTE)
    await repo.gravarContratos(tx, linhas.slice(i, i + LOTE));
  return linhas.length;
}

/** Copia as lojas para os contratos. Devolve quantos contratos gravou. */
export function sincronizarContratos(agora = new Date()): Promise<number> {
  return banco.comoServico((tx) => copiarLojas(tx, agora));
}

/**
 * Sincroniza se a última foi há mais de INTERVALO_MIN minutos (ou nunca).
 * Para rodar sem esperar ao abrir a tela (`void sincronizarSeAntigo()`):
 * nunca lança.
 */
export async function sincronizarSeAntigo(agora = new Date()): Promise<void> {
  try {
    await banco.comoServico(async (tx) => {
      await repo.travarSincronizacao(tx);
      const data = await repo.ultimaSincronizacao(tx);
      const ultima = data ? new Date(data).getTime() : 0;
      if (agora.getTime() - ultima < INTERVALO_MIN * 60_000) return;
      await copiarLojas(tx, agora);
    });
  } catch (err) {
    // A tela já respondeu: fica o aviso no log e a rotina diária tenta de novo.
    log.error({ err }, "sincronizar contratos do Sustentabilidade");
  }
}
