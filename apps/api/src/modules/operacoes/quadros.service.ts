import { randomBytes } from "node:crypto";
import {
  type Caixa,
  entradaCaixa,
  entradaLiberar,
  entradaQuadro,
  entradaTermo,
  entradaTroca,
  contratoEnet as esquemaContrato,
  type Quadro,
  type RespostaFichaDaCaixa,
  type ResumoDoQuadro,
  resumoDoQuadro,
  type Sala,
  type TermoRecente,
} from "@arp/shared/operacoes/contratos/energia";
import {
  type ContratoEnet as Contrato,
  chaveDoDisjuntor,
  contratoDaSala,
  mesmoLocatario,
  opcoesDeDisjuntor,
  textoDoDisjuntor,
  validarDisjuntor,
} from "@arp/shared/operacoes/energia";
import {
  type DadosDoTermo,
  faltaNoTermo,
  nomeDoArquivoDoTermo,
  salaNoTermo,
  textoDoTermo,
} from "@arp/shared/operacoes/termo";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { BYTES_DO_TIPO, tipoPeloConteudo } from "@arp/shared/os/tipo-arquivo";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import {
  gravarArquivo,
  infoDoArquivo,
  inicioDoArquivo,
  linkDeLeitura,
  linksDeLeitura,
  prepararEnvio,
  removerArquivos,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  BUCKET,
  exigirModulo,
  lerParametros,
  logOperacoes,
  nomesDeUsuarios,
  podeAgora,
  validarFormulario,
} from "./apoio";
import * as repo from "./quadros.repository";
import { gerarTermoDocx } from "./termo-docx";
import { gerarTermoPdf } from "./termo-pdf";

// Quadros de medidores e termo de energia (spec 4.5 e 4.6). Leitura e
// cadastro com a sessão: o RLS confere operacoes.energia.* e os grants por
// coluna impedem mudar o ocupante fora de trocar_locatario (que manda o
// anterior para o histórico). O termo grava os arquivos no disco (sem RLS:
// podeAgora antes) e registra a versão pela função do banco, que também
// zera "locatário novo sem termo". Alterações de linha já vão para
// core.auditoria.

const SEM_EDITAR = "Você não tem permissão para editar os quadros de energia.";
const SEM_TERMO = "Você não tem permissão para emitir o termo de energia.";
/** Validade dos links das fotos e dos termos (segundos). */
const LINK_SEGUNDOS = 10 * 60;
const FOTO_MAX_BYTES = 15 * 1024 * 1024;
const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"];
const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

const contratosSchema = z.array(esquemaContrato);

async function lerContratos(tx: Tx): Promise<Contrato[]> {
  const lidos = contratosSchema.safeParse(await repo.contratosEnet(tx));
  if (!lidos.success) {
    log.error(
      { issue: lidos.error.issues[0] },
      "ENET: resposta fora do formato",
    );
    return [];
  }
  return lidos.data;
}

/** Quadros, contagem por quadro (no banco) e contratos vigentes do ENET. */
export async function quadros(ctx: Contexto): Promise<{
  quadros: Quadro[];
  resumo: ResumoDoQuadro[];
  contratos: Contrato[];
}> {
  exigirModulo(ctx);
  return naSessao(ctx, async (tx) => ({
    quadros: await repo.quadros(tx),
    resumo: z.array(resumoDoQuadro).parse(await repo.resumoDosQuadros(tx)),
    contratos: await lerContratos(tx),
  }));
}

function paraCaixa(r: repo.LinhaDaCaixa): Caixa {
  const {
    cadastro_bloco,
    cadastro_sala,
    cadastro_pavimento,
    termos,
    ...resto
  } = r;
  const emitidos = Number(termos ?? 0);
  return {
    ...resto,
    sala:
      r.salas_texto?.trim() ||
      (cadastro_sala !== null ? salaNoTermo(cadastro_sala) : null),
    sala_bloco: cadastro_bloco,
    sala_unidade: cadastro_sala,
    pavimento: r.pavimento ?? cadastro_pavimento ?? null,
    termos: emitidos,
    com_termo: r.termo_externo || emitidos > 0,
  };
}

