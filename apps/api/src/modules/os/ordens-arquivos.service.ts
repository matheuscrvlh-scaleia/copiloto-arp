import type {
  CategoriaDeArquivo,
  RespostaDaOS,
} from "@arp/shared/os/contratos/ordens";
import {
  assinaturaDoLink,
  envioGrandeDemais,
  erroDoArquivo,
  LIMITE_ARQUIVOS,
} from "@arp/shared/os/ordem";
import { BYTES_DO_TIPO, tipoPeloConteudo } from "@arp/shared/os/tipo-arquivo";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  caminhoDoArquivo,
  enviarArquivo,
  removerArquivos,
} from "./base.service";
import * as repo from "./ordens.repository";
import { chamadoParaEditar } from "./ordens.service";
import { anotar } from "./ordens-acoes.service";
import { tentar } from "./tentar";

// Fotos de antes e depois, orçamento e laudo da OS, e a assinatura do
// responsável na tela. A linha em os.anexos passa pelo RLS antes; o
// arquivo vai para o disco depois.

const CATEGORIAS: Record<CategoriaDeArquivo, string> = {
  antes: "foto de antes",
  depois: "foto de depois",
  orcamento: "orçamento",
  laudo: "laudo",
};

/** O tipo vem do conteúdo, não do que o navegador declara. */
export const tipoDoArquivo = (a: ArquivoRecebido) =>
  tipoPeloConteudo(a.bytes.subarray(0, BYTES_DO_TIPO)) ?? "";

/** Confere o lote (quantidade, tamanho e tipo); devolve o tipo de cada um. */
export function conferirEnvio(
  arquivos: ArquivoRecebido[],
  documento: boolean,
): string[] {
  if (!arquivos.length)
    throw new ErroDeNegocio("Escolha pelo menos um arquivo.");
  if (arquivos.length > LIMITE_ARQUIVOS)
    throw new ErroDeNegocio(
      `Envie no máximo ${LIMITE_ARQUIVOS} arquivos por vez.`,
    );
  if (envioGrandeDemais(arquivos.map((a) => a.bytes.length)))
    throw new ErroDeNegocio(
      "Os arquivos passam de 4 MB juntos. Envie em partes.",
    );
  const tipos = arquivos.map(tipoDoArquivo);
  for (const [i, a] of arquivos.entries()) {
    const erro = erroDoArquivo(
      { nome: a.nome, tipo: tipos[i] ?? "", tamanho: a.bytes.length },
      documento,
    );
    if (erro) throw new ErroDeNegocio(erro);
  }
  return tipos;
}

export async function enviarArquivos(
  ctx: Contexto,
  ordemId: string,
  categoria: CategoriaDeArquivo,
  arquivos: ArquivoRecebido[],
): Promise<RespostaDaOS> {
  const tipos = conferirEnvio(
    arquivos,
    categoria === "orcamento" || categoria === "laudo",
  );
  // O arquivo que falha não desfaz os anteriores: o erro sai depois do escopo.
  const erro = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    for (const [i, a] of arquivos.entries()) {
      const mime = tipos[i] ?? "";
      const path = caminhoDoArquivo("chamados", ordemId, a.nome);
      let recusa: string | null = null;
      const t = await tentar(tx, async () => {
        await repo.inserirArquivo(tx, {
          ordem_id: ordemId,
          categoria,
          nome: a.nome.slice(0, 200),
          path,
          mime,
          tamanho: a.bytes.length,
          enviado_por: ctx.usuario.id,
        });
        try {
          await enviarArquivo(path, a.bytes, mime);
        } catch (err) {
          log.error({ err, ordemId }, "enviar arquivo da OS");
          recusa = `Não foi possível enviar ${a.nome}. Tente de novo.`;
          // Sem o arquivo no disco, a linha do anexo não fica.
          throw err;
        }
      });
      if (!t.ok) return recusa ?? t.mensagem;
    }
    await anotar(tx, cx, ordemId, {
      tipo: "anexo",
      texto:
        arquivos.length === 1
          ? `Anexou ${CATEGORIAS[categoria]}: ${arquivos[0]?.nome}.`
          : `Anexou ${arquivos.length} arquivos (${CATEGORIAS[categoria]}).`,
      dados: { categoria, quantidade: arquivos.length },
    });
    return null;
  });
  if (erro) throw new ErroDeNegocio(erro);
  return {
    mensagem: arquivos.length === 1 ? "Arquivo enviado." : "Arquivos enviados.",
  };
}

