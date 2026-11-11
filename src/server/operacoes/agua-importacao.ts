import "server-only";
import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { nomeSeguro } from "@/lib/arquivos/nome";
import {
  type ArquivoLido,
  type AvisoAgua,
  blocoDoNome,
  CAMPOS_AGUA,
  type CampoAgua,
  codigoHidrometro,
  conciliar,
  type LeituraArquivo,
  LISTA_CAMPOS,
  lerNomeDaFoto,
  lerPlanilhaAgua,
  lerTextoPdf,
  ligarFotos,
  type ModeloAgua,
  modeloAgua,
  paraMil,
  rotuloMes,
  type TipoAgua,
} from "@/lib/operacoes/agua";
import { mesesAntes } from "@/lib/operacoes/agua-alertas";
import {
  type ArquivoParaEnviar,
  type ConferenciaArquivo,
  type EnvioPreparado,
  LIMITES_AGUA,
  type LinhaPrevia,
  type PedidoDePrevia,
  type PreviaAgua,
  type RespostaPrevia,
  type ResumoGuardado,
  tipoDoArquivo,
  type ValoresPorArquivo,
} from "@/lib/operacoes/agua-importacao";
import {
  BYTES_DO_TIPO,
  conteudoBateComExtensao,
  tipoPeloConteudo,
} from "@/lib/os/tipo-arquivo";
import type { Json } from "@/lib/supabase/database.types";
import {
  infoDoArquivo,
  inicioDoArquivo,
  lerArquivo,
  listarArquivos,
  prepararEnvio,
  removerArquivos,
} from "@/server/arquivos";
import { caminhoValido } from "@/server/arquivos/caminho";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { lerAbas, sha256 } from "@/server/comercial/importacoes";
import { lerTudo } from "@/server/supabase-paginas";
import { nomesDe } from "./agua";
import { falhar, op, opAdmin, parametros } from "./base";

// Importação mensal da água (spec 4.4 e 4.11): enviar → prévia → confirmar.
//
// 1. prepararEnvioAgua: confere a permissão e devolve um link de envio por
//    arquivo (planilhas, PDFs e fotos vão do navegador direto para o disco,
//    na pasta agua/envios/<envio>, sem o limite da Server Action).
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
// depois de podeAgora("operacoes.agua.importar").

const BUCKET = "operacoes" as const;
const pastaDoEnvio = (envio: string) => `agua/envios/${envio}`;
const LOTE = 500;
const MAX_AVISOS = 500;

const SEM_PERMISSAO = "Você não tem permissão para importar a água.";

// ---------------------------------------------------------------------------
// 1. Envio
// ---------------------------------------------------------------------------

const arquivosParaEnviar = z
  .array(
    z.object({
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    }),
  )
  .min(1, "Escolha os arquivos.")
  .max(LIMITES_AGUA.arquivos + LIMITES_AGUA.fotos);

export async function prepararEnvioAgua(
  entrada: ArquivoParaEnviar[],
): Promise<EnvioPreparado> {
  const e = arquivosParaEnviar.safeParse(entrada);
  if (!e.success)
    return { erro: e.error.issues[0]?.message ?? "Arquivos inválidos." };
  if (!(await podeAgora("operacoes.agua.importar")))
    return { erro: SEM_PERMISSAO };
  let docs = 0;
  let fotos = 0;
  for (const a of e.data) {
    const tipo = tipoDoArquivo(a.nome);
    if (!tipo)
      return {
        erro: `"${a.nome}" não é planilha (.xlsx), PDF nem foto (.jpg, .png, .webp).${/\.xls$/i.test(a.nome) ? " Planilha .xls antiga: abra e salve como .xlsx." : ""}`,
      };
    const limite =
      tipo === "foto" ? LIMITES_AGUA.fotoBytes : LIMITES_AGUA.planilhaBytes;
    if (a.tamanho > limite)
      return { erro: `"${a.nome}" passa de ${limite / 1024 / 1024} MB.` };
    if (tipo === "foto") fotos++;
    else docs++;
  }
  if (docs > LIMITES_AGUA.arquivos)
    return {
      erro: `Envie até ${LIMITES_AGUA.arquivos} planilhas ou PDFs de uma vez.`,
    };
  if (fotos > LIMITES_AGUA.fotos)
    return { erro: `Envie até ${LIMITES_AGUA.fotos} fotos de uma vez.` };

  const envio = randomUUID();
  const usados = new Set<string>();
  const itens = await Promise.all(
    e.data.map(async (a, i) => {
      let nome = nomeSeguro(a.nome);
      if (usados.has(nome.toLowerCase())) nome = `${i}-${nome}`;
      usados.add(nome.toLowerCase());
      const caminho = `${pastaDoEnvio(envio)}/${nome}`;
      const tipo = tipoDoArquivo(a.nome);
      const link = await prepararEnvio(BUCKET, caminho, {
        maxBytes:
          tipo === "foto" ? LIMITES_AGUA.fotoBytes : LIMITES_AGUA.planilhaBytes,
      });
      return "erro" in link ? null : { nome: a.nome, caminho, url: link.url };
    }),
  );
  if (itens.some((i) => i === null))
    return { erro: "Não foi possível preparar o envio. Tente de novo." };
  return {
    envio,
    itens: itens as { nome: string; caminho: string; url: string }[],
  };
}

