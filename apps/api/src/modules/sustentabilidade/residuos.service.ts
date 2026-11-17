import { randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import { formatarData, formatarMes } from "@arp/shared/formato";
import { numeroDo } from "@arp/shared/os/numeros";
import { deBrasilia, paraBrasilia, somarDias } from "@arp/shared/os/tempo";
import type {
  RespostaNotaRcc,
  RespostaRcc,
  RespostaRondas,
} from "@arp/shared/sustentabilidade/contratos/residuos";
import type { esquemaNotaRcc } from "@arp/shared/sustentabilidade/rcc-lancamento";
import {
  competenciaDoMes,
  ehPdf,
  PDF_MAX_BYTES,
} from "@arp/shared/sustentabilidade/rcc-lancamento";
import {
  calcularNotas,
  type FatorDoRcc,
  filtrarNotas,
  type MesRcc,
  type NotaRcc,
  type PrecoDoRcc,
  resumoPorMes,
} from "@arp/shared/sustentabilidade/rcc-lista";
import {
  type CorColetor,
  inicioDaSemana,
} from "@arp/shared/sustentabilidade/rondas";
import {
  type EntradaDaRonda,
  ehImagem,
  FOTO_MAX_BYTES,
  itensLancados,
  mensagemDaRonda,
  recolhimentosAAbrir,
} from "@arp/shared/sustentabilidade/rondas-lancamento";
import {
  type ResumoDasRondas,
  type RondaLida,
  resumoDaUltimaRonda,
} from "@arp/shared/sustentabilidade/rondas-lista";
import type { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import {
  infoDoArquivo,
  inicioDoArquivo,
  linksDeLeitura,
  prepararEnvio,
  removerArquivos,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { criarChamadoSistema } from "@/modules/os/criar.service";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/modules/os/sistema.service";
import { MODULO, nomesDeUsuarios, podeAgora } from "./acesso";
import { coletores, parametros } from "./base.service";
import * as repo from "./residuos.repository";

// Rondas dos coletores (spec 4.6) e notas do RCC (spec 4.7). Leitura e
// gravação com a sessão (o RLS confere "Resíduos – lançar ronda" e
// "Resíduos – RCC"); o chamado da semana/do mês e os de recolhimento vão
// pela service role do Chamados (modules/os), depois de conferir a
// permissão. As fotos e o PDF vão direto do navegador para o disco, por
// link de envio; a gravação confere que o arquivo é da pessoa, chegou
// inteiro e é do tipo certo. Nada de volume em litros ou kg nas rondas:
// só percentuais. Fatores e preços do RCC têm vigência e vêm dos Parâmetros.

const BUCKET = "sustentabilidade" as const;
const RONDA = "sustentabilidade.ronda" as const;
const RCC = "sustentabilidade.rcc" as const;
const SEM_PERMISSAO_RONDA = "Você não tem permissão para lançar ronda.";
const SEM_PERMISSAO_RCC = "Você não tem permissão para lançar nota do RCC.";
const NOME_DA_CATEGORIA = "Recolhimento de coletor";

/** Semanas do gráfico. */
export const SEMANAS_DO_GRAFICO = 12;

// ---------------------------------------------------------------- rondas

const corDe = (c: string): CorColetor => (c === "azul" ? "azul" : "preto");

function aRonda(r: repo.LinhaDaRonda, nomes: Map<string, string>): RondaLida {
  return {
    id: r.id,
    dataHora: r.data_hora,
    exemplo: r.exemplo,
    lancadoPor: r.lancado_por ? (nomes.get(r.lancado_por) ?? null) : null,
    itens: r.itens
      .map((i) => ({
        id: i.id,
        coletorId: i.coletor_id,
        local: i.local,
        cor: corDe(i.cor),
        conteineres: i.conteineres,
        ocupacaoPct: i.ocupacao_pct,
        observacao: i.observacao,
        foto: i.foto,
      }))
      .sort(
        (a, b) =>
          a.local.localeCompare(b.local, "pt-BR") || a.cor.localeCompare(b.cor),
      ),
  };
}

/** Fim do dia `ate` em Brasília (instante ISO, exclusivo). */
const fimDoDia = (ate: string) => deBrasilia(somarDias(ate, 1)).toISOString();

async function exigirPermissao(
  ctx: Contexto,
  permissao: typeof RONDA | typeof RCC,
  mensagem: string,
) {
  if (!(await podeAgora(ctx, permissao))) throw new ErroDePermissao(mensagem);
}

/**
 * GET /rondas: do mais antigo entre o início do período e a primeira das
 * 12 semanas do gráfico até o fim do período, mais a última ronda até esse
 * dia (para os cartões, mesmo que seja anterior à janela).
 */
export async function dadosDasRondas(
  ctx: Contexto,
  de: string,
  ate: string,
): Promise<RespostaRondas> {
  if (!pode(ctx, RONDA)) throw new ErroDePermissao();
  const inicioGrafico = somarDias(
    inicioDaSemana(ate),
    -7 * (SEMANAS_DO_GRAFICO - 1),
  );
  const janela = de < inicioGrafico ? de : inicioGrafico;
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const linhas = await repo.rondasEntre(
      tx,
      deBrasilia(janela).toISOString(),
      fimDoDia(ate),
    );
    const ultima = await repo.ultimaRondaAntes(tx, fimDoDia(ate));
    const param = await parametros(tx);
    const todos = await coletores(tx);
    return { linhas, ultima, limite: param.limite_ocupacao_pct, todos };
  });
  const todas =
    lido.ultima && !lido.linhas.some((l) => l.id === lido.ultima?.id)
      ? [...lido.linhas, lido.ultima]
      : lido.linhas;
  const nomes = await nomesDeUsuarios(
    ctx,
    todas.map((r) => r.lancado_por),
    [RONDA],
  );
  const rondas = todas.map((r) => aRonda(r, nomes));
  return {
    rondas: rondas.map((r) => ({ ...r, itens: [...r.itens] })),
    limite: lido.limite,
    locais: [...new Set(lido.todos.map((c) => c.local))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
    temExemplo: rondas.some((r) => r.exemplo),
  };
}

/** Para o Painel: a última ronda até o dia `ate`. A `tx` é de quem pediu. */
export async function resumoDasRondas(
  tx: Tx,
  ate: string,
): Promise<ResumoDasRondas> {
  const ultima = await repo.ultimaRondaAntes(tx, fimDoDia(ate));
  const param = await parametros(tx);
  if (!ultima) return { ultima: null, pretos: null, azuis: null, cheios: 0 };
  return resumoDaUltimaRonda(
    [aRonda(ultima, new Map())],
    ate,
    param.limite_ocupacao_pct,
  );
}

/** GET /rondas/lancar: coletores ativos, o limite e o chamado da semana. */
export async function paraLancarRonda(ctx: Contexto) {
  if (!pode(ctx, RONDA)) throw new ErroDePermissao();
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    todos: await coletores(tx),
    limite: (await parametros(tx)).limite_ocupacao_pct,
  }));
  await exigirPermissao(ctx, RONDA, SEM_PERMISSAO_RONDA);
  const chamado = await banco.comoServico((tx) =>
    chamadoAbertoDaOrigem(tx, MODULO, "ronda"),
  );
  return {
    coletores: lido.todos
      .filter((c) => c.ativo)
      .map((c) => ({
        id: c.id,
        local: c.local,
        cor: corDe(c.cor),
        conteineres: c.conteineres,
      })),
    limite: lido.limite,
    chamado: chamado ? numeroDo(chamado) : null,
  };
}