/** Caixas de um quadro (ou de todos), na ordem do desenho. */
export async function caixas(
  ctx: Contexto,
  quadroId: string | undefined,
): Promise<Caixa[]> {
  exigirModulo(ctx);
  const linhas = await naSessao(ctx, (tx) => repo.caixas(tx, quadroId ?? null));
  return linhas.map(paraCaixa);
}

async function lerSalas(tx: Tx): Promise<Sala[]> {
  return (await repo.salas(tx)).map((s) => ({
    ...s,
    caixas: Number(s.caixas ?? 0),
  }));
}

/** Cadastro de salas, com quantas caixas cada uma tem. */
export async function salas(ctx: Contexto): Promise<Sala[]> {
  exigirModulo(ctx);
  return naSessao(ctx, lerSalas);
}

/** Links temporários das fotos da sala de medidores (o quadro já foi lido pelo RLS). */
export async function fotosDoQuadro(ctx: Contexto, id: string) {
  exigirModulo(ctx);
  const q = await naSessao(ctx, (tx) => repo.quadro(tx, id));
  if (!q) throw new ErroNaoEncontrado("Quadro não encontrado.");
  const links = await linksDeLeitura(BUCKET, q.fotos, LINK_SEGUNDOS);
  return q.fotos.flatMap((caminho) => {
    const url = links.get(caminho);
    return url ? [{ caminho, url }] : [];
  });
}

/** A caixa e o quadro dela; null se não existe ou o RLS esconde. */
async function caixaComQuadro(tx: Tx, id: string) {
  const c = await repo.caixa(tx, id);
  if (!c) return null;
  const q = await repo.quadro(tx, c.quadro_id);
  return q ? { ...paraCaixa(c), quadro: q } : null;
}

/** Tudo o que a ficha da caixa mostra; 404 se não existe. */
export async function fichaDaCaixa(
  ctx: Contexto,
  id: string,
): Promise<RespostaFichaDaCaixa> {
  exigirModulo(ctx);
  const lido = await naSessao(ctx, async (tx) => {
    const caixa = await caixaComQuadro(tx, id);
    if (!caixa) return null;
    return {
      caixa,
      termos: await repo.termosDaCaixa(tx, caixa.id),
      historico: pode(ctx, "operacoes.energia.historico")
        ? await repo.historicoDaCaixa(tx, caixa.id)
        : null,
      contratos: await lerContratos(tx),
      salas: pode(ctx, "operacoes.energia.editar") ? await lerSalas(tx) : [],
    };
  });
  if (!lido) throw new ErroNaoEncontrado("Caixa não encontrada.");
  const { caixa, termos, historico, contratos, salas } = lido;
  const nomes = await nomesDeUsuarios(
    ctx,
    termos.map((t) => t.emitido_por),
    ["operacoes.energia.ver"],
  );
  const enet = contratoDaSala(contratos, {
    bloco: caixa.sala_bloco ?? caixa.quadro.bloco,
    sala: caixa.sala_unidade ?? caixa.sala,
  });
  return {
    caixa,
    termos: termos.map((t) => ({
      id: t.id,
      versao: t.versao,
      locatario: t.locatario,
      documento: t.documento,
      bloco: t.bloco,
      sala: t.sala,
      data_emissao: t.data_emissao,
      emitido_em: t.emitido_em,
      emitidoPor: (t.emitido_por && nomes.get(t.emitido_por)) || "—",
      temWord: !!t.docx,
    })),
    historico,
    enet,
    salas,
  };
}

/** Últimos termos emitidos (todas as caixas). */
export async function termosRecentes(
  ctx: Contexto,
  limite = 30,
): Promise<TermoRecente[]> {
  exigirModulo(ctx);
  const linhas = await naSessao(ctx, (tx) => repo.termosRecentes(tx, limite));
  return linhas.map(({ docx, ...t }) => ({ ...t, temWord: !!docx }));
}

