import { randomBytes } from "node:crypto";
import {
  ANEXO_MAX_BYTES,
  colunasDoContrato,
  type DadosContrato,
  distratoSemValores,
  esquemaContrato,
  esquemaDistrato,
  fisicaDaVistoria,
  type Garantia,
  lerDados,
  lerDistrato,
  manterValores,
  mimeDoAnexo,
  nomeDoArquivo,
  type ParametrosContrato,
  type StatusContrato,
  semValores,
  TIPOS_ANEXO,
  type TipoAnexo,
  type TipoContrato,
  type TipoParte,
  TOTAL_ETAPAS,
} from "@arp/shared/comercial/contrato";
import {
  type ContextoRevisao,
  lerObrigatorios,
  pendencias,
  resumoDasPendencias,
} from "@arp/shared/comercial/contrato-revisao";
import type { Parametros } from "@arp/shared/comercial/contratos/base";
import type {
  AnexoDoContrato,
  ContratoEnetParaDistrato,
  DocumentoDoKitContrato,
  EntradaSalvarContrato,
  EntradaSalvarDistrato,
  FichaParaContrato,
  LinhaContrato,
  RespostaApoioContrato,
  RespostaContrato,
  RespostaContratosEnet,
  RespostaFichaCarregada,
  RespostaGravacao,
  RespostaListaContratos,
  RespostaVistoriaPuxada,
  VersaoDoContrato,
  VistoriaDoLuc,
} from "@arp/shared/comercial/contratos/contratos";
import { somarDias } from "@arp/shared/comercial/datas";
import { ativoEm } from "@arp/shared/comercial/fontes";
import { blocoDoLuc, itensDoKit } from "@arp/shared/comercial/kit";
import { EVENTOS, type Evento } from "@arp/shared/historico";
import { rotaVistoria } from "@arp/shared/os/rotas";
import { paraBrasilia } from "@arp/shared/os/tempo";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import {
  infoDoArquivo,
  linkDeLeitura,
  prepararEnvio,
  removerArquivos,
} from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import {
  contextoCom,
  exigirUma,
  nomesDeUsuarios,
  parametros,
  podeAgora,
} from "./base";
import * as repo from "./contratos.repository";
import { dadosEnet } from "./fontes";

// Contratos e distratos (spec 4.11): lista, o contrato do assistente, o
// histórico de versões, os anexos, o kit do LUC, as fichas para a etapa
// Partes e os dados do ENET. Tudo pela sessão (RLS de comercial.contratos.*);
// rascunho e etapas também: o RLS confere comercial.contratos.editar e os
// gatilhos do banco registram quem alterou e quando (contrato_versoes). Nada
// vai para o ENET. Sem comercial.valores.ver, o aluguel e os valores de
// `dados` não saem da API; ao gravar, os que já estavam continuam.

export const BUCKET_COMERCIAL = "comercial";

const VEEM: (
  | "comercial.contratos.ver"
  | "comercial.contratos.editar"
  | "comercial.contratos.gerar"
)[] = [
  "comercial.contratos.ver",
  "comercial.contratos.editar",
  "comercial.contratos.gerar",
];

const SEM_PERMISSAO = "Você não tem permissão para editar contratos.";
const OUTRA_PESSOA =
  "Outra pessoa salvou este contrato enquanto você editava. Recarregue a tela para ver a versão nova (o que você digitou continua aqui até recarregar).";
const NAO_SALVOU = "Não foi possível salvar. Tente de novo.";

/** Quem vê ou mexe em contratos (a tela de Contratos). */
export function exigirVer(ctx: Contexto): void {
  if (!VEEM.some((p) => pode(ctx, p))) throw new ErroDePermissao();
}

