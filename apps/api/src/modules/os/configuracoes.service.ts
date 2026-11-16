import { diferencas, TABELAS, tabelasQueCasam } from "@arp/shared/historico";
import {
  etiquetasMaisUsadas,
  nomeDaCopia,
  reordenar,
  validarCamposExtras,
  validarChecklist,
} from "@arp/shared/os/catalogo";
import {
  lerFiltrosHistoricoOS,
  numeroBuscado,
  POR_PAGINA_HISTORICO,
} from "@arp/shared/os/configuracoes";
import type {
  Alteracao,
  ConsultaHistorico,
  EntradaModelo,
  entradaCategoria,
  entradaContato,
  entradaEmpresa,
  entradaGestor,
  entradaMembro,
  entradaProfissional,
  entradaSetor,
  RespostaCategoriaSalva,
  RespostaCategorias,
  RespostaHistorico,
  RespostaRotinas,
  RespostaSetores,
  RespostaTerceirizados,
  ResumoDoCatalogo,
} from "@arp/shared/os/contratos/configuracoes";
import type { Permissao } from "@arp/shared/permissions";
import type { z } from "zod";
import { type Contexto, exigir, exigirAlguma, pode } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import * as base from "./base.repository";
import * as repo from "./configuracoes.repository";
import { modelos } from "./modelos.repository";
import { rodarRotinas } from "./rotinas.service";

// Tickets › Configurações (spec 4.5 e 4.15): catálogo por setor, setores e
// pessoas, internos e terceirizados, o cadastro dos modelos (com "Rodar
// rotinas agora") e o histórico do módulo. Tudo grava pela sessão (RLS: cada
// tabela diz quem altera; o gatilho de auditoria guarda o antes e o depois).
// A service role só conta os usos de uma categoria e roda as rotinas, sempre
// depois de conferir a permissão no banco. Os parâmetros ficam em
// parametros.service.ts.

export const NADA_ALTERADO =
  "Nada foi alterado: o registro não existe mais ou você não tem acesso a ele.";

/** A permissão da tela, lida nesta requisição (o `exigir` antigo). */
export function exigirUma(ctx: Contexto, ...permissoes: Permissao[]): void {
  if (!permissoes.some((p) => pode(ctx, p)))
    throw new ErroDePermissao("Você não tem permissão para esta alteração.");
}

const nadaAlterado = (n: number) => {
  if (!n) throw new ErroDeNegocio(NADA_ALTERADO);
};

const comoUsuario = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/** GET /configuracoes/categorias: setores, catálogo inteiro e agendas. */
export function lerCategorias(ctx: Contexto): Promise<RespostaCategorias> {
  return comoUsuario(ctx, async (tx) => ({
    setores: await base.setores(tx),
    categorias: await base.categorias(tx),
    agendas: (await base.agendas(tx)).map(({ id, nome, ativo }) => ({
      id,
      nome,
      ativo,
    })),
  }));
}

/** GET /configuracoes/catalogo/resumo: contagens do setor, etiquetas, portal. */
export function resumoDoCatalogo(
  ctx: Contexto,
  setorId: string,
): Promise<ResumoDoCatalogo> {
  return comoUsuario(ctx, async (tx) => {
    const ids = (await base.categorias(tx))
      .filter((c) => c.setor_id === setorId)
      .map((c) => c.id);
    const contagens = await repo.chamadosPorCategoria(tx, ids);
    const etiquetas = etiquetasMaisUsadas(await repo.etiquetasRecentes(tx), 24);
    const p = await base.parametros(tx);
    return {
      contagens: Object.fromEntries(contagens),
      etiquetas,
      boasVindas: p.portal_boas_vindas,
    };
  });
}

/**
 * POST /configuracoes/categorias: cria ou altera. O banco confere que a
 * subcategoria tem um nível só e é do mesmo setor.
 */