// ---------------------------------------------------------------------------
// 2. Prévia
// ---------------------------------------------------------------------------

const pedidoDePrevia = z.object({
  envio: z.uuid(),
  arquivos: z
    .array(
      z.object({
        nome: z.string().min(1).max(255),
        caminho: z.string().max(400),
      }),
    )
    .min(1)
    .max(LIMITES_AGUA.arquivos + LIMITES_AGUA.fotos),
  referencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  mapeamento: z
    .partialRecord(
      z.enum(LISTA_CAMPOS as [CampoAgua, ...CampoAgua[]]),
      z.number().int().min(0).max(200),
    )
    .optional(),
  salvarModelo: z.boolean().optional(),
});

/** Erro com mensagem para a tela. */
class ErroAgua extends Error {}

/** Linhas de texto de cada página (itens agrupados pela altura). */
async function paginasDoPdf(bytes: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const paginas: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    const linhas = new Map<number, { x: number; t: string }[]>();
    for (const i of items) {
      if (!("str" in i) || !i.str.trim()) continue;
      const y = Math.round(i.transform[5] / 3) * 3;
      const lista = linhas.get(y) ?? [];
      lista.push({ x: i.transform[4], t: i.str.trim() });
      linhas.set(y, lista);
    }
    paginas.push(
      [...linhas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, l]) =>
          l
            .sort((a, b) => a.x - b.x)
            .map((x) => x.t)
            .join(" "),
        )
        .join("\n"),
    );
  }
  return paginas;
}

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

/** Arquivo já confirmado numa importação da água (mesmo sha256). */
async function jaImportado(hash: string) {
  const { data, error } = await (await op())
    .from("importacoes")
    .select("referencia, confirmado_em")
    .eq("tipo", "agua")
    .eq("status", "confirmada")
    .contains("arquivos", JSON.stringify([{ sha256: hash }]))
    .limit(1)
    .maybeSingle();
  falhar(error);
  return data;
}

async function lerDocumento(
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
  const anterior = await jaImportado(hash);
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

/** Leituras da importação confirmada que continuam (blocos que não vieram). */
async function leiturasMantidas(
  importacaoId: string,
  blocosNovos: Set<string>,
) {
  const db = opAdmin();
  const linhas = await lerTudo(() =>
    db
      .from("agua_leituras")
      .select(
        "id, bloco, sala, cliente, hidrometro, data_anterior, leitura_anterior, data_atual, leitura_atual, dias, consumo, volume_faturado, tipo, foto, agua_valores(valor)",
      )
      .eq("importacao_id", importacaoId)
      .order("id"),
  );
  return linhas
    .filter((l) => !blocosNovos.has(l.bloco))
    .map((l) => {
      const v = l.agua_valores as
        | { valor: number }
        | { valor: number }[]
        | null;
      const valor = Array.isArray(v) ? v[0]?.valor : v?.valor;
      return { ...l, valor: Number(valor ?? 0) };
    });
}

/** Em lotes, para o filtro "in" não passar do tamanho do endereço. */
async function emLotes<T, R>(
  itens: T[],
  tamanho: number,
  fn: (lote: T[]) => Promise<R[]>,
) {
  const r: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho)
    r.push(...(await fn(itens.slice(i, i + tamanho))));
  return r;
}

/** Cancela as outras prévias de água da pessoa (uma aberta por vez). */
async function cancelarPreviasAbertas(usuarioId: string) {
  const db = await op();
  const { data } = await db
    .from("importacoes")
    .select("id, resumo")
    .eq("tipo", "agua")
    .eq("status", "previa")
    .eq("criado_por", usuarioId);
  for (const p of data ?? []) await descartar(p.id, p.resumo);
}