function exigirEditar(ctx: Contexto): void {
  if (!pode(ctx, "comercial.contratos.editar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

async function exigirEditarAgora(ctx: Contexto): Promise<void> {
  if (!(await podeAgora(ctx, "comercial.contratos.editar")))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

/** Erro do banco que não é de regra (nem permissão) vira a mensagem de antes. */
function traduzir(e: unknown, onde: string): never {
  if (e instanceof ErroDaApi) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    throw e;
  }
  log.error({ err: e }, onde);
  throw new ErroDeNegocio(NAO_SALVOU);
}

type EventoContrato =
  | "contrato_salvo"
  | "contrato_pronto"
  | "distrato_salvo"
  | "contrato_anexo"
  | "contrato_anexo_removido";

/** Evento no histórico do sistema; o antes e depois fica em contrato_versoes. */
function registrar(
  evento: EventoContrato,
  ctx: Contexto,
  detalhes: Record<string, JsonValue | undefined>,
) {
  const e: Evento = `comercial_${evento}`;
  registrarDepois({
    modulo: "comercial",
    evento: e,
    descricao: EVENTOS[e],
    usuarioId: ctx.usuario.id,
    detalhes,
  });
}

/** Campos dos parâmetros que o assistente usa. */
export function parametrosDoContrato(p: Parametros): ParametrosContrato {
  return {
    empreendimento_nome: p.empreendimento_nome,
    endereco_cep: p.endereco_cep,
    endereco_logradouro: p.endereco_logradouro,
    endereco_numero: p.endereco_numero,
    endereco_complemento: p.endereco_complemento,
    endereco_bairro: p.endereco_bairro,
    endereco_cidade: p.endereco_cidade,
    endereco_uf: p.endereco_uf,
    indice_padrao: p.indice_padrao,
    dia_vencimento_padrao: p.dia_vencimento_padrao,
    caucao_alugueis: p.caucao_alugueis,
    caucao_prazo_dias: p.caucao_prazo_dias,
    capitalizacao_prazo_dias: p.capitalizacao_prazo_dias,
    nc004_versao: p.nc004_versao,
    obras_tapume_dias: p.obras_tapume_dias,
    obras_retirada_dias: p.obras_retirada_dias,
    obras_projetos_dias: p.obras_projetos_dias,
    multa_alugueis: p.multa_alugueis,
    vaga_promocional_padrao: p.vaga_promocional_padrao,
    consumo_agua_padrao: p.consumo_agua_padrao,
    entrega_tipo_imovel: p.entrega_tipo_imovel,
    entrega_padrao: p.entrega_padrao,
    entrega_prazo_implantacao_dias: p.entrega_prazo_implantacao_dias,
  };
}

/** Obrigatórios por garantia (parâmetros) e os anexos já enviados. */
async function contextoDaRevisao(
  ctx: Contexto,
  anexos: TipoAnexo[],
): Promise<ContextoRevisao> {
  const p = await parametros(ctx);
  return { obrigatorios: lerObrigatorios(p.obrigatorios_garantia), anexos };
}

/** Nome de quem alterou (ids que a pessoa já vê nos contratos). */
const nomesDe = (ctx: Contexto, ids: (string | null)[]) =>
  nomesDeUsuarios(ctx, ids, [
    "comercial.contratos.ver",
    "comercial.contratos.editar",
  ]);

/**
 * Aluguel e dados (com os valores) dos contratos. O banco não deixa a sessão
 * ler essas colunas: a service role lê só ids que a sessão acabou de ver pelo
 * RLS do contrato, depois de conferir a permissão agora. Quem chama tira os
 * valores sem comercial.valores.ver.
 */
async function dadosGuardados(
  ctx: Contexto,
  ids: string[],
): Promise<Map<string, { aluguel: number | null; dados: unknown }>> {
  const mapa = new Map<string, { aluguel: number | null; dados: unknown }>();
  const unicos = [...new Set(ids)];
  if (!unicos.length) return mapa;
  try {
    await exigirUma(ctx, VEEM);
  } catch (e) {
    if (e instanceof ErroDePermissao) return mapa;
    throw e;
  }
  const linhas = await banco.comoServico((tx) => repo.guardados(tx, unicos));
  for (const c of linhas)
    mapa.set(c.id, { aluguel: c.aluguel, dados: c.dados });
  return mapa;
}

const ehTipoAnexo = (t: string): t is TipoAnexo => t in TIPOS_ANEXO;
const ehStatus = (s: string): s is StatusContrato =>
  s === "rascunho" || s === "pronto" || s === "gerado";
const statusDe = (s: string): StatusContrato => (ehStatus(s) ? s : "rascunho");
const tipoDe = (t: string): TipoContrato =>
  t === "distrato" ? "distrato" : "contrato";
const parteDe = (p: string | null): TipoParte | null =>
  p === "pf" || p === "pj" ? p : null;
const GARANTIAS_VALIDAS: readonly string[] = [
  "fiador",
  "capitalizacao",
  "seguro_fianca",
  "caucao",
  "sem_garantia",
];
const ehGarantia = (g: string): g is Garantia => GARANTIAS_VALIDAS.includes(g);
const garantiaDe = (g: string | null): Garantia | null =>
  g && ehGarantia(g) ? g : null;

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export async function lista(
  ctx: Contexto,
  atualizacao: "30" | "90" | "365" | "todos",
): Promise<RespostaListaContratos> {
  exigirVer(ctx);
  const { pode: p, hoje, dadosDe } = contextoCom(ctx);
  const desde =
    atualizacao === "todos"
      ? null
      : `${somarDias(hoje, -Number(atualizacao))}T00:00:00-03:00`;
  const valores = p("comercial.valores.ver");
  const brutas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.lista(tx, desde),
  );
  const nomes = await nomesDe(
    ctx,
    brutas.map((l) => l.atualizado_por),
  );
  const guardados = valores
    ? await dadosGuardados(
        ctx,
        brutas.map((l) => l.id),
      )
    : null;
  const linhas: LinhaContrato[] = brutas.map((l) => ({
    id: l.id,
    tipo: tipoDe(l.tipo),
    status: statusDe(l.status),
    versao: l.versao,
    lucs: l.lucs,
    bloco: l.bloco,
    locatario: l.locatario_nome,
    parte: parteDe(l.parte_tipo),
    garantia: garantiaDe(l.garantia),
    aluguel: guardados?.get(l.id)?.aluguel ?? null,
    atualizadoEm: l.atualizado_em,
    atualizadoPor: l.atualizado_por
      ? (nomes.get(l.atualizado_por) ?? null)
      : null,
    geradoEm: l.gerado_em,
    exemplo: l.exemplo,
  }));
  return { hoje, dadosDe, linhas };
}

// ---------------------------------------------------------------------------
// Apoio do assistente: parâmetros, LUCs, fichas e kit
// ---------------------------------------------------------------------------

/** LUCs do ENET para a busca da etapa Imóvel (sem as áreas publicitárias). */
function lucsParaContrato(hoje: string) {
  const enet = dadosEnet(hoje);
  return {
    exemplo: enet.exemplo,
    lucs: enet.lucs
      .filter((l) => l.abl > 0)
      .map((l) => ({
        numero: l.numero,
        local: l.local,
        piso: l.piso,
        tipo: l.tipo_loja,
        abl: l.abl,
        status: l.status,
        rua: l.rua,
      }))
      .sort((a, b) => a.numero.localeCompare(b.numero)),
  };
}

const tipoDaFicha = (t: string | null): FichaParaContrato["tipo"] | null =>
  t === "pj" || t === "pf" || t === "fiador" ? t : null;

/** Fichas recebidas (e já usadas), para escolher na etapa Partes. */
async function fichasParaContrato(ctx: Contexto): Promise<FichaParaContrato[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, repo.fichasRecebidas);
  return linhas.flatMap((f) => {
    const tipo = tipoDaFicha(f.tipo);
    return tipo
      ? [
          {
            id: f.id,
            tipo,
            nome: f.nome ?? "(sem nome)",
            luc: f.luc,
            data: paraBrasilia(new Date(f.recebida_em ?? f.gerada_em)).data,
            situacao: f.situacao,
          },
        ]
      : [];
  });
}

/** Documentos do kit com a versão atual (o que o assistente lista). */
export async function documentosDoKit(ctx: Contexto) {
  return banco.comoUsuario(ctx.usuario.id, repo.documentosDoKit);
}

export async function apoio(ctx: Contexto): Promise<RespostaApoioContrato> {
  exigirVer(ctx);
  const { pode: p, hoje, dadosDe } = contextoCom(ctx);
  const params = await parametros(ctx);
  const { lucs, exemplo } = lucsParaContrato(hoje);
  const fichas = p("comercial.contratos.editar")
    ? await fichasParaContrato(ctx)
    : [];
  const kit = await documentosDoKit(ctx);
  return {
    hoje,
    dadosDe,
    parametros: parametrosDoContrato(params),
    obrigatorios: params.obrigatorios_garantia,
    lucs,
    exemplo,
    fichas,
    kit: kit.map(
      (d): DocumentoDoKitContrato => ({
        documentoId: d.id,
        nome: d.nome,
        ativo: d.ativo,
        todo_contrato: d.todo_contrato,
        blocos: d.blocos,
        ordem: d.ordem,
        versaoId: d.versao_id,
        versao: d.versao,
        validade: d.validade,
      }),
    ),
  };
}

/** Bloco do contrato (o do primeiro LUC), como no Kit: "11", "Casarão". */
function blocoDosLucs(lucs: string[], hoje: string): string | null {
  if (!lucs.length) return null;
  const l = dadosEnet(hoje).lucs.find((x) => x.numero === lucs[0]);
  return l ? blocoDoLuc(l) : null;
}

/** Versões do kit dos LUCs: os de todo contrato + mapas de cada bloco. */
async function versoesDoKit(
  ctx: Contexto,
  lucs: string[],
  hoje: string,
): Promise<string[]> {
  const enet = dadosEnet(hoje);
  const blocos = [
    ...new Set(
      lucs.map((n) => {
        const l = enet.lucs.find((x) => x.numero === n);
        return l ? blocoDoLuc(l) : null;
      }),
    ),
  ];
  const docs = await documentosDoKit(ctx);
  const versoes = new Map<string, string>();
  for (const b of blocos.length ? blocos : [null])
    for (const d of itensDoKit(docs, b))
      if (d.versao_id) versoes.set(d.id, d.versao_id);
  return [...versoes.values()];
}

// ---------------------------------------------------------------------------
// Um contrato
// ---------------------------------------------------------------------------

const lucValido = (l: string) => /^[A-Za-z0-9_-]{1,30}$/.test(l);

/**
 * Última vistoria (entrada ou saída) do LUC no Tickets. Lida pela service
 * role depois de conferir no banco que a pessoa usa os contratos.
 */
async function vistoriaDoLuc(
  ctx: Contexto,
  lucs: string[],
  tipo: "entrada" | "saida",
): Promise<VistoriaDoLuc | null> {
  const validos = lucs.filter(lucValido);
  if (!validos.length) return null;
  const acesso =
    (await podeAgora(ctx, "comercial.contratos.editar")) ||
    (await podeAgora(ctx, "comercial.contratos.ver"));
  if (!acesso) return null;
  const v = await banco.comoServico((tx) =>
    repo.ultimaVistoria(tx, validos, tipo),
  );
  return v ? { ...v, href: rotaVistoria(v.id) } : null;
}

export async function vistoria(
  ctx: Contexto,
  luc: string,
  tipo: "entrada" | "saida",
): Promise<VistoriaDoLuc | null> {
  exigirVer(ctx);
  return vistoriaDoLuc(ctx, [luc], tipo);
}

export async function contrato(
  ctx: Contexto,
  id: string,
): Promise<RespostaContrato> {
  exigirVer(ctx);
  const { pode: p, hoje, dadosDe } = contextoCom(ctx);
  const lidos = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    c: await repo.contrato(tx, id),
    anexos: await repo.anexos(tx, id),
    versoes: await repo.versoes(tx, id),
  }));
  const { c } = lidos;
  if (!c) throw new ErroNaoEncontrado("Contrato não encontrado.");
  const valores = p("comercial.valores.ver");
  const guardados = await dadosGuardados(ctx, [c.id]);
  const bruto = guardados.get(c.id)?.dados ?? {};
  const tipo = tipoDe(c.tipo);
  const dados =
    tipo === "distrato"
      ? valores
        ? lerDistrato(bruto)
        : distratoSemValores(lerDistrato(bruto))
      : valores
        ? lerDados(bruto)
        : semValores(lerDados(bruto));
  const nomes = await nomesDe(ctx, [
    c.atualizado_por,
    ...lidos.anexos.map((a) => a.enviado_por),
    ...lidos.versoes.map((v) => v.por),
  ]);
  const nome = (u: string | null) => (u ? (nomes.get(u) ?? null) : null);
  const anexos: AnexoDoContrato[] = lidos.anexos.flatMap((a) =>
    ehTipoAnexo(a.tipo)
      ? [
          {
            id: a.id,
            tipo: a.tipo,
            nome: a.arquivo_nome,
            tamanho: a.tamanho,
            enviadoEm: a.enviado_em,
            enviadoPor: nome(a.enviado_por),
          },
        ]
      : [],
  );
  const versoes: VersaoDoContrato[] = lidos.versoes.map((v) => ({
    id: v.id,
    versao: v.versao,
    status: statusDe(v.status),
    etapa: v.etapa_atual,
    por: nome(v.por),
    em: v.em,
  }));
  const luc = tipo === "distrato" ? lerDistrato(bruto).luc : "";
  return {
    hoje,
    dadosDe,
    contrato: {
      id: c.id,
      tipo,
      status: statusDe(c.status),
      versao: c.versao,
      etapaAtual: c.etapa_atual,
      atualizadoEm: c.atualizado_em,
      atualizadoPor: nome(c.atualizado_por),
      exemplo: c.exemplo,
      contratoEnet: c.contrato_enet_id,
      dados,
    },
    anexos,
    versoes,
    vistoriaSaida:
      tipo === "distrato"
        ? await vistoriaDoLuc(ctx, luc ? [luc] : [], "saida")
        : null,
  };
}

