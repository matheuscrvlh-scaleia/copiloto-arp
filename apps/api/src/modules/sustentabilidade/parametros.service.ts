import { lerValorBr } from "@arp/shared/formato";
import type {
  AlteracaoDeParametro,
  CamposDeFormulario,
  ConsultaDaTelaDeParametros,
  RespostaTelaDeParametros,
  VigenciaDoRcc,
} from "@arp/shared/sustentabilidade/contratos/parametros";
import {
  CHAVES_COM_META,
  INDICADORES_DO_PAINEL,
  indicadorDaMeta,
  infoDoIndicador,
  MARCOS_DO_PAINEL,
} from "@arp/shared/sustentabilidade/painel-indicadores";
import {
  diferencaDeLinhas,
  ESQUEMAS,
  ehGrupo,
  esquemaCustosDoTour,
  esquemaEquivalencias,
  esquemaMarcos,
  esquemaPrecosRcc,
  esquemaSetores,
  esquemaVigenciaCo2,
  esquemaVigenciaRcc,
  GRUPOS,
  type Grupo,
  lerMetasDoForm,
  mudancasDoHistorico,
  ROTULOS_PARAMETROS,
  TABELAS_DO_HISTORICO,
  temColunas,
} from "@arp/shared/sustentabilidade/painel-parametros";
import { z } from "zod";
import { type Contexto, exigir } from "@/contexto";
import {
  ErroDeConflito,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import { validarFormulario } from "@/modules/operacoes/apoio";
import { logarSustentabilidade, nomesDeUsuarios, podeAgora } from "./acesso";
import { parametros, validadesPorSetor } from "./base.service";
import * as repo from "./parametros.repository";

// Configurações › Parâmetros do Sustentabilidade (spec 4.11): o histórico das
// alterações (core.auditoria das tabelas sustentabilidade.* e das metas
// sustentabilidade.*), quantos dados de exemplo ainda existem, as tabelas de
// apoio de cada aba e as gravações. Cada aba salva só os campos dela, pelo
// RLS (sustentabilidade.parametros edita); os gatilhos de auditoria guardam
// quem mudou, quando, o antes e o depois.
//
// O RLS de core.auditoria não abre o histórico a quem não administra, por
// isso ele sai pela service role, só depois de conferir no banco a mesma
// permissão que edita os parâmetros.

const PERMISSAO = "sustentabilidade.parametros" as const;
const VALORES = "sustentabilidade.valores" as const;

const SEM_PERMISSAO =
  "Você não tem permissão para alterar os parâmetros de Sustentabilidade.";

const ROTULOS_TABELAS: Record<string, string> = {
  setores: "Validade por setor",
  marcos: "Marcos",
  equivalencias: "Equivalências",
  vigencia: "Vigência",
  preco_a: "Preço da caçamba classe A",
  preco_b: "Preço da caçamba classe B",
  vigente_desde: "Vigente desde",
  toneladas_por_cacamba: "Toneladas por caçamba",
  volume_m3: "Volume da caçamba (m³)",
  kg_por_kwh: "kg de CO₂ por kWh",
  ano: "Ano",
  tipo: "Chamado",
  responsavel: "Responsável",
};

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : null;

/** Os campos de texto do formulário (o `camposDoForm` do sistema antigo). */
function camposDoForm(corpo: CamposDeFormulario): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const [k, bruto] of Object.entries(corpo)) {
    const v = Array.isArray(bruto) ? bruto.at(-1) : bruto;
    if (typeof v !== "string" || k.startsWith("$") || k === "grupo") continue;
    campos[k] = v;
  }
  return campos;
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

/**
 * Últimas alterações (quem, quando, antes e depois), da mais nova para a mais
 * antiga. Os valores em reais (custos do tour, preço da caçamba) só saem para
 * quem também tem "Ver valores". Quem chama já conferiu `PERMISSAO` no banco.
 */
