import { randomBytes, randomUUID } from "node:crypto";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  ConsultaFichas,
  DocumentosPorTipo,
  FichaDaLista,
  OpcaoLuc,
  RespostaDemonstracaoFicha,
  RespostaDetalheFicha,
  RespostaFichas,
  RespostaLinkFicha,
} from "@arp/shared/comercial/contratos/fichas";
import {
  blocosDaFicha,
  caixaAlta,
  documentoDaFicha,
  LUC_NAO_SEI,
  lerRespostas,
  ROTULO_ORIGEM,
  ROTULO_SITUACAO,
  ROTULO_TIPO_CURTO,
  SITUACOES_FICHA,
  type SituacaoFicha,
  TIPOS_FICHA,
  type TipoFicha,
} from "@arp/shared/comercial/ficha";
import {
  COLUNAS_FORMS,
  type FichaImportada,
  type FichasExistentes,
  lerFichasDoForms,
} from "@arp/shared/comercial/ficha-importacao";
import type { EnetLuc } from "@arp/shared/comercial/fontes";
import {
  type Aba,
  type AvisoImportacao,
  type LinhaLida,
  type ResultadoLeitura,
  textoDaCelula,
} from "@arp/shared/comercial/importacao";
import { formatarDocumento } from "@arp/shared/documentos";
import { formatarData, formatarDataHora } from "@arp/shared/formato";
import { paraBrasilia } from "@arp/shared/os/tempo";
import { sql } from "kysely";
import { z } from "zod";
import { env } from "@/config/env";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { linkDeLeitura } from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  contextoCom,
  listas,
  nomesDeUsuarios,
  parametros,
  podeAgora,
} from "./base";
import { gerarPdfDaFicha } from "./ficha-pdf";
import * as repo from "./fichas.repository";
import { dadosEnet } from "./fontes";
import {
  type ContextoGravacao,
  ErroImportacao,
  importador,
} from "./importacoes.service";

// Fichas cadastrais (spec 4.12 e 4.13): a tela interna, o link e a
// importação do Google Forms. A tela lê com a sessão (RLS: a lista para quem
// vê fichas, gera link ou monta contrato; dados, documentos e acessos só com
// comercial.formulario.ver). O token não sai pela sessão: o servidor lê pela
// service role só para quem gera link (conferido agora no banco).

export const BUCKET_COMERCIAL = "comercial";
export const ROTA_FICHAS = "/comercial/fichas";
export const rotaDaFicha = (id: string) => `${ROTA_FICHAS}/${id}`;
export const linkDaFicha = (token: string) => `${env.SITE_URL}/ficha/${token}`;

const SEM_ACESSO = "Você não tem acesso às fichas cadastrais.";
const uuid = /^[0-9a-f-]{36}$/i;

export const ehTipo = (t: string | null): t is TipoFicha =>
  (TIPOS_FICHA as readonly string[]).includes(t ?? "");
const ehSituacao = (s: string): s is SituacaoFicha =>
  (SITUACOES_FICHA as readonly string[]).includes(s);
const situacaoDe = (s: string): SituacaoFicha =>
  ehSituacao(s) ? s : "em_preenchimento";

/** Instante (UTC) → dd/mm/aaaa no dia de Brasília. */
const diaDe = (iso: string) => formatarData(paraBrasilia(new Date(iso)).data);

// ---------------------------------------------------------------------------
// LUCs vagos do ENET (pergunta 3 e "Gerar link")
// ---------------------------------------------------------------------------

export function opcoesDeLuc(lucs: EnetLuc[]): OpcaoLuc[] {
  return lucs
    .filter((l) => l.status === "Vago" && l.abl > 0)
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map((l) => ({
      valor: l.numero,
      rotulo: `${l.numero} — ${l.local}, ${l.piso}`,
    }));
}

// ---------------------------------------------------------------------------
// Documentos exigidos (listas ficha_documento_*)
// ---------------------------------------------------------------------------

const LISTA_DO_TIPO: Record<TipoFicha, string> = {
  pj: "ficha_documento_pj",
  pf: "ficha_documento_pf",
  fiador: "ficha_documento_fiador",
};

const comObrigatorio = z.object({ obrigatorio: z.literal(true) });

