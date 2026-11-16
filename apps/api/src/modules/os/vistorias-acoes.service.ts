import type {
  AmbienteDaEntrada,
  Foto,
  RespostaEnvio,
} from "@arp/shared/os/contratos/vistorias";
import {
  entradaAmbiente,
  entradaNovaVistoria,
  entradaNovoAmbiente,
  entradaVistoria,
  ROTULOS_VISTORIA,
} from "@arp/shared/os/contratos/vistorias";
import { rotaAssinaturaVistoria } from "@arp/shared/os/rotas";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { localEData } from "@arp/shared/os/vistoria";
import {
  faltando,
  motivoParaAssinaturaDoLocatario,
} from "@arp/shared/os/vistoria-regras";
import { linkWhatsApp, preencher } from "@arp/shared/os/whatsapp";
import type { Contexto } from "@/contexto";
import {
  ErroDeConflito,
  ErroDeNegocio,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco } from "@/infra/banco";
import { erroDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import { chamado as alvoChamado } from "./alvo";
import {
  caminhoDoArquivo,
  contextoOs,
  enviarArquivo,
  novoToken,
  registrar,
  removerArquivos,
  urlDoSistema,
  urlsAssinadas,
} from "./base.service";
import { gerarLaudo } from "./pdf/laudo";
import { tentar } from "./tentar";
import { validar } from "./validar";
import * as repo from "./vistorias.repository";
import {
  dadosDoLaudo,
  entradaDoAmbiente,
  exigirVistorias,
  inserirVistoria,
  ligarEntradaSemFalhar,
  linhasDoLaudo,
  padroesVistoria,
  variaveisDaMensagem,
} from "./vistorias.service";

// Gravações das vistorias (4.10). Tudo pela sessão (RLS da permissão
// os.vistorias); o disco só recebe o arquivo depois que a linha passou pelo
// RLS. As mensagens são as de antes.

const MB = 1024 * 1024;
// Só os formatos que o laudo (pdf-lib) consegue pôr no PDF.
const TIPOS_FOTO = ["image/jpeg", "image/png"];

/** O arquivo do formulário, com as regras de antes ("Arquivo: …"). */
function arquivoValido(
  f: ArquivoRecebido | undefined,
  tipos: string[],
  maxMb: number,
): ArquivoRecebido {
  const erro = (m: string) =>
    new ErroDeValidacao(`${ROTULOS_VISTORIA.arquivo}: ${m}`);
  if (!f) throw erro("escolha um arquivo");
  if (f.bytes.length === 0) throw erro("arquivo vazio");
  if (f.bytes.length > maxMb * MB) throw erro(`máximo de ${maxMb} MB`);
  if (!tipos.includes(f.tipo)) throw erro("formato não aceito");
  return f;
}

// ---------------------------------------------------------------------------
// Nova vistoria
// ---------------------------------------------------------------------------

export async function iniciarVistoria(
  ctx: Contexto,
  dados: unknown,
): Promise<string> {
  exigirVistorias(ctx);
  const d = validar(entradaNovaVistoria, dados, ROTULOS_VISTORIA);
  if (!d.loja_id && !d.locatario)
    throw new ErroDeValidacao(
      "Escolha a loja do contrato ou informe o locatário.",
    );
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const loja = d.loja_id ? await repo.loja(tx, d.loja_id) : null;
    if (d.loja_id && !loja) throw new ErroNaoEncontrado("Loja não encontrada.");
    return inserirVistoria(
      tx,
      {
        tipo: d.tipo,
        data: d.data,
        vistoriadorId: ctx.usuario.id,
        vistoriadorNome: ctx.usuario.nome,
        loja: loja ?? null,
        locatario: d.locatario,
        bloco: d.bloco,
        unidade: d.unidade,
        criadoPor: ctx.usuario.id,
      },
      await padroesVistoria(tx),
    );
  });
}

// ---------------------------------------------------------------------------
// Salvar (rascunho ou vistoria)
// ---------------------------------------------------------------------------

