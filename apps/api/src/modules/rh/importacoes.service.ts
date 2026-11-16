import { randomUUID } from "node:crypto";
import { formatarMes, lerValorBr } from "@arp/shared/formato";
import {
  confirmacaoDoPlano,
  entradaEnvioDoPlano,
  type PreviaDaFolha,
  type PreviaDoPlano,
  type RespostaFolhaParaEditar,
  type RespostaImportacoes,
} from "@arp/shared/rh/contratos/importacoes";
import { conferir } from "@arp/shared/rh/folha/conferencia";
import {
  ErroEdicao,
  minutosDasHoras,
  rubricasDoFormulario,
} from "@arp/shared/rh/folha/edicao";
import {
  ErroExtrato,
  type ExtratoMensal,
  lerExtrato,
} from "@arp/shared/rh/folha/extrato";
import {
  ErroPlanilha,
  faixasDoFormulario,
  lerTabelaDoPlano,
} from "@arp/shared/rh/plano";
import {
  GRUPOS_CLASSIFICAVEIS,
  ROTULO_CONTRATO,
} from "@arp/shared/rh/rubricas";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDaApi,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from "@/erros";
import type { ArquivoRecebido } from "@/http/formulario";
import { gravarArquivo, lerArquivo } from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { campo, exigirComMensagem, validarFormulario, valores } from "./apoio";
import {
  abasDoXlsx,
  BUCKET,
  ehPdf,
  ehXlsx,
  nomeNoDisco,
  sha256,
  TAMANHO_MAXIMO,
  textosDoPdf,
} from "./arquivos";
import { tabelasDoPlano } from "./beneficios.repository";
import {
  recalcularCusto,
  recalcularEmAberto,
  tentarRecalcular,
} from "./custo.service";
import * as dados from "./dados.repository";
import * as repo from "./importacoes.repository";

// Configurações › Importações: Extrato Mensal da folha (rh.folha) e tabela
// de faixas do plano (rh.beneficios), em três passos: enviar o arquivo (ele
// fica no disco, no bucket privado) → conferir a prévia → confirmar (relê o
// arquivo guardado; nada vem da tela). Gravação idempotente pela função do
// banco: a prévia só vale uma vez. Também a folha para conferir e corrigir
// pessoa a pessoa e a classificação de rubrica nova.

const SEM_PERMISSAO_FOLHA = "Você não tem permissão para importar a folha.";
const SEM_PERMISSAO_PLANO =
  "Você não tem permissão para importar a tabela do plano.";

/**
 * Erro de uma função do banco: a regra (`raise exception`) já vem traduzida
 * pelo escopo; qualquer outro erro vira a mensagem de antes ("Nada foi
 * alterado.").
 */
async function naFuncaoDoBanco<T>(
  fn: () => Promise<T>,
  falha: string,
  nome: string,
): Promise<T> {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof ErroDaApi) throw erro;
    log.error({ err: erro }, nome);
    throw new ErroDeNegocio(falha);
  }
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

/** GET /rh/importacoes: cada importação para quem tem a permissão dela. */
export function importacoes(ctx: Contexto): Promise<RespostaImportacoes> {
  const folha = pode(ctx, "rh.folha");
  const beneficios = pode(ctx, "rh.beneficios");
  if (!folha && !beneficios) throw new ErroDePermissao();
  return banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    folha: folha
      ? {
          folhas: await folhasImportadas(tx),
          pendentes: (await dados.rubricas(tx))
            .filter((r) => r.grupo === "nao_classificada")
            .map(({ codigo, descricao }) => ({ codigo, descricao })),
          individual: pode(ctx, "rh.custo_pessoal.individual"),
        }
      : null,
    plano: beneficios
      ? {
          planos: (await dados.beneficios(tx))
            .filter(
              (b) =>
                b.ativo && (b.tipo === "plano_saude" || b.tipo === "odonto"),
            )
            .map((b) => ({ id: b.id, nome: b.nome })),
          tabelas: (await tabelasDoPlano(tx)).map((t) => ({
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
          })),
        }
      : null,
  }));
}

