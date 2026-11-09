"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMes } from "@/lib/formato";
import {
  type CoparticipacaoDoPlano,
  ErroPlanilha,
  type FaixaDoPlano,
  faixasDoFormulario,
} from "@/lib/rh/plano";
import { createClient } from "@/lib/supabase/server";
import { gravarArquivo, lerArquivo } from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { ehXlsx, lerPlanilhaDoPlano } from "@/server/rh/beneficios";
import { recalcularEmAberto, tentarRecalcular } from "@/server/rh/custo";
import { BUCKET, sha256, TAMANHO_MAXIMO } from "@/server/rh/folha";

// Tabela de faixas do plano: enviar a planilha → conferir a prévia →
// confirmar. Mesmo caminho da folha: o arquivo fica no bucket privado e a
// confirmação relê o arquivo guardado (nada vem do navegador). Gravar a
// tabela recalcula o custo pela service role (conferido com podeAgora) e
// invalida as tabelas do plano no cache (TAG.rh.planos).

export interface PreviaPlano {
  importacaoId: string;
  arquivo: string;
  beneficio: { id: string; nome: string };
  vigencia: string;
  reajuste: number | null;
  faixas: FaixaDoPlano[];
  coparticipacao: CoparticipacaoDoPlano[];
  avisos: string[];
  substitui: boolean;
}

export interface EstadoPlano {
  previa?: PreviaPlano;
  erro?: string;
}

const SEM_PERMISSAO = "Você não tem permissão para importar a tabela do plano.";

/** "5", "5,5" ou vazio → número ou null. */
const percentual = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s.replace(",", "."));
}, z.number().min(0).max(100).nullable());

const envio = z.object({
  beneficio_id: z.uuid("escolha o benefício"),
  // <input type="month">: "2026-07"
  vigencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "informe o mês de vigência"),
  reajuste: percentual,
});

