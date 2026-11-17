import { nomeSeguro } from "@arp/shared/arquivos/nome";
import { formatarData, formatarDataHora } from "@arp/shared/formato";
import { numeroDo } from "@arp/shared/os/numeros";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type {
  entradaAtivacao,
  entradaDispensa,
  entradaPrazo,
  entradaRascunho,
  entradaTransferencia,
} from "@arp/shared/sustentabilidade/contratos/entrevistas";
import {
  MODULO_DOS_CHAMADOS,
  refDaEntrevista,
} from "@arp/shared/sustentabilidade/entrevistas-chamados";
import { setorDeMenorValidade } from "@arp/shared/sustentabilidade/entrevistas-controle";
import {
  ROTULO_TIPO_ENTREVISTA,
  textoDoSetor,
  valoresAutomaticos,
} from "@arp/shared/sustentabilidade/entrevistas-respostas";
import { validarRespostas } from "@arp/shared/sustentabilidade/formulario/tipos";
import { respostasVisiveis } from "@arp/shared/sustentabilidade/formulario/visibilidade";
import { ehPdf } from "@arp/shared/sustentabilidade/rcc-lancamento";
import { ehImagem } from "@arp/shared/sustentabilidade/rondas-lancamento";
import {
  contratoEntraNaLista,
  proximaDataDaEntrevista,
} from "@arp/shared/sustentabilidade/situacao";
import type { z } from "zod";
import type { Contexto } from "@/contexto";
import {
  ErroDaApi,
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
} from "@/erros";
import {
  ArquivoJaExiste,
  gravarArquivo,
  lerArquivo,
  removerArquivos,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import {
  cancelarPeloSistema,
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/modules/os/sistema.service";
import { tentar } from "@/modules/os/tentar";
import { contextoSu, podeAgora } from "./acesso";
import { parametros, parametrosDaEntrevista } from "./base.service";
import { gerarPdfDaEntrevista } from "./entrevista-pdf";
import * as repo from "./entrevistas.repository";
import {
  anexosDe,
  BUCKET,
  comoRespostas,
  versoesDoQuestionario,
} from "./entrevistas.service";
import {
  abrirChamadoDaEntrevista,
  guardarChamado,
  motivoDoCancelamento,
  mudarPrazoDoChamado,
  precisaDeChamado,
  situacaoDosContratos,
} from "./rotinas.service";

// Gravações das entrevistas (spec 4.4). Com a sessão, pelo RLS: quem aplica
// grava o próprio rascunho e o salva; "dispensar ou corrigir" muda as
// colunas do módulo no contrato e a entrevista salva. O que liga ao
// Chamados (concluir, cancelar, abrir o próximo, contratos.chamado_id) vai
// pela service role, sempre depois de podeAgora.

const APLICAR = "sustentabilidade.entrevistas.aplicar";
const DISPENSAR = "sustentabilidade.entrevistas.dispensar";
const SEM_APLICAR =
  "Você não tem permissão para aplicar entrevistas. Peça a liberação ao administrador.";
const SEM_DISPENSAR =
  "Você não tem permissão para dispensar ou corrigir entrevistas. Peça a liberação ao administrador.";
export const ASSINATURA_MAX = 1024 * 1024;
export const ANEXO_MAX_MB = 9;
const TIPOS_ANEXO = ["application/pdf", "image/jpeg", "image/png"];

export interface ArquivoDoForm {
  nome: string;
  tipo: string;
  bytes: Uint8Array;
}

/**
 * As mensagens do sistema antigo para o erro do banco: sem permissão, valor
 * fora do permitido e, no resto, "tente de novo" (com o erro no log).
 */
async function comMensagens<T>(onde: string, p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (
      e instanceof ErroDePermissao &&
      e.message.startsWith("Você não tem permissão para esta alteração")
    )
      throw new ErroDePermissao(
        "Você não tem permissão para esta ação. Peça a liberação ao administrador.",
      );
    if (
      (e instanceof ErroDeNegocio &&
        e.message === "Valor fora do permitido.") ||
      codigoDoBanco(e) === "22P02"
    )
      throw new ErroDeNegocio(
        "Algum valor está fora do permitido. Confira os campos.",
      );
    if (e instanceof ErroDaApi) throw e;
    log.error({ err: e }, onde);
    throw new ErroDeNegocio(
      "Não foi possível salvar. Tente de novo em instantes.",
    );
  }
}

/**
 * Deixa o chamado do contrato de acordo com a situação: fora da lista ou
 * dispensado, cancela; precisa de entrevista, abre (ou acerta o prazo) com
 * a data prevista. A `tx` é do `comoServico`; quem chama já conferiu
 * podeAgora.
 */
async function ajustarChamado(
  tx: Tx,
  contratoId: string,
): Promise<string | null> {
  const hoje = hojeEmBrasilia(new Date());
  const { linhas, contratos } = await situacaoDosContratos(tx, hoje, [
    contratoId,
  ]);
  const l = linhas[0];
  const c = contratos[0];
  if (!l || !c || c.exemplo) return null;
  const aberto = await chamadoAbertoDaOrigem(
    tx,
    MODULO_DOS_CHAMADOS,
    refDaEntrevista(contratoId),
  );
  if (!l.naLista || l.situacao === "dispensada") {
    if (!aberto) return null;
    await cancelarPeloSistema(tx, {
      chamadoId: aberto.id,
      motivo: motivoDoCancelamento(l),
    });
    await guardarChamado(tx, contratoId, null);
    return `O chamado ${numeroDo(aberto)} foi cancelado.`;
  }
  if (aberto) {
    await mudarPrazoDoChamado(tx, aberto.id, l.dataPrevista);
    if (c.chamado_id !== aberto.id)
      await guardarChamado(tx, contratoId, aberto.id);
    return l.dataPrevista
      ? `Prazo do chamado ${numeroDo(aberto)}: ${formatarData(l.dataPrevista)}.`
      : null;
  }
  if (!precisaDeChamado(l) && !l.validaAte) return null;
  const novo = await abrirChamadoDaEntrevista(tx, c, l.dataPrevista);
  return novo
    ? `Chamado #${novo.numero} aberto${l.dataPrevista ? ` para ${formatarData(l.dataPrevista)}` : ""}.`
    : null;
}

/** ajustarChamado sem derrubar a ação: devolve o texto para a mensagem. */
async function ajustarComAviso(ctx: Contexto, id: string): Promise<string> {
  if (!(await podeAgora(ctx, DISPENSAR))) return "";
  try {
    const t = await banco.comoServico((tx) => ajustarChamado(tx, id));
    return t ? ` ${t}` : "";
  } catch (err) {
    log.error({ err, contrato: id }, "ajustar chamado da entrevista");
    return " O chamado será acertado pela rotina diária.";
  }
}

// ---------------------------------------------------------------------------
// Rascunho (enviado do aparelho a cada resposta; idempotente pela chave)
// ---------------------------------------------------------------------------

export function salvarRascunho(
  ctx: Contexto,
  d: z.output<typeof entradaRascunho>,
): Promise<{ salva: boolean }> {
  const respostas = JSON.stringify(d.respostas);
  if (respostas.length > 200_000)
    throw new ErroDeNegocio("Respostas grandes demais para salvar.");
  const { chave, contratoId, versao } = d;
  return comMensagens(
    "rascunho da entrevista",
    banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const atual = await repo.rascunhoPorChave(tx, chave);
      if (atual?.situacao === "salva") return { salva: true };
      if (atual) {
        await repo.atualizarRespostas(tx, { id: atual.id }, respostas);
        return { salva: false };
      }

      if (!ctx.permissoes.has(APLICAR)) throw new ErroDePermissao(SEM_APLICAR);
      const { hoje } = await contextoSu(tx, ctx);
      if (!(await versoesDoQuestionario(tx)).has(versao))
        throw new ErroDeNegocio(
          "Esta versão do questionário não existe mais. Recarregue a tela.",
        );
      const contrato = await repo.contratoParaRascunho(tx, contratoId);
      if (!contrato) throw new ErroDeNegocio("Contrato não encontrado.");
      const jaTem = await repo.contratoTemEntrevista(tx, contratoId);
      const t = await tentar(tx, () =>
        repo.inserirRascunho(tx, {
          contrato_id: contratoId,
          lucs: contrato.lucs,
          cliente_doc: contrato.cliente_doc,
          data: hoje,
          tipo: jaTem ? "atualizacao" : "primeira",
          formulario_versao: versao,
          respostas,
          rascunho_chave: chave,
          entrevistador_id: ctx.usuario.id,
        }),
      );
      if (!t.ok && t.codigo === "23505") {
        // Dois envios da mesma chave ao mesmo tempo: o outro já criou a linha.
        await repo.atualizarRespostas(tx, { chave }, respostas);
        return { salva: false };
      }
      if (!t.ok) throw t.erro;
      // Só um rascunho por contrato e pessoa: o de outra chave (outro
      // aparelho ou recomeço) sai.
      await repo.apagarOutrosRascunhos(tx, contratoId, ctx.usuario.id, chave);
      return { salva: false };
    }),
  );
}