/** Contratos ativos do ENET, para escolher de qual sai o distrato. */
export async function contratosParaDistrato(
  ctx: Contexto,
): Promise<RespostaContratosEnet> {
  exigirEditar(ctx);
  const { hoje, dadosDe } = contextoCom(ctx);
  const enet = dadosEnet(hoje);
  const p = await parametros(ctx);
  const clientes = new Map(enet.clientes.map((c) => [c.codigo, c]));
  const lucs = new Map(enet.lucs.map((l) => [l.numero, l]));
  const contratos: ContratoEnetParaDistrato[] = enet.contratos
    .filter((c) => ativoEm(c, hoje))
    .map((c) => {
      const cli = clientes.get(c.cliente);
      const l = lucs.get(c.luc);
      return {
        codigo: c.codigo,
        luc: c.luc,
        bloco: l?.local ?? "",
        locatario: c.locatario,
        documento: cli?.cpf_cnpj ?? "",
        tipoPessoa: cli?.tipo_pessoa ?? "PJ",
        inicio: c.data_inicio,
        // Determinado vencido segue por prazo indeterminado.
        termino: c.data_termino,
        indeterminado:
          c.prazo === "Indeterminado" ||
          (c.data_termino !== null && c.data_termino < hoje),
        rua: l?.rua ?? "",
      };
    })
    .sort((a, b) => a.luc.localeCompare(b.luc));
  return {
    hoje,
    dadosDe,
    contratos,
    exemplo: enet.exemplo,
    endereco: {
      logradouro: p.endereco_logradouro,
      numero: p.endereco_numero,
      bairro: p.endereco_bairro,
      cidade: p.endereco_cidade,
      uf: p.endereco_uf,
    },
  };
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

async function tiposDosAnexos(
  ctx: Contexto,
  contratoId: string,
): Promise<TipoAnexo[]> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.tiposDosAnexos(tx, contratoId),
  );
  return [...new Set(linhas.map((a) => a.tipo).filter(ehTipoAnexo))];
}

