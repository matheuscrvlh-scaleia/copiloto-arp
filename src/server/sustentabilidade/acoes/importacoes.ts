"use server";

import { createHash, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { nomeSeguro } from "@/lib/arquivos/nome";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import type { Json } from "@/lib/supabase/database.types";
import { TIPOS_DE_IMPORTACAO } from "@/lib/sustentabilidade/importacao";
import {
  contar,
  NOME_DO_TIPO,
} from "@/lib/sustentabilidade/importacao-historico";
import {
  decisoesPendentes,
  type Escolhas,
  escolhasSchema,
  lerEscolhas,
} from "@/lib/sustentabilidade/importacao-linhas";
import { erroDoBanco } from "@/server/acoes";
import {
  infoDoArquivo,
  inicioDoArquivo,
  lerArquivo,
  prepararEnvio,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora } from "@/server/auth";
import { registrarDepois } from "@/server/logs";
import { contextoSu, su } from "@/server/sustentabilidade/base";
import {
  BUCKET_SU,
  type Gravacao,
  type Montagem,
  montarPrevia,
  previaDoArquivo,
  type ResumoGravado,
} from "@/server/sustentabilidade/importacoes";

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

const tipoSchema = z.enum(
  Object.keys(TIPOS_DE_IMPORTACAO) as [
    keyof typeof TIPOS_DE_IMPORTACAO,
    ...(keyof typeof TIPOS_DE_IMPORTACAO)[],
  ],
);
const CAMINHO = /^importacoes\/[0-9a-f-]{36}\/[\w.-]{1,120}$/;

export type EnvioPreparado =
  | { ok: true; url: string; caminho: string }
  | { ok: false; erro: string };

/** Passo 1a: confere tipo, nome e tamanho e devolve o link de envio. */
export async function prepararEnvioImportacao(entrada: {
  tipo: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  const e = z
    .object({
      tipo: tipoSchema,
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Escolha o tipo e o arquivo." };
  if (!(await podeAgora(PERMISSAO))) return { ok: false, erro: SEM_PERMISSAO };
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

export type RespostaDoEnvio =
  | { ok: true; id: string }
  | { ok: false; erro: string }
  | {
      ok: false;
      repetida: { id: string; quando: string; texto: string };
    };

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
export async function lerEnvioImportacao(entrada: {
  tipo: string;
  caminho: string;
  nome: string;
  substituir?: boolean;
}): Promise<RespostaDoEnvio> {
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
  if (!(await podeAgora(PERMISSAO))) return { ok: false, erro: SEM_PERMISSAO };
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

  const [ctx, db] = await Promise.all([contextoSu(), su()]);
  const { data: iguais, error: erroIguais } = await db
    .from("importacoes")
    .select("id, status, criado_por, criado_em, confirmado_em, resumo")
    .eq("tipo", tipo)
    .eq("sha256", sha256)
    .in("status", ["previa", "confirmada"])
    .order("criado_em", { ascending: false });
  if (erroIguais) {
    console.error("arquivo já importado (sustentabilidade)", erroIguais);
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
        texto:
          (confirmada.resumo as { texto?: string } | null)?.texto ??
          NOME_DO_TIPO[tipo],
      },
    };

  let montagem: Montagem;
  try {
    montagem = await previaDoArquivo({
      id: "",
      tipo,
      bytes,
      escolhas: lerEscolhas({}),
      substitui: confirmada?.id ?? null,
      podeValores: ctx.pode("sustentabilidade.valores"),
    });
  } catch (erro) {
    console.error("leitura da importação (sustentabilidade)", tipo, erro);
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

  const { data: criada, error } = await db
    .from("importacoes")
    .insert({
      tipo,
      arquivo: { nome, caminho, bytes: info.tamanho },
      sha256,
      substitui: confirmada?.id ?? null,
      criado_por: ctx.usuario.id,
      resumo: montagem.resumo as unknown as Json,
      avisos: montagem.avisosGravados as unknown as Json,
    })
    .select("id")
    .single();
  if (error) {
    console.error("criar prévia (sustentabilidade)", error);
    return recusar("Não foi possível criar a prévia. Tente de novo.");
  }
  refresh();
  return { ok: true, id: criada.id };
}

/** "Não substituir": o arquivo enviado sai do disco. */
export async function descartarEnvio(entrada: {
  caminho: string;
}): Promise<void> {
  const e = z.object({ caminho: z.string().regex(CAMINHO) }).safeParse(entrada);
  if (!e.success || !(await podeAgora(PERMISSAO))) return;
  // Só o que não virou importação (o caminho é novo, sem registro).
  const { count } = await (await su())
    .from("importacoes")
    .select("id", { count: "exact", head: true })
    .eq("arquivo->>caminho", e.data.caminho);
  if (!count) await removerArquivos(BUCKET_SU, [e.data.caminho]);
}

// ---------------------------------------------------------------------------
// Passo 2: escolhas da prévia
// ---------------------------------------------------------------------------

async function gravarResumo(id: string, m: Montagem) {
  const { error } = await (await su())
    .from("importacoes")
    .update({
      resumo: m.resumo as unknown as Json,
      avisos: m.avisosGravados as unknown as Json,
    })
    .eq("id", id);
  if (error) console.error("resumo da prévia (sustentabilidade)", error);
}

/** Grava as escolhas da prévia (todas de uma vez) e refaz o resumo. */
export async function salvarEscolhasImportacao(entrada: {
  id: string;
  escolhas: Escolhas;
}): Promise<EstadoAcao> {
  const e = z
    .object({ id: z.uuid(), escolhas: escolhasSchema })
    .safeParse(entrada);
  if (!e.success) return { erro: "Escolha inválida. Recarregue a página." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const db = await su();
  const { data, error } = await db
    .from("importacoes")
    .update({ decisoes: e.data.escolhas as unknown as Json })
    .eq("id", e.data.id)
    .eq("status", "previa")
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data.length)
    return {
      erro: "Só quem enviou o arquivo muda as escolhas, e só enquanto é prévia.",
    };
  const m = await montarPrevia(e.data.id).catch((erro) => {
    console.error("prévia (sustentabilidade)", erro);
    return null;
  });
  if (m) await gravarResumo(e.data.id, m);
  refresh();
  return { ok: "Escolha guardada." };
}

// ---------------------------------------------------------------------------
// Passo 3: confirmar, cancelar e desfazer
// ---------------------------------------------------------------------------

type Banco = Awaited<ReturnType<typeof su>>;

function lotes<T>(itens: T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE) r.push(itens.slice(i, i + LOTE));
  return r;
}

async function jaGravadas(db: Banco, id: string, g: Gravacao) {
  const tabela = g.tipo === "entrevistas" ? "entrevistas" : "lancamentos";
  const { count, error } = await db
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .eq("importacao_id", id);
  if (error) throw error;
  return count ?? 0;
}

/** Grava as linhas da prévia (com o importacao_id dela). */
async function gravarLinhas(
  db: Banco,
  id: string,
  g: Gravacao,
): Promise<{ message: string; code?: string } | null> {
  if (g.tipo === "entrevistas") {
    for (const lote of lotes(g.entrevistas)) {
      const { error } = await db.from("entrevistas").insert(
        lote.map((m) => ({
          contrato_id: m.contrato_id,
          lucs: m.lucs,
          cliente_doc: m.cliente_doc,
          data: m.data,
          tipo: m.tipo,
          setor: m.setor,
          formulario_versao: g.versao,
          respostas: m.respostas as Json,
          situacao: "salva",
          respondente_nome: m.respondente_nome,
          origem: "forms",
          entrevistador_id: null,
          valida_ate: m.valida_ate,
          importacao_id: id,
        })),
      );
      if (error) return error;
    }
    return null;
  }
  if (g.cadastro?.nomes.length) {
    const { error } = await db.from("cadastros_lista").insert(
      g.cadastro.nomes.map((n) => ({
        programa_id: g.programa_id,
        campo_id: g.cadastro?.campo_id ?? "",
        valor: n.valor,
        normalizado: n.normalizado,
        importacao_id: id,
      })),
    );
    if (error) return error;
  }
  const comId = g.lancamentos.map((l) => ({ ...l, id: randomUUID() }));
  for (const lote of lotes(comId)) {
    const { error } = await db.from("lancamentos").insert(
      lote.map((l) => ({
        id: l.id,
        programa_id: g.programa_id,
        formulario_id: g.formulario_id,
        formulario_versao: g.versao,
        data: l.data,
        valores: l.valores as Json,
        origem: "importacao",
        importacao_id: id,
      })),
    );
    if (error) return error;
    const reais = lote.filter((l) => Object.keys(l.reais).length);
    if (reais.length) {
      const r = await db
        .from("lancamento_valores")
        .insert(
          reais.map((l) => ({ lancamento_id: l.id, valores: l.reais as Json })),
        );
      if (r.error) return r.error;
    }
  }
  return null;
}

/** Confirma a prévia: grava as linhas e chama confirmar_importacao. */
export async function confirmarImportacaoSu(entrada: {
  id: string;
}): Promise<EstadoAcao> {
  const e = z.object({ id: z.uuid() }).safeParse(entrada);
  if (!e.success) return { erro: "Importação inválida." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const id = e.data.id;
  const [ctx, db] = await Promise.all([contextoSu(), su()]);
  const { data: imp } = await db
    .from("importacoes")
    .select("tipo, status, criado_por, substitui")
    .eq("id", id)
    .maybeSingle();
  if (!imp) return { erro: "Importação não encontrada." };
  if (imp.status !== "previa")
    return { erro: "Esta importação já foi confirmada ou cancelada." };
  if (imp.criado_por !== ctx.usuario.id)
    return {
      erro: "Só quem enviou o arquivo confirma a prévia. Envie o arquivo de novo para importar você mesmo.",
    };

  let m: Montagem | null;
  try {
    m = await montarPrevia(id);
  } catch (erro) {
    console.error("prévia na confirmação (sustentabilidade)", erro);
    m = null;
  }
  if (!m) return { erro: "Não foi possível reler o arquivo. Tente de novo." };
  const pendentes = decisoesPendentes(m.previa.decisoes, m.previa.escolhas);
  if (pendentes.length)
    return {
      erro: `Falta${pendentes.length === 1 ? "" : "m"} ${formatarNumero(pendentes.length)} ${pendentes.length === 1 ? "decisão" : "decisões"} na prévia (vínculo, nomes ou motivo).`,
    };
  if (m.previa.bloqueio || !m.gravacao)
    return { erro: m.previa.bloqueio ?? "Nada para importar." };
  const g = m.gravacao;

  try {
    // atalho: tentativa anterior que gravou as linhas e falhou ao confirmar
    // não regrava; se gravou só parte, "Cancelar" limpa e reimporta-se.
    if ((await jaGravadas(db, id, g)) === 0) {
      // O índice único (contrato e data entre as salvas) não deixa as
      // entrevistas da anterior e da nova coexistirem: a anterior sai antes
      // (e fica "substituida").
      if (g.tipo === "entrevistas" && imp.substitui) {
        const r = await db.rpc("liberar_substituida", { p_id: id });
        if (r.error) return erroDoBanco(r.error);
      }
      const erro = await gravarLinhas(db, id, g);
      if (erro) {
        console.error("gravar linhas da importação (sustentabilidade)", erro);
        return erro.code === "23505"
          ? {
              erro: "Alguma linha já existe no sistema (mesmo contrato e data). Cancele a prévia e importe de novo.",
            }
          : erroDoBanco(erro);
      }
    }
  } catch (erro) {
    console.error("gravar linhas da importação (sustentabilidade)", erro);
    return { erro: "Não foi possível gravar as linhas. Tente de novo." };
  }
  const resumo: ResumoGravado = m.resumo;
  await db
    .from("importacoes")
    .update({ resumo: resumo as unknown as Json })
    .eq("id", id);
  const { error } = await db.rpc("confirmar_importacao", { p_id: id });
  if (error) return erroDoBanco(error);

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
  refresh();
  return {
    ok: `Importação confirmada: ${contar(g.tipo, quantas)} entraram.${imp.substitui ? " A importação anterior do mesmo arquivo foi substituída." : ""}`,
  };
}

const pedido = z.object({ id: z.uuid("Importação inválida.") });

/** Cancelar a prévia ou desfazer a importação confirmada (AcaoRapida). */
export async function desfazerImportacaoSu(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = pedido.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Importação inválida." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const [ctx, db] = await Promise.all([contextoSu(), su()]);
  const { data: imp } = await db
    .from("importacoes")
    .select("tipo, status")
    .eq("id", e.data.id)
    .maybeSingle();
  if (!imp) return { erro: "Importação não encontrada." };
  const { data: n, error } = await db.rpc("desfazer_importacao", {
    p_id: e.data.id,
  });
  if (error) return erroDoBanco(error);
  const previa = imp.status === "previa";
  const tipo = imp.tipo as keyof typeof NOME_DO_TIPO;
  registrarDepois({
    modulo: "sustentabilidade",
    evento: "sustentabilidade_importacao_desfeita",
    descricao: previa
      ? `Cancelou a prévia de ${NOME_DO_TIPO[tipo] ?? imp.tipo}`
      : `Desfez a importação de ${NOME_DO_TIPO[tipo] ?? imp.tipo}: ${formatarNumero(n ?? 0)} registros removidos`,
    usuarioId: ctx.usuario.id,
    detalhes: { importacao: e.data.id, tipo: imp.tipo, registros: n ?? 0 },
  });
  refresh();
  return {
    ok: previa
      ? "Prévia cancelada. Nada dela entrou nos dados."
      : `Importação desfeita: ${formatarNumero(n ?? 0)} ${n === 1 ? "registro removido" : "registros removidos"}. O arquivo continua guardado para importar de novo.`,
  };
}