export function documentosDasListas(
  l: { lista: string; valor: string; ativo: boolean; extra: unknown }[],
): DocumentosPorTipo {
  const de = (t: TipoFicha) =>
    l
      .filter((x) => x.lista === LISTA_DO_TIPO[t] && x.ativo)
      .map((x) => ({
        documento: x.valor,
        obrigatorio: comObrigatorio.safeParse(x.extra).success,
      }));
  return { pj: de("pj"), pf: de("pf"), fiador: de("fiador") };
}

/** Documentos exigidos pela service role (ficha pública, token já conferido). */
export async function documentosPublicos(tx: Tx): Promise<DocumentosPorTipo> {
  return documentosDasListas(
    await repo.listasDeDocumentos(tx, Object.values(LISTA_DO_TIPO)),
  );
}

// ---------------------------------------------------------------------------
// Lista (/comercial/fichas)
// ---------------------------------------------------------------------------

function exigirFichas(ctx: Contexto) {
  if (
    !pode(ctx, "comercial.formulario.ver") &&
    !pode(ctx, "comercial.formulario.link") &&
    !pode(ctx, "comercial.contratos.editar")
  )
    throw new ErroDePermissao(SEM_ACESSO);
}

function daLista(f: Awaited<ReturnType<typeof repo.lista>>[number]) {
  return {
    ...f,
    tipo: ehTipo(f.tipo) ? f.tipo : null,
    situacao: situacaoDe(f.situacao),
  } satisfies FichaDaLista;
}

export async function lista(
  ctx: Contexto,
  consulta: ConsultaFichas,
): Promise<RespostaFichas> {
  exigirFichas(ctx);
  const c = contextoCom(ctx);
  const gerar = c.pode("comercial.formulario.link");
  const [fichas, validade] = await Promise.all([
    banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.lista(tx, consulta.desde ?? null, consulta.tipo ?? null),
    ),
    gerar ? parametros(ctx).then((p) => p.ficha_validade_dias) : 0,
  ]);
  return {
    hoje: c.hoje,
    dadosDe: c.dadosDe,
    fichas: fichas.map(daLista),
    lucs: gerar ? opcoesDeLuc(dadosEnet(c.hoje).lucs) : null,
    validadeDias: validade,
  };
}

/** "Ver ficha (link público)": a ficha como o interessado vê. */
export async function demonstracao(
  ctx: Contexto,
): Promise<RespostaDemonstracaoFicha> {
  const c = contextoCom(ctx);
  if (
    !c.pode("comercial.formulario.ver") &&
    !c.pode("comercial.formulario.link")
  )
    throw new ErroDePermissao(SEM_ACESSO);
  const [p, todas] = await Promise.all([parametros(ctx), listas(ctx)]);
  return {
    hoje: c.hoje,
    dadosDe: c.dadosDe,
    boasVindas: p.ficha_boas_vindas,
    termoLgpd: p.ficha_termo_lgpd,
    documentos: documentosDasListas(todas),
    lucs: opcoesDeLuc(dadosEnet(c.hoje).lucs),
  };
}

// ---------------------------------------------------------------------------
// Detalhe (/comercial/fichas/:id)
// ---------------------------------------------------------------------------

/** Registra quem abriu, baixou o PDF ou um documento (LGPD), sem travar. */
async function registrarAcesso(
  ctx: Contexto,
  fichaId: string,
  acao: "abriu" | "pdf" | "documento",
) {
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.registrarAcesso(tx, fichaId, acao),
    );
  } catch (erro) {
    log.error({ err: erro }, "acesso à ficha");
  }
}

async function lerDetalhe(ctx: Contexto, id: string, verDados: boolean) {
  if (!uuid.test(id)) return null;
  const lida = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const f = await repo.ficha(tx, id);
    if (!f) return null;
    const [fiadores, principal] = await Promise.all([
      repo.fiadores(tx, id),
      f.ficha_principal_id
        ? repo.nomeDaFicha(tx, f.ficha_principal_id).then((p) => p ?? null)
        : null,
    ]);
    if (!verDados)
      return {
        f,
        fiadores,
        principal,
        dados: null,
        documentos: [],
        acessos: [],
        mesmoDocumento: [],
      };
    const [dados, documentos, acessos] = await Promise.all([
      repo.dados(tx, id),
      repo.documentos(tx, id),
      repo.acessos(tx, id),
    ]);
    const mesmoDocumento = dados?.documento
      ? await repo.mesmoDocumento(tx, dados.documento, id)
      : [];
    return {
      f,
      fiadores,
      principal,
      dados,
      documentos,
      acessos,
      mesmoDocumento,
    };
  });
  return lida;
}