/**
 * Baixar ou reimprimir uma versão do termo (?formato=pdf|docx): confere
 * operacoes.energia.termo no banco, lê o termo pelo RLS e devolve um link
 * assinado de dois minutos, com o nome do arquivo pelo modelo dos parâmetros.
 */
export async function linkDoTermo(
  ctx: Contexto,
  id: string,
  formato: "pdf" | "docx",
): Promise<string> {
  if (!(await podeAgora(ctx, "operacoes.energia.termo")))
    throw new ErroDePermissao(
      "Você não tem permissão para baixar o termo de energia.",
    );
  const lido = await naSessao(ctx, async (tx) => {
    const t = await repo.termo(tx, id);
    return t ? { t, p: await lerParametros(tx) } : null;
  });
  if (!lido) throw new ErroNaoEncontrado("Termo não encontrado.");
  const { t, p } = lido;
  const caminho = formato === "docx" ? t.docx : t.pdf;
  if (!caminho)
    throw new ErroNaoEncontrado("Esta versão do termo não tem o arquivo Word.");
  const nome = `${nomeDoArquivoDoTermo(p.termo_nome_arquivo, t)}.${formato}`;
  const url = await linkDeLeitura(BUCKET, caminho, {
    segundos: 120,
    baixarComo: nome,
  });
  if (!url)
    throw new ErroNaoEncontrado("O arquivo do termo não está no servidor.");
  return url;
}

// ---------------------------------------------------------------------------
// Quadro
// ---------------------------------------------------------------------------

const ROTULOS_QUADRO = {
  codigo: "Código",
  nome: "Nome",
  bloco: "Bloco",
  projeto: "Projeto da Energisa",
  subestacao: "Subestação",
  roteiro_base: "Roteiro base",
  armario: "Armário",
  disjuntor_geral: "Disjuntor geral",
  espacos: "Espaços",
  ordem: "Ordem",
  observacoes: "Observações",
};

/** Atualiza (com id) ou cria o quadro; criado, devolve o código para a tela abrir. */
export async function salvarQuadro(
  ctx: Contexto,
  dados: unknown,
): Promise<{ mensagem: string; codigo?: string }> {
  exigirModulo(ctx);
  const d = validarFormulario(entradaQuadro, dados, ROTULOS_QUADRO);
  const { id: quadroId, codigo, ...linha } = d;
  if (quadroId) {
    const gravados = await naSessao(ctx, (tx) =>
      repo.atualizarQuadro(tx, quadroId, linha),
    );
    if (!gravados.length) throw new ErroDePermissao(SEM_EDITAR);
    return { mensagem: "Quadro atualizado." };
  }
  if (!codigo) throw new ErroDeNegocio("Código: informe o código (ex.: b01).");
  try {
    await naSessao(ctx, (tx) => repo.inserirQuadro(tx, { ...linha, codigo }));
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito("Já existe um quadro com esse código.");
    throw e;
  }
  return { mensagem: "Quadro criado.", codigo };
}

// ---------------------------------------------------------------------------
// Caixa (cadastro; o ocupante só muda pelas ações de locatário)
// ---------------------------------------------------------------------------

const ROTULOS_CAIXA = {
  numero: "Número da caixa",
  numero_antigo: "Numeração antiga",
  lado: "Lado",
  coluna: "Coluna",
  linha: "Linha",
  rota: "Rota",
  sala_id: "Sala",
  salas_texto: "Sala como está no painel",
  pavimento: "Pavimento",
  status: "Status",
  disjuntor: "Disjuntor",
  medidor_situacao: "Medidor",
  medidor_numero: "Número do medidor",
  modulo: "Módulo",
  observacoes: "Observações de campo",
};

async function comErroDaCaixa<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Já existe uma caixa com esse número neste quadro.",
      );
    throw e;
  }
}