export async function salvarCategoria(
  ctx: Contexto,
  d: z.output<typeof entradaCategoria>,
): Promise<RespostaCategoriaSalva> {
  const campos = validarCamposExtras(d.campos);
  if (!campos.ok) throw new ErroDeNegocio(`Campos extras: ${campos.erro}.`);
  const checklist = validarChecklist(d.checklist);
  if (!checklist.ok) throw new ErroDeNegocio(`Checklist: ${checklist.erro}.`);

  const { id, campos: _c, checklist: _k, ...resto } = d;
  if (id && resto.pai_id === id)
    throw new ErroDeNegocio(
      "A categoria não pode ser subcategoria dela mesma.",
    );
  const linha = {
    ...resto,
    // Aviso não pede confirmação de quem pediu (vai e volta como ciência).
    precisa_confirmacao:
      resto.tipo_padrao === "aviso" ? false : resto.precisa_confirmacao,
    campos: JSON.stringify(campos.valor),
    checklist: JSON.stringify(checklist.valor),
  };
  return comoUsuario(ctx, async (tx) => {
    if (id) {
      const filhas = await repo.contarFilhas(tx, id);
      if (filhas > 0 && linha.pai_id)
        throw new ErroDeNegocio(
          "Esta categoria tem subcategorias e por isso não pode virar subcategoria.",
        );
      nadaAlterado(await repo.atualizarCategoria(tx, id, linha));
      // Mudou de setor: as subcategorias vão junto (sempre do mesmo setor).
      if (filhas > 0) await repo.moverFilhas(tx, id, linha.setor_id);
      return {
        mensagem: "Categoria salva.",
        criada: false,
        setor_id: linha.setor_id,
      };
    }
    const ordem = await repo.proximaOrdem(tx, linha.setor_id, linha.pai_id);
    await repo.inserirCategoria(tx, { ...linha, ordem });
    // A tela volta ao catálogo e avisa "Categoria criada." ao abrir.
    return { mensagem: "", criada: true, setor_id: linha.setor_id };
  });
}

/** Sobe ou desce a categoria entre as irmãs (mesmo setor e mesmo pai). */
export function moverCategoria(
  ctx: Contexto,
  id: string,
  delta: number,
): Promise<void> {
  return comoUsuario(ctx, async (tx) => {
    const atual = await base.categoria(tx, id);
    if (!atual) throw new ErroDeNegocio(NADA_ALTERADO);
    const lista = await repo.irmas(tx, atual.setor_id, atual.pai_id);
    for (const m of reordenar(lista, id, delta))
      await repo.gravarOrdem(tx, "os.categorias", m.id, m.ordem);
  });
}

/** Desativa (some da abertura de chamados) ou reativa a categoria. */
export async function alternarCategoria(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<string> {
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.atualizarCategoria(tx, id, { ativo })),
  );
  return ativo ? "Categoria reativada." : "Categoria desativada.";
}

/**
 * Apaga a categoria que nunca foi usada. A contagem vê todos os chamados
 * (service role, depois de conferir os.catalogo no banco); a exclusão vai
 * pelo RLS. Devolve o setor (a tela volta ao catálogo dele).
 */
export async function excluirCategoria(
  ctx: Contexto,
  id: string,
): Promise<string> {
  await exigir(ctx, "os.catalogo");
  const lido = await banco.comoServico(async (tx) => {
    const categoria = await base.categoria(tx, id);
    if (!categoria) return null;
    return {
      setor: categoria.setor_id,
      filhas: await repo.contarFilhas(tx, id),
      usos: await repo.usosDaCategoria(tx, id),
    };
  });
  if (!lido) throw new ErroDeNegocio(NADA_ALTERADO);
  if (lido.filhas)
    throw new ErroDeNegocio("Exclua ou mova as subcategorias antes.");
  const { chamados, planos, itens } = lido.usos;
  if (chamados || planos || itens)
    throw new ErroDeNegocio(
      `Esta categoria já foi usada (${[
        chamados && `${chamados} chamado${chamados === 1 ? "" : "s"}`,
        planos && `${planos} preventiva${planos === 1 ? "" : "s"}`,
        itens && `${itens} item${itens === 1 ? "" : "s"} de modelo`,
      ]
        .filter(Boolean)
        .join(", ")}). Desative em vez de excluir.`,
    );
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.excluirCategoria(tx, id)),
  );
  return lido.setor;
}