async function historicoDosParametros(
  ctx: Contexto,
  setores: { id: string; nome: string }[],
  limite = 80,
): Promise<AlteracaoDeParametro[]> {
  const comValores = await podeAgora(ctx, VALORES);
  const tabelas = TABELAS_DO_HISTORICO.filter(
    (t) => comValores || !t.valores,
  ).map((t) => t.tabela);
  const lidas = await banco.comoServico(async (tx) => [
    ...(await repo.auditoriaDasTabelas(
      tx,
      tabelas.filter((t) => t !== "core.metas"),
      limite,
    )),
    ...(await repo.auditoriaDasMetas(tx, "depois", limite)),
    ...(await repo.auditoriaDasMetas(tx, "antes", limite)),
  ]);
  const porId = new Map(lidas.map((l) => [l.id, l]));
  const linhas = [...porId.values()]
    .sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id)
    .slice(0, limite);
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.map((l) => l.usuario_id),
    [PERMISSAO],
  );
  const contexto = { setores: new Map(setores.map((s) => [s.id, s.nome])) };
  return linhas
    .map((l) => ({
      id: l.id,
      em: l.em,
      autor: l.usuario_id
        ? (nomes.get(l.usuario_id) ?? "Usuário removido")
        : "Sistema",
      mudancas: mudancasDoHistorico(
        l.tabela,
        l.acao === "insert" || l.acao === "delete" ? l.acao : "update",
        objeto(l.antes),
        objeto(l.depois),
        contexto,
      ),
    }))
    .filter((a) => a.mudancas.length > 0);
}

/** Tabelas que sustentabilidade.remover_exemplos() limpa, com o nome na tela. */
const COM_EXEMPLO: readonly (readonly [repo.TabelaComExemplo, string])[] = [
  ["contratos", "Contratos"],
  ["programas", "Programas"],
  ["formularios", "Formulários"],
  ["lancamentos", "Lançamentos"],
  ["participantes", "Participantes do Clube"],
  ["coletores", "Coletores"],
  ["rondas", "Rondas"],
  ["rcc_notas", "Notas do RCC"],
  ["rcc_precos", "Preços da caçamba"],
  ["marcos", "Marcos iniciais"],
];

/** Quantas linhas de exemplo ainda existem em cada tabela (service role). */
async function dadosDeExemplo(tx: Tx) {
  const contagens: { tabela: string; nome: string; linhas: number }[] = [];
  for (const [tabela, nome] of COM_EXEMPLO)
    contagens.push({
      tabela,
      nome,
      linhas: await repo.linhasDeExemplo(tx, tabela),
    });
  return contagens.filter((c) => c.linhas > 0);
}

/** Fatores e preços da caçamba por vigência, do mais novo para o mais antigo. */
async function vigenciasDoRcc(
  tx: Tx,
  comPrecos: boolean,
): Promise<{ vigencias: VigenciaDoRcc[]; comPrecos: boolean }> {
  const fatores = await repo.fatoresDoRcc(tx);
  const precos = comPrecos ? await repo.precosDoRcc(tx) : [];
  const precoDe = new Map(precos.map((p) => [p.vigente_desde, p]));
  const fatorDe = new Map(fatores.map((f) => [f.vigente_desde, f]));
  const datas = [
    ...new Set([
      ...fatores.map((f) => f.vigente_desde),
      ...precos.map((p) => p.vigente_desde),
    ]),
  ].sort((a, b) => b.localeCompare(a));
  return {
    comPrecos,
    vigencias: datas.map((d) => ({
      vigenteDesde: d,
      toneladasPorCacamba: fatorDe.get(d)?.toneladas_por_cacamba ?? 0,
      volumeM3: fatorDe.get(d)?.volume_m3 ?? 0,
      precoA: precoDe.get(d)?.preco_a ?? null,
      precoB: precoDe.get(d)?.preco_b ?? null,
    })),
  };
}

const anoDeBrasilia = () =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(new Date()),
  );