async function descartar(id: string, resumo: Json) {
  const { error } = await (await op()).rpc("desfazer_importacao", { p_id: id });
  if (error) throw error;
  const pasta = (resumo as Partial<ResumoGuardado> | null)?.pasta;
  if (pasta && caminhoValido(pasta) && pasta.startsWith("agua/envios/"))
    await removerArquivos(BUCKET, await listarArquivos(BUCKET, pasta));
}

const centavos = (v: number) => Math.round(v * 100);

/**
 * Lê os arquivos enviados e grava a prévia. Erro de leitura volta como
 * mensagem; colunas não reconhecidas voltam como pedido de mapeamento.
 */
export async function gerarPrevia(
  pedido: PedidoDePrevia,
): Promise<RespostaPrevia> {
  const e = pedidoDePrevia.safeParse(pedido);
  if (!e.success)
    return { erro: "Pedido de prévia inválido. Envie os arquivos de novo." };
  if (!(await podeAgora("operacoes.agua.importar")))
    return { erro: SEM_PERMISSAO };
  const pasta = pastaDoEnvio(e.data.envio);
  if (
    e.data.arquivos.some(
      (a) => !a.caminho.startsWith(`${pasta}/`) || !caminhoValido(a.caminho),
    )
  )
    return { erro: "Arquivo fora do envio. Envie de novo." };
  try {
    return await montarPrevia({ ...e.data, pasta });
  } catch (erro) {
    if (erro instanceof ErroAgua) return { erro: erro.message };
    console.error("prévia da água", erro);
    return {
      erro: "Não foi possível ler os arquivos. Nada foi gravado; tente de novo.",
    };
  }
}

