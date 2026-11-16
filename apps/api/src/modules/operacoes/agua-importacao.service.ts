import { randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import {
  type ArquivoLido,
  type AvisoAgua,
  blocoDoNome,
  CAMPOS_AGUA,
  type CampoAgua,
  codigoHidrometro,
  conciliar,
  type LeituraArquivo,
  lerNomeDaFoto,
  lerPlanilhaAgua,
  lerTextoPdf,
  ligarFotos,
  type ModeloAgua,
  modeloAgua,
  paraMil,
  rotuloMes,
} from "@arp/shared/operacoes/agua";
import { mesesAntes } from "@arp/shared/operacoes/agua-alertas";
import { TIPOS_AGUA } from "@arp/shared/operacoes/agua-formato";
import {
  type ConferenciaArquivo,
  LIMITES_AGUA,
  type LinhaPrevia,
  type PreviaAgua,
  type ResumoGuardado,
  tipoDoArquivo,
  type ValoresPorArquivo,
} from "@arp/shared/operacoes/agua-importacao";
import type { EntradaPreviaAgua } from "@arp/shared/operacoes/contratos/agua";
import {
  BYTES_DO_TIPO,
  conteudoBateComExtensao,
  tipoPeloConteudo,
} from "@arp/shared/os/tipo-arquivo";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import {
  infoDoArquivo,
  inicioDoArquivo,
  lerArquivo,
  listarArquivos,
  prepararEnvio,
  removerArquivos,
} from "@/infra/arquivos";
import { caminhoValido } from "@/infra/arquivos/caminho";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import * as repo from "./agua-importacao.repository";
import {
  BUCKET,
  logImportacaoOp,
  nomesDeUsuarios,
  parametrosDoModulo,
  podeAgora,
} from "./apoio";
import * as imps from "./importacoes.repository";
import { lerAbas, paginasDoPdf, sha256 } from "./planilha";

// Importação mensal da água (spec 4.4 e 4.11): enviar → prévia → confirmar.
//
// 1. prepararEnvio: confere a permissão e devolve um link de envio por
//    arquivo (planilhas, PDFs e fotos vão do navegador direto para o disco,
//    na pasta agua/envios/<envio>).
// 2. gerarPrevia: lê os arquivos, confere linhas e totais com o resumo de
//    cada arquivo, liga as fotos pelo nome e grava a importação "prévia" com
//    as leituras (vigente = false) e os valores. Os blocos do mês que não
//    vieram agora são copiados da importação confirmada, para a nova versão
//    do mês ficar inteira (reenviar um bloco não apaga os outros).
// 3. Confirmar e descartar: operacoes.confirmar_importacao e
//    desfazer_importacao (o banco confere a permissão e o motivo).
//
// Tudo com a sessão (RLS), menos a cópia dos blocos mantidos, que lê os
// valores em reais pela service role (quem importa pode não ver reais),
// depois de conferir operacoes.agua.importar no banco.

const pastaDoEnvio = (envio: string) => `agua/envios/${envio}`;
const LOTE = 500;
const MAX_AVISOS = 500;

const SEM_PERMISSAO = "Você não tem permissão para importar a água.";

async function exigirImportar(ctx: Contexto): Promise<void> {
  if (!(await podeAgora(ctx, "operacoes.agua.importar")))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

// ---------------------------------------------------------------------------
// 1. Envio
// ---------------------------------------------------------------------------

export async function prepararEnvioAgua(
  ctx: Contexto,
  arquivos: { nome: string; tamanho: number }[],
): Promise<{
  envio: string;
  itens: { nome: string; caminho: string; url: string }[];
}> {
  await exigirImportar(ctx);
  let docs = 0;
  let fotos = 0;
  for (const a of arquivos) {
    const tipo = tipoDoArquivo(a.nome);
    if (!tipo)
      throw new ErroDeNegocio(
        `"${a.nome}" não é planilha (.xlsx), PDF nem foto (.jpg, .png, .webp).${/\.xls$/i.test(a.nome) ? " Planilha .xls antiga: abra e salve como .xlsx." : ""}`,
      );
    const limite =
      tipo === "foto" ? LIMITES_AGUA.fotoBytes : LIMITES_AGUA.planilhaBytes;
    if (a.tamanho > limite)
      throw new ErroDeNegocio(
        `"${a.nome}" passa de ${limite / 1024 / 1024} MB.`,
      );
    if (tipo === "foto") fotos++;
    else docs++;
  }
  if (docs > LIMITES_AGUA.arquivos)
    throw new ErroDeNegocio(
      `Envie até ${LIMITES_AGUA.arquivos} planilhas ou PDFs de uma vez.`,
    );
  if (fotos > LIMITES_AGUA.fotos)
    throw new ErroDeNegocio(
      `Envie até ${LIMITES_AGUA.fotos} fotos de uma vez.`,
    );

  const envio = randomUUID();
  const usados = new Set<string>();
  const itens: { nome: string; caminho: string; url: string }[] = [];
  for (const [i, a] of arquivos.entries()) {
    let nome = nomeSeguro(a.nome);
    if (usados.has(nome.toLowerCase())) nome = `${i}-${nome}`;
    usados.add(nome.toLowerCase());
    const caminho = `${pastaDoEnvio(envio)}/${nome}`;
    const link = await prepararEnvio(BUCKET, caminho, {
      maxBytes:
        tipoDoArquivo(a.nome) === "foto"
          ? LIMITES_AGUA.fotoBytes
          : LIMITES_AGUA.planilhaBytes,
    });
    if ("erro" in link)
      throw new ErroDeNegocio(
        "Não foi possível preparar o envio. Tente de novo.",
      );
    itens.push({ nome: a.nome, caminho, url: link.url });
  }
  return { envio, itens };
}

// ---------------------------------------------------------------------------
// 2. Prévia
// ---------------------------------------------------------------------------

/** Erro com mensagem para a tela (o resto vira a mensagem genérica). */
class ErroAgua extends Error {}

interface Registro {
  nome: string;
  caminho: string;
  sha256: string;
  bytes: number;
}

/** Confere o arquivo que chegou (tamanho e tipo pelo conteúdo). */
async function conferirChegada(
  a: { nome: string; caminho: string },
  limite: number,
): Promise<string | null> {
  const info = await infoDoArquivo(BUCKET, a.caminho);
  if (!info) return `"${a.nome}" não chegou. Envie de novo.`;
  if (info.tamanho <= 0) return `"${a.nome}" chegou vazio.`;
  if (info.tamanho > limite)
    return `"${a.nome}" passa de ${limite / 1024 / 1024} MB.`;
  const inicio = await inicioDoArquivo(BUCKET, a.caminho, BYTES_DO_TIPO);
  if (!inicio) return `Não foi possível conferir "${a.nome}".`;
  const ok = /\.csv$/i.test(a.nome)
    ? tipoPeloConteudo(inicio) === null
    : conteudoBateComExtensao(a.nome, inicio);
  return ok
    ? null
    : `"${a.nome}" não é o que o nome diz (o conteúdo não bate com a extensão).`;
}

async function lerDocumento(
  ctx: Contexto,
  a: { nome: string; caminho: string },
  opcoes: {
    modelo: ModeloAgua;
    mapeamento?: Partial<Record<CampoAgua, number>>;
    tolerancia: number;
  },
): Promise<{ leitura: LeituraArquivo; registro: Registro }> {
  const problema = await conferirChegada(a, LIMITES_AGUA.planilhaBytes);
  if (problema) throw new ErroAgua(problema);
  const bytes = await lerArquivo(BUCKET, a.caminho);
  if (!bytes) throw new ErroAgua(`"${a.nome}" não chegou. Envie de novo.`);
  const hash = sha256(bytes);
  const [anterior] = await naSessao(ctx, (tx) =>
    imps.importacaoDoArquivo(tx, "agua", hash, ["confirmada"]),
  );
  if (anterior)
    throw new ErroAgua(
      `"${a.nome}" já foi importado (${rotuloMes(anterior.referencia)}, confirmado${anterior.confirmado_em ? ` em ${new Date(anterior.confirmado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}). Para trocar o mês, desfaça aquela importação ou envie o arquivo novo do parceiro.`,
    );
  const registro = {
    nome: a.nome,
    caminho: a.caminho,
    sha256: hash,
    bytes: bytes.length,
  };
  if (tipoDoArquivo(a.nome) === "pdf") {
    const r = lerTextoPdf(a.nome, await paginasDoPdf(bytes), opcoes);
    if ("imagem" in r)
      throw new ErroAgua(
        `O PDF "${a.nome}" é só imagem (não tem texto para ler). Envie a planilha Excel do mesmo mês, que o parceiro manda junto: o sistema não lê texto de imagem.`,
      );
    return { leitura: r, registro };
  }
  return {
    leitura: lerPlanilhaAgua(a.nome, await lerAbas(bytes, a.nome), opcoes),
    registro,
  };
}

const resumoDaPasta = z.object({ pasta: z.string() }).partial().nullable();

/** Desfaz a prévia e apaga os arquivos do envio dela. */
async function descartar(ctx: Contexto, id: string, resumo: unknown) {
  await naSessao(ctx, (tx) => imps.desfazer(tx, id));
  const pasta = resumoDaPasta.catch(null).parse(resumo)?.pasta;
  if (pasta && caminhoValido(pasta) && pasta.startsWith("agua/envios/"))
    await removerArquivos(BUCKET, await listarArquivos(BUCKET, pasta));
}

/** Cancela as outras prévias de água da pessoa (uma aberta por vez). */
async function cancelarPreviasAbertas(ctx: Contexto) {
  const abertas = await naSessao(ctx, (tx) =>
    imps.previasDaPessoa(tx, "agua", ctx.usuario.id),
  );
  for (const p of abertas) await descartar(ctx, p.id, p.resumo);
}

const centavos = (v: number) => Math.round(v * 100);
const tipoAgua = (t: string) => TIPOS_AGUA.find((x) => x === t) ?? "FATURADO";

/**
 * Lê os arquivos enviados e grava a prévia. Erro de leitura volta como
 * mensagem; colunas não reconhecidas voltam como pedido de mapeamento.
 */
export async function gerarPrevia(ctx: Contexto, pedido: EntradaPreviaAgua) {
  await exigirImportar(ctx);
  const pasta = pastaDoEnvio(pedido.envio);
  if (
    pedido.arquivos.some(
      (a) => !a.caminho.startsWith(`${pasta}/`) || !caminhoValido(a.caminho),
    )
  )
    throw new ErroDeNegocio("Arquivo fora do envio. Envie de novo.");
  try {
    return await montarPrevia(ctx, { ...pedido, pasta });
  } catch (erro) {
    if (erro instanceof ErroAgua) throw new ErroDeNegocio(erro.message);
    log.error({ err: erro }, "prévia da água");
    throw new ErroDeNegocio(
      "Não foi possível ler os arquivos. Nada foi gravado; tente de novo.",
    );
  }
}

async function montarPrevia(
  ctx: Contexto,
  pedido: EntradaPreviaAgua & { pasta: string },
) {
  const p = await parametrosDoModulo(ctx);
  const tolerancia = Number(p.agua_tolerancia);
  const modeloSalvo = modeloAgua.safeParse(p.agua_modelo);
  const modelo = modeloSalvo.success ? modeloSalvo.data : {};
  const avisos: AvisoAgua[] = modeloSalvo.success
    ? []
    : [
        {
          nivel: "aviso",
          mensagem:
            "O modelo de importação salvo em Parâmetros está inválido e foi ignorado.",
        },
      ];

  const docs = pedido.arquivos.filter((a) => tipoDoArquivo(a.nome) !== "foto");
  const fotos = pedido.arquivos.filter((a) => tipoDoArquivo(a.nome) === "foto");

  // Leitura dos arquivos: as planilhas primeiro; o PDF (em geral só imagem)
  // de um bloco que já veio em planilha nem é aberto.
  let lidos: ArquivoLido[] = [];
  const registros: Registro[] = [];
  const ordem = [...docs].sort(
    (a, b) =>
      Number(tipoDoArquivo(a.nome) === "pdf") -
      Number(tipoDoArquivo(b.nome) === "pdf"),
  );
  for (const a of ordem) {
    const blocoDoPdf =
      tipoDoArquivo(a.nome) === "pdf" ? blocoDoNome(a.nome) : null;
    if (blocoDoPdf && lidos.some((l) => l.blocos.includes(blocoDoPdf))) {
      avisos.push({
        nivel: "info",
        arquivo: a.nome,
        mensagem: `"${a.nome}" não foi lido: a planilha do Bloco ${blocoDoPdf} vale.`,
      });
      continue;
    }
    const { leitura, registro } = await lerDocumento(ctx, a, {
      modelo,
      mapeamento: pedido.mapeamento,
      tolerancia,
    });
    if ("erro" in leitura) throw new ErroAgua(leitura.erro);
    if ("colunas" in leitura)
      return {
        colunas: {
          ...leitura.colunas,
          podeSalvarModelo: await podeAgora(ctx, "operacoes.parametros"),
        },
      };
    lidos.push(leitura.ok);
    registros.push(registro);
  }
  const blocosDaPlanilha = new Set(
    lidos.filter((l) => l.fonte === "planilha").flatMap((l) => l.blocos),
  );
  lidos = lidos.filter((l) => {
    if (
      l.fonte === "planilha" ||
      !l.blocos.every((b) => blocosDaPlanilha.has(b))
    )
      return true;
    avisos.push({
      nivel: "info",
      arquivo: l.arquivo,
      mensagem: `"${l.arquivo}" não foi usado: a planilha do mesmo bloco vale.`,
    });
    return false;
  });
  const vistos = new Map<string, string>();
  for (const l of lidos)
    for (const b of l.blocos) {
      const outro = vistos.get(b);
      if (outro)
        throw new ErroAgua(
          `O Bloco ${b} veio em dois arquivos ("${outro}" e "${l.arquivo}"). Envie um arquivo por bloco.`,
        );
      vistos.set(b, l.arquivo);
    }

  // Mês de referência: o dos arquivos, ou o escolhido na tela.
  const escolhido = pedido.referencia ? `${pedido.referencia}-01` : null;
  const doArquivo = [
    ...new Set(
      [
        ...lidos.map((l) => l.referencia),
        ...(lidos.length
          ? []
          : fotos.map((f) => lerNomeDaFoto(f.nome)?.referencia ?? null)),
      ].filter((r): r is string => r !== null),
    ),
  ];
  if (doArquivo.length > 1)
    throw new ErroAgua(
      `Os arquivos são de meses diferentes (${doArquivo.map(rotuloMes).join(", ")}). Importe um mês por vez.`,
    );
  if (escolhido && doArquivo[0] && doArquivo[0] !== escolhido)
    throw new ErroAgua(
      `Os arquivos são de ${rotuloMes(doArquivo[0])}, não de ${rotuloMes(escolhido)}.`,
    );
  const referencia = escolhido ?? doArquivo[0];
  if (!referencia)
    throw new ErroAgua(
      "Não achei o mês de referência nos arquivos. Escolha o mês e leia de novo.",
    );

  // O mês já confirmado: substitui, e os blocos que não vieram continuam.
  const anterior = await naSessao(ctx, (tx) =>
    repo.confirmadaDoMes(tx, referencia),
  );
  if (!lidos.length && !anterior)
    throw new ErroAgua(
      `${rotuloMes(referencia)} ainda não foi importado: envie a planilha junto com as fotos.`,
    );
  const blocosNovos = new Set(lidos.flatMap((l) => l.blocos));
  // Service role: quem importa pode não ver os reais (já conferido acima).
  const mantidas = anterior
    ? (await banco.comoServico((tx) => repo.leiturasComValor(tx, anterior.id)))
        .filter((l) => !blocosNovos.has(l.bloco))
        .map((l) => ({ ...l, valor: Number(l.valor ?? 0) }))
    : [];
  const mantidos = [...new Set(mantidas.map((m) => m.bloco))].sort();

  for (const l of lidos) avisos.push(...l.avisos);
  for (const b of blocosNovos)
    if (!p.agua_blocos.includes(b))
      avisos.push({
        nivel: "aviso",
        bloco: b,
        mensagem: `O Bloco ${b} não está entre os blocos ativos de Parâmetros.`,
      });

  // Mês passado: leitura anterior × atual de lá e hidrômetros novos.
  const novas = lidos.flatMap((l) =>
    l.linhas.map((x) => ({ ...x, arquivo: l.arquivo })),
  );
  const hidros = [...new Set(novas.map((l) => l.hidrometro))];
  const { passado, conhecidos, historico, noCadastro } = await naSessao(
    ctx,
    async (tx) => ({
      passado: await repo.atuaisDoMes(tx, mesesAntes(referencia, 1), hidros),
      conhecidos: await repo.vistosAntes(tx, referencia, hidros),
      historico: await repo.temHistorico(tx, referencia),
      noCadastro: new Set(
        (await repo.cadastrados(tx, hidros)).map((h) => h.numero),
      ),
    }),
  );
  const atualDoPassado = new Map(
    passado.map((x) => [x.hidrometro, x.leitura_atual]),
  );
  const tolMil = paraMil(tolerancia);
  for (const l of novas) {
    const antes = atualDoPassado.get(l.hidrometro);
    if (antes === undefined || antes === null || l.leituraAnterior === null)
      continue;
    if (Math.abs(paraMil(Number(antes)) - paraMil(l.leituraAnterior)) > tolMil)
      avisos.push({
        nivel: "aviso",
        arquivo: l.arquivo,
        bloco: l.bloco,
        linha: l.linha,
        mensagem: `Hidrômetro ${l.hidrometro}: leitura anterior (${l.leituraAnterior.toLocaleString("pt-BR")}) diferente da leitura atual de ${rotuloMes(mesesAntes(referencia, 1))} (${Number(antes).toLocaleString("pt-BR")}). Troca de hidrômetro ou erro do arquivo?`,
      });
  }
  // Hidrômetro só entra no cadastro à mão (Configurações › Cadastros): a
  // prévia avisa quais do arquivo ainda não estão lá.
  const foraDoCadastro = hidros.filter((h) => !noCadastro.has(h));
  if (foraDoCadastro.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `${foraDoCadastro.length} ${foraDoCadastro.length === 1 ? "hidrômetro não está" : "hidrômetros não estão"} em Cadastros: ${foraDoCadastro.slice(0, 20).join(", ")}${foraDoCadastro.length > 20 ? "…" : ""}. A leitura entra assim mesmo; cadastre em Configurações › Cadastros para ligar a foto escolhendo o hidrômetro.`,
    });
  const jaVistos = new Set(conhecidos.map((x) => x.hidrometro));
  const novos = historico ? hidros.filter((h) => !jaVistos.has(h)) : [];

  // Fotos: confere cada uma e liga pelo nome.
  const recusadas: { nome: string; motivo: string }[] = [];
  const validas: typeof fotos = [];
  for (let i = 0; i < fotos.length; i += 25) {
    const lote = fotos.slice(i, i + 25);
    const problemas = await Promise.all(
      lote.map((f) => conferirChegada(f, LIMITES_AGUA.fotoBytes)),
    );
    lote.forEach((f, j) => {
      const problema = problemas[j];
      if (problema) recusadas.push({ nome: f.nome, motivo: problema });
      else validas.push(f);
    });
  }
  const todos = new Set([...hidros, ...mantidas.map((m) => m.hidrometro)]);
  const ligacao = ligarFotos(
    validas.map((f) => f.nome),
    referencia,
    todos,
  );
  recusadas.push(...ligacao.recusadas);
  const caminhoDaFoto = new Map(validas.map((f) => [f.nome, f.caminho]));
  const fotoDe = (h: string) => {
    const nome = ligacao.ligadas.get(codigoHidrometro(h));
    return nome ? (caminhoDaFoto.get(nome) ?? null) : null;
  };
  const usadas = new Set([...ligacao.ligadas.values()]);
  const sobras = fotos.filter((f) => !usadas.has(f.nome)).map((f) => f.caminho);
  if (sobras.length) await removerArquivos(BUCKET, sobras);

  // Conferência de cada arquivo com o resumo dele.
  const conciliacoes = lidos.map((l) => conciliar(l, tolerancia));
  let bate = conciliacoes.every((c) => c.bate);
  if (anterior?.incompleta && mantidos.length) {
    bate = false;
    avisos.push({
      nivel: "erro",
      mensagem: `${rotuloMes(referencia)} estava marcado incompleto e os blocos ${mantidos.join(", ")} continuam da importação anterior. Reenvie todos os blocos ou confirme com o motivo.`,
    });
  }

  const conferencias: ResumoGuardado["conferencias"] = conciliacoes.map(
    (c, i) => ({
      arquivo: c.arquivo,
      blocos: c.blocos,
      fonte: lidos[i]?.fonte ?? "planilha",
      linhas: c.linhas,
      resumoLinhas: c.resumo
        ? (c.resumo.hidrometros ?? c.resumo.faturados)
        : null,
      consumo: c.consumo / 1000,
      resumoConsumo: c.resumo?.consumo == null ? null : c.resumo.consumo / 1000,
      volume: c.volume / 1000,
      resumoVolume: c.resumo?.volume == null ? null : c.resumo.volume / 1000,
      bate: c.bate,
      diferencas: c.diferencas,
    }),
  );
  const porArquivo: ValoresPorArquivo = Object.fromEntries(
    conciliacoes.map((c) => [
      c.blocos.join(",") || c.arquivo,
      {
        arquivo: c.resumo?.valor == null ? null : c.resumo.valor / 100,
        lido: c.valor / 100,
      },
    ]),
  );

  // Linhas a gravar: as novas e as mantidas (com a foto nova, se veio).
  const gravar = [
    ...novas.map((l) => ({
      id: randomUUID(),
      referencia,
      bloco: l.bloco,
      sala: l.sala,
      cliente: l.cliente,
      hidrometro: l.hidrometro,
      data_anterior: l.dataAnterior,
      leitura_anterior: l.leituraAnterior,
      data_atual: l.dataAtual,
      leitura_atual: l.leituraAtual,
      dias: l.dias,
      consumo: l.consumo,
      volume_faturado: l.volumeFaturado,
      tipo: l.tipo,
      foto: fotoDe(l.hidrometro),
      linha_arquivo: l.linha,
      valor: l.valorCentavos / 100,
    })),
    ...mantidas.map((m) => ({
      id: randomUUID(),
      referencia,
      bloco: m.bloco,
      sala: m.sala,
      cliente: m.cliente,
      hidrometro: m.hidrometro,
      data_anterior: m.data_anterior,
      leitura_anterior: m.leitura_anterior,
      data_atual: m.data_atual,
      leitura_atual: m.leitura_atual,
      dias: m.dias,
      consumo: Number(m.consumo),
      volume_faturado: Number(m.volume_faturado),
      tipo: tipoAgua(m.tipo),
      foto: fotoDe(m.hidrometro) ?? m.foto,
      linha_arquivo: null,
      valor: m.valor,
    })),
  ];
  if (!gravar.length) throw new ErroAgua("Nenhuma leitura para importar.");

  const resumo: ResumoGuardado = {
    pasta: pedido.pasta,
    conferencias,
    mantidos,
    totais: {
      linhas: gravar.length,
      consumo: gravar.reduce((s, l) => s + paraMil(l.consumo), 0) / 1000,
      volume: gravar.reduce((s, l) => s + paraMil(l.volume_faturado), 0) / 1000,
    },
    fotos: {
      ligadas: ligacao.ligadas.size,
      semLeitura: ligacao.semLeitura,
      recusadas,
      semFoto: gravar.filter((l) => !l.foto).length,
    },
    novos,
    ignoradas: lidos.flatMap((l) =>
      l.ignoradas.map((i) => ({ arquivo: l.arquivo, ...i })),
    ),
  };

  await cancelarPreviasAbertas(ctx);
  const valorArquivo = conciliacoes.every((c) => c.resumo?.valor != null)
    ? conciliacoes.reduce((s, c) => s + (c.resumo?.valor ?? 0), 0) / 100
    : null;
  // Uma transação: a importação, os valores e as leituras entram juntos.
  let id: string;
  try {
    id = await naSessao(ctx, async (tx) => {
      const imp = await imps.inserirImportacao(tx, {
        tipo: "agua",
        referencia,
        arquivos: registros,
        resumo,
        avisos: avisos.slice(0, MAX_AVISOS),
        bate,
        criado_por: ctx.usuario.id,
      });
      await repo.inserirValoresDaImportacao(tx, {
        importacao_id: imp.id,
        valor_arquivo: valorArquivo,
        valor_lido: conciliacoes.reduce((s, c) => s + c.valor, 0) / 100,
        por_bloco: porArquivo,
      });
      for (let i = 0; i < gravar.length; i += LOTE) {
        const lote = gravar.slice(i, i + LOTE);
        await repo.inserirLeituras(
          tx,
          lote.map(({ valor: _, ...l }) => ({ ...l, importacao_id: imp.id })),
        );
        await repo.inserirValores(
          tx,
          lote.map((l) => ({
            leitura_id: l.id,
            valor: centavos(l.valor) / 100,
          })),
        );
      }
      return imp.id;
    });
  } catch (erro) {
    await removerArquivos(
      BUCKET,
      await listarArquivos(BUCKET, pedido.pasta),
    ).catch(() => {});
    throw erro;
  }

  if (pedido.salvarModelo && pedido.mapeamento)
    await salvarModelo(
      ctx,
      pedido.mapeamento,
      lidos.find((l) => l.fonte === "planilha")?.titulos ?? [],
    );
  return { previa: await previaDaImportacao(ctx, id) };
}

function ehCampo(c: string): c is CampoAgua {
  return c in CAMPOS_AGUA;
}

/** Guarda o mapeamento escolhido como modelo (precisa de operacoes.parametros). */
async function salvarModelo(
  ctx: Contexto,
  mapeamento: Partial<Record<CampoAgua, number>>,
  titulos: string[],
): Promise<void> {
  if (!(await podeAgora(ctx, "operacoes.parametros"))) return;
  // Guarda o título da coluna (vale mesmo se a ordem mudar); sem título, a
  // letra, que o leitor também entende.
  const modelo: ModeloAgua = {};
  for (const [campo, i] of Object.entries(mapeamento)) {
    if (!ehCampo(campo) || i === undefined) continue;
    const titulo = titulos[i]?.trim();
    modelo[campo] = titulo && titulo.length <= 80 ? titulo : letra(i);
  }
  try {
    await naSessao(ctx, (tx) => repo.salvarModelo(tx, modelo, ctx.usuario.id));
  } catch (err) {
    log.error({ err }, "modelo de importação da água");
  }
}

function letra(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Prévia para a tela (também ao reabrir a importação)
// ---------------------------------------------------------------------------

const conferenciaGuardada = z.object({
  arquivo: z.string(),
  blocos: z.array(z.string()),
  fonte: z.enum(["planilha", "pdf"]),
  linhas: z.number(),
  resumoLinhas: z.number().nullable(),
  consumo: z.number(),
  resumoConsumo: z.number().nullable(),
  volume: z.number(),
  resumoVolume: z.number().nullable(),
  bate: z.boolean(),
  diferencas: z.array(z.string()),
});

const resumoGuardado = z.object({
  pasta: z.string(),
  conferencias: z.array(conferenciaGuardada).default([]),
  mantidos: z.array(z.string()).default([]),
  totais: z.object({
    linhas: z.number(),
    consumo: z.number(),
    volume: z.number(),
  }),
  fotos: z.object({
    ligadas: z.number(),
    semLeitura: z.array(z.string()),
    recusadas: z.array(z.object({ nome: z.string(), motivo: z.string() })),
    semFoto: z.number(),
  }),
  novos: z.array(z.string()).default([]),
  ignoradas: z
    .array(
      z.object({ arquivo: z.string(), linha: z.number(), motivo: z.string() }),
    )
    .default([]),
});

const avisosGuardados = z
  .array(
    z.object({
      nivel: z.enum(["erro", "aviso", "info"]),
      arquivo: z.string().optional(),
      bloco: z.string().optional(),
      linha: z.number().optional(),
      mensagem: z.string(),
    }),
  )
  .catch([]);

const valoresGuardados = z
  .record(
    z.string(),
    z.object({ arquivo: z.number().nullable(), lido: z.number() }),
  )
  .catch({});

export async function previaDaImportacao(
  ctx: Contexto,
  id: string,
): Promise<PreviaAgua> {
  const comValores = await podeAgora(ctx, "operacoes.agua.valores");
  const lido = await naSessao(ctx, async (tx) => {
    const imp = await imps.importacao(tx, id);
    if (!imp || imp.tipo !== "agua") return null;
    return {
      imp,
      valores: await repo.valoresDaImportacao(tx, id),
      linhas: await repo.linhasDaPrevia(tx, id),
      anterior: await repo.confirmadaDoMes(tx, imp.referencia, id),
    };
  });
  if (!lido) throw new ErroDeNegocio("Importação não encontrada.");
  const { imp, valores, linhas, anterior } = lido;
  const resumo = resumoGuardado.parse(imp.resumo);
  const nomes = anterior
    ? await nomesDeUsuarios(
        ctx,
        [anterior.confirmado_por],
        ["operacoes.agua.ver", "operacoes.agua.importar"],
      )
    : new Map<string, string>();
  const porArquivo = valoresGuardados.parse(valores?.por_bloco ?? {});
  const conferencias: ConferenciaArquivo[] = resumo.conferencias.map((c) => {
    const v = porArquivo[c.blocos.join(",") || c.arquivo];
    return {
      ...c,
      valor: comValores && v ? v.lido : null,
      resumoValor: comValores && v ? v.arquivo : null,
    };
  });
  const lista: LinhaPrevia[] = linhas.map((l) => ({
    id: l.id,
    bloco: l.bloco,
    sala: l.sala,
    cliente: l.cliente,
    hidrometro: l.hidrometro,
    leituraAnterior:
      l.leitura_anterior === null ? null : Number(l.leitura_anterior),
    leituraAtual: l.leitura_atual === null ? null : Number(l.leitura_atual),
    consumo: Number(l.consumo),
    volume: Number(l.volume_faturado),
    valor: comValores && l.valor != null ? Number(l.valor) : null,
    tipo: tipoAgua(l.tipo),
    foto: l.foto !== null,
    linha: l.linha_arquivo,
  }));
  return {
    id: imp.id,
    referencia: imp.referencia,
    bate: imp.bate !== false,
    comValores,
    conferencias,
    mantidos: resumo.mantidos,
    substitui: anterior
      ? {
          em: anterior.confirmado_em,
          por:
            (anterior.confirmado_por && nomes.get(anterior.confirmado_por)) ||
            "—",
          incompleta: anterior.incompleta,
        }
      : null,
    totais: {
      ...resumo.totais,
      valor: comValores
        ? lista.reduce((s, l) => s + centavos(l.valor ?? 0), 0) / 100
        : null,
    },
    avisos: avisosGuardados.parse(imp.avisos),
    ignoradas: resumo.ignoradas,
    fotos: resumo.fotos,
    novos: resumo.novos,
    linhas: lista,
  };
}

/** A prévia de água aberta da pessoa (para continuar ou descartar). */
export async function previaAberta(ctx: Contexto): Promise<PreviaAgua | null> {
  if (!(await podeAgora(ctx, "operacoes.agua.importar"))) return null;
  try {
    const [aberta] = await naSessao(ctx, (tx) =>
      imps.previasDaPessoa(tx, "agua", ctx.usuario.id),
    );
    return aberta ? await previaDaImportacao(ctx, aberta.id) : null;
  } catch (err) {
    log.error({ err }, "prévia aberta da água");
    return null;
  }
}

/** Descarta a prévia (só a própria, ainda prévia) e apaga os arquivos dela. */
export async function descartarPrevia(ctx: Contexto, id: string) {
  await exigirImportar(ctx);
  const imp = await naSessao(ctx, (tx) => imps.importacao(tx, id));
  if (!imp || imp.tipo !== "agua")
    throw new ErroDeNegocio("Importação não encontrada.");
  if (imp.status !== "previa" || imp.criado_por !== ctx.usuario.id)
    throw new ErroDeNegocio(
      "Só a sua prévia, ainda não confirmada, pode ser descartada aqui.",
    );
  try {
    await descartar(ctx, imp.id, imp.resumo);
  } catch (err) {
    log.error({ err }, "descartar prévia da água");
    throw new ErroDeNegocio("Não foi possível descartar. Tente de novo.");
  }
  logImportacaoOp(ctx, "descartou", { id, tipo: "agua" });
  return "Prévia descartada.";
}

/**
 * Apaga os arquivos de um envio que não virou prévia (erro de leitura ou
 * cancelado no mapeamento das colunas). Envio de uma importação fica.
 */
export async function limparEnvio(ctx: Contexto, envio: string) {
  if (!(await podeAgora(ctx, "operacoes.agua.importar"))) return;
  const pasta = pastaDoEnvio(envio);
  try {
    if (await naSessao(ctx, (tx) => repo.envioUsado(tx, pasta))) return;
    await removerArquivos(BUCKET, await listarArquivos(BUCKET, pasta));
  } catch (err) {
    log.error({ err }, "limpar envio da água");
  }
}

/** Confirma a prévia: o mês passa a valer (incompleto, com o motivo). */
export async function confirmar(
  ctx: Contexto,
  id: string,
  motivoBruto?: string,
): Promise<{ mensagem: string; referencia: string }> {
  const imp = await naSessao(ctx, (tx) => imps.importacao(tx, id));
  if (!imp || imp.tipo !== "agua")
    throw new ErroDeNegocio("Importação não encontrada.");
  if (imp.status !== "previa")
    throw new ErroDeNegocio("Esta prévia já foi confirmada ou descartada.");
  const motivo = motivoBruto || undefined;
  if (imp.bate === false && (!motivo || motivo.length < 3))
    throw new ErroDeNegocio(
      "Linhas e totais não batem com o resumo do arquivo: escreva o motivo para confirmar assim mesmo (o mês fica marcado incompleto).",
    );
  try {
    await naSessao(ctx, (tx) =>
      imps.confirmar(tx, id, imp.bate === false ? motivo : undefined),
    );
  } catch (erro) {
    if (erro instanceof ErroDePermissao)
      throw new ErroDePermissao(SEM_PERMISSAO);
    if (erro instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Há hidrômetro repetido na mesma sala do mês. Confira o arquivo e envie de novo.",
      );
    if (erro instanceof ErroDeNegocio) throw erro;
    log.error({ err: erro }, "confirmar importação da água");
    throw new ErroDeNegocio("Não foi possível confirmar. Nada foi alterado.");
  }
  logImportacaoOp(
    ctx,
    "confirmou",
    { id: imp.id, tipo: "agua", referencia: imp.referencia },
    imp.bate === false ? "marcada incompleta" : undefined,
    imp.bate === false ? { incompleta: true, motivo } : {},
  );
  return {
    mensagem: `${rotuloMes(imp.referencia)} importado${imp.bate === false ? " (marcado incompleto)" : ""}.`,
    referencia: imp.referencia,
  };
}
