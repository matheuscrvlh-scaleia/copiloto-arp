import { formatarData } from "@arp/shared/formato";
import {
  entradaAssinaturaDoLink,
  type PaginaDaVistoria,
} from "@arp/shared/os/contratos/vistorias";
import { rotaVistoria } from "@arp/shared/os/rotas";
import { RESPOSTAS_AMBIENTE, TIPOS_VISTORIA } from "@arp/shared/os/rotulos";
import {
  localDaUnidade,
  motivoParaAssinaturaDoLocatario,
} from "@arp/shared/os/vistoria-regras";
import { ErroDeNegocio, ErroDeValidacao, ErroNaoEncontrado } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  caminhoDoArquivo,
  depois,
  enviarArquivo,
  notificar,
  removerArquivos,
  urlsAssinadas,
} from "./base.service";
import { gerarLaudo, type LaudoGerado } from "./pdf/laudo";
import { tentar } from "./tentar";
import type { Vistoria } from "./vistorias.repository";
import * as repo from "./vistorias.repository";
import {
  dadosDoLaudo,
  fotosPorAmbiente,
  linhasDoLaudo,
} from "./vistorias.service";

// Vistoria para o locatário, sem login: ele confere o laudo e assina por
// último, depois da ARP. O token é conferido a cada acesso e só então a
// service role lê (e grava só a assinatura dele).

const LINK_INATIVO = "Este link não está mais ativo. Fale com a ARP.";

/** Token como o novoToken() gera (base64url, 32+ caracteres). */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

/** A vistoria do link. undefined: token inexistente ou vistoria cancelada. */
async function vistoriaPeloToken(
  tx: Tx,
  token: string,
): Promise<Vistoria | undefined> {
  if (!FORMATO_TOKEN.test(token)) return undefined;
  const v = await repo.vistoriaPeloToken(tx, token);
  return v && v.status !== "cancelado" ? v : undefined;
}

/** GET /os/vistoria-publica/:token: o laudo inteiro, para conferir e assinar. */
export async function paginaDaVistoria(
  token: string,
): Promise<PaginaDaVistoria> {
  const lido = await banco.comoServico(async (tx) => {
    const v = await vistoriaPeloToken(tx, token);
    if (!v) return null;
    const ambientes = await repo.ambientesDaVistoria(tx, v.id);
    const fotos = await fotosPorAmbiente(
      tx,
      ambientes.map((a) => a.id),
    );
    return { v, ambientes, fotos };
  });
  if (!lido) throw new ErroNaoEncontrado(LINK_INATIVO);
  const { v, ambientes, fotos } = lido;
  const urls = await urlsAssinadas([
    ...[...fotos.values()].flat().map((f) => f.path),
    ...(v.assinatura_locador_path ? [v.assinatura_locador_path] : []),
  ]);
  return {
    token,
    codigo: v.codigo,
    tipo: TIPOS_VISTORIA[v.tipo],
    data: formatarData(v.data),
    unidade: localDaUnidade(v.bloco, v.unidade),
    locador: v.locador,
    locatario: v.locatario,
    observacao: v.observacao,
    consideracoes: v.consideracoes,
    termo: v.termo,
    localData: v.local_data,
    ambientes: ambientes.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      texto:
        a.resposta === "respondido"
          ? a.descricao?.trim() || "Sem observações."
          : RESPOSTAS_AMBIENTE[a.resposta],
      fotos: (fotos.get(a.id) ?? []).flatMap((f) => {
        const url = urls.get(f.path);
        return url ? [{ id: f.id, nome: f.nome, url }] : [];
      }),
    })),
    assinaturaLocador: v.assinatura_locador_path
      ? (urls.get(v.assinatura_locador_path) ?? null)
      : null,
    assinado: v.assinatura_locatario_path
      ? {
          nome: v.locatario_assinatura_nome ?? v.locatario,
          documento: v.locatario_assinatura_documento,
          em: v.locatario_assinado_em ?? v.assinado_em,
        }
      : null,
    motivo: motivoParaAssinaturaDoLocatario(v),
  };
}

/** GET /os/vistoria-publica/:token/laudo: o PDF, depois de conferir o token. */
export async function laudoPeloLink(token: string): Promise<LaudoGerado> {
  const linhas = await banco.comoServico(async (tx) => {
    const v = await vistoriaPeloToken(tx, token);
    return v
      ? linhasDoLaudo(tx, v.id, { comparar: v.comparar_no_laudo })
      : null;
  });
  if (!linhas) throw new ErroNaoEncontrado("Este link não está mais ativo.");
  return gerarLaudo(await dadosDoLaudo(linhas));
}

/** POST /os/vistoria-publica/:token/assinatura: a assinatura do locatário. */
export async function assinarPeloLink(
  token: string,
  campos: Record<string, string>,
  png: ArquivoRecebido | undefined,
): Promise<string> {
  const d = entradaAssinaturaDoLink.safeParse({
    token,
    nome: campos.nome ?? "",
    documento: campos.documento ?? "",
    concordo: campos.concordo ?? "",
  });
  if (!d.success) {
    const problema = d.error.issues[0];
    if (problema?.path[0] === "token") throw new ErroDeNegocio(LINK_INATIVO);
    throw new ErroDeValidacao(problema?.message ?? "Confira os campos.");
  }
  const v = await banco.comoServico((tx) => vistoriaPeloToken(tx, token));
  if (!v) throw new ErroDeNegocio(LINK_INATIVO);
  const motivo = motivoParaAssinaturaDoLocatario(v);
  if (motivo) {
    if (v.assinatura_locatario_path) return "Vistoria já assinada.";
    throw new ErroDeNegocio(motivo);
  }
  if (!png || png.bytes.length === 0 || png.tipo !== "image/png")
    throw new ErroDeValidacao("Assine no quadro antes de enviar.");
  if (png.bytes.length > 1024 * 1024)
    throw new ErroDeValidacao("Assinatura grande demais.");

  const path = caminhoDoArquivo("vistorias", v.id, "assinatura-locatario.png");
  try {
    await enviarArquivo(path, png.bytes, "image/png");
  } catch (err) {
    log.error({ err }, "assinatura do locatário pelo link");
    throw new ErroDeNegocio(
      "Não foi possível guardar a assinatura. Tente de novo.",
    );
  }
  // Só grava se ninguém assinou no meio do caminho (dois toques, ou a ARP
  // colheu a assinatura na tela).
  const r = await banco.comoServico((tx) =>
    tentar(tx, () =>
      repo.gravarAssinaturaDoLink(tx, {
        id: v.id,
        token,
        path,
        nome: d.data.nome,
        documento: d.data.documento || null,
      }),
    ),
  );
  if (!r.ok || !r.valor) {
    if (!r.ok)
      log.error({ err: r.erro, vistoria: v.id }, "assinatura pelo link");
    await removerArquivos([path]);
    if (!r.ok)
      throw new ErroDeNegocio("Não foi possível salvar. Tente de novo.");
    return "Vistoria já assinada.";
  }
  // O aviso à equipe não muda a resposta ao locatário: sai depois.
  depois("aviso da vistoria assinada", () =>
    notificar([v.vistoriador_id ?? v.criado_por], {
      tipo: "vistoria",
      titulo: `Vistoria ${v.codigo} assinada`,
      texto: `${d.data.nome} conferiu e assinou o laudo pelo link.`,
      href: rotaVistoria(v.id),
    }),
  );
  return "Vistoria assinada. Obrigado!";
}