function respostaDe(
  mensagem: string,
  r: { id: string; atualizado_em: string; status: string; versao: number },
): RespostaGravacao {
  return {
    mensagem,
    id: r.id,
    atualizadoEm: r.atualizado_em,
    status: statusDe(r.status),
    versao: r.versao,
  };
}

export async function salvarContrato(
  ctx: Contexto,
  e: EntradaSalvarContrato,
): Promise<RespostaGravacao> {
  const lido = esquemaContrato.safeParse(e.dados);
  if (!lido.success || e.etapa < 1 || e.etapa > TOTAL_ETAPAS)
    throw new ErroDeNegocio(
      `Algum campo está fora do formato (${lido.success ? "etapa" : (lido.error.issues[0]?.path.join(" › ") ?? "dados")}). Confira e salve de novo.`,
    );
  exigirEditar(ctx);
  const { id: contratoId, etapa } = e;
  const { pode: p, hoje } = contextoCom(ctx);
  let dados: DadosContrato = lido.data;

  let statusAtual: StatusContrato = "rascunho";
  let fichaAtual: string | null = null;
  if (contratoId) {
    const atual = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.contrato(tx, contratoId),
    );
    if (!atual || atual.tipo !== "contrato")
      throw new ErroDeNegocio("Contrato não encontrado.");
    if (!e.lido || atual.atualizado_em !== e.lido)
      throw new ErroDeConflito(OUTRA_PESSOA);
    statusAtual = statusDe(atual.status);
    fichaAtual = atual.ficha_id;
    if (!p("comercial.valores.ver"))
      dados = manterValores(
        dados,
        lerDados(
          (await dadosGuardados(ctx, [contratoId])).get(contratoId)?.dados,
        ),
      );
  }
  // A ficha escolhida tem que já ter sido recebida e ser visível (o gatilho a marca como usada).
  const fichaId = dados.partes.ficha_id;
  if (fichaId && fichaId !== fichaAtual) {
    const ficha = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.situacaoDaFicha(tx, fichaId),
    );
    if (ficha?.situacao !== "recebida" && ficha?.situacao !== "usada")
      throw new ErroDeNegocio(
        "A ficha escolhida não foi encontrada ou ainda não foi recebida. Escolha outra na etapa Partes.",
      );
  }

  const bloco = blocoDosLucs(dados.imovel.lucs, hoje);
  const anexos = contratoId ? await tiposDosAnexos(ctx, contratoId) : [];
  const faltam = pendencias(dados, await contextoDaRevisao(ctx, anexos));
  // Pronto continua pronto se nada falta; gerado editado abre a versão seguinte.
  const status: StatusContrato =
    statusAtual === "pronto" && !faltam.length ? "pronto" : "rascunho";
  const linha = {
    ...colunasDoContrato(dados, bloco),
    etapa_atual: etapa,
    status,
    dados: JSON.stringify(dados),
    ficha_id: dados.partes.ficha_id,
  };
  const kit =
    status === "rascunho"
      ? await versoesDoKit(ctx, dados.imovel.lucs, hoje)
      : null;

  let r: Awaited<ReturnType<typeof repo.incluir>>;
  try {
    r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const gravado = contratoId
        ? await repo.alterar(tx, contratoId, e.lido ?? "", linha)
        : await repo.incluir(tx, { ...linha, tipo: "contrato" });
      if (gravado && kit) await repo.guardarKit(tx, gravado.id, kit);
      return gravado;
    });
  } catch (erro) {
    traduzir(erro, "salvar contrato");
  }
  if (!r)
    throw contratoId
      ? new ErroDeConflito(OUTRA_PESSOA)
      : new ErroDePermissao(SEM_PERMISSAO);

  registrar("contrato_salvo", ctx, { contrato: r.id, etapa, status });
  return respostaDe(
    statusAtual === "pronto" && status === "rascunho"
      ? "Rascunho salvo. Faltou algum obrigatório: o contrato voltou a rascunho."
      : statusAtual === "gerado"
        ? "Rascunho salvo como nova versão; a anterior ficou no histórico."
        : "Rascunho salvo.",
    r,
  );
}