export async function detalhe(
  ctx: Contexto,
  id: string,
): Promise<RespostaDetalheFicha> {
  exigirFichas(ctx);
  const c = contextoCom(ctx);
  const ver = c.pode("comercial.formulario.ver");
  const d = await lerDetalhe(ctx, id, ver);
  if (!d) throw new ErroNaoEncontrado("Ficha não encontrada.");
  // O banco não deixa a sessão ler o token: o servidor lê para quem gera link.
  const token =
    d.f.situacao === "em_preenchimento" &&
    (await podeAgora(ctx, "comercial.formulario.link"))
      ? await banco
          .comoServico((tx) => repo.token(tx, id))
          .then((r) => r?.token ?? null)
      : null;
  const nomes = ver
    ? await nomesDeUsuarios(
        ctx,
        d.acessos.map((a) => a.usuario_id),
        ["comercial.formulario.ver"],
      )
    : new Map<string, string>();
  if (ver) void registrarAcesso(ctx, id, "abriu");
  return {
    hoje: c.hoje,
    dadosDe: c.dadosDe,
    ficha: {
      ...daLista(d.f),
      link: token ? linkDaFicha(token) : null,
      rd_oportunidade: d.f.rd_oportunidade,
      consentimento_em: d.f.consentimento_em,
      usada_em: d.f.usada_em,
      ultimo_acesso_em: d.f.ultimo_acesso_em,
    },
    dados: d.dados
      ? {
          documento: d.dados.documento,
          respostas: lerRespostas(d.dados.respostas),
          assinatura: d.dados.assinatura_nome,
        }
      : null,
    documentos: d.documentos.map((x) => ({
      ...x,
      tamanho: x.tamanho === null ? null : Number(x.tamanho),
    })),
    acessos: d.acessos.map((a) => ({
      em: a.em,
      acao: a.acao,
      nome: nomes.get(a.usuario_id) ?? "Usuário removido",
    })),
    mesmoDocumento: d.mesmoDocumento,
    principal: d.principal,
    fiadores: d.fiadores,
  };
}

/** "Ficha cadastral em PDF": só com comercial.formulario.ver. */
export async function pdf(
  ctx: Contexto,
  id: string,
): Promise<{ bytes: Uint8Array; nome: string }> {
  if (!pode(ctx, "comercial.formulario.ver"))
    throw new ErroDePermissao(SEM_ACESSO);
  const d = await lerDetalhe(ctx, id, true);
  if (!d?.dados)
    throw new ErroNaoEncontrado("Ficha não encontrada ou ainda sem respostas.");
  void registrarAcesso(ctx, id, "pdf");
  const f = daLista(d.f);
  const bytes = await gerarPdfDaFicha({
    titulo: f.nome ?? "Ficha sem nome",
    subtitulo: [
      f.tipo ? ROTULO_TIPO_CURTO[f.tipo] : "Tipo a escolher",
      f.recebida_em
        ? `Recebida em ${formatarDataHora(f.recebida_em)}`
        : ROTULO_SITUACAO[f.situacao],
      `Origem: ${ROTULO_ORIGEM[f.origem] ?? f.origem}`,
    ].join(" · "),
    blocos: blocosDaFicha(lerRespostas(d.dados.respostas)),
    notas: [
      d.f.consentimento_em
        ? `Consentimento LGPD aceito em ${formatarDataHora(d.f.consentimento_em)}.`
        : "Consentimento LGPD ainda não aceito.",
      d.documentos.length
        ? `Documentos enviados: ${d.documentos.map((x) => x.documento).join("; ")}.`
        : "Nenhum documento enviado.",
    ],
    geradoEm: `${formatarDataHora(new Date().toISOString())} por ${ctx.usuario.nome}`,
  });
  const nome = (f.nome ?? "ficha")
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return { bytes, nome: `ficha-cadastral-${nome || "ficha"}.pdf` };
}

