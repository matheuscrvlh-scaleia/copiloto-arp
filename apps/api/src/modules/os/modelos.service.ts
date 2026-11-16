import { dataDaOcorrencia } from "@arp/shared/os/automacao";
import type {
  DisparoFeito,
  RespostaDisparos,
  Serie,
} from "@arp/shared/os/contratos/disparos";
import {
  ACOES,
  type AcaoItem,
  type Contrato,
  GATILHOS,
  type Gatilho,
  type ItemDoModelo,
  montarAviso,
  setorDoAviso,
} from "@arp/shared/os/modelos";
import type { Calendario } from "@arp/shared/os/prazo";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { registrarDepois } from "@/infra/eventos";
import { chamado } from "./alvo";
import { configDoSistema } from "./automacao.service";
import { contextoOs, registrar, registrarComoSistema } from "./base.service";
import { destinosDosChamados } from "./chamados.repository";
import { criarChamadoSistema } from "./criar.service";
import type {
  ItemModelo,
  LojaDoModelo,
  ModeloComItens,
} from "./modelos.repository";
import * as repo from "./modelos.repository";
import { tentar } from "./tentar";

// Modelos de entrada e saída de cliente (spec 4.12): o disparo (pela rotina
// ou pelo botão "Disparar modelo") e as consultas da tela de Disparos. O
// disparo grava com a service role: os.disparos só cresce pelo servidor, e o
// Aviso nasce com destinos de vários setores. Quem chama já conferiu o
// acesso. O cadastro dos modelos (Configurações) é de outro arquivo.

export type { ItemModelo, LojaDoModelo, ModeloComItens };

const NADA_ALTERADO =
  "Nada foi alterado: o registro não existe mais ou você não tem acesso a ele.";

const paraContrato = (l: LojaDoModelo): Contrato => ({
  ...l,
  situacao: l.situacao === "encerrado" ? "encerrado" : "vigente",
});

const ehAcao = (a: string): a is AcaoItem => Object.hasOwn(ACOES, a);
const ehGatilho = (g: string): g is Gatilho => Object.hasOwn(GATILHOS, g);

export const paraItem = (i: ItemModelo): ItemDoModelo => ({
  ...i,
  condicao: i.condicao === "tem_vaga" ? "tem_vaga" : "sempre",
  acao: ehAcao(i.acao) ? i.acao : "nenhuma",
});

export interface Disparo {
  chamadoId: string;
  numero: number;
  avisos: string[];
}

export interface PedidoDeDisparo {
  modelo: ModeloComItens;
  loja: LojaDoModelo;
  usuario: { id: string; nome: string } | null;
  automatico: boolean;
  agora?: Date;
  cal?: Calendario;
}

/**
 * Ação automática de um item do modelo, no escopo (service role) do disparo.
 * Quem lança não desfaz o Aviso: a linha do tempo conta o que não deu certo.
 */
export type AcaoDoModelo = (
  tx: Tx,
  p: PedidoDeDisparo,
  chamadoId: string,
) => Promise<void>;

/**
 * As ações dos itens são de outras áreas (vistorias e portal do lojista):
 * cada área registra a sua aqui ao subir (`ACOES_DO_MODELO.portal_gerar =
 * …`). Sem registro, o disparo cria o Aviso e a linha do tempo diz que a
 * ação não foi feita ("Faça pela tela.").
 */
export const ACOES_DO_MODELO: Partial<
  Record<Exclude<AcaoItem, "nenhuma">, AcaoDoModelo>
> = {};

/**
 * Dispara o modelo para o contrato: um Aviso com um destino por item, ligado
 * à loja, e as ações dos itens (vistoria, link do portal). Uma vez só por
 * modelo e loja: a linha de os.disparos é gravada antes, e a repetição volta
 * null. Tudo num escopo: sem o Aviso, a reserva some junto e a próxima
 * rodada tenta de novo. Nada é alterado no ENET.
 */