/** Marcar "Pronto para gerar" (V1; Word e PDF a partir da V2). */
export async function marcarPronto(
  ctx: Contexto,
  id: string,
  lido: string,
): Promise<RespostaGravacao> {
  exigirEditar(ctx);
  const { hoje } = contextoCom(ctx);
  const atual = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.contrato(tx, id),
  );
  if (!atual || atual.tipo !== "contrato")
    throw new ErroDeNegocio("Contrato não encontrado.");
  if (atual.atualizado_em !== lido) throw new ErroDeConflito(OUTRA_PESSOA);
  if (atual.status !== "rascunho")
    throw new ErroDeNegocio("Este contrato já está pronto para gerar.");
  const dados = lerDados((await dadosGuardados(ctx, [id])).get(id)?.dados);
  const faltam = pendencias(
    dados,
    await contextoDaRevisao(ctx, await tiposDosAnexos(ctx, id)),
  );
  if (faltam.length)
    throw new ErroDeNegocio(
      `Geração bloqueada — faltam: ${resumoDasPendencias(faltam)}.`,
    );
  const kit = await versoesDoKit(ctx, atual.lucs, hoje);
  let r: Awaited<ReturnType<typeof repo.alterar>>;
  try {
    r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const gravado = await repo.alterar(tx, id, lido, {
        status: "pronto",
        etapa_atual: TOTAL_ETAPAS,
      });
      if (gravado) await repo.guardarKit(tx, id, kit);
      return gravado;
    });
  } catch (erro) {
    traduzir(erro, "marcar pronto");
  }
  if (!r) throw new ErroDeConflito(OUTRA_PESSOA);
  registrar("contrato_pronto", ctx, { contrato: r.id });
  return respostaDe("Contrato marcado como pronto para gerar.", r);
}