/** Link para o navegador enviar a foto de um coletor (ou da ronda). */
export async function prepararFotoDaRonda(
  ctx: Contexto,
  e: { nome: string; tamanho: number },
): Promise<{ url: string; path: string }> {
  if (e.tamanho > FOTO_MAX_BYTES)
    throw new ErroDeNegocio("A foto passa de 12 MB. Tire outra.");
  await exigirPermissao(ctx, RONDA, SEM_PERMISSAO_RONDA);
  const path = `rondas/${ctx.usuario.id}/${randomUUID()}-${nomeSeguro(e.nome, "foto.jpg")}`;
  const envio = await prepararEnvio(BUCKET, path, { maxBytes: FOTO_MAX_BYTES });
  if ("erro" in envio)
    throw new ErroDeNegocio(
      "Não foi possível preparar o envio da foto. Tente de novo.",
    );
  return { url: envio.url, path };
}

/** A foto é da pessoa, chegou inteira e é mesmo uma imagem. */
async function fotoConfere(path: string, usuarioId: string): Promise<boolean> {
  if (!path.startsWith(`rondas/${usuarioId}/`)) return false;
  const [info, inicio] = await Promise.all([
    infoDoArquivo(BUCKET, path),
    inicioDoArquivo(BUCKET, path, 16),
  ]);
  return Boolean(
    info && info.tamanho <= FOTO_MAX_BYTES && inicio && ehImagem(inicio),
  );
}