/** GET /parametros/tela: tudo o que a aba pedida mostra. */
export async function telaDeParametros(
  ctx: Contexto,
  consulta: ConsultaDaTelaDeParametros,
): Promise<RespostaTelaDeParametros> {
  await exigir(ctx, PERMISSAO);
  const pedida = consulta.aba ?? "";
  const aba: Grupo | "historico" =
    pedida === "historico"
      ? "historico"
      : ehGrupo(pedida)
        ? pedida
        : "entrevistas";
  const anoAtual = anoDeBrasilia();
  const anoPedido = Number(consulta.ano ?? "");
  const anoDasMetas =
    Number.isInteger(anoPedido) && anoPedido >= 2000 && anoPedido <= 2100
      ? anoPedido
      : anoAtual;
  const comValores = await podeAgora(ctx, VALORES);

  // Com a sessão: o RLS decide.
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const p = await parametros(tx);
    const validades =
      aba === "entrevistas" ? await validadesPorSetor(tx) : null;
    const custos =
      aba === "programas" && comValores ? await repo.custosDoTour(tx) : null;
    const metas =
      aba === "painel"
        ? await repo.metasDoAno(
            tx,
            `${anoDasMetas}-01-01`,
            CHAVES_COM_META.map((c) => indicadorDaMeta(c)),
          )
        : null;
    return {
      p,
      validades,
      rcc: aba === "rcc" ? await vigenciasDoRcc(tx, comValores) : null,
      custos,
      painel: metas
        ? {
            marcos: await repo.marcos(tx),
            metas: Object.fromEntries(
              metas.map((m) => [
                m.indicador.replace(/^sustentabilidade\./, ""),
                m.meta,
              ]),
            ),
            equivalencias: await repo.equivalencias(tx),
            fatoresCo2: (await repo.fatoresDeCo2(tx)).map((f) => ({
              vigenteDesde: f.vigente_desde,
              kgPorKwh: f.kg_por_kwh,
            })),
          }
        : null,
    };
  });

  // Service role: a permissão foi conferida no banco acima.
  const servico = await banco.comoServico(async (tx) => ({
    setores: await repo.setoresAtivos(tx),
    exemplos: await dadosDeExemplo(tx),
  }));
  const alteracoes = await historicoDosParametros(ctx, servico.setores);

  return {
    aba,
    anoAtual,
    anoDasMetas,
    parametros: lido.p,
    alteracoes,
    exemplos: servico.exemplos,
    comValores,
    setoresDeValidade: lido.validades
      ? Object.entries(lido.validades)
          .map(([setor, meses]) => ({ setor, meses }))
          .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"))
      : null,
    setoresDoChamado: aba === "coletores" ? servico.setores : null,
    rcc: lido.rcc,
    custos: lido.custos
      ? {
          album: lido.custos.tour_custo_album,
          copo: lido.custos.tour_custo_copo,
        }
      : null,
    painel: lido.painel,
  };
}

// ---------------------------------------------------------------------------
// Abas com colunas de sustentabilidade.parametros
// ---------------------------------------------------------------------------

function exigirNaSessao(ctx: Contexto): void {
  if (!ctx.permissoes.has(PERMISSAO)) throw new ErroDePermissao(SEM_PERMISSAO);
}

function linhaDoGrupo(grupo: Grupo, campos: Record<string, unknown>) {
  switch (grupo) {
    case "entrevistas":
      return validarFormulario(
        ESQUEMAS.entrevistas,
        campos,
        ROTULOS_PARAMETROS,
      );
    case "clube":
      return validarFormulario(ESQUEMAS.clube, campos, ROTULOS_PARAMETROS);
    case "coletores":
      return validarFormulario(ESQUEMAS.coletores, campos, ROTULOS_PARAMETROS);
    case "rcc":
      return validarFormulario(ESQUEMAS.rcc, campos, ROTULOS_PARAMETROS);
    case "programas":
      return validarFormulario(ESQUEMAS.programas, campos, ROTULOS_PARAMETROS);
    default:
      throw new ErroDeNegocio("Aba de parâmetros inválida.");
  }
}