/**
 * Documento comprobatório: lê a linha pelo RLS, registra o acesso e devolve
 * um endereço assinado de 5 minutos no bucket privado.
 */
export async function linkDoDocumento(
  ctx: Contexto,
  fichaId: string,
  docId: string,
): Promise<string> {
  if (!pode(ctx, "comercial.formulario.ver"))
    throw new ErroDePermissao(SEM_ACESSO);
  if (!uuid.test(fichaId) || !uuid.test(docId))
    throw new ErroNaoEncontrado("Documento não encontrado.");
  const linha = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.caminhoDoDocumento(tx, fichaId, docId),
  );
  if (!linha) throw new ErroNaoEncontrado("Documento não encontrado.");
  void registrarAcesso(ctx, fichaId, "documento");
  const url = await linkDeLeitura(BUCKET_COMERCIAL, linha.arquivo_path, {
    segundos: 300,
  });
  if (!url)
    throw new ErroNaoEncontrado(
      "O arquivo não está guardado no sistema (ficha de demonstração ou arquivo removido).",
    );
  return url;
}

// ---------------------------------------------------------------------------
// Link: gerar, reenviar, cancelar
// ---------------------------------------------------------------------------

const gerar = z.object({
  luc: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9_.-]*$/, "LUC inválido."),
  tipo: z.enum(TIPOS_FICHA, "Escolha o tipo esperado."),
  nome: z.string().trim().max(150),
  rd: z.string().trim().max(200),
});

const venceEm = (dias: number) =>
  new Date(Date.now() + dias * 86_400_000).toISOString();

// O token não sai pela API (o banco não deixa a sessão ler a coluna): nasce
// aqui e só volta para quem tem comercial.formulario.link.
const novoToken = () => randomBytes(32).toString("hex");

const umValor = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** "Gerar link": link único, com a validade dos parâmetros. */
export async function gerarLink(
  ctx: Contexto,
  form: Formulario,
): Promise<RespostaLinkFicha> {
  const d = gerar.safeParse({
    luc: umValor(form.luc) ?? "",
    tipo: umValor(form.tipo),
    nome: umValor(form.nome) ?? "",
    rd: umValor(form.rd) ?? "",
  });
  if (!d.success)
    throw new ErroDeValidacao(
      d.error.issues[0]?.message ?? "Confira os campos.",
    );
  if (!pode(ctx, "comercial.formulario.link"))
    throw new ErroDePermissao(
      "Você não tem permissão para gerar o link da ficha.",
    );
  const expira = venceEm((await parametros(ctx)).ficha_validade_dias);
  const token = novoToken();
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.incluirLink(tx, {
        token,
        luc: d.data.luc && d.data.luc !== LUC_NAO_SEI ? d.data.luc : null,
        tipo: d.data.tipo,
        nome: d.data.nome ? caixaAlta(d.data.nome) : null,
        rd_oportunidade: d.data.rd || null,
        expira_em: expira,
        gerada_por: ctx.usuario.id,
      }),
    );
  } catch (erro) {
    if (erro instanceof ErroDePermissao)
      throw new ErroDePermissao(
        "Você não tem permissão para gerar o link da ficha.",
      );
    log.error({ err: erro }, "gerar link da ficha");
    throw new ErroDeNegocio("Não foi possível gerar o link. Tente de novo.");
  }
  return {
    mensagem: "Link gerado. Copie e envie ao interessado.",
    link: linkDaFicha(token),
    validoAte: diaDe(expira),
  };
}

const SEM_REENVIO = "Você não tem permissão para reenviar o link.";
const FALHOU_REENVIO = "Não foi possível reenviar. Tente de novo.";

/**
 * "Reenviar": o link volta a valer pela validade dos parâmetros. Link
 * cancelado volta com token novo (quem tinha o antigo não abre mais o que
 * foi salvo); vencido ou ainda valendo continua o mesmo.
 */
