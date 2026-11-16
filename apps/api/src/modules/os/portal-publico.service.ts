import { documentoValido, soDigitos } from "@arp/shared/documentos";
import type {
  CategoriaDoPortal,
  DetalheDoPedido,
  EntradaEntrar,
  LojaDaEntrada,
  PedidoDoPortal,
  RespostaInicioDoPortal,
  RespostaNovoPedido,
  RespostaPedidoDoPortal,
} from "@arp/shared/os/contratos/portal";
import {
  camposDaCategoria,
  type DiaDaEscolha,
  LIMITES_PORTAL,
  paraEscolha,
} from "@arp/shared/os/portal";
import { sql } from "kysely";
import type { Origem } from "@/contexto";
import { ErroDeLimite, ErroDeNegocio } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { diasLivres } from "./agenda.service";
import { UUID } from "./alvo";
import * as base from "./base.repository";
import { depois, novoToken, urlsAssinadas } from "./base.service";
import { hashDoToken } from "./portal-cookie";
import * as repo from "./portal-publico.repository";

// Portal do lojista (endereço único, sem login do sistema). A loja entra com
// o CPF ou CNPJ e fica numa sessão própria (cookie do portal). Tudo passa
// pela service role, então TODA função aqui confere a sessão (`abrirPortal`)
// dentro do mesmo escopo e filtra pela loja dela: o lojista só vê os pedidos
// que a loja fez pelo portal, e nunca dado interno (responsável, prazo
// interno, notas internas, custos).

export interface AcessoPortal {
  sessaoId: string;
  ultimoAcesso: string | null;
  loja: LojaDaEntrada;
}

export const SEM_SESSAO =
  "Sua entrada no portal terminou. Recarregue a página e entre de novo com o CPF ou CNPJ.";

/**
 * Confere a sessão do cookie (o token já passou pela assinatura): existe,
 * não foi encerrada, está no prazo e é de loja com contrato vigente. Null
 * mostra a entrada pelo CNPJ.
 */
export async function abrirPortal(
  tx: Tx,
  token: string | null,
  agora = new Date(),
): Promise<AcessoPortal | null> {
  if (!token) return null;
  const s = await repo.sessaoPeloToken(tx, hashDoToken(token));
  if (
    !s ||
    s.encerrado_em ||
    new Date(s.expira_em) <= agora ||
    s.situacao !== "vigente"
  )
    return null;
  return {
    sessaoId: s.id,
    ultimoAcesso: s.ultimo_acesso_em,
    loja: { id: s.loja_id, nome: s.nome, luc: s.luc, bloco: s.bloco },
  };
}

/** A sessão, ou a recusa das gravações (sessão ou contrato encerrados). */
export async function exigirPortal(
  tx: Tx,
  token: string | null,
  agora = new Date(),
): Promise<AcessoPortal> {
  const acesso = await abrirPortal(tx, token, agora);
  if (!acesso) throw new ErroDeNegocio(SEM_SESSAO);
  return acesso;
}

/** Antes de ler o corpo de um envio: quem não está dentro não manda arquivo. */
export async function conferirSessao(token: string | null): Promise<void> {
  await banco.comoServico((tx) => exigirPortal(tx, token));
}

/** Grava o último acesso depois da resposta (no máximo um a cada poucos minutos). */
function marcarAcesso(a: AcessoPortal, agora: Date): void {
  const ultimo = a.ultimoAcesso ? new Date(a.ultimoAcesso).getTime() : 0;
  if (agora.getTime() - ultimo < LIMITES_PORTAL.acessoMin * 60_000) return;
  depois("último acesso do portal", () =>
    banco.comoServico((tx) => repo.marcarAcesso(tx, a.sessaoId, agora)),
  );
}

// ---------------------------------------------------------------------------
// Entrada pelo CPF ou CNPJ
// ---------------------------------------------------------------------------

export type Entrada =
  | { entrou: false; lojas: LojaDaEntrada[] }
  | { entrou: true; token: string; expira: Date };

/**
 * Entrada da loja. Documento errado conta uma tentativa do IP; passou do
 * limite na janela, recusa sem consultar as lojas. Mais de uma loja vigente
 * no documento: devolve a lista para a pessoa escolher.
 */