export async function salvarParametros(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const grupo = Array.isArray(corpo.grupo) ? corpo.grupo.at(-1) : corpo.grupo;
  if (!ehGrupo(grupo) || !temColunas(grupo))
    throw new ErroDeNegocio("Aba de parâmetros inválida.");
  const campos = camposDoForm(corpo);
  const linha = linhaDoGrupo(grupo, campos);

  // Custos do tour (aba Programas): tabela à parte, só com "Ver valores".
  let custos: { tour_custo_album: number; tour_custo_copo: number } | null =
    null;
  if (
    grupo === "programas" &&
    ("tour_custo_album" in campos || "tour_custo_copo" in campos)
  ) {
    if (!(await podeAgora(ctx, VALORES)))
      throw new ErroDeNegocio(
        "Os custos do tour só mudam com a permissão de ver valores.",
      );
    custos = validarFormulario(esquemaCustosDoTour, campos, ROTULOS_PARAMETROS);
  }

  exigirNaSessao(ctx);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const mudou = await repo.atualizarParametros(tx, {
      ...linha,
      atualizado_por: ctx.usuario.id,
    });
    if (!mudou) throw new ErroDePermissao(SEM_PERMISSAO);
    if (custos && !(await repo.atualizarCustosDoTour(tx, custos)))
      throw new ErroDePermissao(SEM_PERMISSAO);
  });
  // Só os nomes das colunas: o antes e o depois ficam em core.auditoria.
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    `Parâmetros de Sustentabilidade: ${GRUPOS[grupo]}`,
    {
      grupo,
      campos: [...Object.keys(linha), ...(custos ? Object.keys(custos) : [])],
    },
  );
  return `${GRUPOS[grupo]}: salvo.`;
}

// ---------------------------------------------------------------------------
// Validade por setor econômico
// ---------------------------------------------------------------------------

const texto = (v: unknown) => (Array.isArray(v) ? v.at(-1) : v);

export async function salvarValidadesPorSetor(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const novas = validarTabela(esquemaSetores, corpo.setores);
  exigirNaSessao(ctx);
  const mudou = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lidas = await tx
      .selectFrom("sustentabilidade.setor_validades")
      .select(["setor", "meses"])
      .execute();
    const d = diferencaDeLinhas(
      lidas,
      novas,
      (l) => l.setor,
      (a, b) => a.meses === b.meses,
    );
    if (!d.inserir.length && !d.atualizar.length && !d.apagar.length)
      return null;
    await repo.apagarValidades(
      tx,
      d.apagar.map((l) => l.setor),
    );
    for (const l of d.atualizar)
      await repo.atualizarValidade(tx, l.setor, l.meses);
    await repo.inserirValidades(tx, d.inserir);
    return d;
  });
  if (!mudou) return "Nada mudou.";
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: validade por setor",
    {
      grupo: "entrevistas",
      incluidos: mudou.inserir.length,
      alterados: mudou.atualizar.length,
      removidos: mudou.apagar.length,
    },
  );
  return "Validade por setor: salva.";
}