export async function salvarDistrato(
  ctx: Contexto,
  e: EntradaSalvarDistrato,
): Promise<RespostaGravacao> {
  const lido = esquemaDistrato.safeParse(e.dados);
  if (!lido.success)
    throw new ErroDeNegocio(
      "Algum campo está fora do formato. Confira e salve de novo.",
    );
  exigirEditar(ctx);
  const { id: distratoId } = e;
  const { pode: p, hoje } = contextoCom(ctx);
  let dados = lido.data;
  if (distratoId) {
    const atual = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.contrato(tx, distratoId),
    );
    if (!atual || atual.tipo !== "distrato")
      throw new ErroDeNegocio("Distrato não encontrado.");
    if (!e.lido || atual.atualizado_em !== e.lido)
      throw new ErroDeConflito(OUTRA_PESSOA);
    if (!p("comercial.valores.ver"))
      dados = {
        ...dados,
        pendencias: lerDistrato(
          (await dadosGuardados(ctx, [distratoId])).get(distratoId)?.dados,
        ).pendencias,
      };
  }
  const linha = {
    lucs: dados.luc ? [dados.luc] : [],
    bloco: blocoDosLucs(dados.luc ? [dados.luc] : [], hoje),
    locatario_nome: dados.locatario.trim() || null,
    parte_tipo:
      dados.documento.length === 14
        ? "pj"
        : dados.documento.length === 11
          ? "pf"
          : null,
    inicio: dados.inicio || null,
    termino: dados.termino || null,
    contrato_enet_id: dados.contrato_enet || null,
    dados: JSON.stringify(dados),
    status: "rascunho",
  };
  let r: Awaited<ReturnType<typeof repo.incluir>>;
  try {
    r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      distratoId
        ? repo.alterar(tx, distratoId, e.lido ?? "", linha)
        : repo.incluir(tx, { ...linha, tipo: "distrato" }),
    );
  } catch (erro) {
    traduzir(erro, "salvar distrato");
  }
  if (!r)
    throw distratoId
      ? new ErroDeConflito(OUTRA_PESSOA)
      : new ErroDePermissao(SEM_PERMISSAO);
  registrar("distrato_salvo", ctx, { contrato: r.id });
  return respostaDe("Distrato salvo como rascunho.", r);
}

