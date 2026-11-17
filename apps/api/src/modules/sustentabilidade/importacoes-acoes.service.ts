import { createHash, randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import type {
  EnvioPreparado,
  RespostaDoEnvio,
  RespostaImportacao,
} from "@arp/shared/sustentabilidade/contratos/importacoes";
import { TIPOS_DE_IMPORTACAO } from "@arp/shared/sustentabilidade/importacao/index";
import {
  contar,
  NOME_DO_TIPO,
} from "@arp/shared/sustentabilidade/importacao-historico";
import {
  decisoesPendentes,
  escolhasSchema,
  lerEscolhas,
} from "@arp/shared/sustentabilidade/importacao-linhas";
import { z } from "zod";
import { type Contexto, exigir } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import {
  infoDoArquivo,
  inicioDoArquivo,
  lerArquivo,
  prepararEnvio,
  removerArquivos,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { contextoSu, podeAgora } from "./acesso";
import * as repo from "./importacoes.repository";
import {
  BUCKET_SU,
  type Gravacao,
  importacaoSu,
  lerResumoGravado,
  type Montagem,
  montarPrevia,
  previaDoArquivo,
} from "./importacoes.service";

// Importações do histórico (spec 4.10), em três passos: 1) enviar o
// arquivo como está (direto do navegador para o disco, com
// prepararEnvio) e ler: o sha256 diz se o arquivo já foi importado (aí
// pergunta se substitui) e a leitura cria a prévia; 2) escolhas da prévia
// (programa e formulário, vínculo do contrato, nomes, motivo); 3) confirmar
// (grava as linhas com o importacao_id da prévia e chama
// confirmar_importacao) ou cancelar/desfazer (desfazer_importacao). Tudo com
// a sessão: o RLS só deixa gravar na prévia da própria pessoa.

const PERMISSAO = "sustentabilidade.importar" as const;
const SEM_PERMISSAO = "Você não tem permissão para importar o histórico.";
const MAX_MB = 20;
const LOTE = 500;

const tipoSchema = z.custom<keyof typeof TIPOS_DE_IMPORTACAO>(
  (v) => typeof v === "string" && v in TIPOS_DE_IMPORTACAO,
);
const CAMINHO = /^importacoes\/[0-9a-f-]{36}\/[\w.-]{1,120}$/;

async function exigirImportar(ctx: Contexto): Promise<void> {
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

// ---------------------------------------------------------------------------
// Detalhe (a página de uma importação)
// ---------------------------------------------------------------------------

/** GET /importacoes/:id: a importação e, enquanto é prévia, o que foi lido. */
export async function detalheDaImportacao(
  ctx: Contexto,
  id: string,
): Promise<RespostaImportacao> {
  await exigir(ctx, PERMISSAO);
  const imp = /^[0-9a-f-]{36}$/i.test(id) ? await importacaoSu(ctx, id) : null;
  if (!imp) throw new ErroNaoEncontrado();
  const montagem = imp.status === "previa" ? await montarPrevia(ctx, id) : null;
  const { dadosDe } = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    contextoSu(tx, ctx),
  );
  return { importacao: imp, previa: montagem?.previa ?? null, dadosDe };
}

// ---------------------------------------------------------------------------
// Passo 1: enviar e ler
// ---------------------------------------------------------------------------

/** Passo 1a: confere tipo, nome e tamanho e devolve o link de envio. */
export async function prepararEnvioImportacao(
  ctx: Contexto,
  entrada: { tipo: string; nome: string; tamanho: number },
): Promise<EnvioPreparado> {
  const e = z
    .object({
      tipo: tipoSchema,
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Escolha o tipo e o arquivo." };
  if (!(await podeAgora(ctx, PERMISSAO)))
    return { ok: false, erro: SEM_PERMISSAO };
  if (/\.xls$/i.test(e.data.nome))
    return {
      ok: false,
      erro: "Arquivo .xls (Excel 97-2003) não é lido. Baixe do Forms/Planilhas ou do OneDrive em .xlsx ou .csv, sem mudar nada no conteúdo.",
    };
  if (!/\.(xlsx|csv)$/i.test(e.data.nome))
    return { ok: false, erro: "Envie a planilha em .xlsx ou .csv." };
  if (e.data.tamanho > MAX_MB * 1024 * 1024)
    return { ok: false, erro: `Arquivo maior que ${MAX_MB} MB.` };
  const caminho = `importacoes/${randomUUID()}/${nomeSeguro(e.data.nome, "planilha.xlsx")}`;
  const envio = await prepararEnvio(BUCKET_SU, caminho, {
    maxBytes: MAX_MB * 1024 * 1024,
  });
  if ("erro" in envio)
    return {
      ok: false,
      erro: "Não foi possível preparar o envio. Tente de novo.",
    };
  return { ok: true, url: envio.url, caminho };
}

/** Planilha .xlsx (zip) ou texto (CSV, sem byte nulo no começo). */
function ehPlanilha(inicio: Uint8Array, nome: string): boolean {
  if (/\.xlsx$/i.test(nome)) return inicio[0] === 0x50 && inicio[1] === 0x4b;
  return !inicio.includes(0);
}

/**
 * Passo 1b: o arquivo chegou; confere tamanho e tipo pelo conteúdo, calcula o
 * sha256 e cria a prévia. Arquivo já importado (mesmo tipo e sha256):
 * devolve `repetida` para a tela perguntar; `substituir` cria a prévia que
 * substitui a anterior ao confirmar.
 */
export async function lerEnvioImportacao(
  ctx: Contexto,
  entrada: {
    tipo: string;
    caminho: string;
    nome: string;
    substituir?: boolean;
  },
): Promise<RespostaDoEnvio> {
  const e = z
    .object({
      tipo: tipoSchema,
      caminho: z.string().regex(CAMINHO),
      nome: z.string().min(1).max(255),
      substituir: z.boolean().optional(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  const { tipo, caminho, nome, substituir } = e.data;
  if (!(await podeAgora(ctx, PERMISSAO)))
    return { ok: false, erro: SEM_PERMISSAO };
  const recusar = async (erro: string): Promise<RespostaDoEnvio> => {
    await removerArquivos(BUCKET_SU, [caminho]);
    return { ok: false, erro };
  };

  const info = await infoDoArquivo(BUCKET_SU, caminho);
  if (!info) return { ok: false, erro: "O arquivo não chegou. Envie de novo." };
  if (info.tamanho > MAX_MB * 1024 * 1024)
    return recusar(`Arquivo maior que ${MAX_MB} MB.`);
  const inicio = await inicioDoArquivo(BUCKET_SU, caminho, 4096);
  if (!inicio || !ehPlanilha(inicio, nome))
    return recusar("O arquivo não é uma planilha .xlsx ou .csv.");
  const bytes = await lerArquivo(BUCKET_SU, caminho);
  if (!bytes)
    return { ok: false, erro: "O arquivo não chegou. Envie de novo." };
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  let iguais: Awaited<ReturnType<typeof repo.comOMesmoArquivo>>;
  try {
    iguais = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.comOMesmoArquivo(tx, tipo, sha256),
    );
  } catch (err) {
    log.error({ err }, "arquivo já importado (sustentabilidade)");
    return {
      ok: false,
      erro: "Não foi possível conferir o arquivo. Tente de novo.",
    };
  }
  const minhaPrevia = iguais.find(
    (i) => i.status === "previa" && i.criado_por === ctx.usuario.id,
  );
  if (minhaPrevia) {
    await removerArquivos(BUCKET_SU, [caminho]);
    return { ok: true, id: minhaPrevia.id };
  }
  const confirmada = iguais.find((i) => i.status === "confirmada");
  if (confirmada && !substituir)
    return {
      ok: false,
      repetida: {
        id: confirmada.id,
        quando: formatarDataHora(
          confirmada.confirmado_em ?? confirmada.criado_em,
        ),
        texto: lerResumoGravado(confirmada.resumo).texto || NOME_DO_TIPO[tipo],
      },
    };

  let montagem: Montagem;
  try {
    montagem = await previaDoArquivo(ctx, {
      id: "",
      tipo,
      bytes,
      escolhas: lerEscolhas({}),
      substitui: confirmada?.id ?? null,
      podeValores: ctx.permissoes.has("sustentabilidade.valores"),
    });
  } catch (err) {
    log.error({ err, tipo }, "leitura da importação (sustentabilidade)");
    return recusar(
      "Não foi possível ler o arquivo. Confira se é a planilha do tipo escolhido.",
    );
  }
  if (!montagem.previa.lidas) {
    const motivo = montagem.previa.avisos.find((a) => a.nivel === "erro");
    return recusar(
      `Nada foi lido como ${NOME_DO_TIPO[tipo]}.${motivo ? ` ${motivo.mensagem}` : ""} Confira se escolheu o tipo certo.`,
    );
  }

  try {
    const id = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.criarPrevia(tx, {
        tipo,
        arquivo: { nome, caminho, bytes: info.tamanho },
        sha256,
        substitui: confirmada?.id ?? null,
        criado_por: ctx.usuario.id,
        resumo: montagem.resumo,
        avisos: montagem.avisosGravados,
      }),
    );
    return { ok: true, id };
  } catch (err) {
    log.error({ err }, "criar prévia (sustentabilidade)");
    return recusar("Não foi possível criar a prévia. Tente de novo.");
  }
}

/** "Não substituir": o arquivo enviado sai do disco. */
export async function descartarEnvio(
  ctx: Contexto,
  entrada: { caminho: string },
): Promise<void> {
  const e = z.object({ caminho: z.string().regex(CAMINHO) }).safeParse(entrada);
  if (!e.success || !(await podeAgora(ctx, PERMISSAO))) return;
  // Só o que não virou importação (o caminho é novo, sem registro).
  const quantas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.comOCaminho(tx, e.data.caminho),
  );
  if (!quantas) await removerArquivos(BUCKET_SU, [e.data.caminho]);
}

// ---------------------------------------------------------------------------
// Passo 2: escolhas da prévia
// ---------------------------------------------------------------------------

/** Grava as escolhas da prévia (todas de uma vez) e refaz o resumo. */
export async function salvarEscolhasImportacao(
  ctx: Contexto,
  id: string,
  escolhasBrutas: unknown,
): Promise<string> {
  const e = z
    .object({ id: z.uuid(), escolhas: escolhasSchema })
    .safeParse({ id, escolhas: escolhasBrutas });
  if (!e.success)
    throw new ErroDeNegocio("Escolha inválida. Recarregue a página.");
  await exigirImportar(ctx);
  const gravou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.gravarEscolhas(tx, e.data.id, e.data.escolhas),
  );
  if (!gravou)
    throw new ErroDeNegocio(
      "Só quem enviou o arquivo muda as escolhas, e só enquanto é prévia.",
    );
  const m = await montarPrevia(ctx, e.data.id).catch((err: unknown) => {
    log.error({ err }, "prévia (sustentabilidade)");
    return null;
  });
  if (m)
    await banco
      .comoUsuario(ctx.usuario.id, (tx) =>
        repo.gravarResumo(tx, e.data.id, m.resumo, m.avisosGravados),
      )
      .catch((err: unknown) =>
        log.error({ err }, "resumo da prévia (sustentabilidade)"),
      );
  return "Escolha guardada.";
}

// ---------------------------------------------------------------------------
// Passo 3: confirmar, cancelar e desfazer
// ---------------------------------------------------------------------------

function lotes<T>(itens: T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE) r.push(itens.slice(i, i + LOTE));
  return r;
}

/** Grava as linhas da prévia (com o importacao_id dela). */
async function gravarLinhas(tx: Tx, id: string, g: Gravacao): Promise<void> {
  if (g.tipo === "entrevistas") {
    for (const lote of lotes(g.entrevistas))
      await repo.inserirEntrevistas(
        tx,
        lote.map((m) => ({
          contrato_id: m.contrato_id,
          lucs: m.lucs,
          cliente_doc: m.cliente_doc,
          data: m.data,
          tipo: m.tipo,
          setor: m.setor,
          formulario_versao: g.versao,
          respostas: JSON.stringify(m.respostas),
          situacao: "salva",
          respondente_nome: m.respondente_nome,
          origem: "forms",
          entrevistador_id: null,
          valida_ate: m.valida_ate,
          importacao_id: id,
        })),
      );
    return;
  }
  const cadastro = g.cadastro;
  if (cadastro?.nomes.length)
    await repo.inserirCadastros(
      tx,
      cadastro.nomes.map((n) => ({
        programa_id: g.programa_id,
        campo_id: cadastro.campo_id,
        valor: n.valor,
        normalizado: n.normalizado,
        importacao_id: id,
      })),
    );
  const comId = g.lancamentos.map((l) => ({ ...l, id: randomUUID() }));
  for (const lote of lotes(comId)) {
    await repo.inserirLancamentos(
      tx,
      lote.map((l) => ({
        id: l.id,
        programa_id: g.programa_id,
        formulario_id: g.formulario_id,
        formulario_versao: g.versao,
        data: l.data,
        valores: JSON.stringify(l.valores),
        origem: "importacao",
        importacao_id: id,
      })),
    );
    await repo.inserirReais(
      tx,
      lote
        .filter((l) => Object.keys(l.reais).length)
        .map((l) => ({
          lancamento_id: l.id,
          valores: JSON.stringify(l.reais),
        })),
    );
  }
}

/** Confirma a prévia: grava as linhas e chama confirmar_importacao. */
export async function confirmarImportacaoSu(
  ctx: Contexto,
  idBruto: string,
): Promise<string> {
  const e = z.uuid().safeParse(idBruto);
  if (!e.success) throw new ErroDeNegocio("Importação inválida.");
  await exigirImportar(ctx);
  const id = e.data;
  const imp = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.situacao(tx, id),
  );
  if (!imp) throw new ErroDeNegocio("Importação não encontrada.");
  if (imp.status !== "previa")
    throw new ErroDeNegocio("Esta importação já foi confirmada ou cancelada.");
  if (imp.criado_por !== ctx.usuario.id)
    throw new ErroDeNegocio(
      "Só quem enviou o arquivo confirma a prévia. Envie o arquivo de novo para importar você mesmo.",
    );

  let m: Montagem | null;
  try {
    m = await montarPrevia(ctx, id);
  } catch (err) {
    log.error({ err }, "prévia na confirmação (sustentabilidade)");
    m = null;
  }
  if (!m)
    throw new ErroDeNegocio("Não foi possível reler o arquivo. Tente de novo.");
  const pendentes = decisoesPendentes(m.previa.decisoes, m.previa.escolhas);
  if (pendentes.length)
    throw new ErroDeNegocio(
      `Falta${pendentes.length === 1 ? "" : "m"} ${formatarNumero(pendentes.length)} ${pendentes.length === 1 ? "decisão" : "decisões"} na prévia (vínculo, nomes ou motivo).`,
    );
  if (m.previa.bloqueio || !m.gravacao)
    throw new ErroDeNegocio(m.previa.bloqueio ?? "Nada para importar.");
  const g = m.gravacao;
  const resumo = m.resumo;

  // Uma transação: as linhas, o resumo e a confirmação entram juntos (se
  // algo falha, nada fica pela metade).
  try {
    await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      // Prévia que já tem linhas (tentativa do sistema antigo que gravou e
      // falhou ao confirmar) não regrava.
      const tabela = g.tipo === "entrevistas" ? "entrevistas" : "lancamentos";
      if ((await repo.linhasGravadas(tx, id, tabela)) === 0) {
        // O índice único (contrato e data entre as salvas) não deixa as
        // entrevistas da anterior e da nova coexistirem: a anterior sai antes
        // (e fica "substituida").
        if (g.tipo === "entrevistas" && imp.substitui)
          await repo.liberarSubstituida(tx, id);
        await gravarLinhas(tx, id, g);
      }
      await repo.gravarResumo(tx, id, resumo);
      await repo.confirmar(tx, id);
    });
  } catch (err) {
    if (err instanceof ErroDeConflito)
      throw new ErroDeNegocio(
        "Alguma linha já existe no sistema (mesmo contrato e data). Cancele a prévia e importe de novo.",
      );
    if (err instanceof ErroDaApi) throw err;
    log.error({ err }, "gravar linhas da importação (sustentabilidade)");
    throw new ErroDeNegocio(
      "Não foi possível gravar as linhas. Tente de novo.",
    );
  }

  const quantas =
    g.tipo === "entrevistas" ? g.entrevistas.length : g.lancamentos.length;
  registrarDepois({
    modulo: "sustentabilidade",
    evento: "sustentabilidade_importacao_confirmada",
    descricao: `Importou ${contar(g.tipo, quantas)} (${NOME_DO_TIPO[g.tipo]})`,
    usuarioId: ctx.usuario.id,
    detalhes: {
      importacao: id,
      tipo: g.tipo,
      linhas: quantas,
      substitui: imp.substitui,
    },
  });
  return `Importação confirmada: ${contar(g.tipo, quantas)} entraram.${imp.substitui ? " A importação anterior do mesmo arquivo foi substituída." : ""}`;
}