/** POST /rondas: grava a ronda, fecha o chamado da semana e abre os recolhimentos. */
export async function lancarRonda(
  ctx: Contexto,
  e: EntradaDaRonda,
): Promise<string> {
  await exigirPermissao(ctx, RONDA, SEM_PERMISSAO_RONDA);
  const usuarioId = ctx.usuario.id;
  const config = await banco.comoUsuario(usuarioId, async (tx) => ({
    ativos: (await coletores(tx))
      .filter((x) => x.ativo)
      .map((x) => ({
        id: x.id,
        local: x.local,
        cor: corDe(x.cor),
      })),
    param: await parametros(tx),
  }));
  const itens = itensLancados(e.itens);
  if (!itens.length)
    throw new ErroDeNegocio(
      "Toque na ocupação de pelo menos um coletor. Quem não foi visitado fica em branco.",
    );
  const porId = new Map(config.ativos.map((c) => [c.id, c]));
  if (itens.some((i) => !porId.has(i.coletorId)))
    throw new ErroDeNegocio(
      "Há um coletor que não está mais ativo no cadastro. Recarregue a tela e confira a lista.",
    );
  const fotos = [e.foto, ...e.itens.map((i) => i.foto)].filter(
    (f): f is string => Boolean(f),
  );
  for (const f of fotos)
    if (!(await fotoConfere(f, usuarioId)))
      throw new ErroDeNegocio(
        "Uma foto não chegou inteira. Tire de novo e tente salvar.",
      );

  const agora = new Date();
  const quando = paraBrasilia(agora);
  const quandoTexto = `${formatarData(quando.data)} às ${quando.hora}`;
  const chamadoDaRonda = await banco.comoServico((tx) =>
    chamadoAbertoDaOrigem(tx, MODULO, "ronda"),
  );
  const rondaId = randomUUID();
  try {
    // A ronda e os itens juntos: sem os itens a ronda não vale nada.
    await banco.comoUsuario(usuarioId, async (tx) => {
      await repo.inserirRonda(tx, {
        id: rondaId,
        data_hora: agora.toISOString(),
        chamado_id: chamadoDaRonda?.id ?? null,
        observacao: e.observacao || null,
        foto: e.foto || null,
        lancado_por: usuarioId,
      });
      await repo.inserirItens(
        tx,
        itens.map((i) => ({
          ronda_id: rondaId,
          coletor_id: i.coletorId,
          conteineres: i.conteineres,
          ocupacao_pct: i.ocupacaoPct,
          observacao: i.observacao || null,
          foto: i.foto || null,
        })),
      );
    });
  } catch (err) {
    log.error({ err }, "lançar ronda");
    throw new ErroDeNegocio("Não foi possível salvar a ronda. Tente de novo.");
  }

  // Daqui em diante a ronda está salva: falha nos chamados vira aviso.
  let chamadoFechado = false;
  if (chamadoDaRonda)
    try {
      chamadoFechado = await banco.comoServico((tx) =>
        concluirPeloSistema(tx, {
          chamadoId: chamadoDaRonda.id,
          texto: `Ronda lançada em ${quandoTexto}: ${itens.length} ${itens.length === 1 ? "coletor visitado" : "coletores visitados"}.`,
          concluidoPor: usuarioId,
          autorNome: "Sustentabilidade",
        }),
      );
    } catch (err) {
      log.error({ err }, "concluir o chamado da ronda");
    }

  const recolhimentos = recolhimentosAAbrir({
    itens,
    coletores: config.ativos,
    limitePct: config.param.limite_ocupacao_pct,
    rondaId,
    quando: quandoTexto,
  });
  const resultado = await abrirRecolhimentos(
    recolhimentos,
    config.param.recolhimento_setor_id,
    usuarioId,
  );
  return mensagemDaRonda({
    lancados: itens.length,
    chamadoFechado,
    recolhimentosAbertos: resultado.abertos,
    recolhimentosSemSetor: resultado.semSetor,
    recolhimentosComFalha: resultado.falhas,
  });
}

