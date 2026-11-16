import { randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import { formatarDataHora, formatarMes } from "@arp/shared/formato";
import type {
  FaturaDetalhe,
  ItemDaFatura,
} from "@arp/shared/operacoes/contratos/energia";
import {
  ErroEnergisa,
  type FaturaLida,
  faturaParaGravar,
  itensParaGravar,
} from "@arp/shared/operacoes/energisa";
import {
  type FaturaConta,
  mediaDaUnidade,
  type Papel,
  somarMeses,
  type UnidadeEnergia,
} from "@arp/shared/operacoes/energisa-contas";
import { ehPdf, lerPdfEnergisa } from "@arp/shared/operacoes/energisa-pdf";
import {
  arquivosSchema,
  montarPrevia,
  type PreviaFatura,
  type ResumoImportacao,
  resumoSchema,
} from "@arp/shared/operacoes/energisa-previa";
import type { Contexto } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import {
  gravarArquivo,
  linksDeLeitura,
  removerArquivos,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  BUCKET,
  lerParametros,
  logImportacaoOp,
  podeAgora,
  podeAlguma,
} from "./apoio";
import * as repo from "./contas.repository";
import * as importacoes from "./importacoes.repository";
import { sha256 } from "./planilha";

// Contas da área comum (faturas da Energisa), a consulta da energia solar e
// a importação das faturas (PDF), uma fatura por importação: enviar →
// prévia (a fatura e os itens já gravados, fora das telas) → confirmar
// (operacoes.confirmar_importacao) ou descartar
// (operacoes.desfazer_importacao). Matrícula nova: a unidade é cadastrada
// na própria prévia. O PDF original fica no bucket "operacoes". Tudo com a
// sessão (o RLS confere operacoes.energia.contas); o arquivo vai para o
// disco, sem RLS, só depois de podeAgora().

export const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const PERMISSAO = "operacoes.energia.contas" as const;
const SEM_PERMISSAO = "Você não tem permissão para importar as faturas.";

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

/** Contas ou solar: o mesmo acesso que o RLS das faturas. */
function exigirLeitura(ctx: Contexto) {
  if (!podeAlguma(ctx, ["operacoes.energia.contas", "operacoes.solar.ver"]))
    throw new ErroDePermissao();
}

const papel = (p: string): Papel =>
  p === "gera" || p === "gera_e_consome" ? p : "consome";

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export async function unidades(ctx: Contexto): Promise<UnidadeEnergia[]> {
  exigirLeitura(ctx);
  const linhas = await naSessao(ctx, repo.unidades);
  return linhas.map((u) => ({ ...u, papel: papel(u.papel) }));
}

export async function meses(ctx: Contexto): Promise<string[]> {
  exigirLeitura(ctx);
  return naSessao(ctx, repo.mesesComFatura);
}

const MES = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function mesValido(mes: string): string {
  if (!MES.test(mes)) throw new ErroNaoEncontrado("Mês inválido.");
  return mes;
}

/**
 * Links (1 hora) para abrir o PDF original das faturas. O armazenamento não
 * tem RLS: confere a permissão no banco antes.
 */
async function linksDosPdfs(
  ctx: Contexto,
  caminhos: (string | null)[],
): Promise<Map<string, string>> {
  const validos = caminhos.filter((c): c is string => !!c);
  if (!validos.length || !(await podeAgora(ctx, PERMISSAO))) return new Map();
  return linksDeLeitura(BUCKET, validos, 3600);
}

/**
 * Faturas vigentes dos 13 meses até `mes` (o mês, os 12 anteriores para a
 * média e o gráfico) e os links dos PDFs das faturas do mês.
 */
export async function faturasAte(
  ctx: Contexto,
  bruto: string,
): Promise<{ faturas: FaturaConta[]; pdfs: Record<string, string> }> {
  exigirLeitura(ctx);
  const mes = mesValido(bruto);
  const faturas = await naSessao(ctx, (tx) =>
    repo.faturasEntre(tx, somarMeses(mes, -12), mes),
  );
  const pdfs = await linksDosPdfs(
    ctx,
    faturas.filter((f) => f.referencia === mes).map((f) => f.arquivo),
  );
  return { faturas, pdfs: Object.fromEntries(pdfs) };
}

const origem = (o: string | null): "oUC" | "mUC" | null =>
  o === "oUC" || o === "mUC" ? o : null;

/** Uma fatura com os itens e o link do PDF; 404 se não existe ou a pessoa não vê. */
export async function fatura(
  ctx: Contexto,
  id: string,
): Promise<{ fatura: FaturaDetalhe; pdf: string | null }> {
  exigirLeitura(ctx);
  const lido = await naSessao(ctx, async (tx) => {
    const f = await repo.fatura(tx, id);
    return f ? { f, itens: await repo.itensDaFatura(tx, id) } : null;
  });
  if (!lido) throw new ErroNaoEncontrado("Fatura não encontrada.");
  const itens: ItemDaFatura[] = lido.itens.map((i) => ({
    ...i,
    origem: origem(i.origem),
  }));
  const pdfs = await linksDosPdfs(ctx, [lido.f.arquivo]);
  return {
    fatura: { ...lido.f, itens },
    pdf: lido.f.arquivo ? (pdfs.get(lido.f.arquivo) ?? null) : null,
  };
}

/** Créditos usados (itens "Injetada") das faturas vigentes do mês. */
export async function creditosDoMes(ctx: Contexto, bruto: string) {
  exigirLeitura(ctx);
  const mes = mesValido(bruto);
  const linhas = await naSessao(ctx, (tx) => repo.creditosDoMes(tx, mes));
  return linhas.map((l) => ({ ...l, origem: origem(l.origem) }));
}

// ---------------------------------------------------------------------------
// Importação das faturas da Energisa
// ---------------------------------------------------------------------------

async function exigirImportar(ctx: Contexto) {
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/**
 * As prévias das importações, conferidas com o banco (unidade cadastrada,
 * fatura gravada, média dos 12 meses anteriores). Importação com o resumo
 * fora do formato (não deveria acontecer) fica de fora.
 */
async function previasDe(
  ctx: Contexto,
  lista: { id: string; resumo: unknown }[],
): Promise<PreviaFatura[]> {
  const lidas = lista.flatMap((i) => {
    const r = resumoSchema.safeParse(i.resumo);
    if (!r.success) {
      log.error(
        { importacao: i.id },
        "resumo da importação da Energisa inválido",
      );
      return [];
    }
    return [{ id: i.id, resumo: r.data }];
  });
  if (!lidas.length) return [];
  const matriculas = [...new Set(lidas.map((l) => l.resumo.matricula))];
  const refs = lidas.map((l) => l.resumo.fatura.referencia).sort();
  const desde = somarMeses(refs[0] ?? "", -12);
  const ate = refs.at(-1) ?? "";
  const { unidades, gravadas, historico, p } = await naSessao(
    ctx,
    async (tx) => ({
      unidades: await repo.unidadesDasMatriculas(tx, matriculas),
      gravadas: await repo.faturasDasImportacoes(
        tx,
        lidas.map((l) => l.id),
      ),
      historico: await repo.historicoDeConsumo(tx, matriculas, desde, ate),
      p: await lerParametros(tx),
    }),
  );
  const porMatricula = new Map(unidades.map((u) => [u.matricula, u]));
  const comFatura = new Set(gravadas.map((g) => g.importacao_id));
  return lidas.map(({ id, resumo }) => {
    const u = porMatricula.get(resumo.matricula);
    const m = mediaDaUnidade(
      historico,
      resumo.matricula,
      resumo.fatura.referencia,
    );
    return montarPrevia(
      {
        importacaoId: id,
        arquivo: resumo.arquivo,
        fatura: resumo.fatura,
        unidade: u ? { apelido: u.apelido, papel: papel(u.papel) } : null,
        gravada: comFatura.has(id),
        media: m ? { kwh: m.media, meses: m.meses } : null,
      },
      Number(p.energia_alerta_pct),
    );
  });
}

/** Descarta prévias da própria pessoa (reenvio da mesma fatura) e apaga os PDFs. */
async function descartar(ctx: Contexto, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const arquivos = await naSessao(ctx, async (tx) => {
    const lidos = await repo.arquivosDasImportacoes(tx, ids);
    for (const id of ids) await importacoes.desfazer(tx, id);
    return lidos;
  });
  const caminhos = arquivos.flatMap((i) => {
    const a = arquivosSchema.safeParse(i.arquivos);
    return a.success ? a.data.map((x) => x.caminho) : [];
  });
  await removerArquivos(BUCKET, caminhos);
}

interface Conflito {
  erro?: string;
  minhas: string[];
}

/** Mesmo arquivo (sha256) ou mesma unidade e mês já importados ou em prévia. */
async function conflitos(
  ctx: Contexto,
  hash: string,
  fatura: FaturaLida,
): Promise<Conflito> {
  const usuarioId = ctx.usuario.id;
  return naSessao(ctx, async (tx) => {
    const minhas: string[] = [];
    for (const i of await importacoes.importacaoDoArquivo(
      tx,
      "energisa",
      hash,
    )) {
      if (i.status === "confirmada")
        return {
          erro: `Esta fatura já foi importada em ${formatarDataHora(i.criado_em)} (${formatarMes(i.referencia)}).`,
          minhas,
        };
      if (i.criado_por !== usuarioId)
        return {
          erro: "Esta fatura está numa prévia de outra pessoa, ainda não confirmada. Confirme ou descarte essa prévia em Operações › Importações.",
          minhas,
        };
      minhas.push(i.id);
    }
    const vigente = await repo.faturaVigente(
      tx,
      fatura.matricula,
      fatura.referencia,
    );
    if (vigente)
      return {
        erro: `A fatura da matrícula ${fatura.matricula} de ${formatarMes(fatura.referencia)} já foi importada. Para trocar, desfaça a importação anterior em Operações › Importações.`,
        minhas,
      };
    for (const p of await repo.previasDaMatricula(
      tx,
      fatura.matricula,
      fatura.referencia,
    )) {
      if (p.criado_por !== usuarioId)
        return {
          erro: `Já há uma prévia de outra pessoa para a matrícula ${fatura.matricula} de ${formatarMes(fatura.referencia)}.`,
          minhas,
        };
      if (!minhas.includes(p.id)) minhas.push(p.id);
    }
    return { minhas };
  });
}

/** Grava a fatura e os itens da prévia (a unidade já existe). */
async function gravarFatura(
  ctx: Contexto,
  importacaoId: string,
  resumo: ResumoImportacao,
  arquivo: { caminho: string; sha256: string },
): Promise<void> {
  try {
    await naSessao(ctx, (tx) =>
      repo.gravarFatura(tx, {
        importacao: importacaoId,
        arquivo: arquivo.caminho,
        sha256: arquivo.sha256,
        fatura: faturaParaGravar(resumo.fatura),
        itens: itensParaGravar(resumo.fatura),
      }),
    );
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito(
        `A fatura da matrícula ${resumo.matricula} de ${formatarMes(resumo.fatura.referencia)} (ou este mesmo arquivo) já está no sistema.`,
      );
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    log.error({ err: e }, "gravar fatura da Energisa");
    throw new ErroDeNegocio("Não foi possível gravar a fatura. Tente de novo.");
  }
}

/** Lê um PDF, guarda o arquivo e devolve a prévia. Uma fatura por chamada. */
export async function lerFatura(
  ctx: Contexto,
  arquivo: { nome: string; bytes: Uint8Array } | null,
): Promise<{ previa: PreviaFatura; substituiu: boolean }> {
  await exigirImportar(ctx);
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha o PDF da fatura.");
  if (arquivo.bytes.length > TAMANHO_MAXIMO)
    throw new ErroDeNegocio("O arquivo passa de 10 MB.");
  const { bytes } = arquivo;
  if (!ehPdf(bytes))
    throw new ErroDeNegocio("O arquivo não é um PDF. Baixe a fatura em PDF.");
  const nome = arquivo.nome.slice(0, 200) || "fatura.pdf";
  const hash = sha256(bytes);

  let fatura: FaturaLida;
  try {
    fatura = await lerPdfEnergisa(bytes, nome);
  } catch (e) {
    if (e instanceof ErroEnergisa) throw new ErroDeNegocio(e.message);
    log.error({ err: e }, "leitura da fatura da Energisa");
    throw new ErroDeNegocio(
      "Não consegui ler o PDF. Confira se é a fatura da Energisa, em PDF com texto.",
    );
  }

  let conflito: Conflito;
  try {
    conflito = await conflitos(ctx, hash, fatura);
  } catch (e) {
    log.error({ err: e }, "conferência de duplicados da Energisa");
    throw new ErroDeNegocio(
      "Não foi possível conferir a fatura. Tente de novo.",
    );
  }
  if (conflito.erro) throw new ErroDeNegocio(conflito.erro);
  try {
    // Reenvio de uma fatura que a pessoa já tinha em prévia: a nova vale.
    await descartar(ctx, conflito.minhas);
  } catch (e) {
    log.error({ err: e }, "conferência de duplicados da Energisa");
    throw new ErroDeNegocio(
      "Não foi possível conferir a fatura. Tente de novo.",
    );
  }

  const caminho = `energisa/${randomUUID()}/${nomeSeguro(nome, "fatura.pdf")}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, "application/pdf");
  } catch (e) {
    log.error({ err: e }, "gravar PDF da Energisa");
    throw new ErroDeNegocio(
      "Não foi possível guardar o arquivo. Tente de novo.",
    );
  }

  const resumo: ResumoImportacao = {
    versao: 1,
    matricula: fatura.matricula,
    arquivo: nome,
    fatura,
  };
  let id: string;
  let temUnidade: boolean;
  try {
    ({ id, temUnidade } = await naSessao(ctx, async (tx) => {
      const r = await importacoes.inserirImportacao(tx, {
        tipo: "energisa",
        referencia: fatura.referencia,
        arquivos: [{ nome, caminho, sha256: hash, bytes: bytes.length }],
        resumo,
        avisos: fatura.avisos,
        bate: fatura.bate,
        criado_por: ctx.usuario.id,
      });
      return {
        id: r.id,
        temUnidade: !!(await repo.unidadeExiste(tx, fatura.matricula)),
      };
    }));
  } catch (e) {
    await removerArquivos(BUCKET, [caminho]);
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    log.error({ err: e }, "registro da importação da Energisa");
    throw new ErroDeNegocio(
      "Não foi possível registrar a importação. Tente de novo.",
    );
  }
  if (temUnidade) {
    try {
      await gravarFatura(ctx, id, resumo, { caminho, sha256: hash });
    } catch (e) {
      await descartar(ctx, [id]).catch((err: unknown) =>
        log.error({ err }, "descartar prévia da Energisa"),
      );
      throw e;
    }
  }
  const [previa] = await previasDe(ctx, [{ id, resumo }]);
  if (!previa)
    throw new ErroDeNegocio(
      "A prévia está incompleta. Descarte e envie a fatura de novo.",
    );
  return { previa, substituiu: conflito.minhas.length > 0 };
}

/** As prévias da pessoa ainda não confirmadas (ao abrir a importação). */
export async function previasPendentes(ctx: Contexto): Promise<PreviaFatura[]> {
  if (!(await podeAgora(ctx, PERMISSAO))) return [];
  const lista = await naSessao(ctx, (tx) =>
    repo.minhasPrevias(tx, ctx.usuario.id),
  );
  return previasDe(ctx, lista);
}

/** Prévia aberta pela pessoa, com o que foi lido. */
async function previaDaPessoa(ctx: Contexto, importacaoId: string) {
  const data = await naSessao(ctx, (tx) =>
    importacoes.importacao(tx, importacaoId),
  );
  if (!data || data.tipo !== "energisa")
    throw new ErroDeNegocio("Prévia não encontrada.");
  if (data.status !== "previa")
    throw new ErroDeNegocio("Esta prévia já foi confirmada ou descartada.");
  if (data.criado_por !== ctx.usuario.id)
    throw new ErroDeNegocio("Só quem enviou a fatura mexe nesta prévia.");
  const resumo = resumoSchema.safeParse(data.resumo);
  if (!resumo.success)
    throw new ErroDeNegocio(
      "A prévia está incompleta. Descarte e envie a fatura de novo.",
    );
  const arquivos = arquivosSchema.safeParse(data.arquivos);
  const arq = arquivos.success ? arquivos.data[0] : undefined;
  return { resumo: resumo.data, arquivo: arq };
}

const faturaGravada = (ctx: Contexto, importacaoId: string) =>
  naSessao(ctx, (tx) => repo.faturasDasImportacoes(tx, [importacaoId])).then(
    (l) => l.length > 0,
  );

/** Cadastra a unidade de uma matrícula nova e grava a fatura da prévia. */
export async function cadastrarUnidade(
  ctx: Contexto,
  importacaoId: string,
  v: { apelido: string | null; papel: Papel },
): Promise<PreviaFatura> {
  try {
    const p = await previaDaPessoa(ctx, importacaoId);
    const f = p.resumo.fatura;
    try {
      await naSessao(ctx, (tx) =>
        repo.inserirUnidade(tx, {
          matricula: f.matricula,
          apelido: v.apelido,
          papel: v.papel,
          endereco: f.endereco,
          classificacao: f.classificacao,
          ligacao: f.ligacao,
        }),
      );
    } catch (e) {
      // Já cadastrada (por outra prévia ou em Parâmetros): segue com ela.
      if (!(e instanceof ErroDeConflito)) {
        if (e instanceof ErroDePermissao)
          throw new ErroDePermissao(SEM_PERMISSAO);
        log.error({ err: e }, "cadastro da unidade de energia");
        throw new ErroDeNegocio(
          "Não foi possível cadastrar a unidade. Tente de novo.",
        );
      }
    }
    if (!(await faturaGravada(ctx, importacaoId))) {
      if (!p.arquivo)
        throw new ErroDeNegocio(
          "A prévia está sem o arquivo. Descarte e envie a fatura de novo.",
        );
      await gravarFatura(ctx, importacaoId, p.resumo, p.arquivo);
    }
    const [previa] = await previasDe(ctx, [
      { id: importacaoId, resumo: p.resumo },
    ]);
    if (!previa)
      throw new ErroDeNegocio(
        "A prévia está incompleta. Descarte e envie a fatura de novo.",
      );
    return previa;
  } catch (e) {
    if (e instanceof ErroDaApi) throw e;
    log.error({ err: e }, "cadastrar unidade na prévia");
    throw new ErroDeNegocio(
      "Não foi possível cadastrar a unidade. Tente de novo.",
    );
  }
}

/** Confirma a prévia: a fatura passa a valer nas telas. */
export async function confirmarFatura(
  ctx: Contexto,
  importacaoId: string,
  motivo: string | null,
): Promise<string> {
  const p = await previaDaPessoa(ctx, importacaoId);
  if (!(await faturaGravada(ctx, importacaoId)))
    throw new ErroDeNegocio(
      "Cadastre a unidade da matrícula antes de confirmar.",
    );
  if (!p.resumo.fatura.bate && !motivo)
    throw new ErroDeNegocio(
      "Os itens não somam o total da fatura: diga o motivo para confirmar assim mesmo.",
    );
  try {
    await naSessao(ctx, (tx) =>
      importacoes.confirmar(tx, importacaoId, motivo),
    );
  } catch (e) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    // Regras do banco (P0001/22023) já vêm traduzidas.
    if (e instanceof ErroDeNegocio) throw e;
    log.error({ err: e }, "confirmar fatura da Energisa");
    throw new ErroDeNegocio("Não foi possível confirmar. Nada foi alterado.");
  }
  const f = p.resumo.fatura;
  logImportacaoOp(
    ctx,
    "confirmou",
    { id: importacaoId, tipo: "energisa", referencia: f.referencia },
    `matrícula ${f.matricula}${f.bate ? "" : ", itens sem bater com o total"}`,
    { matricula: f.matricula, motivo: motivo ?? undefined },
  );
  return `Fatura da matrícula ${f.matricula} de ${formatarMes(f.referencia)} confirmada.`;
}

/** Descarta a prévia: apaga a fatura gravada e o PDF. */
export async function descartarFatura(
  ctx: Contexto,
  importacaoId: string,
): Promise<string> {
  const p = await previaDaPessoa(ctx, importacaoId);
  try {
    await descartar(ctx, [importacaoId]);
  } catch (e) {
    log.error({ err: e }, "descartar prévia da Energisa");
    throw new ErroDeNegocio("Não foi possível descartar. Tente de novo.");
  }
  const f = p.resumo.fatura;
  logImportacaoOp(
    ctx,
    "descartou",
    { id: importacaoId, tipo: "energisa", referencia: f.referencia },
    `matrícula ${f.matricula}`,
    { matricula: f.matricula },
  );
  return "Prévia descartada.";
}