/** Folhas importadas, da mais recente para a mais antiga (sem expor salário). */
async function folhasImportadas(tx: Tx) {
  const folhas = await dados.folhas(tx);
  if (!folhas.length) return [];
  const imps = await dados.importacoes(
    tx,
    folhas.map((f) => f.importacao_id).filter((i): i is string => !!i),
  );
  const competencias = folhas.map((f) => f.competencia).sort();
  const quadro = await dados.quadroMensal(
    tx,
    competencias[0] ?? "",
    competencias.at(-1) ?? "",
  );
  const porId = new Map(imps.map((i) => [i.id, i]));
  const pessoas = new Map<string, number>();
  for (const q of quadro)
    pessoas.set(
      q.competencia,
      (pessoas.get(q.competencia) ?? 0) + Number(q.colaboradores),
    );
  return folhas.map((f) => {
    const imp = f.importacao_id ? porId.get(f.importacao_id) : undefined;
    return {
      id: f.id,
      competencia: f.competencia,
      status: f.status,
      ficticia: f.ficticia,
      pessoas: pessoas.get(f.competencia) ?? 0,
      arquivo: imp?.arquivo_nome ?? null,
      importadaEm: imp?.confirmado_em ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Folha: enviar → prévia → confirmar
// ---------------------------------------------------------------------------

const contar = <T>(itens: T[], chave: (i: T) => string) =>
  itens.reduce<Record<string, number>>((m, i) => {
    const k = chave(i);
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

/** Folha pronta para gravar, com os valores do extrato. */
function folhaParaGravar(f: ExtratoMensal) {
  return {
    competencia: f.competencia,
    resumo_empresa: f.resumo,
    colaboradores: f.colaboradores.map((c) => ({
      matricula: c.matricula,
      nome: c.nome,
      situacao: c.situacao,
      tipo_contrato: c.tipo_contrato,
      departamento_codigo: c.departamento_codigo,
      cargo_codigo: c.cargo_codigo,
      cargo_nome: c.cargo_nome,
      cbo: c.cbo,
      admissao: c.admissao,
      horas_mes: c.horas_mes,
      salario: c.salario,
      base_inss: c.base_inss,
      base_fgts: c.base_fgts,
      valor_fgts: c.valor_fgts,
      liquido: c.liquido,
      rubricas: c.rubricas.map((r) => ({ ...r })),
    })),
  };
}

const lerPdfDaFolha = async (bytes: Uint8Array) =>
  lerExtrato(await textosDoPdf(bytes));

/** Lê o arquivo, guarda no bucket privado e devolve a prévia para conferência. */
export async function lerFolha(
  ctx: Contexto,
  arquivo: ArquivoRecebido | undefined,
): Promise<PreviaDaFolha> {
  // Conferida agora no banco: o arquivo vai para o disco, sem RLS.
  await exigirComMensagem(ctx, ["rh.folha"], SEM_PERMISSAO_FOLHA);
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha o arquivo do Extrato Mensal (PDF).");
  if (arquivo.bytes.length > TAMANHO_MAXIMO)
    throw new ErroDeNegocio("O arquivo passa de 10 MB.");
  const bytes = new Uint8Array(arquivo.bytes);
  if (!ehPdf(bytes))
    throw new ErroDeNegocio(
      "O arquivo não é um PDF. Por enquanto a importação aceita o Extrato Mensal em PDF.",
    );

  let extrato: ExtratoMensal;
  try {
    extrato = await lerPdfDaFolha(bytes);
  } catch (erro) {
    if (erro instanceof ErroExtrato) throw new ErroDeNegocio(erro.message);
    log.error({ err: erro }, "leitura da folha");
    throw new ErroDeNegocio(
      "Não consegui ler o PDF. Confira se é o Extrato Mensal da Sousa e Couto.",
    );
  }

  // O que a prévia mostra e o que a confirmação precisa saber do banco.
  const doBanco = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    grupos: new Map((await repo.rubricas(tx)).map((r) => [r.codigo, r.grupo])),
    departamentos: await repo.departamentosAtivosComCodigo(tx),
    matriculas: await repo.matriculas(tx),
    folhaExistente:
      (await repo.folhaDaCompetencia(tx, extrato.competencia)) ?? null,
  }));

  const id = randomUUID();
  const nome = arquivo.nome.slice(0, 200);
  const caminho = `folha/${id}/${nomeNoDisco(nome, "extrato.pdf")}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, "application/pdf");
  } catch (erro) {
    log.error({ err: erro }, "upload da folha");
    throw new ErroDeNegocio(
      "Não foi possível guardar o arquivo. Tente de novo.",
    );
  }

  const conferencia = conferir(extrato);
  const codigosComDepartamento = new Set(
    doBanco.departamentos
      .map((d) => d.codigo_folha)
      .filter((c): c is number => c !== null),
  );
  const novasRubricas = new Map<number, string>();
  for (const c of extrato.colaboradores)
    for (const r of c.rubricas)
      if (!doBanco.grupos.has(r.codigo))
        novasRubricas.set(r.codigo, r.descricao);
  const semCodigo = contar(
    extrato.colaboradores.filter(
      (c) =>
        c.departamento_codigo !== null &&
        !codigosComDepartamento.has(c.departamento_codigo),
    ),
    (c) => String(c.departamento_codigo),
  );
  const previa: PreviaDaFolha = {
    importacaoId: id,
    arquivo: nome,
    competencia: extrato.competencia,
    empresa: extrato.empresa,
    pessoas: extrato.colaboradores.length,
    porTipo: contar(extrato.colaboradores, (c) => c.tipo_contrato),
    porSituacao: contar(extrato.colaboradores, (c) => c.situacao),
    conferencia,
    rubricasNovas: [...novasRubricas].map(([codigo, descricao]) => ({
      codigo,
      descricao,
    })),
    foraDoCopiloto: extrato.colaboradores
      .filter((c) => !doBanco.matriculas.has(c.matricula))
      .map((c) => ({ matricula: c.matricula, nome: c.nome })),
    departamentosSemCodigo: Object.entries(semCodigo).map(
      ([codigo, pessoas]) => ({ codigo: Number(codigo), pessoas }),
    ),
    departamentosLivres: doBanco.departamentos
      .filter((d) => d.codigo_folha === null)
      .map((d) => ({ id: d.id, nome: d.nome })),
    folhaExistente: doBanco.folhaExistente
      ? { status: doBanco.folhaExistente.status }
      : null,
  };

  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.registrarImportacao(tx, {
        id,
        tipo: "folha",
        referencia: extrato.competencia,
        arquivo_nome: nome,
        arquivo_path: caminho,
        arquivo_sha256: sha256(bytes),
        enviado_por: ctx.usuario.id,
        avisos: {
          pessoas: previa.pessoas,
          rubricas_novas: previa.rubricasNovas.length,
          fora_do_copiloto: previa.foraDoCopiloto.length,
          departamentos_sem_codigo: previa.departamentosSemCodigo.map(
            (d) => d.codigo,
          ),
          pessoas_incoerentes: previa.conferencia.incoerentes.length,
        },
      }),
    );
  } catch (erro) {
    log.error({ err: erro }, "registro da importação");
    throw new ErroDeNegocio(
      "Não foi possível registrar a importação. Tente de novo.",
    );
  }
  return previa;
}

const confirmacaoDaFolha = z.object({
  importacao_id: z.uuid(),
  substituir: z.preprocess((v) => v === "on", z.boolean()),
});

/** Relê o arquivo guardado e grava a folha numa transação só. */
export async function confirmarFolha(
  ctx: Contexto,
  campos: Record<string, string>,
): Promise<string> {
  await exigirComMensagem(ctx, ["rh.folha"], SEM_PERMISSAO_FOLHA);
  const d = confirmacaoDaFolha.safeParse(campos);
  if (!d.success)
    throw new ErroDeNegocio("Prévia inválida. Envie o arquivo de novo.");

  // De-para escolhido na prévia: dep_<código da folha> = id do departamento.
  const departamentos: Record<string, string> = {};
  for (const [nome, valor] of Object.entries(campos)) {
    const codigo = nome.match(/^dep_(\d+)$/)?.[1];
    if (codigo && z.uuid().safeParse(valor).success)
      departamentos[codigo] = valor;
  }

  const imp = await banco
    .comoUsuario(ctx.usuario.id, (tx) =>
      repo.importacao(tx, d.data.importacao_id),
    )
    .catch(() => undefined);
  if (!imp)
    throw new ErroDeNegocio(
      "Importação não encontrada. Envie o arquivo de novo.",
    );
  if (imp.status !== "previa")
    throw new ErroDeNegocio(
      "Esta prévia já foi usada. Envie o arquivo de novo.",
    );
  const arquivo = imp.arquivo_path.startsWith("folha/")
    ? await lerArquivo(BUCKET, imp.arquivo_path)
    : null;
  if (!arquivo)
    throw new ErroDeNegocio("Não encontrei o arquivo enviado. Envie de novo.");
  const extrato = await lerPdfDaFolha(arquivo);

  let r: Record<string, number>;
  try {
    r = await naFuncaoDoBanco(
      () =>
        banco.comoUsuario(ctx.usuario.id, (tx) =>
          repo.importarFolha(tx, {
            importacaoId: d.data.importacao_id,
            folha: folhaParaGravar(extrato),
            departamentos,
            substituir: d.data.substituir,
          }),
        ),
      "Não foi possível gravar a folha. Nada foi alterado.",
      "importar_folha",
    );
  } catch (erro) {
    // A função levanta as regras sem maiúscula e sem ponto, e a tela antiga
    // mostrava o texto como veio.
    if (erro instanceof ErroDeNegocio && erro.message.endsWith(".")) {
      const m = erro.message;
      if (m !== "Não foi possível gravar a folha. Nada foi alterado.")
        throw new ErroDeNegocio(
          `${m.charAt(0).toLowerCase()}${m.slice(1, -1)}`,
        );
    }
    throw erro;
  }

  const calculado = await tentarRecalcular(() =>
    recalcularCusto(extrato.competencia),
  );
  return `Folha de ${formatarMes(extrato.competencia)} importada: ${r.colaboradores} pessoas${
    r.fora_do_copiloto
      ? ` (${r.fora_do_copiloto} sem cadastro no Copiloto RH ficaram de fora)`
      : ""
  }${
    r.rubricas_novas
      ? `, ${r.rubricas_novas} rubrica(s) nova(s) para classificar`
      : ""
  }.${calculado ? " Custo de pessoal calculado." : " O custo não foi calculado: use Recalcular em Custo de pessoal."}`;
}

/**
 * Exclui a folha importada errada, com o custo do mês (regra no banco).
 * Para trocar pelo arquivo certo do mesmo mês, basta importar de novo.
 */
export async function excluirFolha(
  ctx: Contexto,
  folhaId: string,
): Promise<string> {
  await exigirComMensagem(
    ctx,
    ["rh.folha"],
    "Você não tem permissão para excluir a folha.",
  );
  if (!z.uuid().safeParse(folhaId).success)
    throw new ErroDeNegocio("Folha inválida.");
  const competencia = await naFuncaoDoBanco(
    () =>
      banco.comoUsuario(ctx.usuario.id, (tx) => repo.excluirFolha(tx, folhaId)),
    "Não foi possível excluir. Nada foi alterado.",
    "excluir_folha",
  );
  return `Folha de ${formatarMes(competencia)} excluída.`;
}

const classificacao = z.object({
  codigo: z.coerce.number().int().positive(),
  grupo: z.enum(GRUPOS_CLASSIFICAVEIS),
});

export async function classificarRubrica(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  // O recálculo usa a service role: a permissão é conferida agora no banco.
  await exigirComMensagem(
    ctx,
    ["rh.folha", "rh.parametros"],
    "Você não tem permissão para classificar rubricas.",
  );
  const d = classificacao.safeParse(campos);
  if (!d.success) throw new ErroDeNegocio("Escolha o grupo da rubrica.");
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.classificar(tx, d.data.codigo, d.data.grupo, ctx.usuario.id),
    );
  } catch (erro) {
    log.error({ err: erro }, "classificar rubrica");
    throw new ErroDeNegocio("Não foi possível salvar. Tente de novo.");
  }
  // A classificação vale para todos os meses em aberto.
  const calculado = await tentarRecalcular(() => recalcularEmAberto());
  return calculado
    ? "Classificada. Custo recalculado."
    : "Classificada, mas o custo não foi recalculado.";
}

// ---------------------------------------------------------------------------
// Folha para conferir e corrigir, pessoa a pessoa (valores individuais)
// ---------------------------------------------------------------------------

/**
 * Uma folha inteira para conferir e corrigir na tela: pessoas, rubricas e as
 * opções dos campos. Lê com a sessão (RLS: valores individuais).
 */
export function folhaParaEditar(
  ctx: Contexto,
  id: string,
): Promise<RespostaFolhaParaEditar> {
  if (!pode(ctx, "rh.folha") || !pode(ctx, "rh.custo_pessoal.individual"))
    throw new ErroDePermissao();
  if (!z.uuid().safeParse(id).success) throw new ErroNaoEncontrado();
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const folha = await repo.folha(tx, id);
    if (!folha) throw new ErroNaoEncontrado();
    const pessoas = await repo.pessoasDaFolha(tx, id);
    const departamentos = await dados.departamentos(tx);
    const cargos = await dados.cargos(tx);
    const rubricas = await dados.rubricas(tx);
    const linhas = await repo.rubricasDaFolha(tx, id);
    const catalogo = new Map(rubricas.map((r) => [r.codigo, r]));
    const porPessoa = new Map<string, typeof linhas>();
    for (const l of linhas)
      porPessoa.set(l.colaborador_id, [
        ...(porPessoa.get(l.colaborador_id) ?? []),
        l,
      ]);
    return {
      folha,
      departamentos: departamentos.map(({ id, nome }) => ({ id, nome })),
      cargos,
      rubricas,
      pessoas: pessoas
        .map((p) => ({
          colaborador_id: p.colaborador_id,
          nome: p.nome ?? "—",
          matricula: p.matricula ?? null,
          situacao: p.situacao,
          tipo_contrato: p.tipo_contrato,
          departamento_id: p.departamento_id,
          cargo_id: p.cargo_id,
          horas_mes_min: p.horas_mes_min,
          salario: p.salario,
          liquido: p.liquido,
          rubricas: (porPessoa.get(p.colaborador_id) ?? []).map((r) => ({
            codigo: r.rubrica_codigo,
            descricao: catalogo.get(r.rubrica_codigo)?.descricao ?? "",
            grupo: catalogo.get(r.rubrica_codigo)?.grupo ?? "nao_classificada",
            natureza: r.natureza,
            referencia: r.referencia,
            valor: r.valor,
          })),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  });
}

const idOuNulo = z.preprocess(
  (v) => (String(v ?? "").trim() === "" ? null : v),
  z.uuid().nullable(),
);

const pessoaDaFolha = z.object({
  tipo_contrato: z.enum(
    Object.keys(ROTULO_CONTRATO) as [string, ...string[]],
    "escolha o tipo de contrato",
  ),
  departamento_id: idOuNulo,
  cargo_id: idOuNulo,
  horas_mes: z.string().default(""),
  salario: z.preprocess(
    (v) => lerValorBr(String(v ?? "")),
    z.number("valor inválido").min(0, "não pode ser negativo").nullable(),
  ),
});

/**
 * Correção de uma pessoa na folha já importada. A regra (folha fechada,
 * rubrica cadastrada) fica no banco. O recálculo do mês usa a service role.
 */
export async function salvarPessoaDaFolha(
  ctx: Contexto,
  folhaId: string,
  colaboradorId: string,
  campos: Record<string, unknown>,
): Promise<string> {
  const mensagem = "Você não tem permissão para editar a folha.";
  await exigirComMensagem(ctx, ["rh.folha"], mensagem);
  await exigirComMensagem(ctx, ["rh.custo_pessoal.individual"], mensagem);
  const p = validarFormulario(
    pessoaDaFolha,
    {
      tipo_contrato: campo(campos, "tipo_contrato"),
      departamento_id: campo(campos, "departamento_id"),
      cargo_id: campo(campos, "cargo_id"),
      horas_mes: campo(campos, "horas_mes"),
      salario: campo(campos, "salario"),
    },
    {
      tipo_contrato: "Contrato",
      departamento_id: "Departamento",
      cargo_id: "Cargo",
      salario: "Salário",
    },
  );
  const [codigos, naturezas, referencias, valoresRubrica] = [
    valores(campos, "codigo"),
    valores(campos, "natureza"),
    valores(campos, "referencia"),
    valores(campos, "valor"),
  ];
  let rubricas: ReturnType<typeof rubricasDoFormulario>;
  let horas: number | null;
  try {
    horas = minutosDasHoras(p.horas_mes);
    rubricas = rubricasDoFormulario(
      codigos.map((codigo, i) => ({
        codigo,
        natureza: naturezas[i] ?? "",
        referencia: referencias[i] ?? "",
        valor: valoresRubrica[i] ?? "",
      })),
    );
  } catch (e) {
    if (e instanceof ErroEdicao) throw new ErroDeNegocio(e.message);
    throw e;
  }

  const competencia = await naFuncaoDoBanco(
    () =>
      banco.comoUsuario(ctx.usuario.id, async (tx) => {
        await repo.salvarPessoaDaFolha(tx, {
          folhaId,
          colaboradorId,
          pessoa: {
            tipo_contrato: p.tipo_contrato,
            departamento_id: p.departamento_id,
            cargo_id: p.cargo_id,
            horas_mes_min: horas,
            salario: p.salario,
          },
          rubricas,
        });
        return repo.competenciaDaFolha(tx, folhaId);
      }),
    "Não foi possível salvar. Nada foi alterado.",
    "salvar_pessoa_folha",
  );
  const calculado =
    !!competencia &&
    (await tentarRecalcular(() => recalcularCusto(competencia)));
  return calculado ? "Salvo. Custo do mês recalculado." : "Salvo.";
}

// ---------------------------------------------------------------------------
// Tabela de faixas do plano: enviar a planilha → conferir → confirmar
// ---------------------------------------------------------------------------

export async function lerTabelaPlano(
  ctx: Contexto,
  campos: Record<string, unknown>,
  arquivo: ArquivoRecebido | undefined,
): Promise<PreviaDoPlano> {
  // Conferida agora no banco: o arquivo vai para o disco, sem RLS.
  await exigirComMensagem(ctx, ["rh.beneficios"], SEM_PERMISSAO_PLANO);
  const dadosDoEnvio = entradaEnvioDoPlano.safeParse({
    beneficio_id: campo(campos, "beneficio_id"),
    vigencia: campo(campos, "vigencia"),
    reajuste: campo(campos, "reajuste"),
  });
  if (!dadosDoEnvio.success)
    throw new ErroDeNegocio(
      dadosDoEnvio.error.issues[0]?.message ?? "Confira os campos.",
    );
  const envio = dadosDoEnvio.data;
  if (!arquivo || arquivo.bytes.length === 0)
    throw new ErroDeNegocio("Escolha a planilha da operadora (.xlsx).");
  if (arquivo.bytes.length > TAMANHO_MAXIMO)
    throw new ErroDeNegocio("O arquivo passa de 10 MB.");
  const bytes = new Uint8Array(arquivo.bytes);
  if (!ehXlsx(bytes))
    throw new ErroDeNegocio("O arquivo não é uma planilha .xlsx do Excel.");

  let tabela: ReturnType<typeof lerTabelaDoPlano>;
  try {
    tabela = lerTabelaDoPlano(await abasDoXlsx(bytes));
  } catch (e) {
    if (e instanceof ErroPlanilha) throw new ErroDeNegocio(e.message);
    log.error({ err: e }, "leitura da tabela do plano");
    throw new ErroDeNegocio(
      "Não consegui ler a planilha. Confira se é a da operadora.",
    );
  }

  const vigencia = `${envio.vigencia}-01`;
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    beneficio: await repo.beneficioDoPlano(tx, envio.beneficio_id),
    substitui: await repo.temTabela(tx, envio.beneficio_id, vigencia),
  }));
  const beneficio = lido.beneficio;
  if (!beneficio || !["plano_saude", "odonto"].includes(beneficio.tipo))
    throw new ErroDeNegocio(
      "Escolha um benefício do tipo plano de saúde ou odonto.",
    );

  const id = randomUUID();
  const nome = arquivo.nome.slice(0, 200);
  const caminho = `plano_saude/${id}/${nomeNoDisco(nome, "tabela.xlsx")}`;
  try {
    await gravarArquivo(
      BUCKET,
      caminho,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  } catch (e) {
    log.error({ err: e }, "upload da tabela do plano");
    throw new ErroDeNegocio(
      "Não foi possível guardar o arquivo. Tente de novo.",
    );
  }
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.registrarImportacao(tx, {
        id,
        tipo: "plano_saude",
        referencia: vigencia,
        arquivo_nome: nome,
        arquivo_path: caminho,
        arquivo_sha256: sha256(bytes),
        enviado_por: ctx.usuario.id,
        avisos: tabela.avisos,
      }),
    );
  } catch (e) {
    log.error({ err: e }, "registro da importação do plano");
    throw new ErroDeNegocio(
      "Não foi possível registrar a importação. Tente de novo.",
    );
  }

  return {
    importacaoId: id,
    arquivo: nome,
    beneficio: { id: beneficio.id, nome: beneficio.nome },
    vigencia,
    reajuste: envio.reajuste,
    ...tabela,
    substitui: lido.substitui,
  };
}

export async function confirmarTabelaPlano(
  ctx: Contexto,
  campos: Record<string, string>,
): Promise<string> {
  await exigirComMensagem(ctx, ["rh.beneficios"], SEM_PERMISSAO_PLANO);
  const d = confirmacaoDoPlano.safeParse(campos);
  if (!d.success)
    throw new ErroDeNegocio("Prévia inválida. Envie o arquivo de novo.");

  const imp = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.importacao(tx, d.data.importacao_id),
  );
  if (!imp)
    throw new ErroDeNegocio(
      "Importação não encontrada. Envie o arquivo de novo.",
    );
  if (imp.status !== "previa")
    throw new ErroDeNegocio(
      "Esta prévia já foi usada. Envie o arquivo de novo.",
    );
  const arquivo = imp.arquivo_path.startsWith("plano_saude/")
    ? await lerArquivo(BUCKET, imp.arquivo_path)
    : null;
  if (!arquivo)
    throw new ErroDeNegocio("Não encontrei o arquivo enviado. Envie de novo.");
  const tabela = lerTabelaDoPlano(await abasDoXlsx(arquivo));

  await naFuncaoDoBanco(
    () =>
      banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.importarTabelaDoPlano(tx, {
          importacaoId: d.data.importacao_id,
          beneficioId: d.data.beneficio_id,
          reajuste: d.data.reajuste,
          faixas: tabela.faixas,
          coparticipacao: tabela.coparticipacao.map(
            ({ periodo: _, ...c }) => c,
          ),
        }),
      ),
    "Não foi possível gravar a tabela. Nada foi alterado.",
    "importar_tabela_plano",
  );

  // A faixa muda o valor do plano de quem tem benefício vinculado.
  const calculado = await tentarRecalcular(() => recalcularEmAberto());
  return `Tabela gravada: ${tabela.faixas.length} faixas, vigente desde ${formatarMes(imp.referencia)}.${calculado ? " Custo de pessoal recalculado." : ""}`;
}

/** Correção das faixas de uma tabela já gravada, sem enviar outra planilha. */
export async function salvarFaixasPlano(
  ctx: Contexto,
  tabelaId: string,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirComMensagem(
    ctx,
    ["rh.beneficios"],
    "Você não tem permissão para editar a tabela do plano.",
  );
  if (!z.uuid().safeParse(tabelaId).success)
    throw new ErroDeNegocio("Tabela inválida.");
  const [minimas, maximas, mensalidades] = [
    valores(campos, "idade_min"),
    valores(campos, "idade_max"),
    valores(campos, "mensalidade"),
  ];
  let tabela: ReturnType<typeof faixasDoFormulario>;
  try {
    tabela = faixasDoFormulario(
      minimas.map((idade_min, i) => ({
        idade_min,
        idade_max: maximas[i] ?? "",
        mensalidade: mensalidades[i] ?? "",
      })),
    );
  } catch (e) {
    if (e instanceof ErroPlanilha) throw new ErroDeNegocio(e.message);
    throw e;
  }

  await naFuncaoDoBanco(
    () =>
      banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.salvarFaixas(tx, tabelaId, tabela.faixas),
      ),
    "Não foi possível gravar as faixas. Nada foi alterado.",
    "salvar_faixas_plano",
  );

  const calculado = await tentarRecalcular(() => recalcularEmAberto());
  return [
    `Faixas salvas (${tabela.faixas.length}).`,
    ...tabela.avisos,
    calculado ? "Custo de pessoal recalculado." : "",
  ]
    .filter(Boolean)
    .join(" ");
}
