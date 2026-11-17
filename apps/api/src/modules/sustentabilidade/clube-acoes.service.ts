import { randomBytes, randomUUID } from "node:crypto";
import { formatarCnpj, soDigitos } from "@arp/shared/documentos";
import { formatarData } from "@arp/shared/formato";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import {
  type acaoDoClube,
  competenciaDoMes,
  type contatoDoParticipante,
  type contribuicaoDoClube,
  type dadosDoParticipante,
  lerReais,
  type NovoParticipante,
  type saidaDoClube,
  type termoDoClube,
  type valorCombinado,
} from "@arp/shared/sustentabilidade/clube-cadastro";
import { textoDoTermoClube } from "@arp/shared/sustentabilidade/clube-termo";
import { validadeDoTermo } from "@arp/shared/sustentabilidade/situacao";
import type { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDeConflito, ErroDeNegocio, ErroDePermissao } from "@/erros";
import {
  type Bucket,
  gravarArquivo,
  linkDeLeitura,
  removerArquivos,
} from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { cancelarPeloSistema } from "@/modules/os/sistema.service";
import { podeAgora } from "./acesso";
import { parametros } from "./base.service";
import * as repo from "./clube.repository";
import { exigirVer } from "./clube.service";
import { concluirRenovacoes } from "./clube-rotina.service";
import { gerarTermoClubePdf } from "./termo-pdf";

// Ações do Clube SustentArp (4.5). Gravam com a sessão: o RLS confere
// clube.editar, "Ver contato" nos contatos e "Ver valores" no valor
// combinado; aqui se confere de novo (podeAgora) antes de mexer em arquivo,
// que não tem RLS. Nada aqui gera cobrança: o módulo só registra o que foi
// recebido. Participante não é apagado (sai do clube, com motivo). Termo,
// contribuição e ação podem ser removidos por quem edita; a auditoria guarda
// o antes.

/**
 * Onde ficam o termo anexado, o gerado e a assinatura: o bucket do módulo,
 * com o prefixo clube/ (o banco prende o caminho a clube/termos/<participante>/).
 */
export const BUCKET_CLUBE: Bucket = "sustentabilidade";

const EDITAR = "sustentabilidade.clube.editar" as const;
const SEM_PERMISSAO = "Você não tem permissão para editar o Clube.";
export const TERMO_MAX_MB = 8;
export const ASSINATURA_MAX_BYTES = 1024 * 1024;
const PREFIXO = "clube";

export interface ArquivoDoForm {
  nome: string;
  tipo: string;
  bytes: Uint8Array;
}

const ehPdf = (b: Uint8Array) =>
  b.length > 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-";
const ehPng = (b: Uint8Array) =>
  b.length > 8 &&
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x);

async function exigirEditar(ctx: Contexto): Promise<void> {
  if (!(await podeAgora(ctx, EDITAR))) throw new ErroDePermissao(SEM_PERMISSAO);
}

const hoje = () => hojeEmBrasilia(new Date());

// ---------------------------------------------------------------------------
// Participante
// ---------------------------------------------------------------------------

/** Cliente da lista de contratos, ou cadastro manual (não locatário). */
export async function criarParticipante(
  ctx: Contexto,
  p: NovoParticipante,
): Promise<string> {
  await exigirEditar(ctx);
  const id = randomUUID();
  // O 23505 sai do escopo como ErroDeConflito (o banco traduz na saída).
  await banco
    .comoUsuario(ctx.usuario.id, async (tx) => {
      const permitidas = (await parametros(tx)).clube_formas;
      if (p.formas.some((f) => !permitidas.includes(f)))
        throw new ErroDeNegocio(
          "Forma de participação fora da lista. Recarregue a tela.",
        );
      if (await repo.participantePorDoc(tx, p.doc))
        throw new ErroDeNegocio(
          "Este CPF ou CNPJ já é participante do Clube. Procure-o na lista.",
        );
      let nome = p.nome;
      if (p.origem === "cliente") {
        const c = await repo.nomeDoClienteNoContrato(tx, p.doc);
        if (!c)
          throw new ErroDeNegocio(
            "Esse cliente não está nos contratos. Use o cadastro manual (parceiro que não é locatário).",
          );
        nome = c.cliente_nome;
      }
      await repo.inserirParticipante(tx, {
        id,
        cliente_doc: p.doc,
        nome: nome.slice(0, 200),
        locatario_manual: p.origem === "manual",
        formas: p.formas,
      });
    })
    .catch((e: unknown) => {
      if (e instanceof ErroDeConflito)
        throw new ErroDeConflito(
          "Este CPF ou CNPJ já é participante do Clube.",
        );
      throw e;
    });

  // Contato só entra com "Ver contato"; o participante já foi criado.
  if (
    (p.email || p.telefone || p.contato) &&
    (await podeAgora(ctx, "sustentabilidade.contato"))
  ) {
    try {
      await banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.inserirContato(tx, {
          participante_id: id,
          email: p.email,
          telefone: p.telefone,
          contato: p.contato,
        }),
      );
    } catch (err) {
      log.error({ err, participante: id }, "contato do participante");
    }
  }
  return id;
}