/** Atualiza (com id) ou cria a caixa; criada, devolve o id para a tela abrir. */
export async function salvarCaixa(
  ctx: Contexto,
  dados: unknown,
): Promise<{ mensagem: string; id?: string }> {
  exigirModulo(ctx);
  const v = validarFormulario(entradaCaixa, dados, ROTULOS_CAIXA);
  const { p, atual } = await naSessao(ctx, async (tx) => ({
    p: await lerParametros(tx),
    atual: v.id ? await repo.caixa(tx, v.id) : null,
  }));
  if (v.id && (!atual || atual.quadro_id !== v.quadro_id))
    throw new ErroNaoEncontrado("Caixa não encontrada.");

  // Disjuntor e medidor: da lista dos parâmetros (ou o que a caixa já tinha).
  const opcoes = opcoesDeDisjuntor(p.energia_disjuntores, p.energia_ligacoes, {
    amperes: atual?.disjuntor_amperes ?? null,
    ligacao: atual?.ligacao ?? null,
  });
  const disj = validarDisjuntor(v.disjuntor, opcoes);
  if (disj.erro) throw new ErroDeNegocio(`Disjuntor: ${disj.erro}.`);
  if (
    v.medidor_situacao &&
    !p.energia_medidor_situacoes.includes(v.medidor_situacao) &&
    v.medidor_situacao !== atual?.medidor_situacao
  )
    throw new ErroDeNegocio("Medidor: escolha uma situação da lista.");

  // Uma caixa por posição no desenho.
  const ocupada = await naSessao(ctx, (tx) =>
    repo.caixaNaPosicao(tx, {
      quadro_id: v.quadro_id,
      lado: v.lado,
      coluna: v.coluna,
      linha: v.linha,
      id: v.id,
    }),
  );
  if (ocupada)
    throw new ErroDeNegocio(
      `Posição: a caixa ${ocupada} já está no lado ${v.lado}, coluna ${v.coluna}, linha ${v.linha}.`,
    );

  // Sala trocada sem mexer no texto do painel: o texto antigo não vale mais.
  const salaMudou = !!atual && atual.sala_id !== v.sala_id;
  const disjuntorMudou =
    chaveDoDisjuntor(
      atual?.disjuntor_amperes ?? null,
      atual?.ligacao ?? null,
    ) !== v.disjuntor;
  const linha: repo.DadosDaCaixa = {
    numero: v.numero,
    numero_antigo: v.numero_antigo,
    lado: v.lado,
    coluna: v.coluna,
    linha: v.linha,
    rota: v.rota,
    sala_id: v.sala_id,
    salas_texto:
      salaMudou && v.salas_texto === atual?.salas_texto ? null : v.salas_texto,
    pavimento: v.pavimento,
    status: v.status,
    disjuntor_amperes: disj.amperes,
    ligacao: disj.ligacao,
    ...(disjuntorMudou || !atual
      ? {
          disjuntor_texto: textoDoDisjuntor(disj.amperes, disj.ligacao) || null,
        }
      : {}),
    medidor_situacao: v.medidor_situacao,
    medidor_numero: v.medidor_numero,
    modulo: v.modulo,
    observacoes: v.observacoes,
    termo_externo: v.termo_externo,
  };
  const caixaId = v.id;
  if (caixaId) {
    const gravados = await comErroDaCaixa(() =>
      naSessao(ctx, (tx) => repo.atualizarCaixa(tx, caixaId, linha)),
    );
    if (!gravados.length) throw new ErroDePermissao(SEM_EDITAR);
    return { mensagem: "Caixa salva." };
  }
  const nova = await comErroDaCaixa(() =>
    naSessao(ctx, (tx) =>
      repo.inserirCaixa(tx, { ...linha, quadro_id: v.quadro_id }),
    ),
  );
  return { mensagem: "Caixa criada.", id: nova.id };
}

// ---------------------------------------------------------------------------
// Locatário: troca à mão, pelo ENET e caixa liberada
// ---------------------------------------------------------------------------