// ---------------------------------------------------------------------------
// Assinaturas (componente Assinatura)
// ---------------------------------------------------------------------------

export async function assinarEntrevista(
  ctx: Contexto,
  d: { chave: string; quem: "respondente" | "entrevistador"; nome: string },
  png: ArquivoDoForm | undefined,
): Promise<string> {
  if (!png || png.bytes.length === 0 || png.tipo !== "image/png")
    throw new ErroDeNegocio("Assine no quadro antes de salvar.");
  if (png.bytes.length > ASSINATURA_MAX)
    throw new ErroDeNegocio("Assinatura grande demais.");
  if (png.bytes[0] !== 0x89 || png.bytes[1] !== 0x50)
    throw new ErroDeNegocio("A assinatura não é uma imagem PNG.");

  const r = await comMensagens(
    "ler rascunho para assinar",
    banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.rascunhoPorChave(tx, d.chave),
    ),
  );
  if (!r)
    throw new ErroDeNegocio(
      "As respostas ainda não chegaram ao servidor. Espere o indicador ficar em “Salvo” e assine de novo.",
    );
  if (r.situacao !== "rascunho")
    throw new ErroDeNegocio("Esta entrevista já foi salva.");

  const respondente = d.quem === "respondente";
  const caminho = `entrevistas/${r.id}/assinatura-${d.quem}-${Date.now()}.png`;
  try {
    await gravarArquivo(BUCKET, caminho, png.bytes, "image/png");
  } catch (err) {
    log.error({ err }, "assinatura da entrevista");
    throw new ErroDeNegocio(
      "Não foi possível guardar a assinatura. Tente de novo.",
    );
  }
  try {
    await comMensagens(
      "gravar assinatura",
      banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.gravarAssinatura(
          tx,
          r.id,
          respondente
            ? { assinatura_respondente: caminho, respondente_nome: d.nome }
            : { assinatura_entrevistador: caminho },
        ),
      ),
    );
  } catch (e) {
    await removerArquivos(BUCKET, [caminho]);
    throw e;
  }
  const antiga = respondente
    ? r.assinatura_respondente
    : r.assinatura_entrevistador;
  if (antiga) await removerArquivos(BUCKET, [antiga]);
  return respondente
    ? "Assinatura do respondente salva."
    : "Assinatura do entrevistador salva.";
}