/** Cancelar a prévia ou desfazer a importação confirmada. */
export async function desfazerImportacaoSu(
  ctx: Contexto,
  idBruto: string,
): Promise<string> {
  const e = z.uuid().safeParse(idBruto);
  if (!e.success) throw new ErroDeNegocio("Importação inválida.");
  await exigirImportar(ctx);
  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const imp = await repo.situacao(tx, e.data);
    if (!imp) return null;
    return { imp, n: await repo.desfazer(tx, e.data) };
  });
  if (!r) throw new ErroDeNegocio("Importação não encontrada.");
  const { imp, n } = r;
  const previa = imp.status === "previa";
  const nome =
    imp.tipo in NOME_DO_TIPO
      ? NOME_DO_TIPO[imp.tipo as keyof typeof NOME_DO_TIPO]
      : imp.tipo;
  registrarDepois({
    modulo: "sustentabilidade",
    evento: "sustentabilidade_importacao_desfeita",
    descricao: previa
      ? `Cancelou a prévia de ${nome}`
      : `Desfez a importação de ${nome}: ${formatarNumero(n)} registros removidos`,
    usuarioId: ctx.usuario.id,
    detalhes: { importacao: e.data, tipo: imp.tipo, registros: n },
  });
  return previa
    ? "Prévia cancelada. Nada dela entrou nos dados."
    : `Importação desfeita: ${formatarNumero(n)} ${n === 1 ? "registro removido" : "registros removidos"}. O arquivo continua guardado para importar de novo.`;
}