/** Troca à mão (sala sem contrato no ENET): o anterior vai para o histórico. */
export async function trocarLocatario(
  ctx: Contexto,
  caixaId: string,
  dados: unknown,
): Promise<string> {
  exigirModulo(ctx);
  const v = validarFormulario(entradaTroca, dados, {
    nome: "Novo locatário",
    documento: "CPF ou CNPJ",
    desde: "Entrada",
    contrato: "Contrato",
  });
  await naSessao(ctx, (tx) =>
    repo.trocarLocatario(tx, {
      caixa: caixaId,
      nome: v.nome,
      documento: v.documento ?? "",
      desde: v.desde,
      contrato: v.contrato,
      origem: "manual",
    }),
  );
  return "Locatário trocado. O anterior foi para o histórico; falta emitir o termo.";
}

/**
 * "Atualizar a partir do ENET": lê de novo o contrato vigente da sala no
 * servidor (nunca o nome que veio da tela) e troca o locatário com origem
 * 'enet'.
 */
export async function atualizarDoEnet(
  ctx: Contexto,
  caixaId: string,
): Promise<string> {
  exigirModulo(ctx);
  const lido = await naSessao(ctx, async (tx) => {
    const c = await caixaComQuadro(tx, caixaId);
    return c ? { c, contratos: await lerContratos(tx) } : null;
  });
  if (!lido) throw new ErroNaoEncontrado("Caixa não encontrada.");
  const { c, contratos } = lido;
  const enet = contratoDaSala(contratos, {
    bloco: c.sala_bloco ?? c.quadro.bloco,
    sala: c.sala_unidade ?? c.sala,
  });
  if (!enet)
    throw new ErroDeNegocio("O ENET não tem contrato vigente para esta sala.");
  if (mesmoLocatario(enet.locatario, c.ocupante))
    return "A caixa já mostra o locatário do ENET.";
  await naSessao(ctx, (tx) =>
    repo.trocarLocatario(tx, {
      caixa: c.id,
      nome: enet.locatario,
      documento: enet.documento ?? "",
      desde: enet.inicio ?? hojeEmBrasilia(new Date()),
      contrato: enet.contrato,
      origem: "enet",
    }),
  );
  return `Locatário atualizado pelo ENET: ${enet.locatario}. Falta emitir o termo.`;
}

/** O locatário saiu e ninguém entrou: histórico e caixa livre (ou reservada). */
export async function liberarCaixa(
  ctx: Contexto,
  caixaId: string,
  dados: unknown,
): Promise<string> {
  exigirModulo(ctx);
  const v = validarFormulario(entradaLiberar, dados, {
    saida: "Saída",
    status: "Caixa fica",
  });
  await naSessao(ctx, (tx) =>
    repo.liberarCaixa(tx, { caixa: caixaId, saida: v.saida, status: v.status }),
  );
  return "Caixa liberada. O ocupante foi para o histórico.";
}

// ---------------------------------------------------------------------------
// Termo de autorização (PDF e Word)
// ---------------------------------------------------------------------------

const ROTULOS_TERMO = {
  data_emissao: "Data de emissão",
  locatario: "Locatário",
  documento: "CPF ou CNPJ",
  qualificacao: "Qualificação",
  bloco: "Bloco",
  pavimento: "Pavimento",
  sala: "Sala ou loja",
  projeto: "Projeto",
  amperes: "Disjuntor (amperes)",
  ligacao: "Ligação",
  armario: "Armário",
  rota: "Rota",
  observacao_tecnica: "Observação técnica",
};

