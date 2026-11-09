"use server";

import { createHash, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMoeda, lerValorBr } from "@/lib/formato";
import {
  centavosDe,
  type Mes,
  mesDoDia,
  normalizar,
  periodoDe,
  proximaRevisao,
  reaisDe,
  rotuloMesLongo,
  somar,
} from "@/lib/operacoes/obras";
import {
  type AvisoOrcamento,
  type EstadoOrcamento,
  lerOrcamento,
  type OrcamentoLido,
  type PreviaOrcamento,
} from "@/lib/operacoes/orcamento";
import { abasDoXlsx } from "@/lib/operacoes/orcamento-planilha";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Json } from "@/lib/supabase/database.types";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { gravarArquivo, removerArquivos } from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { op, opAdmin } from "../base";
import { logImportacaoOp } from "../historico";

// Ações das Obras — previsto e realizado (spec 4.9 e 4.11):
//   * orçamento: ler a planilha → prévia gravada (importação "previa",
//     revisão com vigente = false, etapas, previsto e, na primeira
//     importação da obra, o realizado da planilha) → confirmar
//     (operacoes.confirmar_importacao torna a revisão vigente) ou descartar;
//   * realizado lançado na tela (etapa, mês, valor, descrição e anexo);
//   * dados da obra (nome, responsável, vínculo com o Diário de Obra).
// Gravação com a sessão (o RLS confere operacoes.obras.importar de novo);
// arquivos e a limpeza de obra criada por prévia descartada só depois de
// podeAgora. Nada fica em cache no servidor: basta refresh(). O registro de
// quem fez o quê fica na auditoria do banco (operacoes.importacoes e
// operacoes.obra_realizado têm o gatilho core.auditar); confirmar e
// descartar a prévia também vão para o histórico do sistema (core.logs).

const PERMISSAO = "operacoes.obras.importar" as const;
const LIMITE_MB = 8;
const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;
const SEM_PERMISSAO =
  "Você não tem permissão para importar o orçamento nem lançar o realizado.";

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const nomeSeguro = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-80) || "arquivo";

const reais = (centavos: number) => reaisDe(centavos);
const moeda = (centavos: number) => formatarMoeda(reaisDe(centavos));
const mesAtual = () => mesDoDia(hojeEmBrasilia(new Date()));

const comeca = (b: Uint8Array, ...assinatura: number[]) =>
  assinatura.every((x, i) => b[i] === x);
const ehXlsx = (b: Uint8Array) => comeca(b, 0x50, 0x4b, 0x03, 0x04);