/** Formas de participação e, no cadastro manual, o nome. */
export async function salvarDadosDoParticipante(
  ctx: Contexto,
  d: z.output<typeof dadosDoParticipante>,
): Promise<string> {
  await exigirEditar(ctx);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const permitidas = (await parametros(tx)).clube_formas;
    const atual = await repo.formasDoParticipante(tx, d.participante_id);
    if (!atual) throw new ErroDeNegocio("Participante não encontrado.");
    // Forma que já estava (e saiu da lista dos Parâmetros) pode continuar.
    if (
      d.formas.some((f) => !permitidas.includes(f) && !atual.formas.includes(f))
    )
      throw new ErroDeNegocio(
        "Forma de participação fora da lista. Recarregue a tela.",
      );
    const nome = d.nome?.trim();
    if (atual.locatario_manual && nome !== undefined && nome.length < 2)
      throw new ErroDeNegocio("Informe o nome.");
    const r = await repo.atualizarParticipante(tx, d.participante_id, {
      formas: d.formas,
      ...(atual.locatario_manual && nome ? { nome: nome.slice(0, 200) } : {}),
    });
    if (!r) throw new ErroDePermissao(SEM_PERMISSAO);
  });
  return "Participante salvo.";
}

export async function salvarContato(
  ctx: Contexto,
  d: z.output<typeof contatoDoParticipante>,
): Promise<string> {
  const editar = await podeAgora(ctx, EDITAR);
  const contato = await podeAgora(ctx, "sustentabilidade.contato");
  if (!editar || !contato)
    throw new ErroDePermissao("Você não tem permissão para alterar contatos.");
  const { participante_id, ...c } = d;
  const vazio = !c.email && !c.telefone && !c.contato;
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    vazio
      ? repo.removerContato(tx, participante_id)
      : repo.gravarContato(tx, { participante_id, ...c }),
  );
  return vazio ? "Contato removido." : "Contato salvo.";
}

export async function salvarValorCombinado(
  ctx: Contexto,
  d: z.output<typeof valorCombinado>,
): Promise<string> {
  const editar = await podeAgora(ctx, EDITAR);
  const valores = await podeAgora(ctx, "sustentabilidade.valores");
  if (!editar || !valores)
    throw new ErroDePermissao("Você não tem permissão para alterar valores.");
  if (d.valor === "") {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.removerValor(tx, d.participante_id),
    );
    return "Valor combinado removido.";
  }
  const v = lerReais(d.valor);
  if (!v.ok) throw new ErroDeNegocio(v.erro);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.gravarValor(tx, d.participante_id, v.valor),
  );
  return "Valor combinado salvo.";
}

/** "Saiu" com motivo; o chamado de renovação aberto deixa de valer. */
export async function registrarSaida(
  ctx: Contexto,
  d: z.output<typeof saidaDoClube>,
): Promise<string> {
  await exigirEditar(ctx);
  if (d.saiu_em > hoje())
    throw new ErroDeNegocio("A data da saída não pode ser depois de hoje.");
  const p = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarParticipante(tx, d.participante_id, {
      saiu_em: d.saiu_em,
      saiu_motivo: d.motivo,
    }),
  );
  if (!p) throw new ErroDePermissao(SEM_PERMISSAO);
  try {
    // Service role: clube.editar conferido acima (podeAgora).
    await banco.comoServico(async (tx) => {
      for (const t of await repo.chamadosDosTermos(tx, p.id))
        if (t.chamado_id)
          await cancelarPeloSistema(tx, {
            chamadoId: t.chamado_id,
            motivo: `${p.nome} saiu do Clube SustentArp.`,
          });
    });
  } catch (err) {
    log.error({ err, participante: p.id }, "cancelar chamado de renovação");
  }
  return "Saída registrada.";
}