/** Tabela editável (JSON num campo de texto): "Rótulo: mensagem" no erro. */
function validarTabela<T>(esquema: z.ZodType<T>, bruto: unknown): T {
  const r = esquema.safeParse(texto(bruto));
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const campo = String(issue?.path[0] ?? "");
  throw new ErroDeValidacao(
    `${ROTULOS_TABELAS[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  );
}

// ---------------------------------------------------------------------------
// Painel: marcos, equivalências e metas
// ---------------------------------------------------------------------------

export async function salvarMarcos(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const novos = validarTabela(esquemaMarcos, corpo.marcos);
  exigirNaSessao(ctx);
  const mudou = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    // Só os indicadores que a tela edita (marco de outro indicador não some daqui).
    const atuais = (await repo.marcosSemExemplo(tx)).filter(
      (m) => m.indicador in MARCOS_DO_PAINEL,
    );
    const d = diferencaDeLinhas(
      atuais,
      novos,
      (m) => `${m.indicador}|${m.ano}`,
      (a, b) => a.valor === b.valor,
    );
    if (!d.inserir.length && !d.atualizar.length && !d.apagar.length)
      return null;
    for (const m of d.apagar) await repo.apagarMarco(tx, m.indicador, m.ano);
    for (const m of d.atualizar) await repo.atualizarMarco(tx, m);
    await repo.inserirMarcos(tx, d.inserir);
    return d;
  });
  if (!mudou) return "Nada mudou.";
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: marco inicial",
    {
      grupo: "painel",
      incluidos: mudou.inserir.length,
      alterados: mudou.atualizar.length,
      removidos: mudou.apagar.length,
    },
  );
  return "Marco inicial: salvo.";
}

export async function salvarEquivalencias(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const novas = validarTabela(esquemaEquivalencias, corpo.equivalencias);
  exigirNaSessao(ctx);
  const mudou = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const d = diferencaDeLinhas(
      await repo.equivalencias(tx),
      novas,
      (l) => l.nome,
      (a, b) =>
        a.fator === b.fator &&
        a.unidade === b.unidade &&
        a.confirmado === b.confirmado,
    );
    if (!d.inserir.length && !d.atualizar.length && !d.apagar.length)
      return null;
    await repo.apagarEquivalencias(
      tx,
      d.apagar.map((l) => l.nome),
    );
    for (const l of d.atualizar) await repo.atualizarEquivalencia(tx, l);
    await repo.inserirEquivalencias(tx, d.inserir);
    return d;
  });
  if (!mudou) return "Nada mudou.";
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: equivalências",
    {
      grupo: "painel",
      incluidos: mudou.inserir.length,
      alterados: mudou.atualizar.length,
      removidos: mudou.apagar.length,
    },
  );
  return "Equivalências: salvas.";
}

/** Metas de um ano (core.metas, sustentabilidade.<indicador>, a partir de 1º de janeiro). */
export async function salvarMetas(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const ano = Number(texto(corpo.ano));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100)
    throw new ErroDeNegocio("Ano inválido.");
  const lidas = lerMetasDoForm({
    get: (nome) => {
      const v = texto(corpo[nome]);
      return typeof v === "string" ? v : null;
    },
  });
  if (!lidas.ok) throw new ErroDeNegocio(lidas.erro);
  exigirNaSessao(ctx);
  // Meta em reais só muda com "Ver valores" (a tela nem mostra o campo sem ele).
  const comValores = await podeAgora(ctx, VALORES);
  const metas = lidas.metas.filter(
    (m) => comValores || !infoDoIndicador(m.chave).reais,
  );
  const desde = `${ano}-01-01`;

  const mudou = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const atuais = await repo.metasDoAno(
      tx,
      desde,
      CHAVES_COM_META.map((c) => indicadorDaMeta(c)),
    );
    const existente = new Map(atuais.map((m) => [m.indicador, m] as const));
    const gravar = metas.flatMap((m) =>
      m.meta !== null &&
      existente.get(indicadorDaMeta(m.chave))?.meta !== m.meta
        ? [
            {
              indicador: indicadorDaMeta(m.chave),
              direcao: INDICADORES_DO_PAINEL[m.chave].direcao,
              meta: m.meta,
              vigente_desde: desde,
            },
          ]
        : [],
    );
    const apagar = metas.flatMap((m) =>
      m.meta === null
        ? (existente.get(indicadorDaMeta(m.chave))?.id ?? [])
        : [],
    );
    if (!gravar.length && !apagar.length) return null;
    await repo.gravarMetas(tx, gravar);
    await repo.apagarMetas(tx, apagar);
    return { alteradas: gravar.length, removidas: apagar.length };
  });
  if (!mudou) return "Nada mudou.";
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    `Parâmetros de Sustentabilidade: metas de ${ano}`,
    { grupo: "painel", ano, ...mudou },
  );
  const n = mudou.alteradas + mudou.removidas;
  return `Metas de ${ano}: ${n} ${n === 1 ? "alterada" : "alteradas"}.`;
}

// ---------------------------------------------------------------------------
// RCC: nova vigência (fator e, com "Ver valores", preço)
// ---------------------------------------------------------------------------

/**
 * Nova vigência do fator da caçamba (e dos preços): sempre uma linha nova, a
 * antiga fica como estava; só as notas lançadas a partir da data usam os
 * novos valores.
 */
export async function novaVigenciaRcc(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const campos = camposDoForm(corpo);
  const fator = validarFormulario(esquemaVigenciaRcc, campos, ROTULOS_TABELAS);
  const comPreco =
    String(campos.preco_a ?? "").trim() !== "" ||
    String(campos.preco_b ?? "").trim() !== "";
  let preco: { preco_a: number; preco_b: number } | null = null;
  if (comPreco) {
    if (!(await podeAgora(ctx, VALORES)))
      throw new ErroDeNegocio(
        "Os preços da caçamba só mudam com a permissão de ver valores.",
      );
    preco = validarFormulario(esquemaPrecosRcc, campos, ROTULOS_TABELAS);
  }
  exigirNaSessao(ctx);
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.inserirFatorDoRcc(tx, { ...fator, criado_por: ctx.usuario.id }),
    );
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Já existe uma vigência do fator nessa data. Escolha outra data para criar uma nova.",
      );
    throw e;
  }
  // O preço vai em outra transação: se ele falhar, o fator fica (como antes).
  if (preco) {
    const p = preco;
    try {
      await banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.inserirPrecoDoRcc(tx, {
          vigente_desde: fator.vigente_desde,
          ...p,
          criado_por: ctx.usuario.id,
        }),
      );
    } catch (e) {
      throw new ErroDeNegocio(
        e instanceof ErroDeConflito
          ? "O fator foi salvo, mas já existe um preço com essa data. Use outra data para o preço."
          : "O fator foi salvo, mas o preço não. Tente de novo só com o preço.",
      );
    }
  }
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: nova vigência do RCC",
    {
      grupo: "rcc",
      vigenteDesde: fator.vigente_desde,
      comPreco: preco !== null,
    },
  );
  return "Vigência criada. As notas a partir dessa data usam os novos valores.";
}

// ---------------------------------------------------------------------------
// Painel: nova vigência do fator de emissão (CO₂ evitado)
// ---------------------------------------------------------------------------

/**
 * Novo fator de emissão da rede: sempre uma linha nova, a antiga fica como
 * estava; cada mês do painel usa o fator vigente nele.
 */
export async function novaVigenciaCo2(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const campos = camposDoForm(corpo);
  const fator = validarFormulario(esquemaVigenciaCo2, campos, ROTULOS_TABELAS);
  exigirNaSessao(ctx);
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.inserirFatorDeCo2(tx, { ...fator, criado_por: ctx.usuario.id }),
    );
  } catch (e) {
    if (e instanceof ErroDeConflito)
      throw new ErroDeConflito(
        "Já existe um fator de emissão nessa data. Escolha outra data para criar um novo.",
      );
    throw e;
  }
  logarSustentabilidade(
    ctx,
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: novo fator de emissão",
    { grupo: "painel", vigenteDesde: fator.vigente_desde },
  );
  return "Fator salvo. O CO₂ evitado dos meses a partir dessa data usa o novo valor.";
}

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

/** Apaga o que é de exemplo (sustentabilidade.remover_exemplos); poupa o que recebeu dado real. */
export async function removerExemplos(ctx: Contexto): Promise<string> {
  exigirNaSessao(ctx);
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.removerExemplos(tx));
  logarSustentabilidade(
    ctx,
    "sustentabilidade_exemplos_removidos",
    "Removeu os dados de exemplo de Sustentabilidade",
  );
  return "Dados de exemplo removidos. As telas passam a mostrar só os dados reais.";
}

// ---------------------------------------------------------------------------
// Coletores (spec 4.6 e 4.11): aba Coletores das Configurações. Grava com a
// sessão (o RLS exige "Parâmetros") e a auditoria do banco guarda o antes e
// o depois. Coletores NÃO são ativos do Chamados (decidido: faltam cor,
// contêineres e capacidade). Capacidade vazia = "a confirmar".
// ---------------------------------------------------------------------------

const SEM_PERMISSAO_COLETORES =
  "Você não tem permissão para alterar os coletores.";

const esquemaDoColetor = z.object({
  id: z.uuid().optional(),
  local: z
    .string()
    .trim()
    .min(1, "Informe o local do coletor.")
    .max(120, "O local pode ter até 120 letras."),
  cor: z.enum(["preto", "azul"], "Escolha a cor: preto ou azul."),
  conteineres: z.coerce
    .number("Informe quantos contêineres.")
    .int("Contêineres: use um número inteiro.")
    .min(1, "O coletor tem pelo menos 1 contêiner.")
    .max(999, "Contêineres: número alto demais."),
  capacidade: z
    .string()
    .trim()
    .max(20)
    .transform((v, c) => {
      const n = lerValorBr(v);
      if (n === null) return null;
      if (!Number.isFinite(n) || n <= 0 || n > 99_999_999) {
        c.addIssue({
          code: "custom",
          message:
            "Capacidade: digite os litros de cada contêiner (ou deixe vazio, a confirmar).",
        });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
  ordem: z.coerce
    .number("Informe a ordem.")
    .int("Ordem: use um número inteiro.")
    .min(0)
    .max(9999),
});

export async function salvarColetor(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const e = esquemaDoColetor.safeParse({
    id: texto(corpo.id) || undefined,
    local: texto(corpo.local),
    cor: texto(corpo.cor),
    conteineres: texto(corpo.conteineres),
    capacidade: texto(corpo.capacidade) ?? "",
    ordem: texto(corpo.ordem) || 0,
  });
  if (!e.success)
    throw new ErroDeValidacao(
      e.error.issues[0]?.message ?? "Confira os dados.",
    );
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO_COLETORES);
  const { id, capacidade, ...resto } = e.data;
  const campos = {
    ...resto,
    capacidade_l: capacidade,
    ativo: texto(corpo.ativo) === "on",
  };
  let gravou = false;
  try {
    gravou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      id
        ? repo.atualizarColetor(tx, id, campos)
        : repo.inserirColetor(tx, campos),
    );
  } catch (err) {
    log.error({ err }, "salvar coletor");
  }
  if (!gravou)
    throw new ErroDeNegocio(
      "Não foi possível salvar o coletor. Tente de novo.",
    );
  return id ? "Coletor salvo." : `Coletor ${campos.local} cadastrado.`;
}

export async function excluirColetor(
  ctx: Contexto,
  idBruto: string,
): Promise<string> {
  const id = z.uuid().safeParse(idBruto);
  if (!id.success) throw new ErroDeNegocio("Coletor inválido.");
  if (!(await podeAgora(ctx, PERMISSAO)))
    throw new ErroDePermissao(SEM_PERMISSAO_COLETORES);
  let local: string | null = null;
  try {
    local = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.excluirColetor(tx, id.data),
    );
  } catch (err) {
    if (codigoDoBanco(err) === "23503")
      throw new ErroDeNegocio(
        "Este coletor tem rondas lançadas e não pode ser excluído. Desmarque “Ativo” para tirá-lo da ronda.",
      );
    log.error({ err }, "excluir coletor");
  }
  if (local === null)
    throw new ErroDeNegocio(
      "Não foi possível excluir o coletor. Tente de novo.",
    );
  return `Coletor ${local} excluído.`;
}