/** Cria uma cópia (sem as subcategorias); a tela abre a cópia para editar. */
export function duplicarCategoria(ctx: Contexto, id: string): Promise<string> {
  return comoUsuario(ctx, async (tx) => {
    const original = await base.categoria(tx, id);
    if (!original) throw new ErroDeNegocio(NADA_ALTERADO);
    const {
      id: _i,
      criado_em: _c,
      atualizado_em: _a,
      campos,
      checklist,
      ...copia
    } = original;
    const nomes = (await repo.irmas(tx, copia.setor_id, copia.pai_id)).map(
      (n) => n.nome,
    );
    const ordem = await repo.proximaOrdem(tx, copia.setor_id, copia.pai_id);
    const nova = await repo.inserirCategoria(tx, {
      ...copia,
      campos: JSON.stringify(campos),
      checklist: JSON.stringify(checklist),
      nome: nomeDaCopia(copia.nome, nomes),
      ordem,
    });
    return nova.id;
  });
}

// ---------------------------------------------------------------------------
// Setores e pessoas. Setor não é apagado: chamados antigos continuam nele;
// inativo, some da abertura de chamados.
// ---------------------------------------------------------------------------

/** GET /configuracoes/setores: quem é de cada setor. */
export function lerSetores(ctx: Contexto): Promise<RespostaSetores> {
  return comoUsuario(ctx, async (tx) => ({ membros: await repo.membros(tx) }));
}

export function salvarSetor(
  ctx: Contexto,
  d: z.output<typeof entradaSetor>,
): Promise<string> {
  const { id, ...linha } = d;
  return comoUsuario(ctx, async (tx) => {
    if (id) {
      nadaAlterado(await repo.atualizarSetor(tx, id, linha));
      return "Setor salvo.";
    }
    await repo.inserirSetor(tx, linha);
    return "Setor criado. Inclua as pessoas e monte o catálogo dele.";
  });
}

export function moverSetor(
  ctx: Contexto,
  id: string,
  delta: number,
): Promise<void> {
  return comoUsuario(ctx, async (tx) => {
    const lista = await repo.ordemDosSetores(tx);
    for (const m of reordenar(lista, id, delta))
      await repo.gravarOrdem(tx, "os.setores", m.id, m.ordem);
  });
}

export function incluirMembro(
  ctx: Contexto,
  d: z.output<typeof entradaMembro>,
): Promise<void> {
  return comoUsuario(ctx, (tx) => repo.incluirMembro(tx, d));
}

export function marcarGestor(
  ctx: Contexto,
  d: z.output<typeof entradaGestor>,
): Promise<void> {
  return comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.marcarGestor(tx, d)),
  );
}

export function removerMembro(
  ctx: Contexto,
  setorId: string,
  usuarioId: string,
): Promise<void> {
  return comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.removerMembro(tx, setorId, usuarioId)),
  );
}

// ---------------------------------------------------------------------------
// Internos e terceirizados. Empresa e profissional não são apagados: ficam
// nas OS antigas; inativos, somem das escolhas.
// ---------------------------------------------------------------------------

/** GET /configuracoes/terceirizados: empresas (os.terceirizados) e contatos. */
export function lerTerceirizados(
  ctx: Contexto,
): Promise<RespostaTerceirizados> {
  const verEmpresas = pode(ctx, "os.terceirizados");
  if (!verEmpresas && !pode(ctx, "os.parametros")) throw new ErroDePermissao();
  return comoUsuario(ctx, async (tx) => {
    const lista = verEmpresas ? await repo.empresas(tx) : [];
    const profissionais = verEmpresas ? await repo.profissionais(tx) : [];
    return {
      empresas: lista.map((e) => ({
        ...e,
        profissionais: profissionais.filter((p) => p.empresa_id === e.id),
      })),
      contatos: await repo.contatos(tx),
    };
  });
}

export async function salvarEmpresa(
  ctx: Contexto,
  d: z.output<typeof entradaEmpresa>,
): Promise<string> {
  const { id, cnpj, ...resto } = d;
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(
      await repo.salvarEmpresa(tx, id, { ...resto, cnpj: cnpj ?? null }),
    ),
  );
  return id ? "Empresa salva." : "Empresa cadastrada.";
}