export async function salvarVistoria(
  ctx: Contexto,
  id: string,
  dados: unknown,
): Promise<string> {
  exigirVistorias(ctx);
  const v = validar(entradaVistoria, dados, ROTULOS_VISTORIA);
  if (!v.rascunho) {
    const falta = faltando({
      tipo: v.tipo,
      codigo: v.codigo,
      status: v.status,
      data: v.data,
      vistoriador: v.vistoriador_nome,
      locador: v.locador,
      locatario: v.locatario,
    });
    if (falta.length)
      throw new ErroDeValidacao(`Preencha: ${falta.join(", ")}.`);
  }
  const { ambientes, ...campos } = v;
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const r = await tentar(tx, () => repo.atualizarVistoria(tx, id, campos));
    if (!r.ok) {
      if (r.codigo === "23505")
        throw new ErroDeConflito("Já existe uma vistoria com esse código.");
      throw erroDoBanco(r.erro) ?? r.erro;
    }
    // Sem linha, nada foi gravado (a vistoria saiu ou o RLS barrou).
    if (!r.valor) throw new ErroNaoEncontrado("Vistoria não encontrada.");
    for (const [ordem, { id: ambienteId, ...a }] of ambientes.entries())
      await repo.atualizarAmbiente(tx, ambienteId, id, { ...a, ordem });
    await ligarEntradaSemFalhar(tx, id);
  });
  return v.rascunho ? "Rascunho salvo." : "Vistoria salva.";
}

/** Salva um ambiente sozinho (preenchimento no celular, a cada ambiente). */
export async function salvarAmbiente(
  ctx: Contexto,
  vistoriaId: string,
  ambienteId: string,
  dados: unknown,
): Promise<string> {
  exigirVistorias(ctx);
  const a = validar(entradaAmbiente, dados, ROTULOS_VISTORIA);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarAmbiente(tx, ambienteId, vistoriaId, a),
  );
  return "Salvo.";
}

// ---------------------------------------------------------------------------
// Ambientes: incluir, remover, reordenar
// ---------------------------------------------------------------------------

export async function adicionarAmbiente(
  ctx: Contexto,
  vistoriaId: string,
  dados: unknown,
): Promise<{
  mensagem: string;
  id: string;
  entrada: AmbienteDaEntrada | null;
}> {
  exigirVistorias(ctx);
  const d = validar(entradaNovoAmbiente, dados, ROTULOS_VISTORIA);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const id = await repo.inserirAmbiente(tx, {
      vistoria_id: vistoriaId,
      titulo: d.titulo,
      ordem: d.ordem,
    });
    await ligarEntradaSemFalhar(tx, vistoriaId);
    return {
      mensagem: "Ambiente incluído.",
      id,
      entrada: await entradaDoAmbiente(tx, id),
    };
  });
}

export async function removerAmbiente(
  ctx: Contexto,
  id: string,
): Promise<string> {
  exigirVistorias(ctx);
  const paths = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const anexos = await repo.pathsDoAmbiente(tx, id);
    await repo.removerAmbiente(tx, id);
    return anexos.map((a) => a.path);
  });
  // As linhas das fotos saem junto (cascade); os arquivos, aqui.
  await removerArquivos(paths);
  return "Ambiente removido.";
}

export async function ordenarAmbientes(
  ctx: Contexto,
  vistoriaId: string,
  ids: string[],
): Promise<string> {
  exigirVistorias(ctx);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    for (const [ordem, id] of ids.entries())
      await repo.atualizarAmbiente(tx, id, vistoriaId, { ordem });
  });
  return "Ordem salva.";
}

// ---------------------------------------------------------------------------
// Fotos e assinaturas
// ---------------------------------------------------------------------------

/** Uma foto do ambiente (já reduzida no navegador). */
export async function enviarFoto(
  ctx: Contexto,
  vistoriaId: string,
  ambienteId: string,
  arquivo: ArquivoRecebido | undefined,
): Promise<{ mensagem: string; foto: Foto }> {
  exigirVistorias(ctx);
  const f = arquivoValido(arquivo, TIPOS_FOTO, 8);
  const nome = f.nome || "foto.jpg";
  const path = caminhoDoArquivo("ambientes", ambienteId, nome);
  // A linha passa pelo RLS antes; o arquivo só sobe depois dela, e a linha
  // só fica se o arquivo subiu (a transação desfaz).
  const anexo = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const a = await repo.inserirFoto(tx, {
      vistoria_id: vistoriaId,
      ambiente_id: ambienteId,
      nome,
      path,
      mime: f.tipo,
      tamanho: f.bytes.length,
      usuario: ctx.usuario,
    });
    try {
      await enviarArquivo(path, f.bytes, f.tipo);
    } catch (err) {
      log.error({ err }, "foto da vistoria");
      throw new ErroDeNegocio("Não foi possível enviar a foto. Tente de novo.");
    }
    return a;
  });
  const urls = await urlsAssinadas([path]);
  return {
    mensagem: "Foto enviada.",
    foto: { ...anexo, url: urls.get(path) ?? null },
  };
}

export async function removerFoto(ctx: Contexto, id: string): Promise<string> {
  exigirVistorias(ctx);
  const anexo = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.removerFoto(tx, id),
  );
  if (anexo) await removerArquivos([anexo.path]);
  return "Foto removida.";
}