export async function emitirTermo(
  ctx: Contexto,
  caixaId: string,
  dados: unknown,
): Promise<string> {
  const v = validarFormulario(entradaTermo, dados, ROTULOS_TERMO);
  if (!(await podeAgora(ctx, "operacoes.energia.termo")))
    throw new ErroDePermissao(SEM_TERMO);
  const lido = await naSessao(ctx, async (tx) => ({
    c: await caixaComQuadro(tx, caixaId),
    p: await lerParametros(tx),
  }));
  const { c, p } = lido;
  if (!c) throw new ErroNaoEncontrado("Caixa não encontrada.");
  if (v.ligacao && !p.energia_ligacoes.includes(v.ligacao))
    throw new ErroDeNegocio("Ligação: escolha uma da lista.");

  const dadosDoTermo: DadosDoTermo = {
    dataEmissao: v.data_emissao,
    locatario: v.locatario,
    documento: v.documento,
    qualificacao: v.qualificacao,
    bloco: v.bloco,
    pavimento: v.pavimento,
    sala: v.sala,
    projeto: v.projeto,
    amperes: v.amperes,
    ligacao: v.ligacao,
    armario: v.armario,
    rota: v.rota,
    observacaoTecnica: v.observacao_tecnica,
  };
  const falta = faltaNoTermo(dadosDoTermo);
  if (falta.length) throw new ErroDeNegocio(`Preencha: ${falta.join(", ")}.`);

  const texto = textoDoTermo(dadosDoTermo, {
    razaoSocial: p.termo_razao_social,
    cnpj: p.termo_cnpj,
    endereco: p.termo_endereco,
    cidade: p.termo_cidade,
  });
  const meta = {
    titulo: nomeDoArquivoDoTermo(p.termo_nome_arquivo, {
      bloco: v.bloco,
      sala: v.sala,
      locatario: v.locatario,
    }),
    autor: p.termo_razao_social,
  };
  const [pdf, docx] = await Promise.all([
    gerarTermoPdf(texto, meta),
    gerarTermoDocx(texto, meta),
  ]);

  // Duas tentativas: se outra pessoa emitiu no meio, pega a versão seguinte.
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const versao = await naSessao(ctx, (tx) =>
      repo.proximaVersaoDoTermo(tx, c.id),
    );
    const base = `energia/termos/${c.id}/v${versao}-${randomBytes(4).toString("hex")}`;
    const caminhos = { pdf: `${base}.pdf`, docx: `${base}.docx` };
    try {
      await Promise.all([
        gravarArquivo(BUCKET, caminhos.pdf, pdf, PDF),
        gravarArquivo(BUCKET, caminhos.docx, docx, DOCX),
      ]);
    } catch (err) {
      log.error({ err }, "termo: gravar arquivos");
      await removerArquivos(BUCKET, [caminhos.pdf, caminhos.docx]);
      throw new ErroDeNegocio(
        "Não foi possível guardar o termo. Tente de novo.",
      );
    }
    try {
      await naSessao(ctx, (tx) =>
        repo.registrarTermo(tx, {
          caixa: c.id,
          versao,
          locatario: v.locatario,
          documento: v.documento,
          qualificacao: v.qualificacao,
          bloco: v.bloco,
          pavimento: v.pavimento,
          sala: v.sala,
          projeto: v.projeto,
          amperes: v.amperes,
          ligacao: v.ligacao,
          armario: v.armario,
          rota: v.rota,
          observacao_tecnica: v.observacao_tecnica,
          data_emissao: v.data_emissao,
          pdf: caminhos.pdf,
          docx: caminhos.docx,
        }),
      );
    } catch (e) {
      await removerArquivos(BUCKET, [caminhos.pdf, caminhos.docx]);
      if (e instanceof Error && /acabou de ser emitido/.test(e.message))
        continue;
      throw e;
    }
    // Sem nome nem documento do locatário: só caixa, quadro e versão.
    logOperacoes(
      ctx,
      "operacoes_termo_emitido",
      `Emitiu o termo de autorização de energia da caixa ${c.numero} do quadro ${c.quadro.codigo} (versão ${versao})`,
      { caixa: c.id, quadro: c.quadro.id, versao },
    );
    return `Termo emitido (versão ${versao}). PDF e Word guardados na caixa.`;
  }
  throw new ErroDeConflito(
    "Outra pessoa está emitindo termos desta caixa agora. Tente de novo.",
  );
}

// ---------------------------------------------------------------------------
// Fotos da sala de medidores (do navegador direto para o disco)
// ---------------------------------------------------------------------------

const pastaDasFotos = (quadroId: string) => `energia/quadros/${quadroId}/`;

async function exigirEditar(ctx: Contexto) {
  if (!(await podeAgora(ctx, "operacoes.energia.editar")))
    throw new ErroDePermissao(SEM_EDITAR);
}

const quadroVisivel = (ctx: Contexto, id: string) =>
  naSessao(ctx, (tx) => repo.quadro(tx, id));