export async function salvarProfissional(
  ctx: Contexto,
  d: z.output<typeof entradaProfissional>,
): Promise<string> {
  const { id, ...linha } = d;
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.salvarProfissional(tx, id, linha)),
  );
  return id ? "Profissional salvo." : "Profissional incluído.";
}

export async function salvarContato(
  ctx: Contexto,
  d: z.output<typeof entradaContato>,
): Promise<string> {
  exigirUma(ctx, "os.terceirizados", "os.parametros");
  const { id, ...linha } = d;
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.salvarContato(tx, id, linha)),
  );
  return id ? "Contato salvo." : "Contato salvo na lista.";
}

/** Contato não é ligado a nenhum chamado: pode ser removido de verdade. */
export function removerContato(ctx: Contexto, id: string): Promise<void> {
  exigirUma(ctx, "os.terceirizados", "os.parametros");
  return comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.removerContato(tx, id)),
  );
}

// ---------------------------------------------------------------------------
// Modelos de entrada e saída (spec 4.12). Modelos e itens gravam pelo RLS
// (os.modelos). O disparo e a tela de Disparos ficam em modelos.service.ts.
// ---------------------------------------------------------------------------

/** GET /configuracoes/modelos: modelos com os itens na ordem. */
export function lerModelos(ctx: Contexto) {
  return comoUsuario(ctx, async (tx) => ({ modelos: await modelos(tx) }));
}

/** Cria ou altera o modelo e troca a lista de itens pela da tela. */
export async function salvarModelo(
  ctx: Contexto,
  d: EntradaModelo,
): Promise<string> {
  const { id, itens, ...campos } = d;
  if (campos.gatilho !== "manual" && itens.length === 0)
    throw new ErroDeNegocio(
      "Um modelo de entrada ou saída precisa de ao menos um item.",
    );
  await comoUsuario(ctx, async (tx) => {
    let modeloId = id;
    if (modeloId)
      nadaAlterado(await repo.atualizarModelo(tx, modeloId, campos));
    else modeloId = await repo.inserirModelo(tx, campos);
    const dono = modeloId;
    // Itens que saíram da lista são apagados; os outros, gravados na ordem.
    await repo.apagarItensFora(
      tx,
      dono,
      itens.flatMap((i) => (i.id ? [i.id] : [])),
    );
    await repo.gravarItens(
      tx,
      itens.map(({ id: itemId, ...i }, ordem) => ({
        ...(itemId ? { id: itemId } : {}),
        ...i,
        modelo_id: dono,
        ordem,
      })),
    );
  });
  return id
    ? `Modelo salvo (${itens.length} ${itens.length === 1 ? "item" : "itens"}).`
    : "Modelo criado.";
}

/** Ativa ou desativa: modelo desativado não dispara sozinho. */
export async function alternarModelo(
  ctx: Contexto,
  id: string,
  ativo: boolean,
): Promise<string> {
  await comoUsuario(ctx, async (tx) =>
    nadaAlterado(await repo.alternarModelo(tx, id, ativo)),
  );
  return ativo ? "Modelo ativado." : "Modelo desativado.";
}

/**
 * "Rodar rotinas agora": o mesmo que o agendador faz todo dia (service
 * role; a permissão é conferida no banco).
 */
export async function rodarRotinasAgora(
  ctx: Contexto,
): Promise<RespostaRotinas> {
  await exigirAlguma(ctx, ["os.parametros", "os.modelos"]);
  const agora = new Date();
  const resultados = await rodarRotinas(agora, ctx.usuario.id);
  return { resultados, em: agora.toISOString() };
}

// ---------------------------------------------------------------------------
// Histórico (core.auditoria: o RLS libera as tabelas os.* com os.historico)
// ---------------------------------------------------------------------------

/** Quem vê o histórico do módulo (os.historico ou o histórico geral). */
export const podeVerHistorico = (ctx: Contexto) =>
  pode(ctx, "os.historico") || pode(ctx, "admin.historico");

const objeto = (v: JsonValue | null): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? v : null;

interface LinhaAuditoria {
  id: number;
  em: string;
  tabela: string;
  registro_id: string;
  acao: string;
  usuario_id: string | null;
  antes: JsonValue | null;
  depois: JsonValue | null;
}

