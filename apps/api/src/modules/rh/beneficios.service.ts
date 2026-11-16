import {
  competenciaDe,
  fimDoMes,
  formatarMes,
  formatarNumero,
  lerValorBr,
} from "@arp/shared/formato";
import {
  entradaBeneficio,
  entradaTotalDoMes,
  entradaValoresDoMes,
  entradaValorManual,
  entradaVinculo,
  entradaVinculoContrato,
  type RespostaBeneficios,
  ROTULOS_BENEFICIO,
} from "@arp/shared/rh/contratos/beneficios";
import { ErroPlanilha } from "@arp/shared/rh/plano";
import {
  casarPorNome,
  lerValoresDaPlanilha,
} from "@arp/shared/rh/valores-mensais";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { campo, exigirComMensagem, validarFormulario, valores } from "./apoio";
import { abasDoXlsx, ehXlsx, TAMANHO_MAXIMO } from "./arquivos";
import * as repo from "./beneficios.repository";
import { recalcularEmAberto, tentarRecalcular } from "./custo.service";
import * as dados from "./dados.repository";

// Benefícios (rh.beneficios): o catálogo, quem recebe, os valores do mês e
// os dependentes (beneficios.ts, dependentes.ts e acoes/cadastros.ts do
// antigo). Toda gravação passa pelo RLS e cai em core.auditoria; mudar o
// benefício muda o custo: recalcula as folhas em aberto (service role,
// depois de conferir a permissão no banco).

const SEM_PERMISSAO = "Você não tem permissão para cadastrar benefícios.";

const exigirBeneficios = (ctx: Contexto) =>
  exigirComMensagem(ctx, ["rh.beneficios"], SEM_PERMISSAO);

/** GET /rh/beneficios */
export function beneficios(ctx: Contexto): Promise<RespostaBeneficios> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const catalogo = (await dados.beneficios(tx)).map((b) => ({
      ...b,
      forma_calculo:
        b.forma_calculo === "rateado"
          ? ("rateado" as const)
          : ("por_funcionario" as const),
    }));
    const vinculos = (await repo.vinculos(tx))
      .map((v) => ({
        id: v.id,
        beneficio_id: v.beneficio_id,
        colaborador_id: v.colaborador_id,
        nome: v.nome ?? "—",
        matricula: v.matricula ?? null,
        nascimento: v.nascimento ?? null,
        desde: v.desde,
        ate: v.ate,
        valor_manual: v.valor_manual,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const contratos = await repo.contratos(tx);
    const colaboradores = await repo.colaboradoresAtivos(tx);
    const tabelas = (await repo.tabelasDoPlano(tx)).map((t) => ({
      id: t.id,
      beneficio_id: t.beneficio_id,
      beneficio: t.beneficio ?? "—",
      vigente_desde: t.vigente_desde,
      reajuste_pct: t.reajuste_pct,
      faixas: t.faixas.map((f) => ({
        ...f,
        mensalidade: Number(f.mensalidade),
      })),
      regras: Number(t.regras ?? 0),
    }));
    const folhas = await dados.folhas(tx);
    const lancados = await repo.valoresMensais(tx);
    const totais = await repo.totaisMensais(tx);
    const departamentos = await dados.departamentos(tx);
    // Só plano e odonto têm dependentes; sem nenhum dos dois, nem lê.
    const dependentes = catalogo.some(
      (b) => b.tipo === "plano_saude" || b.tipo === "odonto",
    )
      ? (await repo.dependentes(tx))
          .map(({ titular, ...d }) => ({ ...d, titular: titular ?? "—" }))
          .sort(
            (a, b) =>
              a.titular.localeCompare(b.titular) ||
              a.nome.localeCompare(b.nome),
          )
      : [];
    return {
      beneficios: catalogo,
      vinculos,
      contratos,
      colaboradores,
      tabelas,
      lancados,
      totais,
      departamentos,
      dependentes,
      mesAtual: competenciaDe(new Date()),
      desdeSugerido: folhas[0]?.competencia ?? null,
    };
  });
}

/** Grava e recalcula o custo; a mensagem diz se o recálculo deu certo. */
async function salvoERecalculado(ok: string, desde?: string): Promise<string> {
  const calculado = await tentarRecalcular(() => recalcularEmAberto(desde));
  return calculado ? `${ok} Custo recalculado.` : ok;
}