type Parte = "locador" | "locatario";

/** A assinatura do locatário feita na tela (ou apagada) não é a do link. */
const SEM_ASSINATURA_DO_LINK = {
  locatario_assinatura_nome: null,
  locatario_assinatura_documento: null,
  locatario_assinado_em: null,
};

const caminhoDaAssinatura = (quem: Parte, path: string | null) =>
  quem === "locador"
    ? { assinatura_locador_path: path }
    : { assinatura_locatario_path: path };

/** Assinatura feita na tela (PNG), que sai no laudo sobre a linha. */
export async function salvarAssinatura(
  ctx: Contexto,
  id: string,
  quem: Parte,
  arquivo: ArquivoRecebido | undefined,
): Promise<{ mensagem: string; url: string | null }> {
  exigirVistorias(ctx);
  const f = arquivoValido(arquivo, ["image/png"], 1);
  const path = caminhoDoArquivo("vistorias", id, `assinatura-${quem}.png`);
  const anterior = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    // Lê pela sessão: sem acesso à vistoria, nada sobe para o disco.
    const v = await repo.vistoria(tx, id);
    if (!v) throw new ErroNaoEncontrado("Vistoria não encontrada.");
    try {
      await enviarArquivo(path, f.bytes, "image/png");
    } catch (err) {
      log.error({ err }, "assinatura");
      throw new ErroDeNegocio(
        "Não foi possível guardar a assinatura. Tente de novo.",
      );
    }
    const outra =
      quem === "locador"
        ? v.assinatura_locatario_path
        : v.assinatura_locador_path;
    const r = await tentar(tx, () =>
      repo.atualizarVistoria(tx, id, {
        ...caminhoDaAssinatura(quem, path),
        ...(quem === "locatario" ? SEM_ASSINATURA_DO_LINK : {}),
        assinado_em: outra ? new Date().toISOString() : null,
      }),
    );
    if (!r.ok) {
      await removerArquivos([path]);
      throw erroDoBanco(r.erro) ?? r.erro;
    }
    return quem === "locador"
      ? v.assinatura_locador_path
      : v.assinatura_locatario_path;
  });
  if (anterior) await removerArquivos([anterior]);
  const urls = await urlsAssinadas([path]);
  return { mensagem: "Assinatura salva.", url: urls.get(path) ?? null };
}

export async function removerAssinatura(
  ctx: Contexto,
  id: string,
  quem: Parte,
): Promise<string> {
  exigirVistorias(ctx);
  const anterior = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const v = await repo.vistoria(tx, id);
    if (!v) throw new ErroNaoEncontrado("Vistoria não encontrada.");
    await repo.atualizarVistoria(tx, id, {
      ...caminhoDaAssinatura(quem, null),
      ...(quem === "locatario" ? SEM_ASSINATURA_DO_LINK : {}),
      assinado_em: null,
    });
    return quem === "locador"
      ? v.assinatura_locador_path
      : v.assinatura_locatario_path;
  });
  if (anterior) await removerArquivos([anterior]);
  return "Assinatura apagada.";
}

// ---------------------------------------------------------------------------
// Duplicar termo e enviar o laudo
// ---------------------------------------------------------------------------

/** Nova vistoria a partir desta: mesmos dados e ambientes, sem fotos. */
export async function duplicarVistoria(
  ctx: Contexto,
  id: string,
): Promise<string> {
  exigirVistorias(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const v = await repo.vistoria(tx, id);
    if (!v) throw new ErroNaoEncontrado("Vistoria não encontrada.");
    const ambientes = await repo.ambientesDaVistoria(tx, id);
    const hoje = hojeEmBrasilia(new Date());
    const padroes = await padroesVistoria(tx);
    const copia = await repo.inserirVistoria(tx, {
      tipo: v.tipo,
      status: "andamento",
      rascunho: true,
      data: hoje,
      vistoriador_id: ctx.usuario.id,
      vistoriador_nome: ctx.usuario.nome,
      locador: v.locador,
      loja_id: v.loja_id,
      locatario: v.locatario,
      bloco: v.bloco,
      unidade: v.unidade,
      campo_tipo: v.campo_tipo,
      itens_anteriores: v.itens_anteriores,
      observacao: v.observacao,
      consideracoes: v.consideracoes,
      termo: v.termo,
      local_data: localEData(padroes.local, hoje),
      comparar_no_laudo: v.comparar_no_laudo,
      criado_por: ctx.usuario.id,
    });
    await repo.inserirAmbientes(
      tx,
      ambientes.map((a) => ({
        vistoria_id: copia,
        titulo: a.titulo,
        resposta: a.resposta,
        descricao: a.descricao,
        ordem: a.ordem,
      })),
    );
    await ligarEntradaSemFalhar(tx, copia);
    return copia;
  });
}