export async function entrar(
  origem: Origem,
  d: EntradaEntrar,
  agora = new Date(),
): Promise<Entrada> {
  const cnpj = soDigitos(d.cnpj.slice(0, 18));
  if (!documentoValido(cnpj))
    throw new ErroDeNegocio(
      cnpj.length === 11 || cnpj.length === 14
        ? "CPF ou CNPJ inválido. Confira os números."
        : "Informe o CPF (11 dígitos) ou o CNPJ (14 dígitos).",
    );

  // A recusa é decidida dentro do escopo e lançada fora: a tentativa errada
  // precisa ficar gravada.
  const r = await banco.comoServico(async (tx) => {
    // Uma entrada por IP de cada vez: a contagem não é furada por pedidos
    // simultâneos.
    await sql`select pg_advisory_xact_lock(hashtext(${`os.portal.entrar:${origem.ip}`}))`.execute(
      tx,
    );
    const desde = new Date(
      agora.getTime() - LIMITES_PORTAL.tentativasMin * 60_000,
    );
    if (
      (await repo.contarTentativas(tx, origem.ip, desde)) >=
      LIMITES_PORTAL.tentativas
    )
      return { tipo: "bloqueado" } as const;
    const lojas = await repo.lojasDoCnpj(tx, cnpj);
    if (!lojas.length) {
      await repo.registrarTentativa(
        tx,
        origem.ip,
        new Date(agora.getTime() - 86_400_000),
      );
      return { tipo: "nenhuma" } as const;
    }
    const loja = d.loja
      ? lojas.find((l) => l.id === d.loja)
      : lojas.length === 1
        ? lojas[0]
        : undefined;
    if (!loja) return { tipo: "escolher", lojas } as const;
    const token = novoToken();
    const expira = new Date(
      agora.getTime() + LIMITES_PORTAL.sessaoDias * 86_400_000,
    );
    await repo.inserirSessao(tx, {
      lojaId: loja.id,
      hash: hashDoToken(token),
      agora,
      expira,
    });
    return { tipo: "entrou", token, expira } as const;
  });

  if (r.tipo === "bloqueado")
    throw new ErroDeLimite(
      "Muitas tentativas com documento errado. Espere alguns minutos e tente de novo.",
    );
  if (r.tipo === "nenhuma")
    throw new ErroDeNegocio(
      "Nenhuma loja com contrato vigente neste CPF ou CNPJ. Confira o número ou fale com a administração.",
    );
  if (r.tipo === "escolher") return { entrou: false, lojas: r.lojas };
  return { entrou: true, token: r.token, expira: r.expira };
}

/** "Trocar de loja": encerra a sessão do cookie. */
export async function sair(token: string | null): Promise<void> {
  if (!token) return;
  await banco.comoServico((tx) => repo.encerrarSessao(tx, hashDoToken(token)));
}

// ---------------------------------------------------------------------------
// Catálogo e agenda
// ---------------------------------------------------------------------------

export interface CategoriaCompleta extends CategoriaDoPortal {
  setorId: string;
  setor: string;
  agendaId: string | null;
}

export async function categoriasDoPortal(tx: Tx): Promise<CategoriaCompleta[]> {
  return (await repo.categoriasDoPortal(tx)).map((c) => ({
    id: c.id,
    nome: c.nome,
    icone: c.icone,
    orientacao: c.orientacao_portal,
    campos: camposDaCategoria(c.campos),
    setorId: c.setor_id,
    setor: c.setor,
    agendaId: c.agenda_id,
  }));
}

/** Só o que a tela usa (o setor e a agenda não saem). */
const paraTela = (c: CategoriaCompleta): CategoriaDoPortal => ({
  id: c.id,
  nome: c.nome,
  icone: c.icone,
  orientacao: c.orientacao,
  campos: c.campos,
});

/** A agenda e os dias com horário livre (novo pedido e remarcação). */
async function horariosDaAgenda(tx: Tx, agendaId: string, agora: Date) {
  const agenda = (await repo.agenda(tx, agendaId)) ?? null;
  return {
    agenda,
    dias: agenda ? paraEscolha(await diasLivres(tx, agenda, agora)) : [],
  };
}

// ---------------------------------------------------------------------------
// Leituras da loja
// ---------------------------------------------------------------------------

type LinhaDePedido = NonNullable<Awaited<ReturnType<typeof repo.pedidoDaLoja>>>;

function paraPedido(c: LinhaDePedido): PedidoDoPortal {
  const { campos_da_categoria, ...resto } = c;
  return {
    ...resto,
    camposDaCategoria: camposDaCategoria(campos_da_categoria),
  };
}

const SEM_LOJA: RespostaInicioDoPortal = {
  loja: null,
  boasVindas: null,
  categorias: [],
  pedidos: [],
  documentos: [],
};