export async function lerTabelaPlano(
  _: EstadoPlano,
  form: FormData,
): Promise<EstadoPlano> {
  // Conferida agora no banco: o arquivo vai para o armazenamento sem RLS.
  if (!(await podeAgora("rh.beneficios"))) return { erro: SEM_PERMISSAO };
  const dados = envio.safeParse(Object.fromEntries(form));
  if (!dados.success)
    return { erro: dados.error.issues[0]?.message ?? "Confira os campos." };

  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha a planilha da operadora (.xlsx)." };
  if (arquivo.size > TAMANHO_MAXIMO)
    return { erro: "O arquivo passa de 10 MB." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!ehXlsx(bytes))
    return { erro: "O arquivo não é uma planilha .xlsx do Excel." };

  let tabela: Awaited<ReturnType<typeof lerPlanilhaDoPlano>>;
  try {
    tabela = await lerPlanilhaDoPlano(bytes);
  } catch (e) {
    if (e instanceof ErroPlanilha) return { erro: e.message };
    console.error("leitura da tabela do plano", e);
    return {
      erro: "Não consegui ler a planilha. Confira se é a da operadora.",
    };
  }

  const supabase = await createClient();
  const vigencia = `${dados.data.vigencia}-01`;
  const [beneficio, existente, usuario] = await Promise.all([
    supabase
      .schema("rh")
      .from("beneficios")
      .select("id, nome, tipo")
      .eq("id", dados.data.beneficio_id)
      .maybeSingle(),
    supabase
      .schema("rh")
      .from("plano_tabelas")
      .select("id")
      .eq("beneficio_id", dados.data.beneficio_id)
      .eq("vigente_desde", vigencia)
      .maybeSingle(),
    usuarioAtual(),
  ]);
  if (
    !beneficio.data ||
    !["plano_saude", "odonto"].includes(beneficio.data.tipo)
  )
    return { erro: "Escolha um benefício do tipo plano de saúde ou odonto." };

  const id = randomUUID();
  const nome = arquivo.name.slice(0, 200);
  const caminho = `plano_saude/${id}/${
    nome
      .normalize("NFD")
      .replace(/[^\w.-]+/g, "_")
      .slice(-80) || "tabela.xlsx"
  }`;
  try {
    await gravarArquivo(
      BUCKET,
      caminho,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  } catch (e) {
    console.error("upload da tabela do plano", e);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  const registro = await supabase
    .schema("core")
    .from("importacoes")
    .insert({
      id,
      tipo: "plano_saude",
      referencia: vigencia,
      arquivo_nome: nome,
      arquivo_path: caminho,
      arquivo_sha256: sha256(bytes),
      enviado_por: usuario.id,
      avisos: tabela.avisos,
    });
  if (registro.error) {
    console.error("registro da importação do plano", registro.error);
    return { erro: "Não foi possível registrar a importação. Tente de novo." };
  }

  return {
    previa: {
      importacaoId: id,
      arquivo: nome,
      beneficio: { id: beneficio.data.id, nome: beneficio.data.nome },
      vigencia,
      reajuste: dados.data.reajuste,
      ...tabela,
      substitui: !!existente.data,
    },
  };
}

const confirmacao = z.object({
  importacao_id: z.uuid(),
  beneficio_id: z.uuid(),
  reajuste: percentual,
});

export async function confirmarTabelaPlano(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return { erro: SEM_PERMISSAO };
  const dados = confirmacao.safeParse(Object.fromEntries(form));
  if (!dados.success)
    return { erro: "Prévia inválida. Envie o arquivo de novo." };

  const supabase = await createClient();
  const { data: imp } = await supabase
    .schema("core")
    .from("importacoes")
    .select("arquivo_path, referencia, status")
    .eq("id", dados.data.importacao_id)
    .maybeSingle();
  if (!imp)
    return { erro: "Importação não encontrada. Envie o arquivo de novo." };
  if (imp.status !== "previa")
    return { erro: "Esta prévia já foi usada. Envie o arquivo de novo." };
  const arquivo = imp.arquivo_path.startsWith("plano_saude/")
    ? await lerArquivo(BUCKET, imp.arquivo_path)
    : null;
  if (!arquivo)
    return { erro: "Não encontrei o arquivo enviado. Envie de novo." };
  const tabela = await lerPlanilhaDoPlano(arquivo);

  const { error } = await supabase.schema("rh").rpc("importar_tabela_plano", {
    p_importacao_id: dados.data.importacao_id,
    p_beneficio_id: dados.data.beneficio_id,
    // null = sem reajuste (o banco aceita; o gerador de tipos não marca
    // argumento de função como anulável).
    p_reajuste_pct: dados.data.reajuste as number,
    p_faixas: tabela.faixas.map((f) => ({ ...f })),
    p_coparticipacao: tabela.coparticipacao.map(({ periodo: _, ...c }) => c),
  });
  if (error) {
    if (error.code === "P0001" || error.code === "42501")
      return { erro: `${error.message}.` };
    console.error("importar_tabela_plano", error);
    return { erro: "Não foi possível gravar a tabela. Nada foi alterado." };
  }

  updateTag(TAG.rh.planos);
  // A faixa muda o valor do plano de quem tem benefício vinculado.
  const calculado = await tentarRecalcular(recalcularEmAberto);
  refresh();
  return {
    ok: `Tabela gravada: ${tabela.faixas.length} faixas, vigente desde ${formatarMes(imp.referencia)}.${calculado ? " Custo de pessoal recalculado." : ""}`,
  };
}

/** Correção das faixas de uma tabela já gravada, sem enviar outra planilha. */
export async function salvarFaixasPlano(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios")))
    return { erro: "Você não tem permissão para editar a tabela do plano." };
  const tabelaId = z.uuid().safeParse(form.get("tabela_id"));
  if (!tabelaId.success) return { erro: "Tabela inválida." };

  const campo = (nome: string) => form.getAll(nome).map(String);
  const [minimas, maximas, mensalidades] = [
    campo("idade_min"),
    campo("idade_max"),
    campo("mensalidade"),
  ];
  let tabela: ReturnType<typeof faixasDoFormulario>;
  try {
    tabela = faixasDoFormulario(
      minimas.map((idade_min, i) => ({
        idade_min,
        idade_max: maximas[i] ?? "",
        mensalidade: mensalidades[i] ?? "",
      })),
    );
  } catch (e) {
    if (e instanceof ErroPlanilha) return { erro: e.message };
    throw e;
  }

  const { error } = await (await createClient())
    .schema("rh")
    .rpc("salvar_faixas_plano", {
      p_tabela_id: tabelaId.data,
      p_faixas: tabela.faixas.map((f) => ({ ...f })),
    });
  if (error) {
    if (error.code === "P0001" || error.code === "42501")
      return { erro: `${error.message}.` };
    console.error("salvar_faixas_plano", error);
    return { erro: "Não foi possível gravar as faixas. Nada foi alterado." };
  }

  updateTag(TAG.rh.planos);
  const calculado = await tentarRecalcular(recalcularEmAberto);
  refresh();
  return {
    ok: [
      `Faixas salvas (${tabela.faixas.length}).`,
      ...tabela.avisos,
      calculado ? "Custo de pessoal recalculado." : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
