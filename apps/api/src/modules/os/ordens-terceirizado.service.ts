import { formatarData, formatarMoeda } from "@arp/shared/formato";
import type {
  EntradaEnvioAoTerceirizado,
  EntradaUsarDoTerceirizado,
  RespostaDaOS,
} from "@arp/shared/os/contratos/ordens";
import { prazoRetornoDias, tipoDeServico } from "@arp/shared/os/ordem";
import { calcularPrazo } from "@arp/shared/os/prazo";
import { rotaOrdem, rotaTerceirizado } from "@arp/shared/os/rotas";
import { PERIODOS, type Periodo } from "@arp/shared/os/rotulos";
import {
  limparTelefone,
  linkWhatsApp,
  preencher,
} from "@arp/shared/os/whatsapp";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import { banco } from "@/infra/banco";
import { ordem } from "./alvo";
import {
  calendario,
  categorias,
  depois,
  notificar,
  novoToken,
  type Parametros,
  parametros,
  urlDoSistema,
} from "./base.service";
import * as repo from "./ordens.repository";
import {
  chamadoParaEditar,
  modeloMensagem,
  recalcularOS,
} from "./ordens.service";
import { anotar } from "./ordens-acoes.service";
import { cadastros, localDa } from "./ordens-consulta.service";

// Link da OS para o terceirizado (gerar, reenviar, cancelar), conferência
// do que ele informou e aprovação do orçamento acima do teto. Nada é enviado
// pelo servidor: a tela abre o WhatsApp com a mensagem pronta.

const SEM_PERMISSAO =
  "Você não tem permissão para enviar a OS a terceirizados.";

export interface MensagemTerceirizado {
  nome: string | null;
  numero: number;
  categoria: string | null;
  local: string;
  descricao: string | null;
  titulo: string;
  visitaData: string | null;
  visitaPeriodo: Periodo | null;
  token: string;
}

/** "24/10/2026 · Manhã", ou null sem data marcada. */
export function textoVisita(data: string | null, periodo: Periodo | null) {
  if (!data) return null;
  return periodo
    ? `${formatarData(data)} · ${PERIODOS[periodo]}`
    : formatarData(data);
}

/**
 * Mensagem do WhatsApp para o terceirizado (modelo dos parâmetros). A data
 * da visita entra no fim quando o modelo não tem o campo {{visita}}.
 */
export function mensagemTerceirizado(
  p: Pick<Parametros, "mensagens">,
  m: MensagemTerceirizado,
): string {
  const modelo = modeloMensagem(p, "terceirizado");
  const visita = textoVisita(m.visitaData, m.visitaPeriodo);
  const texto = preencher(modelo, {
    nome: m.nome ?? "",
    numero: m.numero,
    tipo: tipoDeServico(m.categoria),
    local: m.local,
    descricao: m.descricao ?? m.titulo,
    titulo: m.titulo,
    visita: visita ?? "a combinar",
    link: urlDoSistema(rotaTerceirizado(m.token)),
  });
  return visita && !/\{\{\s*visita\s*\}\}/.test(modelo)
    ? `${texto}\n*Visita:* ${visita}`
    : texto;
}

/**
 * Gera o link exclusivo (um ativo por OS; se o anterior foi recusado, um
 * novo) e devolve o WhatsApp com a mensagem pronta.
 */