export async function reativarParticipante(
  ctx: Contexto,
  id: string,
): Promise<string> {
  await exigirEditar(ctx);
  const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.atualizarParticipante(tx, id, { saiu_em: null, saiu_motivo: null }),
  );
  if (!r) throw new ErroDePermissao(SEM_PERMISSAO);
  return "Participante de volta ao clube.";
}

// ---------------------------------------------------------------------------
// Termo anual
// ---------------------------------------------------------------------------

interface DadosDoTermo {
  participanteId: string;
  ano: number;
  assinadoEm: string;
  arquivo: string | null;
  assinatura: string | null;
}

/** Grava o termo e conclui o chamado de renovação; devolve a mensagem. */
async function gravarTermo(ctx: Contexto, t: DadosDoTermo): Promise<string> {
  const validoAte = await banco
    .comoUsuario(ctx.usuario.id, async (tx) => {
      const meses = (await parametros(tx)).termo_validade_meses;
      const ate = validadeDoTermo(t.assinadoEm, meses);
      await repo.inserirTermo(tx, {
        id: randomUUID(),
        participante_id: t.participanteId,
        ano: t.ano,
        assinado_em: t.assinadoEm,
        valido_ate: ate,
        arquivo: t.arquivo,
        assinatura: t.assinatura,
      });
      return ate;
    })
    .catch((e: unknown) => {
      if (e instanceof ErroDeConflito)
        throw new ErroDeConflito(
          `Já existe o termo de ${t.ano} deste participante. Remova-o antes ou use outro ano.`,
        );
      throw e;
    });
  // O chamado "Renovar termo do Clube" fecha ao salvar o termo novo.
  let fechados = 0;
  try {
    fechados = await banco.comoServico((tx) =>
      concluirRenovacoes(tx, {
        participanteId: t.participanteId,
        novo: { ano: t.ano, validoAte },
        concluidoPor: ctx.usuario.id,
      }),
    );
  } catch (err) {
    log.error({ err }, "concluir renovação do termo");
  }
  return (
    `Termo de ${t.ano} salvo, válido até ${formatarData(validoAte)}.` +
    (fechados ? " O chamado de renovação foi concluído." : "")
  );
}

/** Data e ano do termo: sem data futura e com o ano perto da assinatura. */
function conferirDataDoTermo(ano: number, assinadoEm: string): void {
  if (assinadoEm > hoje())
    throw new ErroDeNegocio(
      "A data da assinatura não pode ser depois de hoje.",
    );
  if (assinadoEm < "2000-01-01")
    throw new ErroDeNegocio("Data da assinatura inválida.");
  const anoDaData = Number(assinadoEm.slice(0, 4));
  if (ano < anoDaData - 1 || ano > anoDaData + 1)
    throw new ErroDeNegocio(
      "O ano do termo precisa ser o da assinatura (ou o anterior ou o seguinte).",
    );
}

const caminhoDoTermo = (participanteId: string, ano: number, nome: string) =>
  `${PREFIXO}/termos/${participanteId}/${ano}-${randomBytes(4).toString("hex")}-${nome}`;

type DadosDoForm = z.output<typeof termoDoClube>;