export async function removerArquivo(
  ctx: Contexto,
  ordemId: string,
  arquivoId: string,
): Promise<RespostaDaOS> {
  const path = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
    // O RLS só deixa apagar o que a própria pessoa enviou.
    const removido = await repo.removerArquivo(tx, arquivoId, ordemId);
    if (!removido)
      throw new ErroDeNegocio("Só quem enviou o arquivo pode removê-lo.");
    await anotar(tx, cx, ordemId, {
      tipo: "anexo",
      texto: `Removeu o arquivo ${removido.nome}.`,
    });
    return removido.path;
  });
  await removerArquivos([path]);
  return { mensagem: "Arquivo removido." };
}

/** PNG do quadro de assinatura (campo "assinatura" do formulário). */
export function pngDaAssinatura(
  png: ArquivoRecebido | undefined,
  semAssinatura: string,
): ArquivoRecebido {
  if (!png || png.bytes.length === 0 || png.tipo !== "image/png")
    throw new ErroDeNegocio(semAssinatura);
  if (png.bytes.length > 1024 * 1024)
    throw new ErroDeNegocio("Assinatura grande demais.");
  return png;
}

/** Assinatura do responsável desenhada na tela (PNG do canvas). */
export async function assinarOS(
  ctx: Contexto,
  ordemId: string,
  nome: string,
  arquivo: ArquivoRecebido | undefined,
): Promise<RespostaDaOS> {
  const png = pngDaAssinatura(arquivo, "Assine no quadro antes de salvar.");
  const eu = ctx.usuario.id;
  const { ch } = await banco.comoUsuario(eu, (tx) =>
    chamadoParaEditar(tx, ctx, ordemId),
  );
  // OS terceirizada com link: a ARP valida e assina depois do terceirizado.
  // O token é segredo (RLS): a leitura dos links vai pela service role, já
  // conferido que a pessoa mexe nesta OS.
  if (ch.execucao === "terceirizada") {
    const links = await banco.comoServico((tx) =>
      repo.situacaoDosLinks(tx, ch.id),
    );
    if (assinaturaDoLink(links) === false)
      throw new ErroDeNegocio(
        "Aguarde o terceirizado conferir e assinar pelo link (ou cancele o link).",
      );
  }

  const path = caminhoDoArquivo("assinaturas", ch.id, "assinatura.png");
  try {
    await enviarArquivo(path, png.bytes, "image/png");
  } catch (err) {
    log.error({ err, ordemId }, "assinatura da OS");
    throw new ErroDeNegocio(
      "Não foi possível guardar a assinatura. Tente de novo.",
    );
  }
  try {
    await banco.comoUsuario(eu, async (tx) => {
      const { cx } = await chamadoParaEditar(tx, ctx, ordemId);
      await repo.atualizarOrdem(tx, ch.id, {
        assinatura_path: path,
        assinatura_nome: nome,
        assinado_em: new Date().toISOString(),
      });
      await anotar(tx, cx, ch.id, {
        tipo: "alteracao",
        texto:
          ch.execucao === "terceirizada"
            ? `OS validada e assinada pela ARP (${nome}).`
            : `Assinatura do responsável registrada (${nome}).`,
        dados: { campo: "assinatura" },
      });
    });
  } catch (err) {
    await removerArquivos([path]);
    throw err;
  }
  if (ch.assinatura_path) await removerArquivos([ch.assinatura_path]);
  return { mensagem: "Assinatura salva." };
}