// ---------------------------------------------------------------------------
// Salvar a entrevista: PDF, situação, chamado concluído e o próximo
// ---------------------------------------------------------------------------

/**
 * Salva a entrevista do rascunho. A ordem não deixa estado quebrado: grava
 * o PDF (nome fixo, não regrava), muda o rascunho para "salva" (o dado da
 * entrevista), conclui o chamado aberto e abre o próximo. Se algo falhar
 * depois de salva, chamar de novo com a mesma chave só refaz o que faltou.
 */
export async function concluirEntrevista(
  ctx: Contexto,
  chave: string,
): Promise<{ mensagem: string; aviso?: string }> {
  if (!(await podeAgora(ctx, APLICAR))) throw new ErroDePermissao(SEM_APLICAR);
  const lido = await comMensagens(
    "ler rascunho para salvar",
    banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const r = await repo.rascunhoPorChave(tx, chave);
      if (!r)
        throw new ErroDeNegocio(
          "As respostas ainda não chegaram ao servidor. Espere o indicador ficar em “Salvo” (com conexão) e salve de novo.",
        );
      const c = await repo.contratoParaConcluir(tx, r.contrato_id);
      if (!c) throw new ErroDeNegocio("Contrato não encontrado.");
      const def = (await versoesDoQuestionario(tx)).get(r.formulario_versao);
      if (!def)
        throw new ErroDeNegocio(
          "A versão do questionário desta entrevista não foi encontrada.",
        );
      return {
        r,
        c,
        def,
        pe: await parametrosDaEntrevista(tx),
        p: await parametros(tx),
        hoje: (await contextoSu(tx, ctx)).hoje,
        temAnterior: await repo.contratoTemEntrevista(tx, c.id),
      };
    }),
  );
  const { r, c, def, pe, p, hoje } = lido;

  let validaAte = r.valida_ate;
  const data = r.data;
  if (r.situacao === "rascunho") {
    const tipo = lido.temAnterior ? "atualizacao" : "primeira";
    const respostas = respostasVisiveis(def, {
      ...comoRespostas(r.respostas),
      ...valoresAutomaticos(def, {
        empresa: c.cliente_nome,
        lucs: c.lucs,
        tipo,
        data,
      }),
    });
    const erros = validarRespostas(def, respostas);
    const faltam = Object.keys(erros).length;
    if (faltam)
      throw new ErroDeValidacao(
        `${faltam === 1 ? "Uma pergunta precisa" : `${faltam} perguntas precisam`} de resposta ou de “Não se aplica”. Volte às seções marcadas.`,
        erros,
      );
    if (!r.assinatura_respondente || !r.assinatura_entrevistador)
      throw new ErroDeNegocio(
        "Faltam as assinaturas do respondente e do entrevistador.",
      );

    const setor = textoDoSetor(def, respostas);
    validaAte = proximaDataDaEntrevista(
      data,
      setorDeMenorValidade(setor, pe),
      c.validade_meses_especifica,
      pe,
    );

    // PDF assinado (nome fixo: numa segunda tentativa, o arquivo já existe).
    const caminhoPdf = `entrevistas/${r.id}/entrevista-${data}.pdf`;
    try {
      const pngR = await lerArquivo(BUCKET, r.assinatura_respondente);
      const pngE = await lerArquivo(BUCKET, r.assinatura_entrevistador);
      const pdf = await gerarPdfDaEntrevista({
        empresa: c.cliente_nome,
        lucs: c.lucs,
        contrato: c.contrato,
        tipo: ROTULO_TIPO_ENTREVISTA[tipo],
        data: formatarData(data),
        versao: r.formulario_versao,
        definicao: def,
        respostas,
        assinaturas: [
          {
            nome: r.respondente_nome ?? "Respondente",
            papel: "Respondente",
            png: pngR,
          },
          {
            nome: ctx.usuario.nome,
            papel: "Entrevistador(a) – equipe ARP",
            png: pngE,
          },
        ],
        salvaEm: formatarDataHora(new Date().toISOString()).replace(
          " ",
          " às ",
        ),
        validaAte: formatarData(validaAte),
      });
      await gravarArquivo(BUCKET, caminhoPdf, pdf, "application/pdf");
    } catch (err) {
      if (!(err instanceof ArquivoJaExiste)) {
        log.error({ err }, "PDF da entrevista");
        throw new ErroDeNegocio("Não foi possível gerar o PDF. Tente de novo.");
      }
    }

    const salva = await comMensagens(
      "salvar entrevista",
      banco
        .comoUsuario(ctx.usuario.id, (tx) =>
          repo.salvarEntrevista(tx, r.id, {
            respostas: JSON.stringify(respostas),
            setor,
            tipo,
            valida_ate: validaAte,
            pdf: caminhoPdf,
          }),
        )
        .catch((e: unknown) => {
          if (e instanceof ErroDeConflito)
            throw new ErroDeNegocio(
              `Já existe uma entrevista salva deste contrato em ${formatarData(data)}. Abra a ficha do contrato para conferir.`,
            );
          throw e;
        }),
    );
    if (!salva)
      throw new ErroDeNegocio(
        "Esta entrevista mudou enquanto salvava. Recarregue a tela.",
      );
  }

  // Chamados (service role, já conferido podeAgora acima).
  let partes = ["Entrevista salva."];
  let aviso: string | undefined;
  try {
    const feitas = await banco.comoServico(async (tx) => {
      const ditas: string[] = [];
      let aberto = await chamadoAbertoDaOrigem(
        tx,
        MODULO_DOS_CHAMADOS,
        refDaEntrevista(c.id),
      );
      // O aberto já é o próximo (segunda tentativa depois de abrir o próximo).
      const ehProximo =
        !!aberto?.prazo &&
        !!validaAte &&
        hojeEmBrasilia(new Date(aberto.prazo)) === validaAte;
      if (aberto && !ehProximo && !r.chamado_id) {
        const concluiu = await concluirPeloSistema(tx, {
          chamadoId: aberto.id,
          texto: `Entrevista salva em ${formatarData(data)} por ${ctx.usuario.nome}.${validaAte ? ` Válida até ${formatarData(validaAte)}.` : ""}`,
          concluidoPor: ctx.usuario.id,
        });
        await repo.ligarChamado(tx, r.id, aberto.id);
        if (concluiu) ditas.push(`Chamado ${numeroDo(aberto)} concluído.`);
        aberto = null;
      }
      const segue =
        !c.exemplo &&
        !c.dispensada_motivo &&
        contratoEntraNaLista(
          {
            situacao: c.situacao === "vigente" ? "vigente" : "encerrado",
            rescisao: c.rescisao,
            tipoLoja: c.tipo_loja,
          },
          { hoje, tiposLojaDispensados: p.tipos_loja_dispensados },
        );
      if (!aberto && segue && validaAte) {
        const novo = await abrirChamadoDaEntrevista(tx, c, validaAte);
        if (novo)
          ditas.push(
            `Próximo chamado (#${novo.numero}) em ${formatarData(validaAte)}.`,
          );
      } else if (ehProximo && aberto && validaAte) {
        ditas.push(
          `Próximo chamado (${numeroDo(aberto)}) em ${formatarData(validaAte)}.`,
        );
      }
      return ditas;
    });
    partes = [...partes, ...feitas];
  } catch (err) {
    log.error({ err }, "chamados da entrevista salva");
    aviso =
      "A entrevista foi salva, mas o chamado não foi atualizado. Toque em Salvar de novo para concluir o chamado.";
  }
  return { mensagem: partes.join(" "), aviso };
}