/** Início do portal: sem sessão, só `loja: null` (a tela mostra a entrada). */
export async function inicio(
  token: string | null,
): Promise<RespostaInicioDoPortal> {
  const agora = new Date();
  const lido = await banco.comoServico(async (tx) => {
    const acesso = await abrirPortal(tx, token, agora);
    if (!acesso) return null;
    const categorias = await categoriasDoPortal(tx);
    const p = await base.parametros(tx);
    const pedidos = await repo.pedidosDaLoja(tx, acesso.loja.id);
    const documentos = await repo.documentosDaLoja(tx, acesso.loja.id);
    return { acesso, categorias, p, pedidos, documentos };
  });
  if (!lido) return SEM_LOJA;
  marcarAcesso(lido.acesso, agora);
  const urls = await urlsAssinadas(lido.documentos.map((d) => d.path));
  return {
    loja: lido.acesso.loja,
    boasVindas: lido.p.portal_boas_vindas,
    categorias: lido.categorias.map(paraTela),
    pedidos: lido.pedidos.map(paraPedido),
    documentos: lido.documentos.map((d) => ({
      id: d.id,
      nome: d.nome,
      em: d.em,
      url: urls.get(d.path) ?? null,
    })),
  };
}

/** Novo pedido de uma categoria: campos e, com agenda, os horários livres. */
export async function novoPedido(
  token: string | null,
  categoriaId: string,
): Promise<RespostaNovoPedido> {
  const agora = new Date();
  const lido = await banco.comoServico(async (tx) => {
    const acesso = await abrirPortal(tx, token, agora);
    if (!acesso) return null;
    const categoria = (await categoriasDoPortal(tx)).find(
      (c) => c.id === categoriaId,
    );
    if (!categoria) return { acesso, categoria: null, dias: null };
    let dias: DiaDaEscolha[] | null = null;
    let orientacao = categoria.orientacao;
    if (categoria.agendaId) {
      const h = await horariosDaAgenda(tx, categoria.agendaId, agora);
      dias = h.dias;
      if (h.agenda?.orientacao && h.agenda.orientacao !== orientacao)
        orientacao = [orientacao, h.agenda.orientacao]
          .filter(Boolean)
          .join(" ");
    }
    return {
      acesso,
      categoria: { ...paraTela(categoria), orientacao },
      dias,
    };
  });
  if (!lido) return { loja: null, categoria: null, dias: null };
  marcarAcesso(lido.acesso, agora);
  return { loja: lido.acesso.loja, categoria: lido.categoria, dias: lido.dias };
}

/**
 * Pedido com a conversa (só eventos marcados para o lojista), os arquivos
 * liberados (links de 1 h) e os horários marcados. De outra loja: não
 * encontrado.
 */
export async function pedido(
  token: string | null,
  id: string,
): Promise<RespostaPedidoDoPortal> {
  const agora = new Date();
  const lido = await banco.comoServico(async (tx) => {
    const acesso = await abrirPortal(tx, token, agora);
    if (!acesso) return null;
    // A conversa, os arquivos e os horários só são lidos depois de conferir
    // que o pedido é desta loja.
    const linha = UUID.test(id)
      ? await repo.pedidoDaLoja(tx, acesso.loja.id, id)
      : undefined;
    if (!linha) return { acesso, detalhe: null };
    const eventos = await repo.eventosVisiveis(tx, linha.id);
    const anexos = await repo.anexosVisiveis(tx, linha.id);
    const horarios = await repo.horariosDoPedido(tx, linha.id);
    const remarcar: Record<string, DiaDaEscolha[]> = {};
    for (const h of horarios)
      if (h.status === "remarcar" && !remarcar[h.agenda_id])
        remarcar[h.agenda_id] = (
          await horariosDaAgenda(tx, h.agenda_id, agora)
        ).dias;
    return { acesso, detalhe: { linha, eventos, anexos, horarios }, remarcar };
  });
  if (!lido) return { loja: null, detalhe: null, remarcar: {} };
  marcarAcesso(lido.acesso, agora);
  if (!lido.detalhe)
    return { loja: lido.acesso.loja, detalhe: null, remarcar: {} };

  const { linha, eventos, anexos, horarios } = lido.detalhe;
  const urls = await urlsAssinadas(anexos.map((a) => a.path));
  const detalhe: DetalheDoPedido = {
    pedido: paraPedido(linha),
    eventos,
    arquivos: anexos.map((a) => ({
      id: a.id,
      nome: a.nome,
      url: urls.get(a.path) ?? null,
      mime: a.mime,
      tamanho: a.tamanho,
      // Quem é da equipe envia logado; o lojista não tem usuário.
      daLoja: a.enviado_por === null,
      categoria: a.categoria,
      em: a.em,
      eventoId: a.evento_id,
    })),
    horarios: horarios.map((g) => ({
      id: g.id,
      agendaId: g.agenda_id,
      agenda: g.agenda ?? "Agenda",
      inicio: g.inicio,
      fim: g.fim,
      status: g.status,
    })),
  };
  return { loja: lido.acesso.loja, detalhe, remarcar: lido.remarcar ?? {} };
}
