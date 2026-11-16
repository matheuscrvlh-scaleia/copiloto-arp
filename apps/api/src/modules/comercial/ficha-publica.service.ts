import { randomUUID } from "node:crypto";
import type {
  EntradaFichaPublica,
  EstadoDaFicha,
  EstadoDoDocumento,
  MotivoInativo,
  RespostaFichaPublica,
} from "@arp/shared/comercial/contratos/fichas";
import { MOTIVOS_INATIVO } from "@arp/shared/comercial/contratos/fichas";
import {
  avisosDoEnvio,
  documentoDaFicha,
  documentosFaltando,
  lerRespostas,
  limparPorTipo,
  lucDaFicha,
  nomeDaFicha,
  problemasDoEnvio,
  type RespostasFicha,
  ROTULO_TIPO_CURTO,
  respostasSchema,
  TIPOS_FICHA,
} from "@arp/shared/comercial/ficha";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { BYTES_DO_TIPO, tipoPeloConteudo } from "@arp/shared/os/tipo-arquivo";
import { z } from "zod";
import type { Origem } from "@/contexto";
import type { ArquivoRecebido } from "@/http/formulario";
import { gravarArquivo, removerArquivos } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { notificar } from "@/modules/os/base.service";
import * as consultas from "./consultas.service";
import * as repo from "./fichas.repository";
import {
  BUCKET_COMERCIAL,
  documentosPublicos,
  ehTipo,
  opcoesDeLuc,
  rotaDaFicha,
} from "./fichas.service";
import { dadosEnet } from "./fontes";

// Ficha cadastral pelo link (sem login): a página, "Salvar e continuar
// depois", "Enviar ficha" e os documentos comprobatórios. Cada pedido
// confere o token de novo (link vencido, cancelado ou já enviado para na
// hora) e só então usa a service role, só para a ficha desse token. Sem o
// aceite da LGPD nada é gravado.

/** Token do link: 32 a 128 caracteres de base64url ou hex. */
const tokenValido = (t: string) => /^[A-Za-z0-9_-]{32,128}$/.test(t);

type FichaDoLink = NonNullable<Awaited<ReturnType<typeof repo.fichaPeloToken>>>;

type Acesso =
  | { ok: true; ficha: FichaDoLink }
  | { ok: false; motivo: MotivoInativo };

/** Existe, não venceu, não foi cancelado e ainda está em preenchimento. */
async function fichaPeloToken(token: string): Promise<Acesso> {
  if (!tokenValido(token)) return { ok: false, motivo: "inexistente" };
  const f = await banco.comoServico((tx) => repo.fichaPeloToken(tx, token));
  if (!f) return { ok: false, motivo: "inexistente" };
  if (f.situacao !== "em_preenchimento")
    return { ok: false, motivo: "enviada" };
  if (f.cancelada_em) return { ok: false, motivo: "cancelada" };
  if (f.expira_em && new Date(f.expira_em) <= new Date())
    return { ok: false, motivo: "expirada" };
  return { ok: true, ficha: f };
}

const respostasDe = (f: FichaDoLink): RespostasFicha | null =>
  f.dados ? lerRespostas(f.dados.respostas) : null;

/** Tudo o que a ficha pública mostra, depois de conferir o token. */
export async function pagina(token: string): Promise<RespostaFichaPublica> {
  const acesso = await fichaPeloToken(token);
  if (!acesso.ok) return { motivo: acesso.motivo };
  const { ficha } = acesso;
  const hoje = hojeEmBrasilia(new Date());
  const [textos, documentos] = await banco.comoServico((tx) =>
    Promise.all([repo.textosPublicos(tx), documentosPublicos(tx)]),
  );
  const lucs = opcoesDeLuc(dadosEnet(hoje).lucs);
  const luc = ficha.luc;
  if (luc && !lucs.some((l) => l.valor === luc))
    lucs.unshift({ valor: luc, rotulo: luc });
  const ultimo = ficha.ultimo_acesso_em;
  // Último acesso do interessado (no máximo um registro a cada 5 minutos).
  if (!ultimo || Date.now() - new Date(ultimo).getTime() > 5 * 60_000)
    void banco
      .comoServico((tx) => repo.marcarUltimoAcesso(tx, ficha.id))
      .catch((erro: unknown) =>
        log.error({ err: erro }, "último acesso da ficha"),
      );
  return {
    hoje,
    ficha: {
      token: ficha.token,
      tipo: ehTipo(ficha.tipo) ? ficha.tipo : null,
      luc: ficha.luc,
      respostas: respostasDe(ficha),
      documentos: ficha.documentos,
    },
    textos: {
      boasVindas: textos.ficha_boas_vindas,
      termoLgpd: textos.ficha_termo_lgpd,
      validadeDias: textos.ficha_validade_dias,
    },
    documentos,
    lucs,
  };
}