export async function dispararModelo(
  p: PedidoDeDisparo,
): Promise<Disparo | null> {
  const agora = p.agora ?? new Date();
  const disparo = await banco.comoServico(async (tx) => {
    const cal = p.cal ?? (await configDoSistema(tx)).cal;
    const reserva = await tentar(tx, () =>
      repo.reservarDisparo(tx, {
        modelo_id: p.modelo.id,
        loja_id: p.loja.id,
        automatico: p.automatico,
        disparado_por: p.usuario?.id ?? null,
      }),
    );
    if (!reserva.ok) {
      if (reserva.codigo === "23505") return null;
      throw reserva.erro;
    }
    const feito = await criarAviso(tx, p, cal, agora);
    await repo.ligarDisparo(tx, reserva.valor, feito.chamadoId);
    return feito;
  });
  if (!disparo) return null;
  registrarDepois({
    modulo: "os",
    evento: "os_modelo_disparado",
    descricao: `${p.automatico ? "Rotina disparou" : "Disparou"} o modelo ${p.modelo.nome} para ${p.loja.nome} (${p.loja.luc}): aviso #${disparo.numero}`,
    usuarioId: p.usuario?.id ?? null,
    detalhes: {
      modelo_id: p.modelo.id,
      loja_id: p.loja.id,
      chamado_id: disparo.chamadoId,
      automatico: p.automatico,
      avisos: disparo.avisos,
    },
  });
  return disparo;
}

async function criarAviso(
  tx: Tx,
  p: PedidoDeDisparo,
  cal: Calendario,
  agora: Date,
): Promise<Disparo> {
  const { categorias, setores } = await repo.catalogoDoAviso(tx);
  const itens = p.modelo.itens.map(paraItem);
  const aviso = montarAviso(
    {
      nome: p.modelo.nome,
      gatilho: ehGatilho(p.modelo.gatilho) ? p.modelo.gatilho : "entrada",
      descricao: p.modelo.descricao,
    },
    itens,
    paraContrato(p.loja),
    hojeEmBrasilia(agora),
    cal,
  );
  const { setorId, categoriaId } = setorDoAviso(
    p.modelo,
    categorias,
    setores,
    itens,
  );
  if (!setorId) throw new ErroDeNegocio("Modelo sem setor para o aviso.");
  if (!aviso.destinos.length)
    throw new ErroDeNegocio("Nenhum item do modelo vale para este contrato.");

  const criado = await criarChamadoSistema(
    tx,
    {
      tipo: "aviso",
      origem: "modelo",
      setorId,
      categoriaId,
      titulo: aviso.titulo,
      descricao: aviso.descricao,
      prazo: aviso.prazo,
      lojaId: p.loja.id,
      abertoPor: p.usuario?.id ?? null,
      autorNome: p.usuario?.nome ?? `Sistema (modelo ${p.modelo.nome})`,
      destinatarios: aviso.destinos.map((d) => ({
        setorId: d.setorId,
        titulo: d.titulo,
        prazo: d.prazo,
        responsavelId: d.responsavelId,
      })),
    },
    agora,
  );
  if (!criado) throw new ErroDeNegocio("O aviso do modelo não foi criado.");

  const avisos: string[] = [];
  for (const acao of new Set(aviso.destinos.map((d) => d.acao))) {
    const problema = await executarAcao(tx, acao, p, criado.id);
    if (problema) avisos.push(problema);
  }
  return { chamadoId: criado.id, numero: criado.numero, avisos };
}

/**
 * Ação automática do item. Falhar aqui não desfaz o Aviso: o setor faz à mão
 * e a linha do tempo conta o que não deu certo.
 */
async function executarAcao(
  tx: Tx,
  acao: AcaoItem,
  p: PedidoDeDisparo,
  chamadoId: string,
): Promise<string | null> {
  if (acao === "nenhuma") return null;
  const fazer = ACOES_DO_MODELO[acao];
  let motivo = "a ação automática não está ligada";
  if (fazer) {
    const r = await tentar(tx, () => fazer(tx, p, chamadoId));
    if (r.ok) return null;
    motivo = r.erro instanceof Error ? r.erro.message : "erro";
  }
  const texto = `Não foi possível ${ACOES[acao].toLowerCase()}: ${motivo}. Faça pela tela.`;
  await registrarComoSistema(tx, chamado(chamadoId), {
    tipo: "sistema",
    autorNome: "Sistema",
    texto,
  });
  return texto;
}

// ---------------------------------------------------------------------------
// Consultas (pela sessão: o RLS confere o acesso)
// ---------------------------------------------------------------------------

