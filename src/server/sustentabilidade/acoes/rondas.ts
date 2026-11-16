"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { nomeSeguro } from "@/lib/arquivos/nome";
import { formatarData } from "@/lib/formato";
import { paraBrasilia } from "@/lib/os/tempo";
import type { CorColetor } from "@/lib/sustentabilidade/rondas";
import {
  ehImagem,
  esquemaRonda,
  FOTO_MAX_BYTES,
  itensLancados,
  mensagemDaRonda,
  recolhimentosAAbrir,
} from "@/lib/sustentabilidade/rondas-lancamento";
import {
  infoDoArquivo,
  inicioDoArquivo,
  prepararEnvio as linkDeEnvio,
} from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { osAdmin } from "@/server/os/base";
import { criarChamadoSistema } from "@/server/os/criar";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/server/os/sistema";
import { coletores, parametros, su } from "../base";
import { BUCKET_SUSTENTABILIDADE } from "../rcc";

// Lançar ronda (spec 4.6). A ronda e os itens vão com a sessão (o RLS confere
// "Resíduos – lançar ronda"); o chamado da semana e os de recolhimento vão
// pela service role do Chamados (src/server/os), depois de conferir a
// permissão com podeAgora. Coletor em branco não grava item (não vira zero).
// As fotos vão direto do navegador para o disco, por link de envio.

const SEM_PERMISSAO = "Você não tem permissão para lançar ronda.";
const NOME_DA_CATEGORIA = "Recolhimento de coletor";

export type FotoPreparada =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