/** Um chamado por coletor cheio, para o setor dos Parâmetros. Quem recolhe fecha. */
async function abrirRecolhimentos(
  lista: ReturnType<typeof recolhimentosAAbrir>,
  setorId: string | null,
  usuarioId: string,
): Promise<{ abertos: number; semSetor: number; falhas: number }> {
  if (!lista.length) return { abertos: 0, semSetor: 0, falhas: 0 };
  if (!setorId) return { abertos: 0, semSetor: lista.length, falhas: 0 };
  let abertos = 0;
  let falhas = 0;
  let categoriaId: string | null = null;
  try {
    const cats = await banco.comoServico((tx) =>
      repo.categoriasDoRecolhimento(tx, NOME_DA_CATEGORIA),
    );
    categoriaId =
      (cats.find((c) => c.setor_id === setorId) ?? cats[0])?.id ?? null;
  } catch (err) {
    log.error({ err }, "categoria do recolhimento");
  }
  for (const r of lista)
    try {
      const criado = await banco.comoServico((tx) =>
        criarChamadoSistema(tx, {
          setorId,
          categoriaId,
          titulo: r.titulo,
          descricao: r.descricao,
          tipo: "tarefa",
          origem: "modulo",
          origemModulo: MODULO,
          origemRef: r.origemRef,
          abertoPor: usuarioId,
          autorNome: "Sustentabilidade",
          prioridade: "alta",
        }),
      );
      if (criado) abertos += 1;
      else falhas += 1;
    } catch (err) {
      log.error({ err }, "abrir recolhimento de coletor");
      falhas += 1;
    }
  return { abertos, semSetor: 0, falhas };
}

// ---------------------------------------------------------------- RCC

const aNota = (r: Awaited<ReturnType<typeof repo.notas>>[number]): NotaRcc => ({
  id: r.id,
  competencia: r.competencia,
  empresa: r.empresa,
  numero: r.numero,
  pdf: r.pdf,
  cacambasA: r.cacambas_a,
  cacambasB: r.cacambas_b,
  valorTotal: r.valor_total ?? null,
  exemplo: r.exemplo,
});

async function fatoresDoRcc(tx: Tx): Promise<FatorDoRcc[]> {
  return (await repo.fatores(tx)).map((f) => ({
    vigenteDesde: f.vigente_desde,
    toneladasPorCacamba: f.toneladas_por_cacamba,
  }));
}

/** Preços das caçambas A e B com a vigência; null sem "Ver valores". */
async function precosDoRcc(
  tx: Tx,
  ctx: Contexto,
): Promise<PrecoDoRcc[] | null> {
  if (!pode(ctx, "sustentabilidade.valores")) return null;
  return (await repo.precos(tx)).map((p) => ({
    vigenteDesde: p.vigente_desde,
    precoA: p.preco_a,
    precoB: p.preco_b,
  }));
}

/** GET /rcc: notas de todos os anos, fatores, preços, empresas e os links dos PDFs. */
export async function dadosDoRcc(ctx: Contexto): Promise<RespostaRcc> {
  if (!pode(ctx, RCC)) throw new ErroDePermissao();
  const d = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    notas: (await repo.notas(tx)).map(aNota),
    fatores: await fatoresDoRcc(tx),
    precos: await precosDoRcc(tx, ctx),
    empresas: (await parametros(tx)).rcc_empresas,
  }));
  // Links temporários (1 h) dos PDFs; a tela do RCC já exige "RCC".
  const links = Object.fromEntries(
    await linksDeLeitura(
      BUCKET,
      d.notas.map((n) => n.pdf),
      3600,
    ),
  );
  return { ...d, links };
}

/**
 * Para o Painel: toneladas A e B, total, % reciclado e valor economizado de
 * cada mês com nota no ano. A `tx` é de quem pediu.
 */
export async function rccPorMes(
  tx: Tx,
  ctx: Contexto,
  ano: number,
): Promise<MesRcc[]> {
  const doAno = (await repo.notas(tx, ano)).map(aNota);
  return resumoPorMes(
    calcularNotas(
      filtrarNotas(doAno, { ano, empresa: "" }),
      await fatoresDoRcc(tx),
      await precosDoRcc(tx, ctx),
    ),
  );
}

