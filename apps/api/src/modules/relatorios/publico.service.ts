import { randomUUID } from "node:crypto";
import {
  type ArquivoEnviado,
  LIMITES,
  titulosDasPerguntas,
  validarRespostas,
} from "@arp/shared/formularios/campos";
import type { FormularioPublico } from "@arp/shared/formularios/contratos";
import {
  hexDaCor,
  type MotivoFechado,
  motivoFechado,
  SITUACOES,
} from "@arp/shared/formularios/formulario";
import { BYTES_DO_TIPO } from "@arp/shared/os/tipo-arquivo";
import type { Origem } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDeValidacao } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { gravarArquivo } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import {
  assinar,
  BUCKET,
  conferirAssinatura,
  nomeLimpo,
  tipoDoArquivo,
} from "./arquivos";
import * as repo from "./publico.repository";
import { lerCampos } from "./relatorios.service";

// Quem responde pelo link (/responder/<token>, sem login). O token é
// conferido aqui a cada leitura e a cada envio, e só então a service role
// entra; as respostas são conferidas contra as perguntas atuais e gravadas
// por formularios.responder(), que confere de novo a situação, a data e o
// limite com a linha travada. Arquivo sobe antes, um por vez, e volta
// assinado; o envio final só aceita arquivo assinado.

/** Token do link: 32 a 128 caracteres de base64url ou hex. */
export const tokenValido = (t: string) => /^[A-Za-z0-9_-]{32,128}$/.test(t);

const MENSAGEM_FECHADO: Record<MotivoFechado, string> = {
  inexistente: "Este link não existe. Confira o endereço que você recebeu.",
  rascunho: "Este formulário ainda não está aberto para respostas.",
  encerrado: "Este formulário não recebe mais respostas.",
};

type Acesso =
  | { id: string; formulario: FormularioPublico }
  | { motivo: MotivoFechado };

/** O formulário do link, ou o motivo de ele estar fechado. */
export async function peloToken(token: string): Promise<Acesso> {
  if (!tokenValido(token)) return { motivo: "inexistente" };
  const f = await banco.comoServico((tx) => repo.peloToken(tx, token));
  const situacao = f && SITUACOES.find((s) => s === f.situacao);
  const motivo = motivoFechado(
    f && situacao ? { ...f, situacao } : null,
    new Date(),
  );
  if (motivo || !f) return { motivo: motivo ?? "inexistente" };
  return {
    id: f.id,
    formulario: {
      titulo: f.titulo,
      descricao: f.descricao,
      campos: lerCampos(f.campos),
      mensagem_final: f.mensagem_final,
      token,
      cor: hexDaCor(f.cor),
      paginas: f.paginas,
      redirecionar_para: f.redirecionar_para,
    },
  };
}

/** O link fechado vira 409 com a mensagem para quem responde. */
async function aberto(token: string) {
  const acesso = await peloToken(token);
  if ("motivo" in acesso)
    throw new ErroDeConflito(MENSAGEM_FECHADO[acesso.motivo]);
  return acesso;
}

const ILEGIVEL = "Não foi possível ler as respostas. Recarregue a página.";

/**
 * "Enviar" do formulário público. Pergunta com problema: 400 com a mensagem
 * de cada uma em `campos` (id da pergunta → texto).
 */
export async function responder(
  token: string,
  bruto: string,
  site: string | undefined,
  origem: Origem,
): Promise<void> {
  if (!tokenValido(token))
    throw new ErroDeConflito(MENSAGEM_FECHADO.inexistente);
  // Campo escondido que pessoa não preenche; robô costuma preencher.
  if ((site ?? "") !== "") return;
  if (bruto.length > 200_000)
    throw new ErroDeNegocio("Respostas grandes demais.");
  let entrada: unknown;
  try {
    entrada = JSON.parse(bruto);
  } catch {
    throw new ErroDeNegocio(ILEGIVEL);
  }
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
    throw new ErroDeNegocio(ILEGIVEL);

  const { id, formulario } = await aberto(token);
  const { respostas, erros } = validarRespostas(
    formulario.campos,
    Object.fromEntries(Object.entries(entrada)),
    conferirAssinatura(id),
  );
  if (Object.keys(erros).length)
    throw new ErroDeValidacao("Confira as perguntas marcadas.", erros);

  try {
    await banco.comoServico((tx) =>
      repo.responder(
        tx,
        token,
        respostas,
        titulosDasPerguntas(formulario.campos),
      ),
    );
  } catch (e) {
    // P0001 (encerrou no meio) já chega como regra; P0002, sem tradução.
    if (e instanceof ErroDeNegocio)
      throw new ErroDeConflito(MENSAGEM_FECHADO.encerrado);
    if (codigoDoBanco(e) === "P0002")
      throw new ErroDeConflito(MENSAGEM_FECHADO.inexistente);
    log.error(
      { err: e, formularioId: id, requisicao: origem.requisicaoId },
      "resposta do formulário",
    );
    throw new ErroDeNegocio("Não foi possível enviar. Tente de novo.");
  }
}

/**
 * Sobe um arquivo de uma pergunta "Envio de arquivo" com o formulário
 * aberto. Volta caminho, nome, tamanho, tipo e a assinatura que o envio
 * final confere.
 */
export async function enviarArquivo(
  token: string,
  campoId: string,
  arquivo: ArquivoRecebido | undefined,
): Promise<ArquivoEnviado> {
  if (!tokenValido(token))
    throw new ErroDeNegocio(MENSAGEM_FECHADO.inexistente);
  const acesso = await peloToken(token);
  if ("motivo" in acesso)
    throw new ErroDeNegocio(MENSAGEM_FECHADO[acesso.motivo]);
  const { id, formulario } = acesso;
  const campo = formulario.campos.find(
    (c) => c.id === campoId && c.tipo === "arquivo",
  );
  if (!campo)
    throw new ErroDeNegocio("Pergunta não encontrada. Recarregue a página.");

  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha o arquivo.");
  if (arquivo.bytes.length > LIMITES.arquivoMb * 1024 * 1024)
    throw new ErroDeNegocio(`Arquivo maior que ${LIMITES.arquivoMb} MB.`);
  const bytes = new Uint8Array(arquivo.bytes);
  const tipo = tipoDoArquivo(arquivo.nome, bytes.slice(0, BYTES_DO_TIPO));
  if (!tipo)
    throw new ErroDeNegocio(
      "Envie PDF, foto (JPG, PNG, WEBP ou HEIC), Word ou Excel.",
    );

  const caminho = `${id}/${randomUUID()}.${tipo.ext}`;
  // atalho: arquivo que sobe e não é enviado no formulário fica no disco.
  try {
    await gravarArquivo(BUCKET, caminho, bytes, tipo.tipo);
  } catch (err) {
    log.error({ err, formularioId: id }, "arquivo do formulário");
    throw new ErroDeNegocio(
      "Não foi possível guardar o arquivo. Tente de novo.",
    );
  }
  const base = arquivo.nome.replace(/\.[^.]*$/, "");
  const nome = `${nomeLimpo(base).slice(0, 100) || "arquivo"}.${tipo.ext}`;
  const dados = {
    caminho,
    nome,
    tamanho: arquivo.bytes.length,
    tipo: tipo.tipo,
  };
  return { ...dados, assinatura: assinar(dados) };
}