/** Link para o navegador enviar a foto de um coletor (ou da ronda). */
export async function prepararFotoDaRonda(entrada: {
  nome: string;
  tamanho: number;
}): Promise<FotoPreparada> {
  const e = z
    .object({
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Foto inválida." };
  if (e.data.tamanho > FOTO_MAX_BYTES)
    return { ok: false, erro: "A foto passa de 12 MB. Tire outra." };
  if (!(await podeAgora("sustentabilidade.ronda")))
    return { ok: false, erro: SEM_PERMISSAO };
  const { id } = await usuarioAtual();
  const path = `rondas/${id}/${randomUUID()}-${nomeSeguro(e.data.nome, "foto.jpg")}`;
  const envio = await linkDeEnvio(BUCKET_SUSTENTABILIDADE, path, {
    maxBytes: FOTO_MAX_BYTES,
  });
  if ("erro" in envio)
    return {
      ok: false,
      erro: "Não foi possível preparar o envio da foto. Tente de novo.",
    };
  return { ok: true, url: envio.url, path };
}

/** A foto é da pessoa, chegou inteira e é mesmo uma imagem. */
async function fotoConfere(path: string, usuarioId: string): Promise<boolean> {
  if (!path.startsWith(`rondas/${usuarioId}/`)) return false;
  const [info, inicio] = await Promise.all([
    infoDoArquivo(BUCKET_SUSTENTABILIDADE, path),
    inicioDoArquivo(BUCKET_SUSTENTABILIDADE, path, 16),
  ]);
  return Boolean(
    info && info.tamanho <= FOTO_MAX_BYTES && inicio && ehImagem(inicio),
  );
}

/** Categoria "Recolhimento de coletor": a do setor que recebe, senão qualquer uma. */
async function categoriaDoRecolhimento(
  setorId: string,
): Promise<string | null> {
  const { data, error } = await osAdmin()
    .from("categorias")
    .select("id, setor_id")
    .eq("nome", NOME_DA_CATEGORIA)
    .is("pai_id", null)
    .eq("ativo", true);
  if (error) throw new Error(`Categoria do recolhimento: ${error.message}`);
  return (data.find((c) => c.setor_id === setorId) ?? data[0])?.id ?? null;
}

export async function lancarRonda(entrada: unknown): Promise<EstadoAcao> {
  const e = esquemaRonda.safeParse(entrada);
  if (!e.success)
    return {
      erro: e.error.issues[0]?.message ?? "Confira os dados da ronda.",
    };
  if (!(await podeAgora("sustentabilidade.ronda")))
    return { erro: SEM_PERMISSAO };

  const [{ id: usuarioId }, ativos, param] = await Promise.all([
    usuarioAtual(),
    coletores().then((c) =>
      c
        .filter((x) => x.ativo)
        .map((x) => ({ id: x.id, local: x.local, cor: x.cor as CorColetor })),
    ),
    parametros(),
  ]);
  const itens = itensLancados(e.data.itens);
  if (!itens.length)
    return {
      erro: "Toque na ocupação de pelo menos um coletor. Quem não foi visitado fica em branco.",
    };
  const porId = new Map(ativos.map((c) => [c.id, c]));
  if (itens.some((i) => !porId.has(i.coletorId)))
    return {
      erro: "Há um coletor que não está mais ativo no cadastro. Recarregue a tela e confira a lista.",
    };

  const fotos = [e.data.foto, ...e.data.itens.map((i) => i.foto)].filter(
    (f): f is string => Boolean(f),
  );
  for (const f of fotos)
    if (!(await fotoConfere(f, usuarioId)))
      return {
        erro: "Uma foto não chegou inteira. Tire de novo e tente salvar.",
      };

  const agora = new Date();
  const quando = paraBrasilia(agora);
  const quandoTexto = `${formatarData(quando.data)} às ${quando.hora}`;
  const chamadoDaRonda = await chamadoAbertoDaOrigem(
    "sustentabilidade",
    "ronda",
  );

  const db = await su();
  const rondaId = randomUUID();
  const { error } = await db.from("rondas").insert({
    id: rondaId,
    data_hora: agora.toISOString(),
    chamado_id: chamadoDaRonda?.id ?? null,
    observacao: e.data.observacao || null,
    foto: e.data.foto || null,
    lancado_por: usuarioId,
  });
  if (error) {
    console.error("lançar ronda", error);
    return { erro: "Não foi possível salvar a ronda. Tente de novo." };
  }
  const { error: erroItens } = await db.from("ronda_itens").insert(
    itens.map((i) => ({
      ronda_id: rondaId,
      coletor_id: i.coletorId,
      conteineres: i.conteineres,
      ocupacao_pct: i.ocupacaoPct,
      observacao: i.observacao || null,
      foto: i.foto || null,
    })),
  );
  if (erroItens) {
    console.error("itens da ronda", erroItens);
    // Sem os itens a ronda não vale nada: desfaz para não ficar uma ronda vazia.
    await db.from("rondas").delete().eq("id", rondaId);
    return { erro: "Não foi possível salvar a ronda. Tente de novo." };
  }

  // Daqui em diante a ronda está salva: falha nos chamados vira aviso.
  let chamadoFechado = false;
  if (chamadoDaRonda)
    try {
      chamadoFechado = await concluirPeloSistema({
        chamadoId: chamadoDaRonda.id,
        texto: `Ronda lançada em ${quandoTexto}: ${itens.length} ${itens.length === 1 ? "coletor visitado" : "coletores visitados"}.`,
        concluidoPor: usuarioId,
        autorNome: "Sustentabilidade",
      });
    } catch (erro) {
      console.error("concluir o chamado da ronda", erro);
    }

  const recolhimentos = recolhimentosAAbrir({
    itens,
    coletores: ativos,
    limitePct: param.limite_ocupacao_pct,
    rondaId,
    quando: quandoTexto,
  });
  const resultado = await abrirRecolhimentos(
    recolhimentos,
    param.recolhimento_setor_id,
    usuarioId,
  );

  refresh();
  return {
    ok: mensagemDaRonda({
      lancados: itens.length,
      chamadoFechado,
      recolhimentosAbertos: resultado.abertos,
      recolhimentosSemSetor: resultado.semSetor,
      recolhimentosComFalha: resultado.falhas,
    }),
  };
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
    categoriaId = await categoriaDoRecolhimento(setorId);
  } catch (erro) {
    console.error("categoria do recolhimento", erro);
  }
  for (const r of lista)
    try {
      const criado = await criarChamadoSistema({
        setorId,
        categoriaId,
        titulo: r.titulo,
        descricao: r.descricao,
        tipo: "tarefa",
        origem: "modulo",
        origemModulo: "sustentabilidade",
        origemRef: r.origemRef,
        abertoPor: usuarioId,
        autorNome: "Sustentabilidade",
        prioridade: "alta",
      });
      if (criado) abertos += 1;
      else falhas += 1;
    } catch (erro) {
      console.error("abrir recolhimento de coletor", erro);
      falhas += 1;
    }
  return { abertos, semSetor: 0, falhas };
}