const MENSAGEM_INATIVO: Record<MotivoInativo, string> = {
  inexistente: "Este link não existe. Confira o endereço que a ARP enviou.",
  expirada: "Este link venceu. Peça um novo link à equipe da ARP.",
  cancelada: "Este link foi cancelado pela ARP. Fale com a equipe.",
  enviada: "Esta ficha já foi enviada. Obrigado!",
};

const inativo = (motivo: MotivoInativo): EstadoDaFicha => ({
  erro: MENSAGEM_INATIVO[motivo],
  inativo: motivo,
});

const ehMotivo = (m: string | null): m is MotivoInativo =>
  (MOTIVOS_INATIVO as readonly string[]).includes(m ?? "");

const FALHOU: EstadoDaFicha = {
  erro: "Não foi possível salvar. Tente de novo.",
};
const SEM_ACEITE: EstadoDaFicha = {
  erro: "Sem o aceite do termo da LGPD (pergunta 2) não é possível seguir.",
  problemas: [
    {
      campo: "aceite",
      pergunta: 2,
      mensagem: "Marque o aceite do termo da LGPD para seguir.",
    },
  ],
};

/** "Salvar e continuar depois" (acao=salvar) ou "Enviar ficha" (acao=enviar). */
export async function salvar(
  token: string,
  entrada: EntradaFichaPublica,
): Promise<EstadoDaFicha> {
  const acesso = await fichaPeloToken(token);
  if (!acesso.ok) return inativo(acesso.motivo);
  const { ficha } = acesso;
  const enviar = entrada.acao === "enviar";

  const bruto = entrada.respostas;
  if (bruto.length > 200_000) return { erro: "Respostas grandes demais." };
  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return { erro: "Não foi possível ler as respostas. Recarregue a página." };
  }
  const lidas = respostasSchema.safeParse(json);
  if (!lidas.success)
    return { erro: "Algum campo veio num formato que não dá para guardar." };
  if (!lidas.data.aceite) return SEM_ACEITE;
  const r = enviar ? limparPorTipo(lidas.data) : lidas.data;

  // Ficha e respostas numa transação, com o token conferido de novo no banco.
  async function gravar(
    dados: RespostasFicha,
    comoEnvio: boolean,
  ): Promise<EstadoDaFicha | null> {
    const doc = documentoDaFicha(dados);
    let resultado: string | null;
    try {
      resultado = await banco.comoServico((tx) =>
        repo.gravarPeloLink(tx, {
          token: ficha.token,
          tipo: dados.tipo || null,
          luc: lucDaFicha(dados),
          nome: nomeDaFicha(dados) || ficha.nome,
          documento: doc.length === 11 || doc.length === 14 ? doc : null,
          respostas: dados,
          assinatura: dados.assinatura || null,
          enviar: comoEnvio,
        }),
      );
    } catch (erro) {
      log.error({ err: erro, ficha: ficha.id }, "ficha pelo link");
      return FALHOU;
    }
    if (resultado === "ok") return null;
    return ehMotivo(resultado) ? inativo(resultado) : FALHOU;
  }

  if (enviar) {
    const problemas = problemasDoEnvio(r, hojeEmBrasilia(new Date()));
    if (r.tipo) {
      const exigidos = (await banco.comoServico(documentosPublicos))[r.tipo];
      for (const d of documentosFaltando(
        exigidos,
        ficha.documentos.map((x) => x.documento),
      ))
        problemas.push({
          campo: `documentos.${d}`,
          pergunta: 0,
          mensagem: `Envie o arquivo: ${d}.`,
        });
    }
    // Envio barrado não perde o que foi digitado: fica como rascunho.
    if (problemas.length) {
      const falha = await gravar(lidas.data, false);
      if (falha) return falha;
      return {
        erro:
          problemas.length === 1
            ? "Falta 1 resposta para enviar. Veja o campo marcado."
            : `Faltam ${problemas.length} respostas para enviar. Veja os campos marcados.`,
        problemas,
      };
    }
    const avisos = avisosDoEnvio(r);
    if (avisos.length && entrada.confirmar !== "1") {
      const falha = await gravar(lidas.data, false);
      return falha ?? { avisos };
    }
  }

  const falha = await gravar(r, enviar);
  if (falha) return falha;
  const nome = nomeDaFicha(r) || ficha.nome;

  if (!enviar)
    return {
      ok: "Rascunho salvo. Use o mesmo link para continuar quando quiser.",
    };
  // O aviso à equipe não muda a resposta ao interessado: sai depois.
  void notificar([ficha.gerada_por], {
    tipo: "ficha_recebida",
    titulo: `Ficha cadastral recebida: ${nome ?? "sem nome"}`,
    texto: r.tipo ? ROTULO_TIPO_CURTO[r.tipo] : undefined,
    href: rotaDaFicha(ficha.id),
    chave: `ficha_recebida:${ficha.id}`,
  });
  return { ok: "Ficha enviada. Obrigado!", enviada: true };
}

// ---------------------------------------------------------------------------
// Documentos comprobatórios
// ---------------------------------------------------------------------------