/** Tipo do anexo pelo conteúdo (não pelo nome): PDF, JPEG, PNG ou WebP. */
function tipoDoAnexo(b: Uint8Array): string | null {
  if (comeca(b, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (comeca(b, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (comeca(b, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (
    comeca(b, 0x52, 0x49, 0x46, 0x46) &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

// ---------------------------------------------------------------------------
// Orçamento: obras para escolher na importação
// ---------------------------------------------------------------------------

/** Obras para a lista do componente de importação (sem props). */
export async function obrasParaImportar(): Promise<
  { id: string; nome: string }[]
> {
  const { data, error } = await (await op())
    .from("obras")
    .select("id, nome")
    .order("nome");
  if (error) {
    console.error("obras para importar", error);
    return [];
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Orçamento: ler a planilha e gravar a prévia
// ---------------------------------------------------------------------------

const escolhas = z.object({
  obra: z.union([z.literal(""), z.literal("nova"), z.uuid()]),
  nome_obra: z.preprocess(
    (v) => String(v ?? "").trim(),
    z.string().max(120, "máximo de 120 caracteres"),
  ),
});

/** "mes_H" = "2027-01" → { H: "2027-01-01" }. */
function mesesEscolhidos(form: FormData): Record<string, Mes> {
  const meses: Record<string, Mes> = {};
  for (const [k, v] of form) {
    const m = /^mes_([A-Z]{1,3})$/.exec(k);
    if (m?.[1] && typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v))
      meses[m[1]] = `${v}-01`;
  }
  return meses;
}

type Banco = Awaited<ReturnType<typeof op>>;

async function importacaoComMesmoArquivo(banco: Banco, hash: string) {
  const { data, error } = await banco
    .from("importacoes")
    .select("id, status, referencia, criado_em")
    .eq("tipo", "orcamento")
    .in("status", ["previa", "confirmada"])
    .contains("arquivos", [{ sha256: hash }])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function previaDe(
  lido: OrcamentoLido,
  e: {
    importacaoId: string;
    obra: { id: string; nome: string };
    obraNova: boolean;
    codigo: string;
    revisaoVigente: string | null;
    arquivo: string;
    realizadoImportado: boolean;
    avisos: AvisoOrcamento[];
  },
): PreviaOrcamento {
  return {
    importacaoId: e.importacaoId,
    obraId: e.obra.id,
    obraNome: e.obra.nome,
    obraNova: e.obraNova,
    codigo: e.codigo,
    revisaoVigente: e.revisaoVigente,
    data: lido.data,
    titulo: lido.titulo,
    arquivo: e.arquivo,
    etapas: lido.etapas.map((et) => {
      const p = periodoDe(et.previsto);
      return {
        nome: et.nome,
        observacao: et.observacao,
        de: p?.de ?? null,
        ate: p?.ate ?? null,
        previsto: somar(et.previsto),
        realizado: somar(et.realizado),
      };
    }),
    totalArquivo: lido.totalArquivo,
    totalEtapas: lido.totalEtapas,
    diferenca: lido.diferenca,
    totalRealizado: lido.totalRealizado,
    realizadoAte: lido.realizadoAte,
    realizadoImportado: e.realizadoImportado,
    colunasEscolhidas: lido.colunas.flatMap((c) =>
      c.escolhido && c.mes
        ? [{ coluna: c.coluna, texto: c.texto, mes: c.mes }]
        : [],
    ),
    avisos: e.avisos,
  };
}

/**
 * Lê a planilha de orçamento. Se falta decidir a obra ou o mês de alguma
 * coluna, devolve o que precisa ser escolhido (nada é gravado). Senão grava
 * a prévia: a planilha no disco, a importação, a revisão (ainda não
 * vigente), as etapas, o previsto e, se a obra ainda não tem realizado, o
 * realizado da planilha.
 */
export async function lerPlanilhaOrcamento(
  _: EstadoOrcamento,
  form: FormData,
): Promise<EstadoOrcamento> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha a planilha de orçamento (.xlsx)." };
  if (arquivo.size > LIMITE_BYTES)
    return { erro: `A planilha passa de ${LIMITE_MB} MB.` };
  const nome = arquivo.name.slice(0, 200) || "orcamento.xlsx";
  if (!/\.xlsx$/i.test(nome))
    return {
      erro: "Envie a planilha em Excel (.xlsx). Se ela estiver em .xls, abra no Excel e salve como .xlsx.",
    };
  const campos = escolhas.safeParse({
    obra: form.get("obra") ?? "",
    nome_obra: form.get("nome_obra"),
  });
  if (!campos.success)
    return primeiroErro(campos.error, {
      obra: "Obra",
      nome_obra: "Nome da obra",
    });
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!ehXlsx(bytes))
    return { erro: "O arquivo não é uma planilha .xlsx válida." };

  let lido: OrcamentoLido;
  try {
    const r = lerOrcamento(await abasDoXlsx(bytes), {
      arquivo: nome,
      meses: mesesEscolhidos(form),
    });
    if ("erro" in r) return { erro: r.erro };
    lido = r.ok;
  } catch (e) {
    console.error("leitura do orçamento", e);
    return {
      erro: "Não consegui abrir a planilha. Confira se é o arquivo do orçamento, sem senha.",
    };
  }

  const banco = await op();
  const hash = sha256(bytes);
  try {
    const repetida = await importacaoComMesmoArquivo(banco, hash);
    if (repetida)
      return {
        erro:
          repetida.status === "previa"
            ? `Esta planilha já está numa prévia esperando confirmação (${repetida.referencia}). Confirme ou descarte essa prévia em Operações › Importações.`
            : `Esta planilha já foi importada (${repetida.referencia}). Para uma nova revisão, envie o arquivo novo.`,
      };
  } catch (e) {
    console.error("conferência de arquivo repetido", e);
    return { erro: "Não foi possível conferir o arquivo. Tente de novo." };
  }

  // Obra: a escolhida, uma nova, ou a do título da planilha.
  const obras = await banco.from("obras").select("id, nome");
  if (obras.error) return erroDoBanco(obras.error);
  const pelaNome = (n: string) =>
    (obras.data ?? []).find((o) => normalizar(o.nome) === normalizar(n));
  const { obra: escolha, nome_obra } = campos.data;
  let obra: { id: string; nome: string } | null = null;
  let nomeNova: string | null = null;
  if (escolha === "nova") {
    nomeNova = nome_obra || lido.obra;
    if (!nomeNova)
      return { erro: "Nome da obra: informe o nome da obra nova." };
    if (pelaNome(nomeNova))
      return {
        erro: `Já existe a obra “${pelaNome(nomeNova)?.nome}”: escolha-a na lista.`,
      };
  } else if (escolha) {
    obra = (obras.data ?? []).find((o) => o.id === escolha) ?? null;
    if (!obra) return { erro: "Obra: escolha uma da lista." };
  } else {
    // Identificar: o nome digitado (quando a planilha não diz) ou o do título.
    const nomeLido = nome_obra || lido.obra;
    if (nomeLido) {
      obra = pelaNome(nomeLido) ?? null;
      if (!obra) nomeNova = nomeLido;
    }
  }

  if (lido.pendentes.length || (!obra && !nomeNova))
    return {
      escolher: {
        arquivo: nome,
        obraLida: lido.obra,
        precisaObra: !obra && !nomeNova,
        revisao: lido.revisao,
        etapas: lido.etapas.length,
        colunas: lido.pendentes,
      },
    };

  // Revisão: uma prévia por obra de cada vez; o código nunca se repete.
  let revisaoVigente: string | null = null;
  let codigos: string[] = [];
  let temRealizado = false;
  let realizadoAteMes = 0;
  if (obra) {
    const [revs, real] = await Promise.all([
      banco
        .from("orcamento_revisoes")
        .select("codigo, vigente, importacoes(status)")
        .eq("obra_id", obra.id),
      banco
        .from("obra_realizado")
        .select("mes, valor, importacao_id, importacoes(status)")
        .eq("obra_id", obra.id),
    ]);
    if (revs.error) return erroDoBanco(revs.error);
    if (real.error) return erroDoBanco(real.error);
    const pendente = (revs.data ?? []).find(
      (r) => r.importacoes?.status === "previa",
    );
    if (pendente)
      return {
        erro: `Já há uma prévia da revisão ${pendente.codigo} desta obra esperando confirmação. Confirme ou descarte essa prévia antes de enviar outra.`,
      };
    codigos = (revs.data ?? []).map((r) => r.codigo);
    revisaoVigente = (revs.data ?? []).find((r) => r.vigente)?.codigo ?? null;
    const validos = (real.data ?? []).filter(
      (r) => !r.importacao_id || r.importacoes?.status === "confirmada",
    );
    temRealizado = validos.length > 0;
    if (lido.realizadoAte)
      realizadoAteMes = validos
        .filter((r) => r.mes <= (lido.realizadoAte ?? ""))
        .reduce((s, r) => s + centavosDe(Number(r.valor)), 0);
  }
  const rev = proximaRevisao(codigos, lido.revisao);
  if (!rev)
    return {
      erro: "Esta obra já tem 100 revisões (R00 a R99): fale com o suporte.",
    };

  const avisos: AvisoOrcamento[] = [...lido.avisos];
  if (rev.aviso) avisos.unshift({ nivel: "aviso", mensagem: rev.aviso });
  const importarRealizado = lido.totalRealizado !== 0 && !temRealizado;
  if (lido.totalRealizado !== 0 && temRealizado) {
    const ate = lido.realizadoAte ? rotuloMesLongo(lido.realizadoAte) : "";
    const dif = lido.totalRealizado - realizadoAteMes;
    avisos.push({
      nivel: dif === 0 ? "info" : "aviso",
      mensagem: `O realizado da planilha (${moeda(lido.totalRealizado)} até ${ate}) não foi importado: a obra já tem realizado lançado (${moeda(realizadoAteMes)} até ${ate}${dif === 0 ? ", igual" : `, diferença de ${moeda(dif)}`}).`,
    });
  }

  // Gravação. Se algo falhar no meio, a prévia é desfeita.
  const usuario = await usuarioAtual();
  let obraNova = false;
  // Ids gerados aqui: o insert não precisa ler de volta (quem importa pode
  // não ter operacoes.obras.ver, que é o que o RLS pede para ler).
  if (!obra && nomeNova) {
    const nova = { id: randomUUID(), nome: nomeNova };
    const { error } = await banco.from("obras").insert(nova);
    if (error) {
      if (error.code === "23505")
        return { erro: `Já existe a obra “${nomeNova}”: escolha-a na lista.` };
      return erroDoBanco(error);
    }
    obra = nova;
    obraNova = true;
  }
  if (!obra) return { erro: "Obra: escolha uma da lista." };

  const id = randomUUID();
  const caminho = `importacoes/orcamento/${id}/${nomeSeguro(nome)}`;
  const desfazer = async () => {
    await banco.rpc("desfazer_importacao", { p_id: id });
    await removerArquivos("operacoes", [caminho]);
    if (obraNova && obra) await apagarObraVazia(obra.id);
  };
  try {
    await gravarArquivo(
      "operacoes",
      caminho,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  } catch (e) {
    console.error("planilha do orçamento no disco", e);
    if (obraNova) await apagarObraVazia(obra.id);
    return { erro: "Não foi possível guardar a planilha. Tente de novo." };
  }

  const resumo = {
    obra_id: obra.id,
    obra: obra.nome,
    obra_nova: obraNova,
    revisao: rev.codigo,
    data: lido.data,
    aba: lido.aba,
    etapas: lido.etapas.length,
    total_arquivo: lido.totalArquivo === null ? null : reais(lido.totalArquivo),
    total_etapas: reais(lido.totalEtapas),
    diferenca: lido.diferenca === null ? null : reais(lido.diferenca),
    realizado_planilha: reais(lido.totalRealizado),
    realizado_ate: lido.realizadoAte,
    realizado_importado: importarRealizado,
    meses: lido.periodo,
    colunas_escolhidas: lido.colunas
      .filter((c) => c.escolhido)
      .map((c) => ({ coluna: c.coluna, texto: c.texto, mes: c.mes })),
  };
  const passo = async (): Promise<string | null> => {
    const imp = await banco.from("importacoes").insert({
      id,
      tipo: "orcamento",
      referencia: `${obra.nome} ${rev.codigo}`.slice(0, 200),
      arquivos: [
        { nome, caminho, sha256: hash, bytes: bytes.byteLength },
      ] as Json,
      resumo: resumo as Json,
      avisos: avisos as unknown as Json,
      // A diferença de centavos entre a soma e o total só avisa (spec
      // 4.11): não exige motivo para confirmar.
      bate: lido.diferenca === null || lido.diferenca === 0 ? true : null,
      criado_por: usuario.id,
    });
    if (imp.error) return "importação";
    const revisaoId = randomUUID();
    const revisao = await banco.from("orcamento_revisoes").insert({
      id: revisaoId,
      obra_id: obra.id,
      importacao_id: id,
      codigo: rev.codigo,
      data: lido.data,
      titulo: lido.titulo,
      total: reais(lido.totalEtapas),
      total_arquivo:
        lido.totalArquivo === null ? null : reais(lido.totalArquivo),
    });
    if (revisao.error) {
      console.error("revisão do orçamento", revisao.error);
      return revisao.error.code === "23505" ? "repetida" : "revisão";
    }
    const idDaOrdem = new Map(lido.etapas.map((e) => [e.ordem, randomUUID()]));
    const etapas = await banco.from("orcamento_etapas").insert(
      lido.etapas.map((e) => ({
        id: idDaOrdem.get(e.ordem),
        revisao_id: revisaoId,
        ordem: e.ordem,
        nome: e.nome,
        observacao: e.observacao,
      })),
    );
    if (etapas.error) return "etapas";
    const previsto = lido.etapas.flatMap((e) =>
      e.previsto.map((v) => ({
        etapa_id: idDaOrdem.get(e.ordem) ?? "",
        mes: v.mes,
        valor: reais(v.centavos),
      })),
    );
    if (previsto.length) {
      const p = await banco.from("orcamento_previsto").insert(previsto);
      if (p.error) return "previsto";
    }
    if (importarRealizado) {
      const r = await banco.from("obra_realizado").insert(
        lido.etapas.flatMap((e) =>
          e.realizado.map((v) => ({
            obra_id: obra.id,
            etapa: e.nome,
            mes: v.mes,
            valor: reais(v.centavos),
            descricao: `Realizado até ${rotuloMesLongo(v.mes)} (planilha ${rev.codigo})`,
            origem: "planilha",
            importacao_id: id,
            lancado_por: usuario.id,
          })),
        ),
      );
      if (r.error) return "realizado";
    }
    return null;
  };

  let falhou: string | null;
  try {
    falhou = await passo();
  } catch (e) {
    console.error("prévia do orçamento", e);
    falhou = "gravação";
  }
  if (falhou) {
    await desfazer().catch((e) => console.error("desfazer prévia", e));
    return {
      erro:
        falhou === "repetida"
          ? "Outra pessoa importou uma revisão desta obra agora. Envie a planilha de novo."
          : `Não foi possível gravar a prévia (${falhou}). Nada foi alterado; tente de novo.`,
    };
  }

  refresh();
  return {
    previa: previaDe(lido, {
      importacaoId: id,
      obra,
      obraNova,
      codigo: rev.codigo,
      revisaoVigente,
      arquivo: nome,
      realizadoImportado: importarRealizado,
      avisos,
    }),
  };
}

/** Apaga a obra se ela não tem revisão nem realizado (obra criada por uma prévia). */
async function apagarObraVazia(obraId: string): Promise<void> {
  // Service role: o RLS não deixa apagar obra. A permissão de importar já
  // foi conferida no banco (podeAgora) por quem chamou.
  const admin = opAdmin();
  const [revs, real] = await Promise.all([
    admin
      .from("orcamento_revisoes")
      .select("id", { count: "exact", head: true })
      .eq("obra_id", obraId),
    admin
      .from("obra_realizado")
      .select("id", { count: "exact", head: true })
      .eq("obra_id", obraId),
  ]);
  if (revs.error || real.error || revs.count || real.count) return;
  const { error } = await admin
    .from("obras")
    .delete()
    .eq("id", obraId)
    .eq("exemplo", false);
  if (error) console.error("apagar obra vazia", error);
}

// ---------------------------------------------------------------------------
// Orçamento: confirmar ou descartar a prévia
// ---------------------------------------------------------------------------

const idDaImportacao = z.object({ importacao: z.uuid() });

async function previaDoOrcamento(banco: Banco, id: string) {
  const { data, error } = await banco
    .from("importacoes")
    .select("id, tipo, status, resumo, arquivos")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.tipo === "orcamento" ? data : null;
}

const campoDoResumo = (resumo: Json, campo: string): Json | undefined =>
  resumo && typeof resumo === "object" && !Array.isArray(resumo)
    ? resumo[campo]
    : undefined;

/** "Obra X, revisão R02" para o histórico do sistema. */
function revisaoDaObra(resumo: Json): string | undefined {
  const obra = campoDoResumo(resumo, "obra");
  const revisao = campoDoResumo(resumo, "revisao");
  return (
    [
      typeof obra === "string" && obra ? obra : null,
      typeof revisao === "string" && revisao ? `revisão ${revisao}` : null,
    ]
      .filter(Boolean)
      .join(", ") || undefined
  );
}

export async function confirmarOrcamento(
  _: EstadoOrcamento,
  form: FormData,
): Promise<EstadoOrcamento> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const d = idDaImportacao.safeParse({ importacao: form.get("importacao") });
  if (!d.success) return { erro: "Prévia inválida. Envie a planilha de novo." };
  const banco = await op();
  const imp = await previaDoOrcamento(banco, d.data.importacao).catch(
    () => null,
  );
  if (!imp) return { erro: "Prévia não encontrada. Envie a planilha de novo." };
  if (imp.status !== "previa")
    return { erro: "Esta prévia já foi confirmada ou descartada." };
  const { error } = await banco.rpc("confirmar_importacao", {
    p_id: imp.id,
  });
  if (error) return erroDoBanco(error);
  refresh();
  const obraId = campoDoResumo(imp.resumo, "obra_id");
  const obraNome = campoDoResumo(imp.resumo, "obra");
  const codigo = campoDoResumo(imp.resumo, "revisao");
  await logImportacaoOp(
    "confirmou",
    { id: imp.id, tipo: "orcamento" },
    revisaoDaObra(imp.resumo),
  );
  return {
    confirmado: {
      obraId: typeof obraId === "string" ? obraId : "",
      obraNome: typeof obraNome === "string" ? obraNome : "",
      codigo: typeof codigo === "string" ? codigo : "",
    },
  };
}

export async function descartarOrcamento(
  _: EstadoOrcamento,
  form: FormData,
): Promise<EstadoOrcamento> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const d = idDaImportacao.safeParse({ importacao: form.get("importacao") });
  if (!d.success) return { erro: "Prévia inválida." };
  const banco = await op();
  const imp = await previaDoOrcamento(banco, d.data.importacao).catch(
    () => null,
  );
  if (!imp) return { erro: "Prévia não encontrada." };
  if (imp.status !== "previa")
    return { erro: "Esta prévia já foi confirmada ou descartada." };
  const { error } = await banco.rpc("desfazer_importacao", { p_id: imp.id });
  if (error) return erroDoBanco(error);
  const caminhos = Array.isArray(imp.arquivos)
    ? imp.arquivos.flatMap((a) =>
        a &&
        typeof a === "object" &&
        !Array.isArray(a) &&
        typeof a.caminho === "string"
          ? [a.caminho]
          : [],
      )
    : [];
  await removerArquivos("operacoes", caminhos);
  const obraId = campoDoResumo(imp.resumo, "obra_id");
  if (
    campoDoResumo(imp.resumo, "obra_nova") === true &&
    typeof obraId === "string"
  )
    await apagarObraVazia(obraId);
  refresh();
  await logImportacaoOp(
    "descartou",
    { id: imp.id, tipo: "orcamento" },
    revisaoDaObra(imp.resumo),
  );
  return { descartado: true };
}

// ---------------------------------------------------------------------------
// Realizado lançado na tela
// ---------------------------------------------------------------------------

const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(max, `máximo de ${max} caracteres`).nullable(),
  );

const realizado = z.object({
  id: z.preprocess((v) => (v ? v : undefined), z.uuid().optional()),
  obra_id: z.uuid("obra inválida"),
  etapa: z.string().trim().min(1, "escolha a etapa").max(200),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "escolha o mês"),
  valor: z.string().trim().min(1, "informe o valor"),
  descricao: textoOpcional(500),
  remover_anexo: z.preprocess((v) => v === "on", z.boolean()),
});

const ROTULOS_REALIZADO = {
  obra_id: "Obra",
  etapa: "Etapa",
  mes: "Mês",
  valor: "Valor",
  descricao: "Descrição",
};

/** Lança ou altera um realizado (só os lançados pela tela se alteram). */
export async function salvarRealizado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const d = realizado.safeParse({
    id: form.get("id"),
    obra_id: form.get("obra_id"),
    etapa: form.get("etapa") ?? "",
    mes: form.get("mes") ?? "",
    valor: form.get("valor") ?? "",
    descricao: form.get("descricao"),
    remover_anexo: form.get("remover_anexo"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS_REALIZADO);
  const v = d.data;
  const reaisLidos = lerValorBr(v.valor);
  if (reaisLidos === null || !Number.isFinite(reaisLidos))
    return { erro: "Valor: escreva em reais, ex.: 12.345,67." };
  const centavos = centavosDe(reaisLidos);
  if (centavos === 0) return { erro: "Valor: não pode ser zero." };
  if (Math.abs(centavos) >= 1e15)
    return { erro: "Valor: alto demais. Confira o número." };
  const mes: Mes = `${v.mes}-01`;
  if (mes > mesAtual())
    return {
      erro: "Mês: o realizado é o que já foi pago. Escolha até o mês atual.",
    };
  if (mes < "2000-01-01") return { erro: "Mês: confira o ano." };

  const banco = await op();
  // A etapa tem de existir numa revisão da obra (o realizado casa pelo nome).
  const etapas = await banco
    .from("orcamento_etapas")
    .select("nome, orcamento_revisoes!inner(obra_id)")
    .eq("orcamento_revisoes.obra_id", v.obra_id);
  if (etapas.error) return erroDoBanco(etapas.error);
  const etapa = (etapas.data ?? []).find(
    (e) => normalizar(e.nome) === normalizar(v.etapa),
  );
  if (!etapa) return { erro: "Etapa: escolha uma da lista." };

  let anterior: { anexo: string | null } | null = null;
  if (v.id) {
    const { data, error } = await banco
      .from("obra_realizado")
      .select("id, obra_id, origem, anexo")
      .eq("id", v.id)
      .maybeSingle();
    if (error) return erroDoBanco(error);
    if (!data || data.obra_id !== v.obra_id)
      return { erro: "Lançamento não encontrado." };
    if (data.origem !== "tela")
      return {
        erro: "Este valor veio da planilha: para mudar, importe uma nova revisão ou desfaça a importação.",
      };
    anterior = data;
  }

  // Anexo (nota ou medição): PDF ou imagem, conferido pelo conteúdo.
  let anexo: string | null | undefined;
  const arquivo = form.get("anexo");
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > LIMITE_BYTES)
      return { erro: `Anexo: passa de ${LIMITE_MB} MB.` };
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const tipo = tipoDoAnexo(bytes);
    if (!tipo) return { erro: "Anexo: envie PDF, JPG, PNG ou WebP." };
    anexo = `obras/${v.obra_id}/realizado/${randomUUID()}-${nomeSeguro(arquivo.name)}`;
    try {
      await gravarArquivo("operacoes", anexo, bytes, tipo);
    } catch (e) {
      console.error("anexo do realizado", e);
      return { erro: "Não foi possível guardar o anexo. Tente de novo." };
    }
  } else if (v.remover_anexo) anexo = null;

  const linha = {
    etapa: etapa.nome,
    mes,
    valor: reais(centavos),
    descricao: v.descricao,
    ...(anexo !== undefined ? { anexo } : {}),
  };
  const { error } = v.id
    ? await banco
        .from("obra_realizado")
        .update(linha)
        .eq("id", v.id)
        .eq("origem", "tela")
    : await banco.from("obra_realizado").insert({
        ...linha,
        obra_id: v.obra_id,
        origem: "tela",
        lancado_por: (await usuarioAtual()).id,
      });
  if (error) {
    if (anexo) await removerArquivos("operacoes", [anexo]);
    return erroDoBanco(error);
  }
  if (anexo !== undefined && anterior?.anexo)
    await removerArquivos("operacoes", [anterior.anexo]);
  refresh();
  return { ok: v.id ? "Lançamento alterado." : "Realizado lançado." };
}

export async function excluirRealizado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Lançamento inválido." };
  const banco = await op();
  const { data, error } = await banco
    .from("obra_realizado")
    .delete()
    .eq("id", id.data)
    .eq("origem", "tela")
    .select("anexo");
  if (error) return erroDoBanco(error);
  if (!data?.length)
    return {
      erro: "Lançamento não encontrado (o que veio da planilha só sai desfazendo a importação).",
    };
  const anexos = data.flatMap((r) => (r.anexo ? [r.anexo] : []));
  if (anexos.length) await removerArquivos("operacoes", anexos);
  refresh();
  return { ok: "Lançamento excluído." };
}

// ---------------------------------------------------------------------------
// Dados da obra e vínculo com o Diário de Obra
// ---------------------------------------------------------------------------

const dadosObra = z.object({
  id: z.uuid(),
  nome: z
    .string()
    .trim()
    .min(1, "informe o nome")
    .max(120, "máximo de 120 caracteres"),
  responsavel: textoOpcional(120),
  diario_obra_id: textoOpcional(64),
  ativa: z.preprocess((v) => v === "on", z.boolean()),
});

export async function salvarObra(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const d = dadosObra.safeParse(Object.fromEntries(form));
  if (!d.success)
    return primeiroErro(d.error, {
      nome: "Nome",
      responsavel: "Responsável",
      diario_obra_id: "Obra no Diário de Obra",
    });
  const v = d.data;
  const banco = await op();
  const atual = await banco
    .from("obras")
    .select("diario_obra_id")
    .eq("id", v.id)
    .maybeSingle();
  if (atual.error) return erroDoBanco(atual.error);
  if (!atual.data) return { erro: "Obra não encontrada." };
  // O vínculo que já existe fica, mesmo se a obra saiu do Diário.
  if (v.diario_obra_id && v.diario_obra_id !== atual.data.diario_obra_id) {
    // A permissão de importar já foi conferida no banco (podeAgora).
    const { data, error } = await opAdmin()
      .from("diario_obras")
      .select("id")
      .eq("id", v.diario_obra_id)
      .maybeSingle();
    if (error) return erroDoBanco(error);
    if (!data) return { erro: "Obra no Diário de Obra: escolha uma da lista." };
  }
  const { data, error } = await banco
    .from("obras")
    .update({
      nome: v.nome,
      responsavel: v.responsavel,
      diario_obra_id: v.diario_obra_id,
      ativa: v.ativa,
    })
    .eq("id", v.id)
    .select("id");
  if (error) {
    if (error.code === "23505")
      return {
        erro: error.message.includes("obras_diario_obra")
          ? "Essa obra do Diário de Obra já está ligada a outra obra."
          : "Já existe outra obra com esse nome.",
      };
    return erroDoBanco(error);
  }
  if (!data?.length) return { erro: "Obra não encontrada." };
  refresh();
  return { ok: "Obra salva." };
}