export async function reenviar(
  ctx: Contexto,
  id: string,
): Promise<RespostaLinkFicha> {
  if (!uuid.test(id)) throw new ErroNaoEncontrado("Ficha não encontrada.");
  if (!pode(ctx, "comercial.formulario.link"))
    throw new ErroDePermissao(SEM_REENVIO);
  const expira = venceEm((await parametros(ctx)).ficha_validade_dias);
  let token = novoToken();
  let renovada: boolean;
  try {
    renovada = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const cancelada = await repo.reabrirCancelado(tx, id, expira, token);
      if (cancelada.length) return true;
      const mudou = await repo.renovar(tx, id, expira);
      if (!mudou.length)
        throw new ErroDeNegocio(
          "Só o link de ficha ainda não enviada pode ser reenviado.",
        );
      return false;
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) throw erro;
    if (erro instanceof ErroDePermissao) throw new ErroDePermissao(SEM_REENVIO);
    log.error({ err: erro }, "reenviar link da ficha");
    throw new ErroDeNegocio(FALHOU_REENVIO);
  }
  if (!renovada) {
    if (!(await podeAgora(ctx, "comercial.formulario.link")))
      throw new ErroDePermissao(SEM_REENVIO);
    const atual = await banco
      .comoServico((tx) => repo.token(tx, id))
      .catch((erro: unknown) => {
        log.error({ err: erro }, "token da ficha");
        return undefined;
      });
    if (!atual) throw new ErroDeNegocio(FALHOU_REENVIO);
    token = atual.token;
  }
  return {
    mensagem: `Link valendo até ${diaDe(expira)}. Copie e envie de novo.`,
    link: linkDaFicha(token),
    validoAte: diaDe(expira),
  };
}

/** "Cancelar link": quem abrir vê que o link foi cancelado. */
export async function cancelar(ctx: Contexto, id: string): Promise<string> {
  if (!uuid.test(id)) throw new ErroNaoEncontrado("Ficha não encontrada.");
  const SEM = "Você não tem permissão para cancelar o link.";
  if (!pode(ctx, "comercial.formulario.link")) throw new ErroDePermissao(SEM);
  let mudou: { id: string }[];
  try {
    mudou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.cancelar(tx, id),
    );
  } catch (erro) {
    if (erro instanceof ErroDePermissao) throw new ErroDePermissao(SEM);
    log.error({ err: erro }, "cancelar link da ficha");
    throw new ErroDeNegocio("Não foi possível cancelar. Tente de novo.");
  }
  if (!mudou.length)
    throw new ErroDeNegocio("Este link já foi enviado ou cancelado.");
  return "Link cancelado.";
}

// ---------------------------------------------------------------------------
// Importação do Google Forms cadastral (Configurações › Importações)
// ---------------------------------------------------------------------------

async function fichasComOsDocumentos(
  ctx: Contexto,
  docs: string[],
): Promise<FichasExistentes> {
  const mapa: FichasExistentes = new Map();
  const unicos = [...new Set(docs.filter(Boolean))];
  if (!unicos.length) return mapa;
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    for (let i = 0; i < unicos.length; i += 200)
      for (const d of await repo.fichasComOsDocumentos(
        tx,
        unicos.slice(i, i + 200),
      ))
        if (d.documento && !mapa.has(d.documento))
          mapa.set(d.documento, { id: d.id, nome: d.nome });
  });
  return mapa;
}

const COLUNAS_PREVIA = ["Envio", "Tipo", "Nome", "CPF/CNPJ", "Imóvel"];