// ---------------------------------------------------------------------------
// Atalho da pergunta 13: interesse no Clube
// ---------------------------------------------------------------------------

export async function registrarInteresse(
  ctx: Contexto,
  contratoId: string,
): Promise<string> {
  if (!(await podeAgora(ctx, APLICAR))) throw new ErroDePermissao(SEM_APLICAR);
  const c = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.clienteDoContrato(tx, contratoId),
  );
  if (!c) throw new ErroDeNegocio("Contrato não encontrado.");
  const doc = c.cliente_doc ?? "";
  if (!/^(\d{11}|\d{14})$/.test(doc))
    throw new ErroDeNegocio(
      "O contrato não tem CPF ou CNPJ válido no cadastro: registre o interesse pela tela do Clube.",
    );
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.inserirInteressado(tx, doc, c.cliente_nome.slice(0, 200)),
    );
  } catch (e) {
    if (!(e instanceof ErroDeConflito))
      return comMensagens("interesse no clube", Promise.reject(e));
    // Já está no Clube (ou já tinha interesse): marca o interesse de novo.
    await comMensagens(
      "interesse no clube",
      banco.comoServico((tx) => repo.marcarInteresse(tx, doc)),
    );
  }
  return "Interesse registrado no Clube SustentArp.";
}

// ---------------------------------------------------------------------------
// Ficha: dispensar, desfazer, corrigir inauguração, prazo, transferir, anexar
// ---------------------------------------------------------------------------

