import { createHash, randomBytes, randomUUID } from "node:crypto";
import { nomeSeguro } from "@arp/shared/arquivos/nome";
import { formatarDataHora } from "@arp/shared/formato";
import {
  lerMes,
  nomeDoMes,
  reais,
  regraBl04Do,
} from "@arp/shared/operacoes/limpeza";
import {
  type DadosParaSalvar,
  dadosParaSalvar,
  GRUPOS_EQUIPE,
  type GrupoEquipe,
  type Lancamento,
  lancamentoDasLinhas,
} from "@arp/shared/operacoes/limpeza-lancamento";
import {
  abasDoExcel,
  avisoSchema,
  lerHistoricoDoRateio,
  type MesLido,
  type PreviaHistorico,
  paraPrevia,
  previaSchema,
} from "@arp/shared/operacoes/limpeza-planilha";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import {
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
} from "@/erros";
import {
  gravarArquivo,
  infoDoArquivo,
  lerArquivo,
  linkDeLeitura,
  prepararEnvio,
  removerArquivos,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import { TIPO_XLSX } from "@/infra/planilha";
import { notificar } from "../os/base.service";
import {
  BUCKET,
  lerParametros,
  logImportacaoOp,
  logOperacoes,
  podeAgora,
} from "./apoio";
import * as imps from "./importacoes.repository";
import * as repo from "./limpeza.repository";
import {
  detalheDoMes,
  PERMISSAO_FINANCEIRO,
  veRateio,
} from "./limpeza.service";
import { gerarDemonstrativo } from "./limpeza-pdf";
import { planilhaDoRateio } from "./limpeza-planilha";

// Gravações do rateio da limpeza (spec 4.8), todas com a sessão: o banco
// confere operacoes.limpeza.fechar e o RLS deixa mudar só o mês aberto. Mês
// e filhos vão juntos em operacoes.limpeza_salvar (uma transação). Mudanças
// de mês ficam em core.auditoria (gatilho de limpeza_meses).

const PERMISSAO = "operacoes.limpeza.fechar";
const SEM_PERMISSAO = "Você não tem permissão para lançar o rateio da limpeza.";
const SEM_PERMISSAO_IMPORTAR = "Você não tem permissão para importar o rateio.";
const ANEXO_MAX_MB = 25;
const PLANILHA_MAX_MB = 40;

const ehGrupoEquipe = (g: string): g is GrupoEquipe => g in GRUPOS_EQUIPE;

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

function mesValido(v: string): string {
  const ref = lerMes(v);
  if (!ref) throw new ErroDeValidacao("Mês inválido.");
  return ref;
}

/** Erro do banco com as mensagens da tela do rateio. */
function erroDoRateio(e: unknown, contexto: string): never {
  if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
  if (e instanceof ErroDeConflito)
    throw new ErroDeConflito("Este mês já existe no rateio.");
  if (
    (e instanceof ErroDeNegocio && e.message === "Valor fora do permitido.") ||
    codigoDoBanco(e) === "22P02"
  )
    throw new ErroDeNegocio(
      "Algum valor está fora do permitido. Confira os campos.",
    );
  if (e instanceof ErroDeNegocio) throw e;
  log.error({ err: e }, contexto);
  throw new ErroDeNegocio("Não foi possível salvar. Tente de novo.");
}

// ---------------------------------------------------------------------------
// Lançamento do mês
// ---------------------------------------------------------------------------

/** Salva o mês aberto (cria se ainda não existe). */
export async function salvarRateio(
  ctx: Contexto,
  referencia: string,
  l: Record<string, unknown>,
): Promise<string> {
  const ref = mesValido(referencia);
  const d = dadosParaSalvar({ ...l, referencia: ref }, regraBl04Do(ref));
  if (!d.ok) throw new ErroDeNegocio(d.erro);
  await naSessao(ctx, (tx) => repo.salvar(tx, d.referencia, d.dados)).catch(
    (e: unknown) => erroDoRateio(e, "salvar rateio"),
  );
  return `Rateio de ${nomeDoMes(d.referencia)} salvo.`;
}

const extrasPadrao = z.array(
  z.object({
    descricao: z.string().trim().min(1).max(200),
    valor_dia: z.coerce.number().nonnegative(),
  }),
);

/** O último mês antes de `ref` que vale (sem importação em prévia). */
async function mesAnteriorQueVale(ctx: Contexto, ref: string) {
  const anteriores = await naSessao(ctx, (tx) => repo.mesesAntes(tx, ref));
  return anteriores.find(
    (m) => !m.importacao_id || m.importacao_status === "confirmada",
  );
}

/**
 * Começa um mês: copiando o mês anterior lançado (os mesmos valores, para só
 * ajustar o que mudou) ou do zero, com os funcionários e os extras padrão
 * dos Parâmetros (quantidade zero, para preencher).
 */
export async function criarMes(
  ctx: Contexto,
  entrada: { referencia: string; copiar: boolean },
): Promise<{ mensagem: string; referencia: string }> {
  const ref = lerMes(entrada.referencia);
  if (!ref) throw new ErroDeValidacao("Mês inválido.");
  const { copiar } = entrada;
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const { ja, param } = await naSessao(ctx, async (tx) => ({
    ja: await repo.existe(tx, ref),
    param: await lerParametros(tx),
  })).catch((e: unknown) => erroDoRateio(e, "criar mês"));
  if (ja) throw new ErroDeConflito(`O rateio de ${nomeDoMes(ref)} já existe.`);

  let dados: DadosParaSalvar;
  if (copiar) {
    const origem = await mesAnteriorQueVale(ctx, ref).catch((e: unknown) =>
      erroDoRateio(e, "copiar mês"),
    );
    if (!origem)
      throw new ErroDeNegocio(
        "Não há mês anterior para copiar. Comece do zero.",
      );
    const d = await detalheDoMes(ctx, origem.referencia);
    if (!d) throw new ErroDeNegocio("Não foi possível ler o mês anterior.");
    dados = {
      apontamento: null,
      valor_base: d.mes.valor_base,
      base_composicao: d.mes.base_composicao,
      func_base: d.mes.func_base,
      func_area_comum: d.mes.func_area_comum,
      func_rateados: d.mes.func_rateados,
      regra_bl04: regraBl04Do(ref),
      extras: d.extras.map((x) => ({
        descricao: x.descricao,
        quantidade: x.quantidade,
        valor_unitario: x.valor_unitario,
        valor: x.valor,
      })),
      minutos: param.limpeza_blocos.map((bloco) => {
        const m = d.minutos.find((x) => x.bloco === bloco);
        return {
          bloco,
          limpeza: m?.limpeza ?? 0,
          manutencao: m?.manutencao ?? 0,
        };
      }),
      contrato: d.contrato,
      equipe: d.equipe.map((x) => ({
        nome: x.nome,
        funcao: x.funcao,
        grupo: ehGrupoEquipe(x.grupo) ? x.grupo : "area_comum",
        blocos: x.blocos,
        turno: x.turno,
        minutos_dia: x.minutos_dia,
      })),
    };
  } else {
    const padrao = extrasPadrao.safeParse(param.limpeza_extras_padrao);
    dados = {
      apontamento: null,
      valor_base: null,
      base_composicao: null,
      func_base: param.limpeza_func_base,
      func_area_comum: param.limpeza_func_area_comum,
      func_rateados: param.limpeza_func_rateados,
      regra_bl04: regraBl04Do(ref),
      extras: (padrao.success ? padrao.data : []).map((x) => ({
        descricao: x.descricao,
        quantidade: 0,
        valor_unitario: x.valor_dia,
        valor: 0,
      })),
      minutos: param.limpeza_blocos.map((bloco) => ({
        bloco,
        limpeza: 0,
        manutencao: 0,
      })),
      contrato: [],
      equipe: [],
    };
  }
  await naSessao(ctx, (tx) => repo.salvar(tx, ref, dados)).catch((e: unknown) =>
    erroDoRateio(e, "criar mês"),
  );
  return {
    mensagem: copiar
      ? `${nomeDoMes(ref)} começou com os valores do mês anterior. Ajuste o que mudou.`
      : `${nomeDoMes(ref)} criado. Lance o valor base, os extras e os minutos.`,
    referencia: ref,
  };
}

/**
 * "Copiar mês anterior" num mês aberto: os valores do último mês lançado
 * antes dele, para a tela preencher (nada é gravado aqui).
 */
export async function lancamentoDoMesAnterior(
  ctx: Contexto,
  referencia: string,
): Promise<{ lancamento: Lancamento; de: string }> {
  const ref = mesValido(referencia);
  const lido = await (async () => {
    const origem = await mesAnteriorQueVale(ctx, ref);
    const param = await naSessao(ctx, lerParametros);
    return { origem, param };
  })().catch((e: unknown) => {
    log.error({ err: e }, "mês anterior do rateio");
    throw new ErroDeNegocio("Não foi possível ler o mês anterior.");
  });
  if (!lido.origem) throw new ErroDeNegocio("Não há mês anterior para copiar.");
  const d = await detalheDoMes(ctx, lido.origem.referencia);
  if (!d) throw new ErroDeNegocio("Não foi possível ler o mês anterior.");
  return {
    de: lido.origem.referencia,
    lancamento: lancamentoDasLinhas(
      ref,
      { ...d.mes, apontamento: null },
      d.extras,
      d.minutos,
      d.contrato,
      d.equipe,
      lido.param.limpeza_blocos,
    ),
  };
}

// ---------------------------------------------------------------------------
// Fechar, reabrir e enviar ao Financeiro
// ---------------------------------------------------------------------------

export async function fecharRateio(
  ctx: Contexto,
  referencia: string,
): Promise<string> {
  const ref = mesValido(referencia);
  await naSessao(ctx, (tx) => repo.fechar(tx, ref)).catch((e: unknown) =>
    erroDoRateio(e, "fechar rateio"),
  );
  logOperacoes(
    ctx,
    "operacoes_rateio_fechado",
    `Fechou o rateio da limpeza de ${nomeDoMes(ref)}`,
    { referencia: ref },
  );
  return `${nomeDoMes(ref)} fechado. Agora é só leitura.`;
}

export async function reabrirRateio(
  ctx: Contexto,
  referencia: string,
  motivo: string,
): Promise<string> {
  const ref = mesValido(referencia);
  const m = z.string().trim().min(3).max(500).safeParse(motivo);
  if (!m.success)
    throw new ErroDeValidacao(
      "Motivo: escreva por que o mês precisa ser reaberto.",
    );
  await naSessao(ctx, (tx) => repo.reabrir(tx, ref, m.data)).catch(
    (e: unknown) => erroDoRateio(e, "reabrir rateio"),
  );
  logOperacoes(
    ctx,
    "operacoes_rateio_reaberto",
    `Reabriu o rateio da limpeza de ${nomeDoMes(ref)}`,
    { referencia: ref, motivo: m.data },
  );
  return `${nomeDoMes(ref)} reaberto. O envio ao Financeiro foi desfeito; envie de novo depois de fechar.`;
}

/**
 * "Enviar ao Financeiro": registra data e autor (limpeza_enviar), guarda o
 * resultado por bloco em Excel e PDF nos anexos do mês e avisa no sistema
 * quem tem PERMISSAO_FINANCEIRO, com o link do demonstrativo.
 */
export async function enviarRateio(
  ctx: Contexto,
  referencia: string,
): Promise<string> {
  const ref = mesValido(referencia);
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO);
  await naSessao(ctx, (tx) => repo.enviar(tx, ref)).catch((e: unknown) =>
    erroDoRateio(e, "enviar rateio"),
  );

  const d = await detalheDoMes(ctx, ref);
  const param = await naSessao(ctx, lerParametros);
  const agora = new Date().toISOString();
  const quando = formatarDataHora(agora);
  if (d) {
    // Cópia do que foi enviado (o link do Financeiro gera na hora).
    const geradoEm = `${quando} por ${ctx.usuario.nome}`;
    const mes = ref.slice(0, 7);
    const marca = `${agora.replace(/\D/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
    const arquivos = [
      {
        caminho: `limpeza/${mes}/financeiro/${marca}-rateio.pdf`,
        nome: `Rateio ${nomeDoMes(ref)} enviado ao Financeiro em ${quando}.pdf`,
        tipo: "application/pdf",
        gerar: () =>
          gerarDemonstrativo({
            detalhe: d,
            empresa: param.limpeza_empresa,
            geradoEm,
          }),
      },
      {
        caminho: `limpeza/${mes}/financeiro/${marca}-rateio.xlsx`,
        nome: `Rateio ${nomeDoMes(ref)} enviado ao Financeiro em ${quando}.xlsx`,
        tipo: TIPO_XLSX,
        gerar: () => planilhaDoRateio(d, param.limpeza_empresa, geradoEm),
      },
    ];
    try {
      for (const a of arquivos)
        await gravarArquivo(BUCKET, a.caminho, await a.gerar(), a.tipo);
      await naSessao(ctx, (tx) =>
        repo.inserirAnexos(
          tx,
          arquivos.map((a) => ({
            referencia: ref,
            nome: a.nome,
            caminho: a.caminho,
            tipo: "outro",
          })),
        ),
      );
    } catch (erro) {
      // O envio vale; a cópia é só registro (o link gera de novo).
      log.error({ err: erro }, "cópia do rateio enviado");
      await removerArquivos(
        BUCKET,
        arquivos.map((a) => a.caminho),
      );
    }

    const total = d.resultado.total;
    void avisarFinanceiro(ctx, ref, mes, total, agora).catch((err: unknown) =>
      log.error({ err }, "aviso do rateio ao Financeiro"),
    );
  }
  logOperacoes(
    ctx,
    "operacoes_rateio_enviado",
    `Enviou o rateio da limpeza de ${nomeDoMes(ref)} ao Financeiro`,
    { referencia: ref },
  );
  return `Rateio de ${nomeDoMes(ref)} enviado ao Financeiro em ${quando}.`;
}

async function avisarFinanceiro(
  ctx: Contexto,
  ref: string,
  mes: string,
  total: number | null,
  agora: string,
) {
  const financeiro = await banco.comoServico((tx) =>
    repo.usuariosComPermissao(tx, PERMISSAO_FINANCEIRO),
  );
  await notificar(
    financeiro,
    {
      tipo: "rateio_limpeza_enviado",
      titulo: `Rateio da limpeza de ${nomeDoMes(ref)} enviado ao Financeiro`,
      texto: `Total R$ ${reais(total)}. O link abre o resultado por bloco em PDF; o Excel fica em /operacoes/limpeza/${mes}/planilha.`,
      href: `/operacoes/limpeza/${mes}/demonstrativo`,
      chave: `rateio_limpeza:${mes}:${agora}`,
    },
    ctx.usuario.id,
  );
}

// ---------------------------------------------------------------------------
// Anexos do mês (medição ou nota da empresa, apontamento de minutos)
// ---------------------------------------------------------------------------

const ACEITOS = /\.(pdf|png|jpe?g|webp|xlsx|xls|csv|docx?)$/i;

export async function prepararAnexoRateio(
  ctx: Contexto,
  entrada: { referencia: string; tipo: string; nome: string; tamanho: number },
): Promise<{ url: string; caminho: string }> {
  const referencia = lerMes(entrada.referencia);
  if (!referencia) throw new ErroDeValidacao("Arquivo inválido.");
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const { tipo, nome, tamanho } = entrada;
  if (!ACEITOS.test(nome))
    throw new ErroDeNegocio(
      "Envie PDF, imagem (PNG, JPG), planilha (XLSX, CSV) ou Word.",
    );
  if (tamanho > ANEXO_MAX_MB * 1024 * 1024)
    throw new ErroDeNegocio(`Arquivo maior que ${ANEXO_MAX_MB} MB.`);
  if (!(await naSessao(ctx, (tx) => repo.existe(tx, referencia))))
    throw new ErroDeNegocio("Salve o mês antes de anexar.");
  const caminho = `limpeza/${referencia.slice(0, 7)}/${tipo}-${randomBytes(4).toString("hex")}-${nomeSeguro(nome)}`;
  const envio = await prepararEnvio(BUCKET, caminho, {
    maxBytes: ANEXO_MAX_MB * 1024 * 1024,
  });
  if ("erro" in envio)
    throw new ErroDeNegocio(
      "Não foi possível preparar o envio. Tente de novo.",
    );
  return { url: envio.url, caminho };
}

export async function registrarAnexoRateio(
  ctx: Contexto,
  entrada: { referencia: string; tipo: string; caminho: string; nome: string },
): Promise<string> {
  const referencia = lerMes(entrada.referencia);
  if (!referencia) throw new ErroDeValidacao("Arquivo inválido.");
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const { tipo, caminho, nome } = entrada;
  if (!caminho.startsWith(`limpeza/${referencia.slice(0, 7)}/${tipo}-`))
    throw new ErroDeValidacao("Arquivo inválido.");
  const info = await infoDoArquivo(BUCKET, caminho);
  if (!info)
    throw new ErroDeNegocio("O arquivo não chegou. Tente enviar de novo.");
  if (info.tamanho > ANEXO_MAX_MB * 1024 * 1024) {
    await removerArquivos(BUCKET, [caminho]);
    throw new ErroDeNegocio(`Arquivo maior que ${ANEXO_MAX_MB} MB.`);
  }
  try {
    await naSessao(ctx, (tx) =>
      repo.inserirAnexos(tx, [{ referencia, nome, caminho, tipo }]),
    );
  } catch (e) {
    await removerArquivos(BUCKET, [caminho]);
    erroDoRateio(e, "registrar anexo do rateio");
  }
  return "Arquivo anexado ao mês.";
}

export async function removerAnexoRateio(
  ctx: Contexto,
  id: string,
): Promise<string> {
  const linhas = await naSessao(ctx, (tx) => repo.removerAnexo(tx, id)).catch(
    (e: unknown) => erroDoRateio(e, "remover anexo do rateio"),
  );
  const linha = linhas[0];
  if (!linha)
    throw new ErroDeNegocio(
      "Anexo não encontrado ou mês fechado (reabra para remover).",
    );
  await removerArquivos(BUCKET, [linha.caminho]);
  return "Anexo removido.";
}

/** Link assinado (60 s) de um anexo que a pessoa vê pelo RLS. */
export async function linkDoAnexoRateio(
  ctx: Contexto,
  id: string,
): Promise<string> {
  // Antes era só o RLS (o anexo segue o mês); aqui também a regra da tela.
  if (!veRateio(ctx))
    throw new ErroDePermissao("Você não tem acesso ao rateio da limpeza.");
  const a = await naSessao(ctx, (tx) => repo.anexo(tx, id));
  if (!a) throw new ErroDeNegocio("Anexo não encontrado.");
  const url = await linkDeLeitura(BUCKET, a.caminho, {
    segundos: 60,
    baixarComo: a.nome,
  });
  if (!url) throw new ErroDeNegocio("Não foi possível abrir o anexo.");
  return url;
}

// ---------------------------------------------------------------------------
// Importação do histórico (planilha "RATEIO BS E MANUTENÇÃO")
// ---------------------------------------------------------------------------

export async function prepararEnvioHistorico(
  ctx: Contexto,
  entrada: { nome: string; tamanho: number },
): Promise<{ url: string; caminho: string }> {
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO_IMPORTAR);
  if (!/\.xlsx$/i.test(entrada.nome))
    throw new ErroDeNegocio("Envie a planilha em Excel (.xlsx), como recebeu.");
  if (entrada.tamanho > PLANILHA_MAX_MB * 1024 * 1024)
    throw new ErroDeNegocio(`Planilha maior que ${PLANILHA_MAX_MB} MB.`);
  const caminho = `importacoes/limpeza/${randomUUID()}/${nomeSeguro(entrada.nome)}`;
  const envio = await prepararEnvio(BUCKET, caminho, {
    maxBytes: PLANILHA_MAX_MB * 1024 * 1024,
  });
  if ("erro" in envio)
    throw new ErroDeNegocio(
      "Não foi possível preparar o envio. Tente de novo.",
    );
  return { url: envio.url, caminho };
}

const CAMINHO_HISTORICO = /^importacoes\/limpeza\/[0-9a-f-]{36}\/[\w.-]{1,80}$/;

/**
 * Prévia: lê as abas pelas células fixas, refaz a conta de cada mês com a
 * regra do Bloco 04 da época e grava os meses na importação "prévia" (não
 * aparecem no rateio até confirmar). Mês que já existe no rateio fica de
 * fora, com aviso. Arquivo já importado é recusado (sha256).
 */
export async function previaHistorico(
  ctx: Contexto,
  entrada: { caminho: string; nome: string },
): Promise<PreviaHistorico> {
  const { caminho, nome } = entrada;
  if (!CAMINHO_HISTORICO.test(caminho))
    throw new ErroDeValidacao("Arquivo inválido.");
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO_IMPORTAR);
  const falhar = async (erro: string): Promise<never> => {
    await removerArquivos(BUCKET, [caminho]);
    throw new ErroDeNegocio(erro);
  };

  const info = await infoDoArquivo(BUCKET, caminho);
  if (!info) throw new ErroDeNegocio("O arquivo não chegou. Envie de novo.");
  if (info.tamanho > PLANILHA_MAX_MB * 1024 * 1024)
    return falhar(`Planilha maior que ${PLANILHA_MAX_MB} MB.`);
  const bytes = await lerArquivo(BUCKET, caminho);
  if (!bytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    return falhar("O arquivo não é uma planilha .xlsx.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  let repetida:
    | Awaited<ReturnType<typeof imps.importacaoDoArquivo>>[number]
    | undefined;
  let param: Awaited<ReturnType<typeof lerParametros>>;
  try {
    const lido = await naSessao(ctx, async (tx) => ({
      repetida: (
        await imps.importacaoDoArquivo(tx, "limpeza", sha256, ["confirmada"])
      )[0],
      param: await lerParametros(tx),
    }));
    repetida = lido.repetida;
    param = lido.param;
  } catch (erro) {
    log.error({ err: erro }, "conferência de planilha repetida (rateio)");
    return falhar(
      "Não foi possível conferir se a planilha já foi importada. Tente de novo.",
    );
  }
  if (repetida)
    return falhar(
      `Esta planilha já foi importada${repetida.confirmado_em ? ` em ${formatarDataHora(repetida.confirmado_em)}` : ""}. Para trocar, desfaça aquela importação primeiro.`,
    );

  let leitura: ReturnType<typeof lerHistoricoDoRateio>;
  try {
    leitura = lerHistoricoDoRateio(await abasDoExcel(bytes), {
      blocos: param.limpeza_blocos,
      funcAreaComum: param.limpeza_func_area_comum,
      funcRateados: param.limpeza_func_rateados,
    });
  } catch (erro) {
    log.error({ err: erro }, "leitura do histórico do rateio");
    return falhar(
      'Não consegui ler a planilha. Confira se é a "RATEIO BS E MANUTENÇÃO" em .xlsx.',
    );
  }
  if (!leitura.meses.length)
    return falhar(
      leitura.avisos[0]?.mensagem ?? "Nenhuma aba de mês na planilha.",
    );

  let existentes: string[];
  try {
    existentes = await naSessao(ctx, (tx) =>
      repo.referenciasExistentes(
        tx,
        leitura.meses.map((m) => m.referencia),
      ),
    );
  } catch {
    return falhar("Não foi possível conferir os meses já lançados.");
  }
  const ja = new Set(existentes);
  const entram = leitura.meses.filter((m) => !ja.has(m.referencia));
  if (!entram.length)
    return falhar(
      "Todos os meses desta planilha já estão no rateio. Nada a importar.",
    );
  const previa = paraPrevia(leitura, entram, [...ja].sort(), nome);

  // Importação e meses numa transação: se os meses falham, nada fica.
  let id: string;
  let etapa: "registrar" | "gravar" = "registrar";
  try {
    id = await naSessao(ctx, async (tx) => {
      const imp = await imps.inserirImportacao(tx, {
        tipo: "limpeza",
        referencia: `Histórico do rateio${previa.resumo.periodo ? ` · ${previa.resumo.periodo}` : ""}`,
        arquivos: [{ nome, caminho, sha256, bytes: info.tamanho }],
        resumo: previa.resumo,
        avisos: previa.avisos,
        bate: previa.bate,
        criado_por: ctx.usuario.id,
      });
      etapa = "gravar";
      await repo.gravarPrevia(tx, imp.id, entram.map(mesParaGravar));
      return imp.id;
    });
  } catch (e) {
    if (etapa === "registrar") {
      log.error({ err: e }, "prévia do histórico do rateio");
      return falhar("Não foi possível registrar a prévia. Tente de novo.");
    }
    log.error({ err: e }, "meses da prévia do rateio");
    return falhar(
      e instanceof ErroDeNegocio
        ? e.message
        : "Não foi possível gravar a prévia. Nada foi importado.",
    );
  }
  return { ...previa, id };
}

function mesParaGravar(m: MesLido) {
  return {
    referencia: m.referencia,
    apontamento: m.apontamento,
    valor_base: m.valorBase === null ? null : m.valorBase / 100,
    func_base: m.funcBase,
    func_area_comum: m.funcAreaComum,
    func_rateados: m.funcRateados,
    regra_bl04: m.regraBl04,
    incompleto: m.incompleto,
    valores_planilha: m.planilha,
    extras: m.extras.map((x) => ({
      descricao: x.descricao,
      quantidade: x.quantidade,
      valor_unitario: x.valorUnitario === null ? null : x.valorUnitario / 100,
      valor: x.valor / 100,
    })),
    minutos: m.minutos,
  };
}

const arquivosSchema = z
  .array(
    z.object({ nome: z.string().optional(), caminho: z.string().optional() }),
  )
  .catch([]);

/** A prévia que a pessoa deixou aberta (para confirmar ou descartar). */
export async function previaAbertaHistorico(
  ctx: Contexto,
): Promise<PreviaHistorico | null> {
  if (!(await podeAgora(ctx, PERMISSAO))) return null;
  const data = await naSessao(ctx, (tx) =>
    repo.previaAberta(tx, ctx.usuario.id),
  );
  if (!data) return null;
  const p = previaSchema.safeParse({
    id: data.id,
    arquivo: arquivosSchema.parse(data.arquivos)[0]?.nome ?? "planilha",
    resumo: data.resumo,
    avisos: z.array(avisoSchema).catch([]).parse(data.avisos),
    bate: data.bate ?? true,
  });
  return p.success ? p.data : null;
}

export async function confirmarHistorico(
  ctx: Contexto,
  id: string,
  motivo?: string,
): Promise<string> {
  try {
    await naSessao(ctx, (tx) => imps.confirmar(tx, id, motivo || undefined));
  } catch (e) {
    if (e instanceof ErroDePermissao)
      throw new ErroDePermissao(SEM_PERMISSAO_IMPORTAR);
    if (e instanceof ErroDeNegocio) throw e;
    log.error({ err: e }, "confirmar histórico do rateio");
    throw new ErroDeNegocio("Não foi possível confirmar. Nada foi alterado.");
  }
  logImportacaoOp(ctx, "confirmou", { id, tipo: "limpeza" }, undefined, {
    motivo: motivo || undefined,
  });
  return "Histórico importado. Os meses estão no rateio, com a conta refeita.";
}

/** Descarta a prévia: os meses lidos saem e o arquivo é apagado. */
export async function descartarHistorico(
  ctx: Contexto,
  id: string,
): Promise<string> {
  const data = await naSessao(ctx, (tx) => repo.statusDaImportacao(tx, id));
  if (!data || data.status !== "previa")
    throw new ErroDeNegocio("Esta prévia já foi confirmada ou descartada.");
  try {
    await naSessao(ctx, (tx) => imps.desfazer(tx, id));
  } catch (e) {
    if (e instanceof ErroDePermissao)
      throw new ErroDePermissao(SEM_PERMISSAO_IMPORTAR);
    log.error({ err: e }, "descartar prévia do rateio");
    throw new ErroDeNegocio("Não foi possível descartar. Tente de novo.");
  }
  const caminhos = arquivosSchema
    .parse(data.arquivos)
    .map((a) => a.caminho)
    .filter((c): c is string => typeof c === "string");
  await removerArquivos(BUCKET, caminhos);
  logImportacaoOp(ctx, "descartou", { id, tipo: "limpeza" });
  return "Prévia descartada. Nada foi importado.";
}