/** Termo anexado (PDF do termo assinado em papel). */
export async function registrarTermoAnexo(
  ctx: Contexto,
  d: DadosDoForm,
  arquivo: ArquivoDoForm | undefined,
): Promise<string> {
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Anexe o PDF do termo assinado.");
  if (arquivo.bytes.length > TERMO_MAX_MB * 1024 * 1024)
    throw new ErroDeNegocio(
      `O PDF passa de ${TERMO_MAX_MB} MB. Envie um arquivo menor.`,
    );
  if (!ehPdf(arquivo.bytes))
    throw new ErroDeNegocio("O arquivo precisa ser um PDF.");
  conferirDataDoTermo(d.ano, d.assinado_em);
  await exigirEditar(ctx);

  const caminho = caminhoDoTermo(d.participante_id, d.ano, "termo.pdf");
  try {
    await gravarArquivo(
      BUCKET_CLUBE,
      caminho,
      arquivo.bytes,
      "application/pdf",
    );
  } catch (err) {
    log.error({ err }, "gravar termo");
    throw new ErroDeNegocio("Não foi possível guardar o PDF. Tente de novo.");
  }
  try {
    return await gravarTermo(ctx, {
      participanteId: d.participante_id,
      ano: d.ano,
      assinadoEm: d.assinado_em,
      arquivo: caminho,
      assinatura: null,
    });
  } catch (e) {
    await removerArquivos(BUCKET_CLUBE, [caminho]);
    throw e;
  }
}

/** Dados da ARP para o termo (core.empresa), conferidos antes de gerar. */
async function dadosDaArp() {
  const e = await banco.comoServico((tx) => repo.empresa(tx));
  const razaoSocial = (e?.razao_social || e?.nome || "").trim();
  const cnpj = formatarCnpj(soDigitos(e?.cnpj ?? ""));
  if (!razaoSocial || !cnpj) return null;
  return { razaoSocial, cnpj, cidade: (e?.cidade ?? "").trim() };
}

/**
 * Assinatura na tela (componente Assinatura): gera o PDF do termo no papel
 * timbrado com a assinatura desenhada e guarda os dois arquivos.
 */
export async function registrarTermoAssinado(
  ctx: Contexto,
  d: DadosDoForm,
  png: ArquivoDoForm | undefined,
): Promise<string> {
  if (!png || png.bytes.length === 0 || png.tipo !== "image/png")
    throw new ErroDeNegocio("Assine no quadro antes de salvar.");
  if (png.bytes.length > ASSINATURA_MAX_BYTES)
    throw new ErroDeNegocio("Assinatura grande demais.");
  const imagem = png.bytes;
  if (!ehPng(imagem))
    throw new ErroDeNegocio("Assine no quadro antes de salvar.");
  if ((d.nome ?? "").trim().length < 2)
    throw new ErroDeNegocio("Informe o nome de quem assina.");
  conferirDataDoTermo(d.ano, d.assinado_em);
  await exigirEditar(ctx);

  const { participante, meses } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      participante: await repo.participanteDoTermo(tx, d.participante_id),
      meses: (await parametros(tx)).termo_validade_meses,
    }),
  );
  if (!participante) throw new ErroDeNegocio("Participante não encontrado.");
  const arp = await dadosDaArp();
  if (!arp)
    throw new ErroDeNegocio(
      "Faltam o nome e o CNPJ da empresa em Administração › Empresa para gerar o termo.",
    );

  const validoAte = validadeDoTermo(d.assinado_em, meses);
  const texto = textoDoTermoClube({
    assinadoEm: d.assinado_em,
    validoAte,
    ano: d.ano,
    validadeMeses: meses,
    participante: { nome: participante.nome, doc: participante.cliente_doc },
    formas: participante.formas,
    assinante: { nome: d.nome ?? "", documento: d.documento ?? "" },
    arp,
  });
  let pdf: Uint8Array;
  try {
    pdf = await gerarTermoClubePdf(texto, imagem, {
      titulo: `Termo do Clube SustentArp ${d.ano} - ${participante.nome}`,
      autor: arp.razaoSocial,
    });
  } catch (err) {
    log.error({ err }, "gerar termo do clube");
    throw new ErroDeNegocio(
      "Não foi possível gerar o PDF do termo. Tente de novo.",
    );
  }

  const arquivo = caminhoDoTermo(d.participante_id, d.ano, "termo.pdf");
  const assinatura = caminhoDoTermo(d.participante_id, d.ano, "assinatura.png");
  try {
    await gravarArquivo(BUCKET_CLUBE, arquivo, pdf, "application/pdf");
    await gravarArquivo(BUCKET_CLUBE, assinatura, imagem, "image/png");
  } catch (err) {
    log.error({ err }, "gravar termo assinado");
    await removerArquivos(BUCKET_CLUBE, [arquivo, assinatura]);
    throw new ErroDeNegocio("Não foi possível guardar o termo. Tente de novo.");
  }
  try {
    return await gravarTermo(ctx, {
      participanteId: d.participante_id,
      ano: d.ano,
      assinadoEm: d.assinado_em,
      arquivo,
      assinatura,
    });
  } catch (e) {
    await removerArquivos(BUCKET_CLUBE, [arquivo, assinatura]);
    throw e;
  }
}