/** Benefício novo (devolve o id) ou alterado (devolve a mensagem). */
export async function salvarBeneficio(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<{ id: string } | { mensagem: string }> {
  await exigirBeneficios(ctx);
  const { id, ...b } = validarFormulario(
    entradaBeneficio,
    campos,
    ROTULOS_BENEFICIO,
  );
  const rateado = b.forma_calculo === "rateado";
  const registro = {
    ...b,
    // Valor por mês: o valor sai dos lançamentos, não de um padrão.
    valor_padrao: b.valor_por_mes ? null : b.valor_padrao,
    dependente_valor:
      b.dependente_regra === "nao_paga" ? null : b.dependente_valor,
    // Divisão só no rateado; departamento só quando divide por ele.
    dividir_entre: rateado ? b.dividir_entre : null,
    dividir_departamento_id:
      rateado && b.dividir_entre === "departamento"
        ? b.dividir_departamento_id
        : null,
  };
  if (id) {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.atualizarBeneficio(tx, id, registro),
    );
    return { mensagem: await salvoERecalculado("Benefício salvo.") };
  }
  // Novo: a tela abre a página dele, para vincular quem recebe.
  return banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.criarBeneficio(tx, registro),
  );
}

export async function vincular(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirBeneficios(ctx);
  const v = validarFormulario(entradaVinculo, campos, {
    colaborador_id: "Colaborador",
    desde: "Desde",
    valor_manual: "Valor manual",
  });
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    if (await repo.temVinculoAberto(tx, v.beneficio_id, v.colaborador_id))
      throw new ErroDeNegocio("Este colaborador já recebe o benefício.");
    await repo.vincular(tx, [v]);
  });
  return salvoERecalculado("Vinculado.");
}

/**
 * Todos com o tipo de contrato recebem o benefício, inclusive quem for
 * admitido depois. Quem já tem o benefício vinculado à pessoa fica com o dela.
 */
export async function vincularContrato(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirBeneficios(ctx);
  const v = validarFormulario(entradaVinculoContrato, campos, {
    tipo_contrato: "Tipo de contrato",
    desde: "Desde",
  });
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    if (await repo.temContratoAberto(tx, v.beneficio_id, v.tipo_contrato))
      throw new ErroDeNegocio("Este tipo de contrato já recebe o benefício.");
    await repo.vincularContrato(tx, v);
  });
  return salvoERecalculado("Vinculado ao tipo de contrato.");
}

const idDoVinculo = z.uuid();

export async function removerContrato(
  ctx: Contexto,
  id: string,
): Promise<string> {
  await exigirBeneficios(ctx);
  if (!idDoVinculo.safeParse(id).success)
    throw new ErroDeNegocio("Vínculo inválido.");
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.removerContrato(tx, id));
  return salvoERecalculado("Removido.");
}

/** Valor manual de quem já recebe; vazio volta para a faixa (ou o padrão). */
export async function salvarValorManual(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirBeneficios(ctx);
  const v = validarFormulario(entradaValorManual, campos, {
    valor_manual: "Valor manual",
  });
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarValorManual(tx, v.id, v.valor_manual),
  );
  return salvoERecalculado(
    v.valor_manual === null ? "Valor manual removido." : "Valor manual salvo.",
  );
}

export async function removerVinculo(
  ctx: Contexto,
  id: string,
): Promise<string> {
  await exigirBeneficios(ctx);
  if (!idDoVinculo.safeParse(id).success)
    throw new ErroDeNegocio("Vínculo inválido.");
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.removerVinculo(tx, id));
  return salvoERecalculado("Removido.");
}

/**
 * Vincula quem tem desconto deste benefício na última folha (ex.: 307 do
 * plano), a partir do mês dessa folha. Lê só quem tem a rubrica, nunca o
 * valor; a leitura usa a service role porque a folha individual exige
 * rh.custo_pessoal.individual, e a gravação segue pelo RLS.
 */