/** Disparos mais recentes, com o andamento de cada setor no Aviso. */
async function disparosFeitos(tx: Tx, limite = 60): Promise<DisparoFeito[]> {
  const linhas = await repo.disparosFeitos(tx, limite);
  const ids = linhas.flatMap((d) => (d.chamado_id ? [d.chamado_id] : []));
  const avisos = ids.length ? await repo.avisosDosDisparos(tx, ids) : [];
  const destinos = avisos.length
    ? await destinosDosChamados(
        tx,
        avisos.map((c) => c.id),
      )
    : [];
  const porId = new Map(avisos.map((c) => [c.id, c]));
  return linhas.map((d) => {
    const c = d.chamado_id ? porId.get(d.chamado_id) : undefined;
    return {
      id: d.id,
      em: d.em,
      automatico: d.automatico,
      modelo: d.modelo ?? "—",
      loja: {
        id: d.loja_id,
        nome: d.loja_nome,
        luc: d.loja_luc,
        situacao: d.loja_situacao,
      },
      chamado: c ? { id: c.id, numero: c.numero, status: c.status } : null,
      destinos: c
        ? destinos
            .filter((x) => x.chamado_id === c.id)
            .sort((a, b) => a.ordem - b.ordem)
            .map((x) => ({
              setor_id: x.setor_id,
              titulo: x.titulo,
              status: x.status,
            }))
        : null,
    };
  });
}

/** Lembretes recorrentes ativos que a pessoa vê (RLS). */
async function seriesAtivas(tx: Tx): Promise<Serie[]> {
  // Toda ocorrência guarda o Repetir: lê em páginas, até 10 mil.
  const series = new Map<string, Serie>();
  for (let de = 0; de < 10_000; de += 1000) {
    const pagina = await repo.comRecorrencia(tx, de);
    for (const c of pagina) {
      const chave = c.serie_id ?? c.id;
      const dia = dataDaOcorrencia(c);
      const ultima = {
        ultimaId: c.id,
        numero: c.numero,
        titulo: c.titulo,
        tipo: c.tipo,
        setor_id: c.setor_id,
        responsavel_id: c.responsavel_id,
        recorrencia: c.recorrencia,
        ultimaData: dia,
      };
      const s = series.get(chave);
      if (!s) series.set(chave, { serieId: chave, ocorrencias: 1, ...ultima });
      else {
        s.ocorrencias++;
        if (dia > s.ultimaData) Object.assign(s, ultima);
      }
    }
    if (pagina.length < 1000) break;
  }
  return [...series.values()].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}

/** GET /os/disparos: o que a tela Disparos e lembretes mostra. */
export function lerDisparos(ctx: Contexto): Promise<RespostaDisparos> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lista = await repo.modelos(tx);
    const lojas = await repo.lojasParaDisparo(tx);
    return {
      modelos: lista.map((m) => ({
        id: m.id,
        nome: m.nome,
        ativo: m.ativo,
        itens: m.itens.length,
      })),
      lojas,
      disparos: await disparosFeitos(tx),
      series: await seriesAtivas(tx),
    };
  });
}

// ---------------------------------------------------------------------------
// Ações da tela
// ---------------------------------------------------------------------------

/**
 * POST /os/disparos: "Disparar modelo" à mão: quando o ENET não trouxer o
 * dado ou num caso fora do comum. Uma vez só por modelo e contrato. O
 * disparo grava com a service role: a permissão é conferida no banco.
 */
export async function dispararModeloManual(
  ctx: Contexto,
  d: { modelo_id: string; loja_id: string },
): Promise<string> {
  await exigir(ctx, "os.modelos");
  const { modelo, loja } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      modelo: (await repo.modelos(tx, d.modelo_id))[0],
      loja: await repo.lojaDoModelo(tx, d.loja_id),
    }),
  );
  if (!modelo || !loja) throw new ErroDeNegocio(NADA_ALTERADO);
  if (!modelo.itens.length) throw new ErroDeNegocio("O modelo não tem itens.");

  const feito = await dispararModelo({
    modelo,
    loja,
    usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome },
    automatico: false,
  });
  if (!feito)
    throw new ErroDeNegocio(
      `O modelo ${modelo.nome} já foi disparado para ${loja.nome}. O histórico fica no contrato.`,
    );
  return `Aviso #${feito.numero} criado para ${loja.nome}.${feito.avisos.length ? ` ${feito.avisos.join(" ")}` : ""}`;
}

/**
 * POST /os/series/:id/parar: nenhuma ocorrência repete mais (as criadas
 * ficam).
 */
export function pararSerie(
  ctx: Contexto,
  serieId: string,
  ultimaId: string,
): Promise<void> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const cx = await contextoOs(tx, ctx);
    if (!(await repo.pararSerie(tx, serieId)))
      throw new ErroDeNegocio(NADA_ALTERADO);
    // A linha do tempo não desfaz a parada (a última pode não ser visível).
    await tentar(tx, () =>
      registrar(tx, cx, chamado(ultimaId), {
        tipo: "alteracao",
        texto: "Parou de repetir: nenhuma ocorrência nova será criada.",
        dados: { campo: "recorrencia", para: null },
      }),
    );
  });
}