function comAutores(
  lidas: LinhaAuditoria[],
  nomes: Map<string, string>,
): Alteracao[] {
  return lidas.map((l) => ({
    id: l.id,
    em: l.em,
    tabela: l.tabela,
    registroId: l.registro_id,
    acao: l.acao === "insert" || l.acao === "delete" ? l.acao : "update",
    autor: l.usuario_id
      ? (nomes.get(l.usuario_id) ?? "Outro usuário")
      : "Sistema",
    antes: objeto(l.antes),
    depois: objeto(l.depois),
  }));
}

/**
 * Últimas alterações de um bloco de Parâmetros. `campos` separa os blocos
 * que dividem a linha única de os.parametros: só entra a alteração que
 * mexeu num campo do bloco. null: a pessoa não vê o histórico.
 */
export async function ultimasAlteracoes(
  tx: Tx,
  ctx: Contexto,
  tabelas: string[],
  {
    campos,
    limite = 5,
    nomes,
  }: { campos?: string[]; limite?: number; nomes?: Map<string, string> } = {},
): Promise<Alteracao[] | null> {
  if (!podeVerHistorico(ctx)) return null;
  const lidas = (
    await repo.ultimasAlteracoes(tx, tabelas, campos ? limite * 10 : limite)
  ).filter(
    (l) =>
      !campos ||
      l.tabela !== "os.parametros" ||
      diferencas(objeto(l.antes), objeto(l.depois)).some((d) =>
        campos.includes(d.campo),
      ),
  );
  return comAutores(lidas.slice(0, limite), nomes ?? (await nomesDoModulo(tx)));
}

export async function nomesDoModulo(tx: Tx): Promise<Map<string, string>> {
  return new Map((await base.pessoas(tx)).map((p) => [p.id, p.nome]));
}

/** Termo de busca seguro (sem vírgula nem parênteses). */
const termoSeguro = (t: string) =>
  t.replace(/[^\p{L}\p{N} @._-]/gu, " ").trim();
const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tabelas do módulo para o filtro (nome na tela). */
const TABELAS_OS = Object.entries(TABELAS)
  .filter(([t]) => t.startsWith("os."))
  .map(([tabela, nome]) => ({ tabela, nome }))
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

/** GET /configuracoes/historico: o módulo inteiro, com filtros e página. */
export function lerHistorico(
  ctx: Contexto,
  consulta: ConsultaHistorico,
): Promise<RespostaHistorico> {
  if (!podeVerHistorico(ctx)) throw new ErroDePermissao();
  const f = lerFiltrosHistoricoOS(consulta);
  return comoUsuario(ctx, async (tx) => {
    const pessoas = await base.pessoas(tx);
    const termo = termoSeguro(f.busca);
    let busca: repo.FiltroDoHistorico["busca"] = null;
    if (termo) {
      const numero = numeroBuscado(f.busca);
      // Chamado e OS numeram cada um na sua sequência: o número pode casar
      // com os dois.
      busca = {
        termo,
        registros: numero !== null ? await repo.idsPeloNumero(tx, numero) : [],
        tabelas: tabelasQueCasam(termo).filter((t) => t.startsWith("os.")),
        autores: pessoas
          .filter((p) => semAcento(p.nome).includes(semAcento(termo)))
          .map((p) => p.id),
      };
    }
    const { linhas, total } = await repo.historico(
      tx,
      {
        tabela: f.tabela,
        usuario: f.usuario,
        registro: f.registro,
        de: f.de ? `${f.de}T00:00:00-03:00` : null,
        ate: f.ate ? `${f.ate}T23:59:59-03:00` : null,
        busca,
      },
      {
        limite: POR_PAGINA_HISTORICO,
        pular: (f.pagina - 1) * POR_PAGINA_HISTORICO,
      },
    );
    return {
      linhas: comAutores(linhas, new Map(pessoas.map((p) => [p.id, p.nome]))),
      total,
      tabelas: TABELAS_OS,
      autores: pessoas
        .map((p) => ({ id: p.id, nome: p.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    };
  });
}