async function montarPrevia(
  pedido: z.infer<typeof pedidoDePrevia> & { pasta: string },
): Promise<RespostaPrevia> {
  const [usuario, p] = await Promise.all([usuarioAtual(), parametros()]);
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
    const { leitura, registro } = await lerDocumento(a, {
      modelo,
      mapeamento: pedido.mapeamento,
      tolerancia,
    });
    if ("erro" in leitura) throw new ErroAgua(leitura.erro);
    if ("colunas" in leitura)
      return {
        colunas: {
          ...leitura.colunas,
          podeSalvarModelo: await podeAgora("operacoes.parametros"),
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
  const db = await op();
  const { data: anterior, error: errAnterior } = await db
    .from("importacoes")
    .select("id, incompleta, confirmado_em, confirmado_por")
    .eq("tipo", "agua")
    .eq("status", "confirmada")
    .eq("referencia", referencia)
    .maybeSingle();
  falhar(errAnterior);
  if (!lidos.length && !anterior)
    throw new ErroAgua(
      `${rotuloMes(referencia)} ainda não foi importado: envie a planilha junto com as fotos.`,
    );
  const blocosNovos = new Set(lidos.flatMap((l) => l.blocos));
  const mantidas = anterior
    ? await leiturasMantidas(anterior.id, blocosNovos)
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
  const [passado, conhecidos, historico] = await Promise.all([
    emLotes(hidros, 150, async (lote) => {
      const { data, error } = await db
        .from("agua_leituras")
        .select("hidrometro, leitura_atual")
        .eq("vigente", true)
        .eq("referencia", mesesAntes(referencia, 1))
        .in("hidrometro", lote);
      falhar(error);
      return data ?? [];
    }),
    emLotes(hidros, 150, async (lote) => {
      const { data, error } = await db
        .from("agua_leituras")
        .select("hidrometro")
        .eq("vigente", true)
        .lt("referencia", referencia)
        .in("hidrometro", lote);
      falhar(error);
      return data ?? [];
    }),
    db
      .from("agua_leituras")
      .select("id", { count: "exact", head: true })
      .eq("vigente", true)
      .lt("referencia", referencia),
  ]);
  falhar(historico.error);
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
  const cadastrados = await emLotes(hidros, 150, async (lote) => {
    const { data, error } = await db
      .from("hidrometros")
      .select("numero")
      .in("numero", lote);
    falhar(error);
    return data ?? [];
  });
  const noCadastro = new Set(cadastrados.map((h) => h.numero));
  const foraDoCadastro = hidros.filter((h) => !noCadastro.has(h));
  if (foraDoCadastro.length)
    avisos.push({
      nivel: "aviso",
      mensagem: `${foraDoCadastro.length} ${foraDoCadastro.length === 1 ? "hidrômetro não está" : "hidrômetros não estão"} em Cadastros: ${foraDoCadastro.slice(0, 20).join(", ")}${foraDoCadastro.length > 20 ? "…" : ""}. A leitura entra assim mesmo; cadastre em Configurações › Cadastros para ligar a foto escolhendo o hidrômetro.`,
    });
  const jaVistos = new Set(conhecidos.map((x) => x.hidrometro));
  const novos =
    (historico.count ?? 0) > 0 ? hidros.filter((h) => !jaVistos.has(h)) : [];

  // Fotos: confere cada uma e liga pelo nome.
  const recusadas: { nome: string; motivo: string }[] = [];
  const validas: typeof fotos = [];
  const problemas = await emLotes(fotos, 25, (lote) =>
    Promise.all(lote.map((f) => conferirChegada(f, LIMITES_AGUA.fotoBytes))),
  );
  fotos.forEach((f, i) => {
    const problema = problemas[i];
    if (problema) recusadas.push({ nome: f.nome, motivo: problema });
    else validas.push(f);
  });
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
      consumo: m.consumo,
      volume_faturado: m.volume_faturado,
      tipo: m.tipo as TipoAgua,
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

  await cancelarPreviasAbertas(usuario.id);
  const { data: imp, error: errImp } = await db
    .from("importacoes")
    .insert({
      tipo: "agua",
      referencia,
      arquivos: registros as unknown as Json,
      resumo: resumo as unknown as Json,
      avisos: avisos.slice(0, MAX_AVISOS) as unknown as Json,
      bate,
      criado_por: usuario.id,
    })
    .select("id")
    .single();
  falhar(errImp);
  try {
    const valorArquivo = conciliacoes.every((c) => c.resumo?.valor != null)
      ? conciliacoes.reduce((s, c) => s + (c.resumo?.valor ?? 0), 0) / 100
      : null;
    const { error: errValores } = await db.from("importacao_valores").insert({
      importacao_id: imp.id,
      valor_arquivo: valorArquivo,
      valor_lido: conciliacoes.reduce((s, c) => s + c.valor, 0) / 100,
      por_bloco: porArquivo as unknown as Json,
    });
    falhar(errValores);
    for (let i = 0; i < gravar.length; i += LOTE) {
      const lote = gravar.slice(i, i + LOTE);
      const { error } = await db
        .from("agua_leituras")
        .insert(
          lote.map(({ valor: _, ...l }) => ({ ...l, importacao_id: imp.id })),
        );
      falhar(error);
      const valores = await db.from("agua_valores").insert(
        lote.map((l) => ({
          leitura_id: l.id,
          valor: centavos(l.valor) / 100,
        })),
      );
      falhar(valores.error);
    }
  } catch (erro) {
    await descartar(imp.id, resumo as unknown as Json).catch(() => {});
    throw erro;
  }

  if (pedido.salvarModelo && pedido.mapeamento)
    await salvarModelo(
      pedido.mapeamento,
      lidos.find((l) => l.fonte === "planilha")?.titulos ?? [],
    );
  return { previa: await previaDaImportacao(imp.id) };
}

/** Guarda o mapeamento escolhido como modelo (precisa de operacoes.parametros). */
async function salvarModelo(
  mapeamento: Partial<Record<CampoAgua, number>>,
  titulos: string[],
): Promise<void> {
  if (!(await podeAgora("operacoes.parametros"))) return;
  // Guarda o título da coluna (vale mesmo se a ordem mudar); sem título, a
  // letra, que o leitor também entende.
  const modelo: ModeloAgua = {};
  for (const [campo, i] of Object.entries(mapeamento) as [
    CampoAgua,
    number,
  ][]) {
    if (!(campo in CAMPOS_AGUA)) continue;
    const titulo = titulos[i]?.trim();
    modelo[campo] = titulo && titulo.length <= 80 ? titulo : letra(i);
  }
  const usuario = await usuarioAtual();
  const { error } = await (await op())
    .from("parametros")
    .update({
      agua_modelo: modelo as unknown as Json,
      atualizado_por: usuario.id,
    })
    .eq("id", true);
  if (error) {
    console.error("modelo de importação da água", error);
    return;
  }
  updateTag(TAG.operacoes.parametros);
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

const resumoGuardado = z.object({
  pasta: z.string(),
  conferencias: z.array(z.any()).default([]),
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

export async function previaDaImportacao(id: string): Promise<PreviaAgua> {
  const db = await op();
  const { data: imp, error } = await db
    .from("importacoes")
    .select("id, referencia, bate, resumo, avisos, status")
    .eq("id", id)
    .eq("tipo", "agua")
    .single();
  falhar(error);
  const resumo = resumoGuardado.parse(imp.resumo) as ResumoGuardado;
  const [valores, linhas, anterior, comValores] = await Promise.all([
    db
      .from("importacao_valores")
      .select("valor_lido, por_bloco")
      .eq("importacao_id", id)
      .maybeSingle(),
    lerTudo(() =>
      db
        .from("agua_leituras")
        .select(
          "id, bloco, sala, cliente, hidrometro, leitura_anterior, leitura_atual, consumo, volume_faturado, tipo, foto, linha_arquivo, agua_valores(valor)",
        )
        .eq("importacao_id", id)
        .order("bloco")
        .order("sala")
        .order("id"),
    ),
    db
      .from("importacoes")
      .select("confirmado_em, confirmado_por, incompleta")
      .eq("tipo", "agua")
      .eq("status", "confirmada")
      .eq("referencia", imp.referencia)
      .neq("id", id)
      .maybeSingle(),
    podeAgora("operacoes.agua.valores"),
  ]);
  falhar(valores.error);
  falhar(anterior.error);
  const nomes = anterior.data
    ? await nomesDe([anterior.data.confirmado_por])
    : new Map();
  const porArquivo = (valores.data?.por_bloco ?? {}) as ValoresPorArquivo;
  const conferencias: ConferenciaArquivo[] = resumo.conferencias.map((c) => {
    const v = porArquivo[c.blocos.join(",") || c.arquivo];
    return {
      ...c,
      valor: comValores && v ? v.lido : null,
      resumoValor: comValores && v ? v.arquivo : null,
    };
  });
  const lista: LinhaPrevia[] = linhas.map((l) => {
    const v = l.agua_valores as { valor: number } | { valor: number }[] | null;
    const valor = Array.isArray(v) ? v[0]?.valor : v?.valor;
    return {
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
      valor: comValores && valor != null ? Number(valor) : null,
      tipo: l.tipo as TipoAgua,
      foto: l.foto !== null,
      linha: l.linha_arquivo,
    };
  });
  return {
    id: imp.id,
    referencia: imp.referencia,
    bate: imp.bate !== false,
    comValores,
    conferencias,
    mantidos: resumo.mantidos,
    substitui: anterior.data
      ? {
          em: anterior.data.confirmado_em,
          por:
            (anterior.data.confirmado_por &&
              nomes.get(anterior.data.confirmado_por)) ||
            "—",
          incompleta: anterior.data.incompleta,
        }
      : null,
    totais: {
      ...resumo.totais,
      valor: comValores
        ? lista.reduce((s, l) => s + centavos(l.valor ?? 0), 0) / 100
        : null,
    },
    avisos: (Array.isArray(imp.avisos)
      ? imp.avisos
      : []) as unknown as AvisoAgua[],
    ignoradas: resumo.ignoradas,
    fotos: resumo.fotos,
    novos: resumo.novos,
    linhas: lista,
  };
}

/** A prévia de água aberta da pessoa (para continuar ou descartar). */
export async function previaAberta(): Promise<PreviaAgua | null> {
  if (!(await podeAgora("operacoes.agua.importar"))) return null;
  const usuario = await usuarioAtual();
  const { data, error } = await (await op())
    .from("importacoes")
    .select("id")
    .eq("tipo", "agua")
    .eq("status", "previa")
    .eq("criado_por", usuario.id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  falhar(error);
  return data ? previaDaImportacao(data.id) : null;
}

/** Descarta a prévia (só a própria, ainda prévia) e apaga os arquivos dela. */
export async function descartarPrevia(id: string): Promise<string | null> {
  const usuario = await usuarioAtual();
  const { data, error } = await (await op())
    .from("importacoes")
    .select("id, status, criado_por, resumo")
    .eq("id", id)
    .eq("tipo", "agua")
    .maybeSingle();
  falhar(error);
  if (!data) return "Importação não encontrada.";
  if (data.status !== "previa" || data.criado_por !== usuario.id)
    return "Só a sua prévia, ainda não confirmada, pode ser descartada aqui.";
  await descartar(data.id, data.resumo);
  return null;
}

/**
 * Apaga os arquivos de um envio que não virou prévia (erro de leitura ou
 * cancelado no mapeamento das colunas). Envio de uma importação fica.
 */
export async function limparEnvio(envio: string): Promise<void> {
  if (!z.uuid().safeParse(envio).success) return;
  if (!(await podeAgora("operacoes.agua.importar"))) return;
  const pasta = pastaDoEnvio(envio);
  const { data, error } = await (await op())
    .from("importacoes")
    .select("id")
    .eq("tipo", "agua")
    .eq("resumo->>pasta", pasta)
    .limit(1);
  if (error || data?.length) return;
  await removerArquivos(BUCKET, await listarArquivos(BUCKET, pasta));
}