export async function dispensarEntrevista(
  ctx: Contexto,
  d: z.output<typeof entradaDispensa>,
): Promise<string> {
  const motivos = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => (await parametros(tx)).motivos_dispensa,
  );
  if (!motivos.includes(d.motivo))
    throw new ErroDeNegocio("Escolha um dos motivos dos Parâmetros.");
  if (d.motivo === "Outro" && !d.observacao)
    throw new ErroDeNegocio("Com o motivo “Outro”, escreva a observação.");
  const texto = (
    d.observacao ? `${d.motivo} – ${d.observacao}` : d.motivo
  ).slice(0, 500);
  const r = await comMensagens(
    "dispensar entrevista",
    banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.atualizarContrato(tx, d.contrato_id, { dispensada_motivo: texto }),
    ),
  );
  if (!r) throw new ErroDePermissao(SEM_DISPENSAR);

  let chamado = "";
  if (await podeAgora(ctx, DISPENSAR)) {
    try {
      chamado = await banco.comoServico(async (tx) => {
        const aberto = await chamadoAbertoDaOrigem(
          tx,
          MODULO_DOS_CHAMADOS,
          refDaEntrevista(d.contrato_id),
        );
        let t = "";
        if (aberto) {
          await cancelarPeloSistema(tx, {
            chamadoId: aberto.id,
            motivo: `Entrevista dispensada: ${texto}`,
          });
          t = ` O chamado ${numeroDo(aberto)} foi cancelado com o mesmo motivo.`;
        }
        await guardarChamado(tx, d.contrato_id, null);
        return t;
      });
    } catch (err) {
      log.error({ err }, "cancelar chamado da dispensa");
      chamado =
        " O chamado não foi cancelado agora; a rotina diária cancela amanhã.";
    }
  }
  return `Entrevista dispensada.${chamado}`;
}