export async function prepararFoto(
  ctx: Contexto,
  quadroId: string,
  entrada: { nome: string; tamanho: number },
): Promise<{ url: string; caminho: string }> {
  await exigirEditar(ctx);
  const { nome, tamanho } = entrada;
  const ext = /\.(jpe?g|png|webp)$/i.exec(nome)?.[1]?.toLowerCase();
  if (!ext) throw new ErroDeNegocio("Envie a foto em JPG, PNG ou WebP.");
  if (tamanho > FOTO_MAX_BYTES)
    throw new ErroDeNegocio("Foto maior que 15 MB.");
  if (!(await quadroVisivel(ctx, quadroId)))
    throw new ErroDeNegocio("Quadro não encontrado.");
  const caminho = `${pastaDasFotos(quadroId)}${Date.now()}-${randomBytes(4).toString("hex")}.${ext === "jpeg" ? "jpg" : ext}`;
  const envio = await prepararEnvio(BUCKET, caminho, {
    maxBytes: FOTO_MAX_BYTES,
  });
  if ("erro" in envio)
    throw new ErroDeNegocio("Não foi possível preparar o envio.");
  return { url: envio.url, caminho };
}

/** Depois do envio: confere o arquivo (tamanho e tipo pelo conteúdo) e liga ao quadro. */
export async function registrarFoto(
  ctx: Contexto,
  quadroId: string,
  caminho: string,
): Promise<string> {
  await exigirEditar(ctx);
  const pasta = pastaDasFotos(quadroId);
  if (
    !caminho.startsWith(pasta) ||
    !/^[0-9]+-[0-9a-f]{8}\.(jpg|png|webp)$/.test(caminho.slice(pasta.length))
  )
    throw new ErroDeNegocio("Foto inválida.");
  const descartar = async (erro: ErroDaApi): Promise<never> => {
    await removerArquivos(BUCKET, [caminho]);
    throw erro;
  };
  const info = await infoDoArquivo(BUCKET, caminho);
  if (!info) throw new ErroDeNegocio("A foto não chegou. Envie de novo.");
  if (info.tamanho <= 0 || info.tamanho > FOTO_MAX_BYTES)
    return descartar(new ErroDeNegocio("Foto vazia ou maior que 15 MB."));
  const inicio = await inicioDoArquivo(BUCKET, caminho, BYTES_DO_TIPO);
  const tipo = inicio ? tipoPeloConteudo(inicio) : null;
  if (!tipo || !TIPOS_DE_FOTO.includes(tipo))
    return descartar(
      new ErroDeNegocio("O arquivo não é uma foto JPG, PNG ou WebP."),
    );
  const q = await quadroVisivel(ctx, quadroId);
  if (!q) return descartar(new ErroDeNegocio("Quadro não encontrado."));
  if (q.fotos.includes(caminho)) return "Foto já está no quadro.";
  let gravados: { id: string }[];
  try {
    gravados = await naSessao(ctx, (tx) =>
      repo.fotosDoQuadro(tx, quadroId, [...q.fotos, caminho]),
    );
  } catch (e) {
    return descartar(
      e instanceof ErroDaApi
        ? e
        : new ErroDeNegocio("Não foi possível salvar. Tente de novo."),
    );
  }
  if (!gravados.length) return descartar(new ErroDePermissao(SEM_EDITAR));
  return "Foto da sala de medidores guardada.";
}

export async function removerFoto(
  ctx: Contexto,
  quadroId: string,
  caminho: string,
): Promise<string> {
  await exigirEditar(ctx);
  const q = await quadroVisivel(ctx, quadroId);
  if (!q?.fotos.includes(caminho))
    throw new ErroDeNegocio("Foto não encontrada.");
  const gravados = await naSessao(ctx, (tx) =>
    repo.fotosDoQuadro(
      tx,
      quadroId,
      q.fotos.filter((f) => f !== caminho),
    ),
  );
  if (!gravados.length) throw new ErroDePermissao(SEM_EDITAR);
  await removerArquivos(BUCKET, [caminho]);
  return "Foto removida.";
}