export const LIMITE_MB = 8;
const ACEITOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const envio = z.object({
  tipo: z.enum(TIPOS_FICHA),
  documento: z.string().trim().min(1).max(200),
  aceite: z.literal("1"),
});

const umValor = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Sobe um documento (troca o anterior do mesmo item da lista). */
export async function enviarDocumento(
  token: string,
  campos: Record<string, string | string[]>,
  arquivo: ArquivoRecebido | undefined,
): Promise<EstadoDoDocumento> {
  const acesso = await fichaPeloToken(token);
  if (!acesso.ok) {
    const e = inativo(acesso.motivo);
    return { erro: e.erro, inativo: e.inativo };
  }
  const { ficha } = acesso;
  const d = envio.safeParse({
    tipo: umValor(campos.tipo),
    documento: umValor(campos.documento),
    aceite: umValor(campos.aceite),
  });
  if (!d.success)
    return d.error.issues[0]?.path[0] === "aceite"
      ? { erro: SEM_ACEITE.erro }
      : { erro: "Escolha o tipo de formulário antes de enviar os documentos." };
  const exigidos = (await banco.comoServico(documentosPublicos))[d.data.tipo];
  const item = exigidos.find((x) => x.documento === d.data.documento);
  if (!item) return { erro: "Documento fora da lista. Recarregue a página." };

  if (!arquivo || arquivo.bytes.length === 0)
    return { erro: "Escolha o arquivo." };
  if (arquivo.bytes.length > LIMITE_MB * 1024 * 1024)
    return {
      erro: `Arquivo maior que ${LIMITE_MB} MB. Envie uma foto ou PDF menor.`,
    };
  const bytes = new Uint8Array(arquivo.bytes);
  const mime = tipoPeloConteudo(bytes.slice(0, BYTES_DO_TIPO));
  const ext = mime ? ACEITOS[mime] : undefined;
  if (!mime || !ext)
    return { erro: "Envie um PDF ou uma foto (JPG, PNG, WEBP ou HEIC)." };

  const path = `fichas/${ficha.id}/${randomUUID()}.${ext}`;
  try {
    await gravarArquivo(BUCKET_COMERCIAL, path, bytes, mime);
  } catch (eUp) {
    log.error({ err: eUp, ficha: ficha.id }, "documento da ficha");
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  const nome =
    arquivo.nome.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 120) ||
    `documento.${ext}`;
  let r: {
    novo: { id: string; documento: string; arquivo_nome: string };
    velhos: string[];
  };
  try {
    r = await banco.comoServico(async (tx) => {
      const antigos = await repo.documentosDoItem(tx, ficha.id, item.documento);
      const novo = await repo.incluirDocumento(tx, {
        ficha_id: ficha.id,
        documento: item.documento,
        arquivo_path: path,
        arquivo_nome: nome,
        tamanho: arquivo.bytes.length,
        tipo_mime: mime,
      });
      if (antigos.length)
        await repo.apagarDocumentos(
          tx,
          antigos.map((v) => v.id),
        );
      if (!ficha.consentimento_em) await repo.marcarConsentimento(tx, ficha.id);
      return { novo, velhos: antigos.map((v) => v.arquivo_path) };
    });
  } catch (erro) {
    log.error({ err: erro, ficha: ficha.id }, "documento da ficha");
    await removerArquivos(BUCKET_COMERCIAL, [path]);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  if (r.velhos.length) await removerArquivos(BUCKET_COMERCIAL, r.velhos);
  return { ok: "Arquivo enviado.", documento: r.novo };
}

/** Tira um documento enviado pelo link. */
export async function removerDocumento(
  token: string,
  id: string,
): Promise<EstadoDoDocumento> {
  const acesso = await fichaPeloToken(token);
  if (!acesso.ok) {
    const e = inativo(acesso.motivo);
    return { erro: e.erro, inativo: e.inativo };
  }
  if (!z.uuid().safeParse(id).success)
    return { erro: "Documento não encontrado." };
  let caminhos: string[];
  try {
    caminhos = (
      await banco.comoServico((tx) =>
        repo.removerDocumento(tx, acesso.ficha.id, id),
      )
    ).map((x) => x.arquivo_path);
  } catch (erro) {
    log.error({ err: erro }, "tirar documento da ficha");
    return { erro: "Não foi possível tirar o arquivo. Tente de novo." };
  }
  if (caminhos.length) await removerArquivos(BUCKET_COMERCIAL, caminhos);
  return { ok: "Arquivo retirado." };
}

// ---------------------------------------------------------------------------
// CEP e CNPJ (perguntas da ficha): só com um link que ainda vale
// ---------------------------------------------------------------------------

export async function consultarCep(
  token: string,
  valor: string,
  origem: Origem,
) {
  if (!(await fichaPeloToken(token)).ok) return null;
  return consultas.consultarCep(valor, origem);
}

export async function consultarCnpj(
  token: string,
  valor: string,
  origem: Origem,
) {
  if (!(await fichaPeloToken(token)).ok) return null;
  return consultas.consultarCnpj(valor, origem);
}