export async function desfazerDispensa(
  ctx: Contexto,
  contratoId: string,
): Promise<string> {
  const r = await comMensagens(
    "desfazer dispensa",
    banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.atualizarContrato(tx, contratoId, { dispensada_motivo: null }),
    ),
  );
  if (!r) throw new ErroDePermissao(SEM_DISPENSAR);
  const chamado = await ajustarComAviso(ctx, contratoId);
  return `Dispensa desfeita.${chamado}`;
}

export async function corrigirAtivacao(
  ctx: Contexto,
  d: z.output<typeof entradaAtivacao>,
): Promise<string> {
  const r = await comMensagens(
    "corrigir ativação",
    banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.atualizarContrato(tx, d.contrato_id, {
        ativacao_corrigida: d.data || null,
        ativacao_corrigida_motivo: d.data ? d.motivo : null,
      }),
    ),
  );
  if (!r) throw new ErroDePermissao(SEM_DISPENSAR);
  const chamado = await ajustarComAviso(ctx, d.contrato_id);
  return d.data
    ? `Data de inauguração corrigida para ${formatarData(d.data)}.${chamado}`
    : `Correção retirada: vale a data do cadastro.${chamado}`;
}

export async function prazoDoContrato(
  ctx: Contexto,
  d: z.output<typeof entradaPrazo>,
): Promise<string> {
  const r = await comMensagens(
    "prazo do contrato",
    banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.atualizarContrato(tx, d.contrato_id, {
        validade_meses_especifica: d.meses,
      }),
    ),
  );
  if (!r) throw new ErroDePermissao(SEM_DISPENSAR);
  const chamado = await ajustarComAviso(ctx, d.contrato_id);
  return d.meses
    ? `Prazo deste contrato: ${d.meses} meses.${chamado}`
    : `Prazo específico retirado: vale o do setor.${chamado}`;
}