// ---------------------------------------------------------------------------
// Ficha cadastral → etapa Partes (dados pessoais: só com a permissão de fichas)
// ---------------------------------------------------------------------------

export async function carregarFicha(
  ctx: Contexto,
  fichaId: string,
): Promise<RespostaFichaCarregada> {
  exigirEditar(ctx);
  if (!pode(ctx, "comercial.formulario.ver"))
    throw new ErroDePermissao(
      "Para puxar os dados da ficha é preciso a permissão de ver fichas cadastrais. Peça a quem tem ou preencha manualmente.",
    );
  const f = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.ficha(tx, fichaId),
  );
  if (!f || f.respostas === null)
    throw new ErroNaoEncontrado("Ficha não encontrada.");
  if (f.situacao === "em_preenchimento")
    throw new ErroDeNegocio("Esta ficha ainda está em preenchimento.");
  // LGPD: quem abriu a ficha.
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.registrarAcessoAFicha(tx, fichaId),
    );
  } catch (erro) {
    log.error({ err: erro }, "registrar acesso à ficha");
  }
  return {
    nome: f.nome ?? "",
    ficha: { id: f.id, tipo: f.tipo, origem: f.origem, respostas: f.respostas },
  };
}

// ---------------------------------------------------------------------------
// Puxar da vistoria de entrada (Tickets)
// ---------------------------------------------------------------------------