/** Link para o navegador enviar o PDF da nota. */
export async function prepararPdfDaNota(
  ctx: Contexto,
  e: { nome: string; tamanho: number },
): Promise<{ url: string; path: string }> {
  if (!/\.pdf$/i.test(e.nome)) throw new ErroDeNegocio("Envie o PDF da nota.");
  if (e.tamanho > PDF_MAX_BYTES)
    throw new ErroDeNegocio("O PDF passa de 15 MB. Envie um menor.");
  await exigirPermissao(ctx, RCC, SEM_PERMISSAO_RCC);
  const path = `rcc/${ctx.usuario.id}/${randomUUID()}-${nomeSeguro(e.nome, "nota.pdf")}`;
  const envio = await prepararEnvio(BUCKET, path, { maxBytes: PDF_MAX_BYTES });
  if ("erro" in envio)
    throw new ErroDeNegocio(
      "Não foi possível preparar o envio do PDF. Tente de novo.",
    );
  return { url: envio.url, path };
}

/** POST /rcc/notas: grava a nota (ou avisa que o mês já tem) e fecha o chamado do mês. */
export async function lancarNotaRcc(
  ctx: Contexto,
  d: z.output<typeof esquemaNotaRcc>,
): Promise<RespostaNotaRcc> {
  await exigirPermissao(ctx, RCC, SEM_PERMISSAO_RCC);
  const competencia = competenciaDoMes(d.competencia);
  if (!competencia) throw new ErroDeNegocio("Escolha a competência.");
  const usuarioId = ctx.usuario.id;

  // O PDF é da pessoa, chegou inteiro e é mesmo um PDF.
  const pdfOk = d.pdf.startsWith(`rcc/${usuarioId}/`)
    ? await Promise.all([
        infoDoArquivo(BUCKET, d.pdf),
        inicioDoArquivo(BUCKET, d.pdf, 8),
      ]).then(
        ([info, inicio]) =>
          Boolean(info && info.tamanho <= PDF_MAX_BYTES) &&
          Boolean(inicio && ehPdf(inicio)),
      )
    : false;
  if (!pdfOk)
    throw new ErroDeNegocio("O PDF não chegou inteiro. Envie de novo e salve.");

  if (!d.confirmarDuplicada) {
    const existentes = await banco.comoUsuario(usuarioId, (tx) =>
      repo.notasDaCompetencia(tx, competencia),
    );
    if (existentes.length) return { duplicada: existentes };
  }

  const chamado = await banco.comoServico((tx) =>
    chamadoAbertoDaOrigem(tx, MODULO, "rcc"),
  );
  const notaId = randomUUID();
  const etapa = { valor: false };
  try {
    // A nota e o valor juntos (o valor fica em tabela à parte: valores).
    await banco.comoUsuario(usuarioId, async (tx) => {
      await repo.inserirNota(tx, {
        id: notaId,
        competencia,
        empresa: d.empresa,
        numero: d.numero,
        pdf: d.pdf,
        cacambas_a: d.cacambasA,
        cacambas_b: d.cacambasB,
        chamado_id: chamado?.id ?? null,
        lancado_por: usuarioId,
      });
      etapa.valor = true;
      if (d.valorTotal !== null)
        await repo.inserirValorDaNota(tx, notaId, d.valorTotal);
    });
  } catch (err) {
    if (etapa.valor) {
      log.error({ err }, "valor da nota do RCC");
      await removerArquivos(BUCKET, [d.pdf]);
      throw new ErroDeNegocio(
        "Não foi possível salvar o valor da nota. Tente de novo.",
      );
    }
    log.error({ err }, "lançar nota do RCC");
    throw new ErroDeNegocio("Não foi possível salvar a nota. Tente de novo.");
  }

  let chamadoFechado = false;
  if (chamado)
    try {
      chamadoFechado = await banco.comoServico((tx) =>
        concluirPeloSistema(tx, {
          chamadoId: chamado.id,
          texto: `Nota ${d.numero} de ${d.empresa} lançada (${formatarMes(competencia)}).`,
          concluidoPor: usuarioId,
          autorNome: "Sustentabilidade",
        }),
      );
    } catch (err) {
      log.error({ err }, "concluir o chamado do RCC");
    }
  return {
    mensagem: `Nota ${d.numero} de ${formatarMes(competencia)} salva.${
      chamadoFechado
        ? " Chamado do mês fechado."
        : " Não havia chamado do RCC em aberto."
    }`,
  };
}