export async function removerTermo(ctx: Contexto, id: string): Promise<string> {
  await exigirEditar(ctx);
  const t = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.removerTermo(tx, id),
  );
  if (!t) throw new ErroDeNegocio("Termo não encontrado.");
  await removerArquivos(
    BUCKET_CLUBE,
    [t.arquivo, t.assinatura].filter((c): c is string => !!c),
  );
  return "Termo removido.";
}

/** Link (60 s) do PDF do termo ou da assinatura, para quem vê o participante. */
export async function linkDoTermo(
  ctx: Contexto,
  termoId: string,
  qual: "arquivo" | "assinatura",
): Promise<string> {
  exigirVer(ctx);
  const t = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.arquivosDoTermo(tx, termoId),
  );
  const caminho = t?.[qual];
  if (!caminho) throw new ErroDeNegocio("Este termo não tem esse arquivo.");
  const url = await linkDeLeitura(BUCKET_CLUBE, caminho, { segundos: 60 });
  if (!url)
    throw new ErroDeNegocio(
      "O arquivo não está no armazenamento (pode ser um termo de exemplo).",
    );
  return url;
}

// ---------------------------------------------------------------------------
// Contribuições e ações
// ---------------------------------------------------------------------------

/**
 * Contribuição recebida (data, forma, valor, competência, observação). O
 * valor pode ser zero (doação de material, por exemplo). O módulo não gera
 * cobrança: só registra o que foi recebido.
 */
export async function registrarContribuicao(
  ctx: Contexto,
  d: z.output<typeof contribuicaoDoClube>,
): Promise<string> {
  const v = lerReais(d.valor);
  if (!v.ok) throw new ErroDeNegocio(v.erro);
  if (d.data > hoje() || d.data < "2000-01-01")
    throw new ErroDeNegocio("A data não pode ser depois de hoje.");
  await exigirEditar(ctx);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const formas = (await parametros(tx)).formas_contribuicao;
    if (!formas.includes(d.forma))
      throw new ErroDeNegocio("Forma fora da lista. Recarregue a tela.");
    // Contribuição e valor juntos: um sem o outro não fica.
    await repo.inserirContribuicao(
      tx,
      {
        id: randomUUID(),
        participante_id: d.participante_id,
        data: d.data,
        forma: d.forma,
        competencia: competenciaDoMes(d.competencia),
        observacao: d.observacao,
      },
      v.valor,
    );
  });
  return "Contribuição registrada.";
}

export async function removerContribuicao(
  ctx: Contexto,
  id: string,
): Promise<string> {
  await exigirEditar(ctx);
  const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.removerContribuicao(tx, id),
  );
  if (!r) throw new ErroDeNegocio("Contribuição não encontrada.");
  return "Contribuição removida.";
}

export async function registrarAcao(
  ctx: Contexto,
  d: z.output<typeof acaoDoClube>,
): Promise<string> {
  if (d.data > hoje() || d.data < "2000-01-01")
    throw new ErroDeNegocio("A data não pode ser depois de hoje.");
  await exigirEditar(ctx);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const tipos = (await parametros(tx)).tipos_acao;
    if (!tipos.includes(d.tipo))
      throw new ErroDeNegocio("Tipo fora da lista. Recarregue a tela.");
    await repo.inserirAcao(tx, {
      id: randomUUID(),
      participante_id: d.participante_id,
      data: d.data,
      tipo: d.tipo,
      observacao: d.observacao,
    });
  });
  return "Ação registrada.";
}

export async function removerAcao(ctx: Contexto, id: string): Promise<string> {
  await exigirEditar(ctx);
  const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.removerAcao(tx, id),
  );
  if (!r) throw new ErroDeNegocio("Ação não encontrada.");
  return "Ação removida.";
}