export async function puxarVistoria(
  ctx: Contexto,
  lucs: string[],
): Promise<RespostaVistoriaPuxada> {
  if (!lucs.length)
    throw new ErroDeNegocio("Escolha o LUC na etapa Imóvel primeiro.");
  await exigirEditarAgora(ctx);
  const v = await vistoriaDoLuc(ctx, lucs, "entrada");
  if (!v)
    throw new ErroDeNegocio(
      "Este LUC ainda não tem vistoria de entrada no Tickets. Preencha a condição física à mão.",
    );
  const ambientes = await banco.comoServico((tx) =>
    repo.ambientesDaVistoria(tx, v.id),
  );
  return { vistoria: v, fisica: fisicaDaVistoria(ambientes) };
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

/** Confere tudo e devolve o link assinado para o navegador enviar o arquivo. */
export async function prepararAnexo(
  ctx: Contexto,
  contratoId: string,
  e: { tipo: TipoAnexo; nome: string; tamanho: number },
): Promise<{ url: string; path: string }> {
  await exigirEditarAgora(ctx);
  if (!mimeDoAnexo(e.nome))
    throw new ErroDeNegocio("Envie PDF, PNG, JPG ou Word (DOC, DOCX).");
  if (e.tamanho > ANEXO_MAX_BYTES)
    throw new ErroDeNegocio("Arquivo maior que 25 MB.");
  const existe = await banco.comoServico((tx) => repo.existe(tx, contratoId));
  if (!existe) throw new ErroNaoEncontrado("Contrato não encontrado.");
  const path = `contratos/${contratoId}/${e.tipo}-${randomBytes(4).toString("hex")}-${nomeDoArquivo(e.nome)}`;
  const envio = await prepararEnvio(BUCKET_COMERCIAL, path, {
    maxBytes: ANEXO_MAX_BYTES,
  });
  if ("erro" in envio)
    throw new ErroDeNegocio(
      "Não foi possível preparar o envio. Tente de novo.",
    );
  return { url: envio.url, path };
}

/** Depois do envio: confere o arquivo e registra o anexo. */
export async function registrarAnexo(
  ctx: Contexto,
  contratoId: string,
  e: { tipo: TipoAnexo; path: string; nome: string },
): Promise<string> {
  await exigirEditarAgora(ctx);
  if (
    !e.path.startsWith(`contratos/${contratoId}/${e.tipo}-`) ||
    e.path.includes("..")
  )
    throw new ErroDeNegocio("Arquivo inválido.");
  const info = await infoDoArquivo(BUCKET_COMERCIAL, e.path);
  if (!info)
    throw new ErroDeNegocio("O arquivo não chegou. Tente enviar de novo.");
  if (info.tamanho > ANEXO_MAX_BYTES) {
    await removerArquivos(BUCKET_COMERCIAL, [e.path]);
    throw new ErroDeNegocio("Arquivo maior que 25 MB.");
  }
  try {
    await banco.comoServico((tx) =>
      repo.incluirAnexo(tx, {
        contrato_id: contratoId,
        tipo: e.tipo,
        arquivo_path: e.path,
        arquivo_nome: e.nome,
        tamanho: info.tamanho,
        tipo_mime: mimeDoAnexo(e.nome),
        enviado_por: ctx.usuario.id,
      }),
    );
  } catch (erro) {
    log.error({ err: erro }, "registrar anexo");
    await removerArquivos(BUCKET_COMERCIAL, [e.path]);
    throw new ErroDeNegocio(
      "Não foi possível registrar o anexo. Tente de novo.",
    );
  }
  registrar("contrato_anexo", ctx, { contrato: contratoId, tipo: e.tipo });
  return `${TIPOS_ANEXO[e.tipo]}: arquivo anexado.`;
}

export async function removerAnexo(
  ctx: Contexto,
  anexoId: string,
): Promise<void> {
  exigirEditar(ctx);
  let linha: Awaited<ReturnType<typeof repo.removerAnexo>>;
  try {
    linha = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.removerAnexo(tx, anexoId),
    );
  } catch (erro) {
    traduzir(erro, "remover anexo");
  }
  if (!linha) throw new ErroDeNegocio("Anexo não encontrado.");
  await removerArquivos(BUCKET_COMERCIAL, [linha.arquivo_path]);
  registrar("contrato_anexo_removido", ctx, { contrato: linha.contrato_id });
}

/** Link assinado (60 s) de um anexo que a pessoa vê pelo RLS. */
export async function linkDoAnexo(
  ctx: Contexto,
  anexoId: string,
): Promise<string> {
  const a = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.anexo(tx, anexoId),
  );
  if (!a) throw new ErroNaoEncontrado("Anexo não encontrado.");
  const url = await linkDeLeitura(BUCKET_COMERCIAL, a.arquivo_path, {
    segundos: 60,
    baixarComo: a.arquivo_nome,
  });
  if (!url) throw new ErroDeNegocio("Não foi possível abrir o anexo.");
  return url;
}
