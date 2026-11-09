"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { nomeSeguro } from "@/lib/arquivos/nome";
import { formatarDataHora } from "@/lib/formato";
import { lerMes, nomeDoMes, reais, regraBl04Do } from "@/lib/operacoes/limpeza";
import {
  type DadosParaSalvar,
  dadosParaSalvar,
  type Lancamento,
  lancamentoDasLinhas,
} from "@/lib/operacoes/limpeza-lancamento";
import {
  abasDoExcel,
  avisoSchema,
  lerHistoricoDoRateio,
  type MesLido,
  type PreviaHistorico,
  paraPrevia,
  previaSchema,
} from "@/lib/operacoes/limpeza-planilha";
import type { Json } from "@/lib/supabase/database.types";
import {
  type Bucket,
  gravarArquivo,
  infoDoArquivo,
  lerArquivo,
  linkDeLeitura,
  prepararEnvio,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { usuariosComPermissao } from "@/server/comercial/usuarios";
import { notificar } from "@/server/os/base";
import { TIPO_XLSX } from "@/server/os/relatorios/planilha";
import { op, parametros } from "../base";
import { logImportacaoOp, logOperacoes } from "../historico";
import { importacaoDoArquivo } from "../importacoes";
import { detalheDoMes, PERMISSAO_FINANCEIRO } from "../limpeza";
import { gerarDemonstrativo } from "../limpeza-pdf";
import { planilhaDoRateio } from "../limpeza-planilha";

// Gravações do rateio da limpeza (spec 4.8), todas com a sessão: o banco
// confere operacoes.limpeza.fechar e o RLS deixa mudar só o mês aberto
// (20261109160000_operacoes, 20261109160400_operacoes_limpeza). Mês e
// filhos vão juntos em operacoes.limpeza_salvar (uma transação). O rateio
// não fica em cache no servidor: basta refresh(). Mudanças de mês ficam em
// core.auditoria (gatilho de limpeza_meses).

const BUCKET: Bucket = "operacoes";
const PERMISSAO = "operacoes.limpeza.fechar";
const SEM_PERMISSAO = "Você não tem permissão para lançar o rateio da limpeza.";
const ANEXO_MAX_MB = 25;
const PLANILHA_MAX_MB = 40;

const mesValido = z
  .string()
  .transform((v) => lerMes(v))
  .refine((v): v is string => v !== null, "Mês inválido.");

function erroDoBanco(
  error: { message: string; code?: string },
  contexto: string,
): EstadoAcao {
  if (error.code === "42501") return { erro: SEM_PERMISSAO };
  if (error.code === "22023" || error.code === "P0001") {
    const m = error.message;
    return { erro: `${m.charAt(0).toUpperCase()}${m.slice(1)}.` };
  }
  if (error.code === "23514" || error.code === "22P02")
    return { erro: "Algum valor está fora do permitido. Confira os campos." };
  if (error.code === "23505") return { erro: "Este mês já existe no rateio." };
  console.error(contexto, error);
  return { erro: "Não foi possível salvar. Tente de novo." };
}

// ---------------------------------------------------------------------------
// Lançamento do mês
// ---------------------------------------------------------------------------

/** Salva o mês aberto (cria se ainda não existe). */
export async function salvarRateio(l: Lancamento): Promise<EstadoAcao> {
  const ref = lerMes(
    typeof l === "object" && l !== null ? String(l.referencia) : "",
  );
  if (!ref) return { erro: "Mês inválido." };
  const d = dadosParaSalvar(l, regraBl04Do(ref));
  if (!d.ok) return { erro: d.erro };
  const { error } = await (await op()).rpc("limpeza_salvar", {
    p_ref: d.referencia,
    p_dados: d.dados as unknown as Json,
  });
  if (error) return erroDoBanco(error, "salvar rateio");
  refresh();
  return { ok: `Rateio de ${nomeDoMes(d.referencia)} salvo.` };
}

const extrasPadrao = z.array(
  z.object({
    descricao: z.string().trim().min(1).max(200),
    valor_dia: z.coerce.number().nonnegative(),
  }),
);

/**
 * Começa um mês: copiando o mês anterior lançado (os mesmos valores, para só
 * ajustar o que mudou) ou do zero, com os funcionários e os extras padrão
 * dos Parâmetros (quantidade zero, para preencher).
 */
export async function criarMes(entrada: {
  referencia: string;
  copiar: boolean;
}): Promise<EstadoAcao & { referencia?: string }> {
  const e = z
    .object({ referencia: mesValido, copiar: z.boolean() })
    .safeParse(entrada);
  if (!e.success) return { erro: "Mês inválido." };
  const { referencia: ref, copiar } = e.data;
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const db = await op();
  const [existe, param] = await Promise.all([
    db
      .from("limpeza_meses")
      .select("referencia")
      .eq("referencia", ref)
      .maybeSingle(),
    parametros(),
  ]);
  if (existe.error) return erroDoBanco(existe.error, "criar mês");
  if (existe.data)
    return {
      erro: `O rateio de ${nomeDoMes(ref)} já existe.`,
      referencia: ref,
    };

  let dados: DadosParaSalvar;
  if (copiar) {
    const anterior = await db
      .from("limpeza_meses")
      .select("referencia, importacao_id, importacoes(status)")
      .lt("referencia", ref)
      .order("referencia", { ascending: false })
      .limit(24);
    if (anterior.error) return erroDoBanco(anterior.error, "copiar mês");
    const origem = (anterior.data ?? []).find(
      (m) => !m.importacao_id || m.importacoes?.status === "confirmada",
    );
    if (!origem)
      return { erro: "Não há mês anterior para copiar. Comece do zero." };
    const d = await detalheDoMes(origem.referencia);
    if (!d) return { erro: "Não foi possível ler o mês anterior." };
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
        grupo: x.grupo as DadosParaSalvar["equipe"][number]["grupo"],
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
  const { error } = await db.rpc("limpeza_salvar", {
    p_ref: ref,
    p_dados: dados as unknown as Json,
  });
  if (error) return erroDoBanco(error, "criar mês");
  refresh();
  return {
    ok: copiar
      ? `${nomeDoMes(ref)} começou com os valores do mês anterior. Ajuste o que mudou.`
      : `${nomeDoMes(ref)} criado. Lance o valor base, os extras e os minutos.`,
    referencia: ref,
  };
}

// ---------------------------------------------------------------------------
// Fechar, reabrir e enviar ao Financeiro
// ---------------------------------------------------------------------------

export async function fecharRateio(referencia: string): Promise<EstadoAcao> {
  const ref = lerMes(referencia);
  if (!ref) return { erro: "Mês inválido." };
  const { error } = await (await op()).rpc("limpeza_fechar", { p_ref: ref });
  if (error) return erroDoBanco(error, "fechar rateio");
  refresh();
  await logOperacoes(
    "operacoes_rateio_fechado",
    `Fechou o rateio da limpeza de ${nomeDoMes(ref)}`,
    { referencia: ref },
  );
  return { ok: `${nomeDoMes(ref)} fechado. Agora é só leitura.` };
}

export async function reabrirRateio(
  referencia: string,
  motivo: string,
): Promise<EstadoAcao> {
  const ref = lerMes(referencia);
  if (!ref) return { erro: "Mês inválido." };
  const m = z.string().trim().min(3).max(500).safeParse(motivo);
  if (!m.success)
    return { erro: "Motivo: escreva por que o mês precisa ser reaberto." };
  const { error } = await (await op()).rpc("limpeza_reabrir", {
    p_ref: ref,
    p_motivo: m.data,
  });
  if (error) return erroDoBanco(error, "reabrir rateio");
  refresh();
  await logOperacoes(
    "operacoes_rateio_reaberto",
    `Reabriu o rateio da limpeza de ${nomeDoMes(ref)}`,
    { referencia: ref, motivo: m.data },
  );
  return {
    ok: `${nomeDoMes(ref)} reaberto. O envio ao Financeiro foi desfeito; envie de novo depois de fechar.`,
  };
}

/**
 * "Enviar ao Financeiro": registra data e autor (limpeza_enviar), guarda o
 * resultado por bloco em Excel e PDF nos anexos do mês e avisa no sistema
 * quem tem PERMISSAO_FINANCEIRO, com o link do demonstrativo.
 */
export async function enviarRateio(referencia: string): Promise<EstadoAcao> {
  const ref = lerMes(referencia);
  if (!ref) return { erro: "Mês inválido." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const db = await op();
  const { error } = await db.rpc("limpeza_enviar", { p_ref: ref });
  if (error) return erroDoBanco(error, "enviar rateio");

  const [d, param, usuario] = await Promise.all([
    detalheDoMes(ref),
    parametros(),
    usuarioAtual(),
  ]);
  const agora = new Date().toISOString();
  const quando = formatarDataHora(agora);
  if (d) {
    // Cópia do que foi enviado (o link do Financeiro gera na hora).
    const geradoEm = `${quando} por ${usuario.nome}`;
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
      const { error: e2 } = await db.from("limpeza_anexos").insert(
        arquivos.map((a) => ({
          referencia: ref,
          nome: a.nome,
          caminho: a.caminho,
          tipo: "outro",
        })),
      );
      if (e2) throw e2;
    } catch (erro) {
      // O envio vale; a cópia é só registro (o link gera de novo).
      console.error("cópia do rateio enviado", erro);
      await removerArquivos(
        BUCKET,
        arquivos.map((a) => a.caminho),
      );
    }

    const total = d.resultado.total;
    after(async () => {
      try {
        const financeiro = await usuariosComPermissao(PERMISSAO_FINANCEIRO);
        await notificar(
          financeiro,
          {
            tipo: "rateio_limpeza_enviado",
            titulo: `Rateio da limpeza de ${nomeDoMes(ref)} enviado ao Financeiro`,
            texto: `Total R$ ${reais(total)}. O link abre o resultado por bloco em PDF; o Excel fica em /operacoes/limpeza/${mes}/planilha.`,
            href: `/operacoes/limpeza/${mes}/demonstrativo`,
            chave: `rateio_limpeza:${mes}:${agora}`,
          },
          usuario.id,
        );
      } catch (erro) {
        console.error("aviso do rateio ao Financeiro", erro);
      }
    });
  }
  refresh();
  await logOperacoes(
    "operacoes_rateio_enviado",
    `Enviou o rateio da limpeza de ${nomeDoMes(ref)} ao Financeiro`,
    { referencia: ref },
  );
  return {
    ok: `Rateio de ${nomeDoMes(ref)} enviado ao Financeiro em ${quando}.`,
  };
}

// ---------------------------------------------------------------------------
// Anexos do mês (medição ou nota da empresa, apontamento de minutos)
// ---------------------------------------------------------------------------

const TIPOS_ANEXO = ["medicao", "apontamento", "outro"] as const;
const ACEITOS = /\.(pdf|png|jpe?g|webp|xlsx|xls|csv|docx?)$/i;

export type EnvioPreparado =
  | { ok: true; url: string; caminho: string }
  | { ok: false; erro: string };

export async function prepararAnexoRateio(entrada: {
  referencia: string;
  tipo: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  const e = z
    .object({
      referencia: mesValido,
      tipo: z.enum(TIPOS_ANEXO),
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  if (!(await podeAgora(PERMISSAO))) return { ok: false, erro: SEM_PERMISSAO };
  const { referencia, tipo, nome, tamanho } = e.data;
  if (!ACEITOS.test(nome))
    return {
      ok: false,
      erro: "Envie PDF, imagem (PNG, JPG), planilha (XLSX, CSV) ou Word.",
    };
  if (tamanho > ANEXO_MAX_MB * 1024 * 1024)
    return { ok: false, erro: `Arquivo maior que ${ANEXO_MAX_MB} MB.` };
  const { data } = await (await op())
    .from("limpeza_meses")
    .select("referencia")
    .eq("referencia", referencia)
    .maybeSingle();
  if (!data) return { ok: false, erro: "Salve o mês antes de anexar." };
  const caminho = `limpeza/${referencia.slice(0, 7)}/${tipo}-${randomBytes(4).toString("hex")}-${nomeSeguro(nome)}`;
  const envio = await prepararEnvio(BUCKET, caminho, {
    maxBytes: ANEXO_MAX_MB * 1024 * 1024,
  });
  if ("erro" in envio)
    return {
      ok: false,
      erro: "Não foi possível preparar o envio. Tente de novo.",
    };
  return { ok: true, url: envio.url, caminho };
}

export async function registrarAnexoRateio(entrada: {
  referencia: string;
  tipo: string;
  caminho: string;
  nome: string;
}): Promise<EstadoAcao> {
  const e = z
    .object({
      referencia: mesValido,
      tipo: z.enum(TIPOS_ANEXO),
      caminho: z.string().max(400),
      nome: z.string().min(1).max(255),
    })
    .safeParse(entrada);
  if (!e.success) return { erro: "Arquivo inválido." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const { referencia, tipo, caminho, nome } = e.data;
  if (!caminho.startsWith(`limpeza/${referencia.slice(0, 7)}/${tipo}-`))
    return { erro: "Arquivo inválido." };
  const info = await infoDoArquivo(BUCKET, caminho);
  if (!info) return { erro: "O arquivo não chegou. Tente enviar de novo." };
  if (info.tamanho > ANEXO_MAX_MB * 1024 * 1024) {
    await removerArquivos(BUCKET, [caminho]);
    return { erro: `Arquivo maior que ${ANEXO_MAX_MB} MB.` };
  }
  const { error } = await (await op())
    .from("limpeza_anexos")
    .insert({ referencia, nome, caminho, tipo });
  if (error) {
    await removerArquivos(BUCKET, [caminho]);
    return erroDoBanco(error, "registrar anexo do rateio");
  }
  refresh();
  return { ok: "Arquivo anexado ao mês." };
}

export async function removerAnexoRateio(id: string): Promise<EstadoAcao> {
  const e = z.uuid().safeParse(id);
  if (!e.success) return { erro: "Anexo inválido." };
  const { data, error } = await (await op())
    .from("limpeza_anexos")
    .delete()
    .eq("id", e.data)
    .select("caminho");
  if (error) return erroDoBanco(error, "remover anexo do rateio");
  const linha = data?.[0];
  if (!linha)
    return {
      erro: "Anexo não encontrado ou mês fechado (reabra para remover).",
    };
  await removerArquivos(BUCKET, [linha.caminho]);
  refresh();
  return { ok: "Anexo removido." };
}

/** Link assinado (60 s) de um anexo que a pessoa vê pelo RLS. */
export async function linkDoAnexoRateio(
  id: string,
): Promise<{ url: string } | { erro: string }> {
  const e = z.uuid().safeParse(id);
  if (!e.success) return { erro: "Anexo inválido." };
  const { data } = await (await op())
    .from("limpeza_anexos")
    .select("caminho, nome")
    .eq("id", e.data)
    .maybeSingle();
  if (!data) return { erro: "Anexo não encontrado." };
  const url = await linkDeLeitura(BUCKET, data.caminho, {
    segundos: 60,
    baixarComo: data.nome,
  });
  return url ? { url } : { erro: "Não foi possível abrir o anexo." };
}

// ---------------------------------------------------------------------------
// Importação do histórico (planilha "RATEIO BS E MANUTENÇÃO")
// ---------------------------------------------------------------------------

export async function prepararEnvioHistorico(entrada: {
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  const e = z
    .object({
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  if (!(await podeAgora(PERMISSAO)))
    return {
      ok: false,
      erro: "Você não tem permissão para importar o rateio.",
    };
  if (!/\.xlsx$/i.test(e.data.nome))
    return {
      ok: false,
      erro: "Envie a planilha em Excel (.xlsx), como recebeu.",
    };
  if (e.data.tamanho > PLANILHA_MAX_MB * 1024 * 1024)
    return { ok: false, erro: `Planilha maior que ${PLANILHA_MAX_MB} MB.` };
  const caminho = `importacoes/limpeza/${randomUUID()}/${nomeSeguro(e.data.nome)}`;
  const envio = await prepararEnvio(BUCKET, caminho, {
    maxBytes: PLANILHA_MAX_MB * 1024 * 1024,
  });
  if ("erro" in envio)
    return {
      ok: false,
      erro: "Não foi possível preparar o envio. Tente de novo.",
    };
  return { ok: true, url: envio.url, caminho };
}

const CAMINHO_HISTORICO = /^importacoes\/limpeza\/[0-9a-f-]{36}\/[\w.-]{1,80}$/;

export type RespostaPrevia =
  | { ok: true; previa: PreviaHistorico }
  | { ok: false; erro: string };

/**
 * Prévia: lê as abas pelas células fixas, refaz a conta de cada mês com a
 * regra do Bloco 04 da época e grava os meses na importação "prévia" (não
 * aparecem no rateio até confirmar). Mês que já existe no rateio fica de
 * fora, com aviso. Arquivo já importado é recusado (sha256).
 */
export async function previaHistorico(entrada: {
  caminho: string;
  nome: string;
}): Promise<RespostaPrevia> {
  const e = z
    .object({
      caminho: z.string().regex(CAMINHO_HISTORICO),
      nome: z.string().min(1).max(255),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  const { caminho, nome } = e.data;
  if (!(await podeAgora(PERMISSAO)))
    return {
      ok: false,
      erro: "Você não tem permissão para importar o rateio.",
    };
  const falhar = async (erro: string): Promise<RespostaPrevia> => {
    await removerArquivos(BUCKET, [caminho]);
    return { ok: false, erro };
  };

  const info = await infoDoArquivo(BUCKET, caminho);
  if (!info) return { ok: false, erro: "O arquivo não chegou. Envie de novo." };
  if (info.tamanho > PLANILHA_MAX_MB * 1024 * 1024)
    return falhar(`Planilha maior que ${PLANILHA_MAX_MB} MB.`);
  const bytes = await lerArquivo(BUCKET, caminho);
  if (!bytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    return falhar("O arquivo não é uma planilha .xlsx.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const db = await op();
  let repetida: Awaited<ReturnType<typeof importacaoDoArquivo>>;
  try {
    repetida = await importacaoDoArquivo(db, "limpeza", sha256, ["confirmada"]);
  } catch (erro) {
    console.error("conferência de planilha repetida (rateio)", erro);
    return falhar(
      "Não foi possível conferir se a planilha já foi importada. Tente de novo.",
    );
  }
  if (repetida)
    return falhar(
      `Esta planilha já foi importada${repetida.confirmado_em ? ` em ${formatarDataHora(repetida.confirmado_em)}` : ""}. Para trocar, desfaça aquela importação primeiro.`,
    );
  const [usuario, param] = await Promise.all([usuarioAtual(), parametros()]);

  let leitura: ReturnType<typeof lerHistoricoDoRateio>;
  try {
    leitura = lerHistoricoDoRateio(await abasDoExcel(bytes), {
      blocos: param.limpeza_blocos,
      funcAreaComum: param.limpeza_func_area_comum,
      funcRateados: param.limpeza_func_rateados,
    });
  } catch (erro) {
    console.error("leitura do histórico do rateio", erro);
    return falhar(
      'Não consegui ler a planilha. Confira se é a "RATEIO BS E MANUTENÇÃO" em .xlsx.',
    );
  }
  if (!leitura.meses.length)
    return falhar(
      leitura.avisos[0]?.mensagem ?? "Nenhuma aba de mês na planilha.",
    );

  const { data: existentes, error: e1 } = await db
    .from("limpeza_meses")
    .select("referencia")
    .in(
      "referencia",
      leitura.meses.map((m) => m.referencia),
    );
  if (e1) return falhar("Não foi possível conferir os meses já lançados.");
  const ja = new Set((existentes ?? []).map((m) => m.referencia));
  const entram = leitura.meses.filter((m) => !ja.has(m.referencia));
  if (!entram.length)
    return falhar(
      "Todos os meses desta planilha já estão no rateio. Nada a importar.",
    );
  const previa = paraPrevia(leitura, entram, [...ja].sort(), nome);

  const { data: imp, error: e2 } = await db
    .from("importacoes")
    .insert({
      tipo: "limpeza",
      referencia: `Histórico do rateio${previa.resumo.periodo ? ` · ${previa.resumo.periodo}` : ""}`,
      arquivos: [{ nome, caminho, sha256, bytes: info.tamanho }] as Json,
      resumo: previa.resumo as unknown as Json,
      avisos: previa.avisos as unknown as Json,
      bate: previa.bate,
      criado_por: usuario.id,
    })
    .select("id")
    .single();
  if (e2 || !imp) {
    console.error("prévia do histórico do rateio", e2);
    return falhar("Não foi possível registrar a prévia. Tente de novo.");
  }
  const { error: e3 } = await db.rpc("limpeza_gravar_previa", {
    p_importacao: imp.id,
    p_meses: entram.map(mesParaGravar) as unknown as Json,
  });
  if (e3) {
    await db.rpc("desfazer_importacao", { p_id: imp.id });
    console.error("meses da prévia do rateio", e3);
    return falhar(
      e3.code === "22023"
        ? `${e3.message.charAt(0).toUpperCase()}${e3.message.slice(1)}.`
        : "Não foi possível gravar a prévia. Nada foi importado.",
    );
  }
  refresh();
  return { ok: true, previa: { ...previa, id: imp.id } };
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

/** A prévia que a pessoa deixou aberta (para confirmar ou descartar). */
export async function previaAbertaHistorico(): Promise<PreviaHistorico | null> {
  if (!(await podeAgora(PERMISSAO))) return null;
  const usuario = await usuarioAtual();
  const { data } = await (await op())
    .from("importacoes")
    .select("id, resumo, avisos, bate, arquivos")
    .eq("tipo", "limpeza")
    .eq("status", "previa")
    .eq("criado_por", usuario.id)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const p = previaSchema.safeParse({
    id: data.id,
    arquivo:
      (data.arquivos as { nome?: string }[] | null)?.[0]?.nome ?? "planilha",
    resumo: data.resumo,
    avisos: z.array(avisoSchema).catch([]).parse(data.avisos),
    bate: data.bate ?? true,
  });
  return p.success ? p.data : null;
}

export async function confirmarHistorico(entrada: {
  id: string;
  motivo?: string;
}): Promise<EstadoAcao> {
  const e = z
    .object({ id: z.uuid(), motivo: z.string().trim().max(500).optional() })
    .safeParse(entrada);
  if (!e.success) return { erro: "Importação inválida." };
  const { error } = await (await op()).rpc("confirmar_importacao", {
    p_id: e.data.id,
    p_motivo: e.data.motivo || undefined,
  });
  if (error) {
    if (error.code === "42501")
      return { erro: "Você não tem permissão para importar o rateio." };
    if (error.code === "22023" || error.code === "P0001")
      return {
        erro: `${error.message.charAt(0).toUpperCase()}${error.message.slice(1)}.`,
      };
    console.error("confirmar histórico do rateio", error);
    return { erro: "Não foi possível confirmar. Nada foi alterado." };
  }
  refresh();
  await logImportacaoOp(
    "confirmou",
    { id: e.data.id, tipo: "limpeza" },
    undefined,
    { motivo: e.data.motivo || undefined },
  );
  return {
    ok: "Histórico importado. Os meses estão no rateio, com a conta refeita.",
  };
}

/** Descarta a prévia: os meses lidos saem e o arquivo é apagado. */
export async function descartarHistorico(id: string): Promise<EstadoAcao> {
  const e = z.uuid().safeParse(id);
  if (!e.success) return { erro: "Importação inválida." };
  const db = await op();
  const { data } = await db
    .from("importacoes")
    .select("arquivos, status")
    .eq("id", e.data)
    .maybeSingle();
  if (!data || data.status !== "previa")
    return { erro: "Esta prévia já foi confirmada ou descartada." };
  const { error } = await db.rpc("desfazer_importacao", { p_id: e.data });
  if (error) {
    if (error.code === "42501")
      return { erro: "Você não tem permissão para importar o rateio." };
    console.error("descartar prévia do rateio", error);
    return { erro: "Não foi possível descartar. Tente de novo." };
  }
  const caminhos = ((data.arquivos as { caminho?: string }[] | null) ?? [])
    .map((a) => a.caminho)
    .filter((c): c is string => typeof c === "string");
  await removerArquivos(BUCKET, caminhos);
  refresh();
  await logImportacaoOp("descartou", { id: e.data, tipo: "limpeza" });
  return { ok: "Prévia descartada. Nada foi importado." };
}

/**
 * "Copiar mês anterior" num mês aberto: os valores do último mês lançado
 * antes dele, para a tela preencher (nada é gravado aqui).
 */
export async function lancamentoDoMesAnterior(
  referencia: string,
): Promise<
  { ok: true; lancamento: Lancamento; de: string } | { ok: false; erro: string }
> {
  const ref = lerMes(referencia);
  if (!ref) return { ok: false, erro: "Mês inválido." };
  const db = await op();
  const [anterior, param] = await Promise.all([
    db
      .from("limpeza_meses")
      .select("referencia, importacao_id, importacoes(status)")
      .lt("referencia", ref)
      .order("referencia", { ascending: false })
      .limit(24),
    parametros(),
  ]);
  if (anterior.error)
    return { ok: false, erro: "Não foi possível ler o mês anterior." };
  const origem = (anterior.data ?? []).find(
    (m) => !m.importacao_id || m.importacoes?.status === "confirmada",
  );
  if (!origem) return { ok: false, erro: "Não há mês anterior para copiar." };
  const d = await detalheDoMes(origem.referencia);
  if (!d) return { ok: false, erro: "Não foi possível ler o mês anterior." };
  return {
    ok: true,
    de: origem.referencia,
    lancamento: lancamentoDasLinhas(
      ref,
      { ...d.mes, apontamento: null },
      d.extras,
      d.minutos,
      d.contrato,
      d.equipe,
      param.limpeza_blocos,
    ),
  };
}