export async function vincularPelaFolha(
  ctx: Contexto,
  beneficioId: string,
): Promise<string> {
  await exigirBeneficios(ctx);
  if (!z.uuid().safeParse(beneficioId).success)
    throw new ErroDeNegocio("Benefício inválido.");
  const lido = await banco
    .comoUsuario(ctx.usuario.id, async (tx) => ({
      b: await repo.beneficio(tx, beneficioId),
      atuais: await repo.quemJaRecebe(tx, beneficioId),
    }))
    .catch((err: unknown) => {
      log.error({ err }, "vínculos do benefício");
      return null;
    });
  if (!lido)
    throw new ErroDeNegocio("Não consegui ler os vínculos. Tente de novo.");
  const codigos = lido.b?.rubricas_desconto ?? [];
  if (!codigos.length)
    throw new ErroDeNegocio(
      "Informe antes as rubricas de desconto do titular.",
    );
  const folha = await banco.comoServico((tx) => repo.ultimaFolha(tx));
  if (!folha) throw new ErroDeNegocio("Nenhuma folha importada ainda.");
  const comDesconto = await banco
    .comoServico((tx) => repo.comRubricas(tx, folha.id, codigos))
    .catch((err: unknown) => {
      log.error({ err }, "rubricas da folha");
      return null;
    });
  if (!comDesconto)
    throw new ErroDeNegocio("Não consegui ler a folha. Tente de novo.");

  const jaTem = new Set(lido.atuais);
  const novos = [...new Set(comDesconto)].filter((c) => !jaTem.has(c));
  if (!novos.length)
    return `Todos com desconto na folha de ${formatarMes(folha.competencia)} já estão vinculados.`;
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.vincular(
      tx,
      novos.map((colaborador_id) => ({
        beneficio_id: beneficioId,
        colaborador_id,
        desde: folha.competencia,
      })),
    ),
  );
  return salvoERecalculado(
    `${novos.length} ${novos.length > 1 ? "pessoas vinculadas" : "pessoa vinculada"} pela folha de ${formatarMes(folha.competencia)}.`,
  );
}

// ---------------------------------------------------------------------------
// Valores do mês dos benefícios que variam por mês
// (rh.beneficio_valores_mensais). Cada competência é um lançamento à parte:
// gravar um mês não mexe nos anteriores, e só o custo daquele mês em diante
// é recalculado.
// ---------------------------------------------------------------------------

const SEM_LEITURA = "Não consegui ler quem recebe o benefício. Tente de novo.";

/**
 * Benefício que varia por mês e quem o recebe na competência: os vinculados
 * à pessoa e quem tem um tipo de contrato vinculado (como o custo calcula).
 * Null se o benefício não varia por mês.
 */
async function quemRecebeNoMes(
  ctx: Contexto,
  beneficioId: string,
  competencia: string,
) {
  const fim = fimDoMes(competencia);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const b = await repo.beneficio(tx, beneficioId);
    if (!b?.valor_por_mes) return null;
    const pessoais = await repo.pessoaisNoMes(
      tx,
      beneficioId,
      competencia,
      fim,
    );
    const tipos = await repo.contratosNoMes(tx, beneficioId, competencia, fim);
    const doContrato = (await repo.colaboradoresDosContratos(tx, tipos)).filter(
      (c) =>
        (!c.admissao || c.admissao <= fim) &&
        (!c.desligamento || c.desligamento >= competencia),
    );
    const pessoas = new Map<string, string>();
    for (const c of doContrato) pessoas.set(c.id, c.nome);
    for (const v of pessoais) pessoas.set(v.colaborador_id, v.nome ?? "");
    return {
      nome: b.nome,
      pessoas: [...pessoas].map(([colaborador_id, nome]) => ({
        colaborador_id,
        nome,
      })),
    };
  });
}

async function recebemNoMes(
  ctx: Contexto,
  beneficioId: string,
  competencia: string,
) {
  const recebem = await quemRecebeNoMes(ctx, beneficioId, competencia).catch(
    (err: unknown) => {
      log.error({ err }, "quem recebe o benefício");
      return undefined;
    },
  );
  if (recebem === undefined) throw new ErroDeNegocio(SEM_LEITURA);
  if (!recebem) throw new ErroDeNegocio("Este benefício não varia por mês.");
  return recebem;
}

/** Grava os valores digitados do mês; campo vazio apaga o lançamento. */
export async function salvarValoresDoMes(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirBeneficios(ctx);
  const d = validarFormulario(
    entradaValoresDoMes,
    {
      beneficio_id: campo(campos, "beneficio_id"),
      competencia: campo(campos, "competencia"),
    },
    { competencia: "Mês" },
  );
  const competencia = `${d.competencia}-01`;
  const recebem = await recebemNoMes(ctx, d.beneficio_id, competencia);
  const nomes = new Map(recebem.pessoas.map((p) => [p.colaborador_id, p.nome]));

  const ids = valores(campos, "colaborador_id");
  const textos = valores(campos, "valor");
  const gravar: { colaborador_id: string; valor: number }[] = [];
  const apagar: string[] = [];
  for (const [i, id] of ids.entries()) {
    if (!nomes.has(id)) continue;
    const valor = lerValorBr(textos[i] ?? "");
    if (valor === null) apagar.push(id);
    else if (Number.isNaN(valor) || valor < 0)
      throw new ErroDeNegocio(`Valor inválido para ${nomes.get(id)}.`);
    else gravar.push({ colaborador_id: id, valor });
  }

  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    await repo.gravarValores(
      tx,
      gravar.map((g) => ({ ...g, beneficio_id: d.beneficio_id, competencia })),
    );
    await repo.apagarValores(tx, d.beneficio_id, competencia, apagar);
  });
  return salvoERecalculado(
    `Valores de ${formatarMes(competencia)} salvos (${gravar.length} ${gravar.length === 1 ? "pessoa" : "pessoas"}).`,
    competencia,
  );
}