export function enviarAoTerceirizado(
  ctx: Contexto,
  ordemId: string,
  d: EntradaEnvioAoTerceirizado,
): Promise<RespostaDaOS> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx, ch } = await chamadoParaEditar(tx, ctx, ordemId);
    if (!cx.pode("os.terceirizados")) throw new ErroDeNegocio(SEM_PERMISSAO);
    if (ch.tipo !== "os")
      throw new ErroDeNegocio("Só Ordem de Serviço vai para terceirizado.");
    if (!["aberto", "em_andamento", "aguardando"].includes(ch.status))
      throw new ErroDeNegocio("A OS não está mais aberta.");
    const telefone = d.telefone ? limparTelefone(d.telefone) : null;
    if (d.telefone && !telefone)
      throw new ErroDeNegocio("Telefone: informe o DDD e o número.");

    const ativo = await repo.linkAtivoDa(tx, ch.id);
    let token = ativo?.token ?? null;
    // Recusado ou de outra empresa: o link antigo para e sai um novo (só um
    // ativo por OS).
    if (ativo && (ativo.recusado_em || ativo.empresa_id !== ch.empresa_id)) {
      await repo.cancelarLink(tx, ativo.id);
      token = null;
    }
    const novo = token === null;
    const doLink = token ?? novoToken();
    if (novo)
      await repo.inserirLink(tx, {
        ordem_id: ch.id,
        token: doLink,
        empresa_id: ch.empresa_id,
        criado_por: ctx.usuario.id,
      });

    // Terceirizada e com prazo de retorno (categoria, empresa ou parâmetros).
    const p = await parametros(tx);
    const cad = await cadastros(tx);
    const cats = await categorias(tx);
    const categoria = cats.find((c) => c.id === ch.categoria_id);
    const muda: {
      execucao?: "terceirizada";
      prazo_terceirizado?: string;
      cobranca_avisada_em?: null;
    } = {};
    if (ch.execucao !== "terceirizada") muda.execucao = "terceirizada";
    // Link novo (primeiro envio ou outra empresa): o prazo começa agora.
    if (novo || !ch.prazo_terceirizado) {
      const dias = prazoRetornoDias(
        categoria?.prazo_terceirizado_dias,
        ch.empresa_id
          ? cad.empresas.get(ch.empresa_id)?.prazo_retorno_dias
          : null,
        p.terceirizado_prazo_dias,
      );
      muda.prazo_terceirizado = calcularPrazo(
        { abertura: new Date(), valor: dias, unidade: "dias_uteis" },
        await calendario(tx),
      ).toISOString();
      muda.cobranca_avisada_em = null;
    }
    if (Object.keys(muda).length) await repo.atualizarOrdem(tx, ch.id, muda);

    const empresa = ch.empresa_id ? cad.empresas.get(ch.empresa_id) : null;
    const mensagem = mensagemTerceirizado(p, {
      nome: d.nome || empresa?.contato || empresa?.nome || null,
      numero: ch.numero,
      categoria: categoria?.nome ?? null,
      local: localDa(ch, cad),
      descricao: ch.descricao,
      titulo: ch.titulo,
      visitaData: ch.visita_data,
      visitaPeriodo: ch.visita_periodo,
      token: doLink,
    });
    await anotar(tx, cx, ch.id, {
      tipo: "terceirizado",
      texto: `${novo ? "Enviou" : "Reenviou"} a OS ao terceirizado${empresa ? ` (${empresa.nome})` : ""}.`,
      dados: { empresa_id: ch.empresa_id },
    });
    return {
      mensagem: novo ? "Link gerado." : "Link reenviado.",
      whatsapp: linkWhatsApp(telefone, mensagem),
    };
  });
}

export function cancelarLinkTerceirizado(
  ctx: Contexto,
  ordemId: string,
): Promise<RespostaDaOS> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    if (!cx.pode("os.terceirizados")) throw new ErroDeNegocio(SEM_PERMISSAO);
    if (!(await repo.cancelarLinksDa(tx, ordemId)))
      throw new ErroDeNegocio("Não há link ativo.");
    await anotar(tx, cx, ordemId, {
      tipo: "terceirizado",
      texto: "Cancelou o link do terceirizado.",
    });
    return { mensagem: "Link cancelado: ele não abre mais." };
  });
}