/** O link do PDF vale por 7 dias (o locatário abre pelo WhatsApp). */
const DIAS_DO_LINK = 7;

/**
 * Gera o laudo, guarda no disco como anexo da vistoria (e do chamado da
 * loja, visível no portal) e devolve o link e a mensagem do WhatsApp.
 */
export async function prepararEnvio(
  ctx: Contexto,
  id: string,
): Promise<RespostaEnvio> {
  exigirVistorias(ctx);
  // O laudo segue a escolha da vistoria (comparar ou não com a entrada).
  const linhas = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lida = await repo.vistoria(tx, id);
    return lida
      ? linhasDoLaudo(tx, id, { comparar: lida.comparar_no_laudo })
      : null;
  });
  if (!linhas) throw new ErroNaoEncontrado("Vistoria não encontrada.");
  const v = linhas.vistoria;
  const laudo = await gerarLaudo(await dadosDoLaudo(linhas));
  const path = caminhoDoArquivo("vistorias", id, laudo.nome);

  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const loja = v.loja_id ? await repo.loja(tx, v.loja_id) : undefined;
    // O chamado da loja que pediu a vistoria (o Aviso); as OS dos ambientes
    // ficam em os.ordens.
    const chamado = await repo.chamadoDaLoja(tx, id);
    const anteriores = await repo.laudosDaVistoria(tx, id);
    const anexoId = await repo.inserirLaudo(tx, {
      vistoria_id: id,
      chamado_id: chamado?.id ?? null,
      nome: laudo.nome,
      path,
      tamanho: laudo.bytes.length,
      visivel_lojista: !!v.loja_id,
      usuario: ctx.usuario,
    });
    try {
      await enviarArquivo(path, laudo.bytes, "application/pdf");
    } catch (err) {
      log.error({ err }, "laudo no disco");
      throw new ErroDeNegocio(
        "Não foi possível guardar o laudo. Tente de novo.",
      );
    }
    // Fica só o laudo mais recente (o portal mostra um por vistoria).
    await repo.removerAnexos(
      tx,
      anteriores.map((a) => a.id),
    );
    if (chamado)
      await registrar(tx, await contextoOs(tx, ctx), alvoChamado(chamado.id), {
        tipo: "anexo",
        texto: `Laudo da vistoria ${v.codigo} enviado ao locatário.`,
        dados: { vistoria_id: id, anexo_id: anexoId },
        visivelLojista: true,
      });
    return {
      telefone: loja?.telefone ?? null,
      anteriores: anteriores.map((a) => a.path),
      padroes: await padroesVistoria(tx),
    };
  });
  await removerArquivos(r.anteriores);

  const link = (await urlsAssinadas([path], DIAS_DO_LINK * 86_400)).get(path);
  if (!link) throw new ErroDeNegocio("Não foi possível gerar o link do laudo.");
  const mensagem = preencher(
    r.padroes.mensagem,
    variaveisDaMensagem(v, link, DIAS_DO_LINK),
  );
  return {
    mensagem: "Laudo pronto para enviar.",
    link,
    whatsapp: linkWhatsApp(r.telefone, mensagem),
  };
}

/**
 * Link para o locatário conferir o laudo e assinar por último (sem login).
 * A ARP finaliza e assina como locador antes; o mesmo link vale até ele
 * assinar (reenviar não troca o endereço).
 */
export async function enviarParaAssinatura(
  ctx: Contexto,
  id: string,
): Promise<RespostaEnvio> {
  exigirVistorias(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const v = await repo.vistoria(tx, id);
    if (!v) throw new ErroNaoEncontrado("Vistoria não encontrada.");
    const motivo = motivoParaAssinaturaDoLocatario(v);
    if (motivo) throw new ErroDeNegocio(motivo);
    const token = v.assinatura_token ?? novoToken();
    await repo.atualizarVistoria(tx, v.id, {
      assinatura_token: token,
      assinatura_enviada_em: new Date().toISOString(),
    });
    const link = urlDoSistema(rotaAssinaturaVistoria(token));
    const padroes = await padroesVistoria(tx);
    const loja = v.loja_id ? await repo.loja(tx, v.loja_id) : undefined;
    const mensagem = preencher(
      padroes.mensagemAssinatura,
      variaveisDaMensagem(v, link, DIAS_DO_LINK),
    );
    return {
      mensagem: "Link pronto para o locatário assinar.",
      link,
      whatsapp: linkWhatsApp(loja?.telefone ?? null, mensagem),
    };
  });
}