/** Leitor do tipo "fichas": a planilha do Forms na primeira aba. */
async function lerFichasDoArquivo(
  ctx: Contexto,
  abas: Aba[],
): Promise<ResultadoLeitura<FichaImportada | null>> {
  const aba = abas[0];
  if (!aba || aba.linhas.length < 2)
    return { erro: "O arquivo não tem respostas." };
  const semMapa = lerFichasDoForms(aba.linhas, new Map());
  const r = semMapa.ok
    ? lerFichasDoForms(
        aba.linhas,
        await fichasComOsDocumentos(
          ctx,
          semMapa.previa.fichas.map((f) => f.documento),
        ),
      )
    : semMapa;
  if (!r.ok) {
    if (!r.cabecalho.length) return { erro: r.erro };
    return {
      cabecalho: {
        aba: aba.nome,
        esperado: COLUNAS_FORMS.map((c) => c.titulo),
        recebido: (aba.linhas[0] ?? []).map(textoDaCelula),
        faltam: r.cabecalho
          .filter((p) => p.esperado !== "(nenhuma)")
          .map((p) => `Coluna ${p.coluna}: ${p.esperado} (veio "${p.veio}")`),
        sobram: r.cabecalho
          .filter((p) => p.esperado === "(nenhuma)")
          .map((p) => `Coluna ${p.coluna}: ${p.veio}`),
        foraDeOrdem: false,
      },
    };
  }
  const p = r.previa;
  const linhas: LinhaLida<FichaImportada | null>[] = [
    ...p.fichas.map((f) => ({
      linha: f.linha,
      valores: [
        formatarDataHora(f.enviadaEm),
        ROTULO_TIPO_CURTO[f.tipo],
        f.nome,
        formatarDocumento(f.documento),
        f.luc ?? "Ainda não sei",
      ],
      duplicada: f.duplicada,
      entra: true,
      avisos: f.avisos,
      dados: f,
    })),
    ...p.ignoradas.map((x) => ({
      linha: x.linha,
      valores: ["", "", "", "", ""],
      duplicada: false,
      entra: false,
      avisos: [x.texto],
      dados: null,
    })),
  ].sort((a, b) => a.linha - b.linha);
  // A ficha atual com o mesmo CPF/CNPJ vai com o link (a linha já tem o aviso).
  const avisos: AvisoImportacao[] = p.fichas.flatMap((f) =>
    f.fichaExistente
      ? [
          {
            linha: f.linha,
            mensagem: "Ver a ficha atual com o mesmo CPF ou CNPJ.",
            href: rotaDaFicha(f.fichaExistente),
          },
        ]
      : [],
  );
  return { ok: { colunas: COLUNAS_PREVIA, linhas, avisos } };
}

/**
 * Roda `fn` com a service role dentro da transação da confirmação e volta
 * ao papel da sessão. Só depois de a importação comum conferir
 * comercial.pode_importar no banco (o RLS não deixa a sessão criar ficha
 * já recebida nem rodada fechada do Censo).
 */
export async function comoServicoNaTransacao<T>(
  tx: Tx,
  fn: () => Promise<T>,
): Promise<T> {
  await sql`select set_config('role', 'service_role', true)`.execute(tx);
  const r = await fn();
  await sql`select set_config('role', 'authenticated', true)`.execute(tx);
  return r;
}

async function gravarFichas(
  linhas: LinhaLida<FichaImportada | null>[],
  g: ContextoGravacao,
): Promise<number> {
  const fichas = linhas
    .map((l) => l.dados)
    .filter((f): f is FichaImportada => f !== null)
    .map((f) => ({ id: randomUUID(), f }));
  if (!fichas.length) throw new ErroImportacao("Nenhuma ficha para importar.");
  await comoServicoNaTransacao(g.tx, async () => {
    for (let i = 0; i < fichas.length; i += 200) {
      const lote = fichas.slice(i, i + 200);
      await repo.incluirFichasImportadas(
        g.tx,
        lote.map(({ id, f }) => ({
          id,
          tipo: f.tipo,
          situacao: "recebida",
          luc: f.luc,
          nome: f.nome || null,
          origem: "google_forms",
          gerada_por: g.usuarioId,
          gerada_em: f.enviadaEm,
          iniciada_em: f.enviadaEm,
          consentimento_em: f.enviadaEm,
          recebida_em: f.enviadaEm,
          importacao_id: g.importacaoId,
        })),
      );
      await repo.incluirDadosImportados(
        g.tx,
        lote.map(({ id, f }) => {
          const doc = documentoDaFicha(f.respostas);
          return {
            ficha_id: id,
            documento:
              f.documento ||
              (doc.length === 11 || doc.length === 14 ? doc : null),
            respostas: JSON.stringify(f.respostas),
            assinatura_nome: f.assinatura || null,
          };
        }),
      );
    }
  });
  return fichas.length;
}

/** Grava as fichas do Forms (origem "Google Forms", situação "Recebida"). */
export const importadorFichas = importador<FichaImportada | null>(
  (ctx, abas) => lerFichasDoArquivo(ctx, abas),
  gravarFichas,
);