export async function transferirEntrevista(
  ctx: Contexto,
  d: z.output<typeof entradaTransferencia>,
): Promise<string> {
  if (!(await podeAgora(ctx, DISPENSAR)))
    throw new ErroDePermissao(SEM_DISPENSAR);
  let dataDaEntrevista = "";
  const de = await comMensagens(
    "transferir entrevista",
    banco
      .comoUsuario(ctx.usuario.id, async (tx) => {
        const e = await repo.entrevistaSalva(tx, d.entrevista_id);
        if (!e) throw new ErroDeNegocio("Entrevista não encontrada.");
        dataDaEntrevista = e.data;
        if (e.contrato_id === d.para_contrato_id)
          throw new ErroDeNegocio("Escolha outro contrato.");
        const cs = await repo.contratosPorIds(tx, [
          e.contrato_id,
          d.para_contrato_id,
        ]);
        const origem = cs.find((c) => c.id === e.contrato_id);
        const destino = cs.find((c) => c.id === d.para_contrato_id);
        if (!origem || !destino)
          throw new ErroDeNegocio("Contrato não encontrado.");
        if (!origem.cliente_doc || origem.cliente_doc !== destino.cliente_doc)
          throw new ErroDeNegocio(
            "Só dá para transferir para outro contrato do mesmo cliente (mesmo CPF ou CNPJ).",
          );
        // A transferência e o registro dela juntos: um sem o outro não fica.
        await repo.moverEntrevista(tx, e.id, {
          contrato_id: destino.id,
          lucs: destino.lucs,
          cliente_doc: destino.cliente_doc,
        });
        await repo.inserirTransferencia(tx, {
          entrevista_id: e.id,
          de_contrato_id: e.contrato_id,
          para_contrato_id: destino.id,
          motivo: d.motivo,
          quem: ctx.usuario.id,
        });
        return e.contrato_id;
      })
      .catch((e: unknown) => {
        if (e instanceof ErroDeConflito)
          throw new ErroDeNegocio(
            `O contrato de destino já tem entrevista em ${formatarData(dataDaEntrevista)}.`,
          );
        throw e;
      }),
  );
  const a = await ajustarComAviso(ctx, de);
  const b = await ajustarComAviso(ctx, d.para_contrato_id);
  return `Entrevista transferida.${a}${b}`;
}

export async function anexarPapel(
  ctx: Contexto,
  entrevistaId: string,
  arquivo: ArquivoDoForm | undefined,
): Promise<string> {
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha o arquivo digitalizado (PDF ou foto).");
  if (!TIPOS_ANEXO.includes(arquivo.tipo))
    throw new ErroDeNegocio("Envie um PDF, JPG ou PNG.");
  if (arquivo.bytes.length > ANEXO_MAX_MB * 1024 * 1024)
    throw new ErroDeNegocio(`O arquivo passa de ${ANEXO_MAX_MB} MB.`);
  // Confere pelos primeiros bytes: não confia no tipo que o navegador disse.
  const inicio = arquivo.bytes.slice(0, 16);
  if (!(ehPdf(inicio) || ehImagem(inicio)))
    throw new ErroDeNegocio(
      "O arquivo não é um PDF nem uma foto. Envie um PDF, JPG ou PNG.",
    );
  if (!(await podeAgora(ctx, DISPENSAR)))
    throw new ErroDePermissao(SEM_DISPENSAR);
  const e = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.entrevistaSalva(tx, entrevistaId),
  );
  if (!e) throw new ErroDeNegocio("Entrevista não encontrada.");
  const caminho = `entrevistas/${e.id}/anexos/${Date.now()}-${nomeSeguro(arquivo.nome, "papel")}`;
  try {
    await gravarArquivo(BUCKET, caminho, arquivo.bytes, arquivo.tipo);
  } catch (err) {
    log.error({ err }, "anexo da entrevista");
    throw new ErroDeNegocio(
      "Não foi possível guardar o arquivo. Tente de novo.",
    );
  }
  const anexos = [
    ...anexosDe(e.anexos),
    { nome: arquivo.nome.slice(0, 200), caminho },
  ];
  try {
    await comMensagens(
      "anexar papel",
      banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.gravarAnexos(tx, e.id, JSON.stringify(anexos)),
      ),
    );
  } catch (err) {
    await removerArquivos(BUCKET, [caminho]);
    throw err;
  }
  return "Arquivo anexado à entrevista.";
}