/** Leva para a OS a solução ou o valor que o terceirizado informou. */
export async function usarDoTerceirizado(
  ctx: Contexto,
  ordemId: string,
  d: EntradaUsarDoTerceirizado,
): Promise<RespostaDaOS> {
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx, ch } = await chamadoParaEditar(tx, ctx, ordemId);
    const link = await repo.linkAtivoDa(tx, ch.id);
    if (!link) throw new ErroDeNegocio("Não há link ativo.");
    if (d.campo === "solucao") {
      if (!link.solucao)
        throw new ErroDeNegocio("O terceirizado não informou a solução.");
      await repo.atualizarOrdem(tx, ch.id, { solucao: link.solucao });
      await anotar(tx, cx, ch.id, {
        tipo: "alteracao",
        texto: "Usou a solução informada pelo terceirizado.",
        dados: { campo: "solucao" },
      });
      return;
    }
    if (!cx.pode("os.custos"))
      throw new ErroDeNegocio("Você não tem permissão para editar custos.");
    if (link.valor_informado === null)
      throw new ErroDeNegocio("O terceirizado não informou o valor.");
    await repo.gravarCustos(tx, ch.id, {
      valor_terceirizado: link.valor_informado,
      orcamento_numero: link.orcamento_numero,
      orcamento_aprovado_em: null,
      orcamento_aprovado_por: null,
    });
    await anotar(tx, cx, ch.id, {
      tipo: "alteracao",
      texto: "Usou o valor informado pelo terceirizado.",
      dados: { campo: "custo_terceirizado" },
    });
  });
  if (d.campo === "valor") await recalcularOS(ordemId);
  return { mensagem: "Atualizado na OS." };
}

/**
 * Aprovação do orçamento acima do teto, por quem gerencia o setor. O valor
 * fica em os_custos (só os.custos): quem gerencia sem ver custos aprova
 * pela service role, depois de conferido o acesso.
 */
export async function aprovarOrcamento(
  ctx: Contexto,
  ordemId: string,
): Promise<RespostaDaOS> {
  const eu = ctx.usuario.id;
  const comCustos = ctx.permissoes.has("os.custos");
  const SEM_ORCAMENTO = "Não há orçamento para aprovar.";
  const conferir = async () =>
    banco.comoUsuario(eu, async (tx) => {
      const alvo = await chamadoParaEditar(tx, ctx, ordemId);
      if (!alvo.gerencia)
        throw new ErroDeNegocio("Só quem gerencia o setor aprova o orçamento.");
      return alvo.ch;
    });
  let ch = await conferir();
  if (!comCustos) {
    const aprovado = await banco.comoServico((tx) =>
      repo.aprovarOrcamento(tx, ch.id, eu),
    );
    if (!aprovado) throw new ErroDeNegocio(SEM_ORCAMENTO);
  }
  ch = await banco.comoUsuario(eu, async (tx) => {
    const alvo = await chamadoParaEditar(tx, ctx, ordemId);
    let valor: number | null = null;
    if (comCustos) {
      const aprovado = await repo.aprovarOrcamento(tx, alvo.ch.id, eu);
      if (!aprovado) throw new ErroDeNegocio(SEM_ORCAMENTO);
      valor = aprovado.valor_terceirizado;
    }
    await anotar(tx, alvo.cx, alvo.ch.id, {
      tipo: "alteracao",
      texto: comCustos
        ? `Aprovou o orçamento do terceirizado (${formatarMoeda(valor)}).`
        : "Aprovou o orçamento do terceirizado.",
      dados: { campo: "orcamento_aprovado" },
    });
    return alvo.ch;
  });
  depois("aviso do orçamento aprovado", () =>
    notificar(
      [ch.responsavel_id],
      {
        tipo: "orcamento",
        titulo: `#${ch.numero} ${ch.titulo}`,
        texto: "O orçamento do terceirizado foi aprovado.",
        href: rotaOrdem(ch.id),
        alvo: ordem(ch.id),
      },
      eu,
    ),
  );
  return { mensagem: "Orçamento aprovado." };
}