/**
 * Planilha com CPF, nome e valor → valores do mês. O CPF não é gravado nem
 * usado (o banco não tem CPF): cada linha vale pela pessoa de mesmo nome
 * entre quem recebe o benefício no mês. O arquivo não é guardado.
 */
export async function importarValoresDoMes(
  ctx: Contexto,
  campos: Record<string, unknown>,
  arquivo: ArquivoRecebido | undefined,
): Promise<string> {
  await exigirBeneficios(ctx);
  const d = validarFormulario(
    entradaValoresDoMes,
    {
      beneficio_id: campo(campos, "beneficio_id"),
      competencia: campo(campos, "competencia"),
    },
    { competencia: "Mês" },
  );
  const competencia = `${d.competencia}-01`;
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio(
      "Escolha a planilha (.xlsx) com CPF, nome e valor.",
    );
  if (arquivo.bytes.length > TAMANHO_MAXIMO)
    throw new ErroDeNegocio("O arquivo passa de 10 MB.");
  const bytes = new Uint8Array(arquivo.bytes);
  if (!ehXlsx(bytes))
    throw new ErroDeNegocio("O arquivo não é uma planilha .xlsx do Excel.");

  let planilha: ReturnType<typeof lerValoresDaPlanilha>;
  try {
    const abas = await abasDoXlsx(bytes);
    planilha = lerValoresDaPlanilha(abas[0]?.data ?? []);
  } catch (e) {
    if (e instanceof ErroPlanilha) throw new ErroDeNegocio(e.message);
    log.error({ err: e }, "leitura dos valores do mês");
    throw new ErroDeNegocio("Não consegui ler a planilha. Confira o arquivo.");
  }

  const recebem = await recebemNoMes(ctx, d.beneficio_id, competencia);
  const casados = casarPorNome(planilha.linhas, recebem.pessoas);
  if (casados.valores.size === 0)
    throw new ErroDeNegocio(
      `Nenhum nome da planilha é de quem recebe ${recebem.nome} em ${formatarMes(competencia)}.`,
    );

  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.gravarValores(
      tx,
      [...casados.valores].map(([colaborador_id, valor]) => ({
        beneficio_id: d.beneficio_id,
        colaborador_id,
        competencia,
        valor,
      })),
    ),
  );

  const total = [...casados.valores.values()].reduce((s, v) => s + v, 0);
  return salvoERecalculado(
    [
      `${casados.valores.size} ${casados.valores.size === 1 ? "valor importado" : "valores importados"} em ${formatarMes(competencia)} (total R$ ${formatarNumero(total, 2)}).`,
      casados.naoEncontrados.length
        ? `Fora de quem recebe o benefício no mês: ${casados.naoEncontrados.join(", ")}.`
        : "",
      ...planilha.avisos,
      ...casados.avisos,
    ]
      .filter(Boolean)
      .join(" "),
    competencia,
  );
}

/**
 * Total do mês do benefício rateado que varia por mês: um valor por
 * competência, dividido no custo entre quem entra na divisão. Valor vazio
 * apaga o lançamento do mês.
 */
export async function salvarTotalDoMes(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirBeneficios(ctx);
  const t = validarFormulario(entradaTotalDoMes, campos, {
    competencia: "Mês",
    valor: "Valor total",
  });
  const competencia = `${t.competencia}-01`;
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const b = await repo.beneficio(tx, t.beneficio_id);
    if (b?.forma_calculo !== "rateado" || !b.valor_por_mes)
      throw new ErroDeNegocio(
        "Este benefício não é rateado com valor por mês.",
      );
    await repo.gravarTotal(tx, t.beneficio_id, competencia, t.valor);
  });
  return salvoERecalculado(
    t.valor === null
      ? `Lançamento de ${formatarMes(competencia)} apagado.`
      : `Total de ${formatarMes(competencia)}: R$ ${formatarNumero(t.valor, 2)}.`,
    competencia,
  );
}
