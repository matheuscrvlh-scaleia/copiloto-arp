import "server-only";
import { calcularOS } from "@/lib/os/calculos";
import {
  contarExemplo,
  type DadosExemplo,
  gerarExemplo,
} from "@/lib/os/exemplo";
import { fotoDeExemplo } from "@/lib/os/exemplo-imagem";
import type { Gatilho } from "@/lib/os/modelos";
import { resultadoParaBanco } from "@/lib/os/ordem";
import { proximoCodigo, TEXTOS_PADRAO } from "@/lib/os/vistoria";
import type { Json } from "@/lib/supabase/database.types";
import { registrarEvento } from "@/server/logs";
import { configDoSistema, usuariosDoModulo } from "./automacao";
import { caminhoDoArquivo, enviarArquivo, os, osAdmin } from "./base";
import { removerEmLotes } from "./importacao/arquivos";
import { paraItem } from "./modelos";

// Dados de exemplo (etapa 1 da spec): gera com a service role tudo marcado
// com exemplo = true e apaga só isso. Quem chama já conferiu a permissão
// (os.importacao). A geração é pura (src/lib/os/exemplo.ts); aqui só grava,
// em lotes, na ordem das chaves, já com o status final e as datas (a service
// role não passa pelos gatilhos de quem pode, mas passa pelos do ciclo, que
// só olham mudanças de status).

const LOTE = 500;
/**
 * Lote com linhas de campos diferentes: o que uma linha não traz fica com o
 * padrão da coluna (sem isto, o PostgREST grava null e fura os not null).
 */
const PADRAO = { defaultToNull: false } as const;
const SEMENTE = 20261023;

type Resposta = PromiseLike<{ error: { message: string } | null }>;

async function emLotes<T>(
  nome: string,
  linhas: T[],
  gravar: (lote: T[]) => Resposta,
): Promise<void> {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await gravar(linhas.slice(i, i + LOTE));
    if (error) throw new Error(`Exemplo (${nome}): ${error.message}`);
  }
}

/** Roda `tarefa` em cada item, `deUmaVez` por vez. */
async function emParalelo<T>(
  itens: T[],
  deUmaVez: number,
  tarefa: (item: T) => Promise<void>,
): Promise<void> {
  const fila = [...itens];
  const trabalhar = async () => {
    for (let i = fila.shift(); i !== undefined; i = fila.shift())
      await tarefa(i);
  };
  await Promise.all(Array.from({ length: deUmaVez }, trabalhar));
}

export interface ResultadoExemplo {
  contagens: Record<string, number>;
  /** Pessoas sem setor que entraram num setor para ver a Minha caixa. */
  colocadosEmSetor: string[];
  avisos: string[];
}

export async function gerarDadosDeExemplo(
  usuarioId: string,
  agora = new Date(),
): Promise<ResultadoExemplo> {
  const db = osAdmin();
  const ja = await db
    .from("chamados")
    .select("id")
    .eq("exemplo", true)
    .limit(1);
  const jaLojas = await db
    .from("lojas")
    .select("id")
    .eq("exemplo", true)
    .limit(1);
  if (ja.data?.length || jaLojas.data?.length)
    throw new Error(
      "Já existem dados de exemplo. Apague os atuais antes de gerar de novo.",
    );

  const [
    config,
    pessoas,
    setores,
    categorias,
    ativoCats,
    agendas,
    modelos,
    codigos,
  ] = await Promise.all([
    configDoSistema(),
    usuariosDoModulo(),
    db.from("setores").select("id, nome").eq("ativo", true).order("ordem"),
    db
      .from("categorias")
      .select(
        "id, nome, setor_id, pai_id, tipo_padrao, prazo_valor, prazo_unidade, precisa_confirmacao, checklist",
      )
      .eq("ativo", true),
    db.from("ativo_categorias").select("id, nome, vida_util_padrao_anos"),
    db.from("agendas").select("id, nome").eq("ativo", true),
    db
      .from("modelos")
      .select("*, itens:modelo_itens(*)")
      .eq("ativo", true)
      .in("gatilho", ["entrada", "saida"]),
    db.from("vistorias").select("codigo"),
  ]);
  for (const r of [setores, categorias, ativoCats, agendas, modelos, codigos])
    if (r.error) throw new Error(`Exemplo: ${r.error.message}`);
  const { p, cal } = config;
  const proximo = proximoCodigo((codigos.data ?? []).map((v) => v.codigo));
  const textos = (p.vistoria_textos ?? {}) as Record<
    string,
    { observacao?: string; termo?: string }
  >;

  const dados = gerarExemplo({
    // A semente muda a cada minuto: um técnico de exemplo que ficou (usado
    // numa OS de verdade) não colide com os ids da geração seguinte.
    semente: SEMENTE + Math.floor(agora.getTime() / 60_000),
    agora,
    cal,
    almoco: {
      inicio: p.almoco_inicio.slice(0, 5),
      fim: p.almoco_fim.slice(0, 5),
    },
    setores: setores.data ?? [],
    categorias: categorias.data ?? [],
    ativoCategorias: ativoCats.data ?? [],
    pessoas,
    agendaTelhadoId:
      (agendas.data ?? []).find((a) => /telhado/i.test(a.nome))?.id ?? null,
    modelos: (modelos.data ?? []).map((m) => ({
      id: m.id,
      nome: m.nome,
      gatilho: m.gatilho as Gatilho,
      descricao: m.descricao,
      itens: m.itens.map(paraItem),
    })),
    ambientes: p.vistoria_ambientes.length
      ? p.vistoria_ambientes
      : ["Paredes", "Teto", "Piso", "Fachada e Acesso"],
    causasFalha: p.causas_falha,
    aceiteDias: p.aceite_dias_uteis,
    vistoria: {
      locador: p.vistoria_locador,
      local: p.vistoria_local,
      textos: {
        entrada: textos.entrada ?? TEXTOS_PADRAO.entrada,
        saida: textos.saida ?? TEXTOS_PADRAO.saida,
        preventiva: textos.preventiva ?? TEXTOS_PADRAO.preventiva,
        extraordinaria: textos.extraordinaria ?? TEXTOS_PADRAO.extraordinaria,
      },
    },
    primeiroCodigoVistoria: Number(proximo.replace(/\D/g, "")) || 1,
  });

  await gravar(dados);
  const avisos: string[] = [];
  const semFoto = await gravarFotos(dados);
  if (semFoto)
    avisos.push(`${semFoto} fotos de exemplo não foram gravadas no arquivo.`);
  const semCusto = await gravarCustos(dados);
  if (semCusto) avisos.push(`${semCusto} OS ficaram sem o custo calculado.`);
  const colocadosEmSetor = await colocarEmSetores(pessoas, setores.data ?? []);

  const contagens = contarExemplo(dados);
  await registrarEvento({
    modulo: "os",
    evento: "os_exemplo_gerado",
    descricao: `Gerou dados de exemplo: ${contagens.lojas} lojas, ${contagens.chamados} chamados (${contagens.os} OS), ${contagens.ativos} ativos e ${contagens.vistorias} vistorias`,
    usuarioId,
    detalhes: { contagens, colocados_em_setor: colocadosEmSetor, avisos },
  });
  return { contagens, colocadosEmSetor, avisos };
}

/** Grava na ordem das chaves estrangeiras. */
async function gravar(d: DadosExemplo): Promise<void> {
  const db = osAdmin();
  await emLotes("lojas", d.lojas, (l) => db.from("lojas").insert(l, PADRAO));
  await emLotes("técnicos", d.tecnicos, (l) =>
    db.from("tecnicos").insert(l, PADRAO),
  );
  await emLotes("valor por minuto", d.tecnico_valores, (l) =>
    db.from("tecnico_valores").insert(l, PADRAO),
  );
  await emLotes("empresas", d.empresas, (l) =>
    db.from("empresas").insert(l, PADRAO),
  );
  await emLotes("profissionais", d.profissionais, (l) =>
    db.from("profissionais").insert(l, PADRAO),
  );
  await emLotes("contatos", d.contatos, (l) =>
    db.from("contatos").insert(l, PADRAO),
  );
  await emLotes("ativos", d.ativos, (l) => db.from("ativos").insert(l, PADRAO));
  await emLotes("planos", d.planos_preventivos, (l) =>
    db.from("planos_preventivos").insert(l, PADRAO),
  );
  await emLotes("vistorias", d.vistorias, (l) =>
    db.from("vistorias").insert(l, PADRAO),
  );
  await emLotes("ambientes", d.vistoria_ambientes, (l) =>
    db.from("vistoria_ambientes").insert(l, PADRAO),
  );
  // Um por vez na ordem da abertura: o número segue a data.
  await emLotes("chamados", d.chamados, (l) =>
    db.from("chamados").insert(l, PADRAO),
  );
  await emLotes("destinos", d.destinatarios, (l) =>
    db.from("destinatarios").insert(l, PADRAO),
  );
  await emLotes("linha do tempo", d.eventos, (l) =>
    db.from("eventos").insert(l, PADRAO),
  );
  await emLotes("sessões", d.sessoes, (l) =>
    db.from("sessoes").insert(l, PADRAO),
  );
  await emLotes("técnicos das sessões", d.sessao_tecnicos, (l) =>
    db.from("sessao_tecnicos").insert(l, PADRAO),
  );
  await emLotes("materiais", d.materiais, (l) =>
    db.from("materiais").insert(l, PADRAO),
  );
  await emLotes("valores dos materiais", d.material_valores, (l) =>
    db.from("material_valores").insert(l, PADRAO),
  );
  await emLotes("custos", d.os_custos, (l) =>
    db.from("os_custos").insert(l, PADRAO),
  );
  await emLotes("profissionais da OS", d.chamado_profissionais, (l) =>
    db.from("chamado_profissionais").insert(l, PADRAO),
  );
  await emLotes("links do terceirizado", d.terceirizado_links, (l) =>
    db.from("terceirizado_links").insert(l, PADRAO),
  );
  await emLotes("agendamentos", d.agendamentos, (l) =>
    db.from("agendamentos").insert(l, PADRAO),
  );
  await emLotes("disparos", d.disparos, (l) =>
    db.from("disparos").insert(l, PADRAO),
  );
}

/** Desenha e grava as fotos dos ambientes. Devolve quantas falharam. */
async function gravarFotos(d: DadosExemplo): Promise<number> {
  let falhas = 0;
  await emParalelo(d.fotos, 6, async (f) => {
    try {
      const png = await fotoDeExemplo(f.titulo, f.semente);
      const nome = `${f.titulo}.png`;
      const path = caminhoDoArquivo("ambientes", f.ambienteId, nome);
      await enviarArquivo(path, png, "image/png");
      const { error } = await osAdmin().from("anexos").insert({
        vistoria_id: f.vistoriaId,
        ambiente_id: f.ambienteId,
        categoria: "foto",
        nome,
        path,
        mime: "image/png",
        tamanho: png.length,
        enviado_por_nome: "Dados de exemplo",
        exemplo: true,
      });
      if (error) throw error;
    } catch (erro) {
      falhas++;
      console.error("foto de exemplo", f.ambienteId, erro);
    }
  });
  return falhas;
}

/** Custo de cada OS pelo cálculo do sistema (valor vigente em cada sessão). */
async function gravarCustos(d: DadosExemplo): Promise<number> {
  const nomes = Object.fromEntries(
    d.tecnicos.flatMap((t) => (t.id ? [[t.id, t.nome]] : [])),
  ) as Record<string, string>;
  let falhas = 0;
  await emParalelo(d.calculos, 10, async (c) => {
    const r = calcularOS({ ...c.entrada, nomes });
    const { error } = await osAdmin().rpc("gravar_calculo_os", {
      p_chamado: c.chamadoId,
      p_resultado: resultadoParaBanco(r) as unknown as Json,
    });
    if (error) {
      falhas++;
      console.error("custo da OS de exemplo", c.chamadoId, error);
    }
  });
  return falhas;
}

/**
 * Quem usa o módulo e não está em nenhum setor entra num (um em cada, em
 * rodízio) para a Minha caixa mostrar a fila. Não dá para marcar isso como
 * exemplo: a tela avisa quem entrou e o apagar não tira.
 */
async function colocarEmSetores(
  pessoas: { id: string; nome: string }[],
  setores: { id: string; nome: string }[],
): Promise<string[]> {
  if (!pessoas.length || !setores.length) return [];
  const db = osAdmin();
  const { data, error } = await db.from("setor_membros").select("usuario_id");
  if (error) throw new Error(`Setores: ${error.message}`);
  const comSetor = new Set((data ?? []).map((m) => m.usuario_id));
  const sem = pessoas.filter((p) => !comSetor.has(p.id));
  if (!sem.length) return [];
  const linhas = sem.map((p, i) => ({
    usuario_id: p.id,
    setor_id: (setores[i % setores.length] as { id: string }).id,
  }));
  const { error: e } = await db.from("setor_membros").insert(linhas);
  if (e) throw new Error(`Setores: ${e.message}`);
  return sem.map(
    (p, i) =>
      `${p.nome} → ${(setores[i % setores.length] as { nome: string }).nome}`,
  );
}

// ---------------------------------------------------------------------------
// Apagar
// ---------------------------------------------------------------------------

/** Apaga só o que é de exemplo, das pontas para o centro das chaves. */
export async function apagarDadosDeExemplo(
  usuarioId: string,
): Promise<Record<string, number>> {
  const db = osAdmin();
  const ids = async (tabela: "lojas" | "planos_preventivos") => {
    const { data, error } = await db
      .from(tabela)
      .select("id")
      .eq("exemplo", true);
    if (error) throw new Error(`Exemplo: ${error.message}`);
    return (data ?? []).map((r) => r.id);
  };
  const [lojas, planos] = await Promise.all([
    ids("lojas"),
    ids("planos_preventivos"),
  ]);

  // Arquivos primeiro: as linhas de os.anexos somem em cascata.
  await removerEmLotes(await arquivosDoExemplo(lojas));

  const contagens: Record<string, number> = {};
  const apagar = async (
    nome: string,
    r: PromiseLike<{ error: { message: string } | null; count: number | null }>,
  ) => {
    const { error, count } = await r;
    if (error) throw new Error(`Apagar ${nome}: ${error.message}`);
    contagens[nome] = (contagens[nome] ?? 0) + (count ?? 0);
  };
  await apagar(
    "agendamentos",
    db.from("agendamentos").delete({ count: "exact" }).eq("exemplo", true),
  );
  await apagar(
    "chamados",
    db.from("chamados").delete({ count: "exact" }).eq("exemplo", true),
  );
  // OS que a rotina de preventivas criou para planos de exemplo.
  for (let i = 0; i < planos.length; i += 200)
    await apagar(
      "chamados",
      db
        .from("chamados")
        .delete({ count: "exact" })
        .in("plano_id", planos.slice(i, i + 200)),
    );
  await apagar(
    "vistorias",
    db.from("vistorias").delete({ count: "exact" }).eq("exemplo", true),
  );
  // Vistorias que o modelo de entrada criou sozinho para lojas de exemplo.
  for (let i = 0; i < lojas.length; i += 200)
    await apagar(
      "vistorias",
      db
        .from("vistorias")
        .delete({ count: "exact" })
        .in("loja_id", lojas.slice(i, i + 200))
        .is("criado_por", null),
    );
  for (const [nome, tabela] of [
    ["planos", "planos_preventivos"],
    ["ativos", "ativos"],
    ["contatos", "contatos"],
    ["profissionais", "profissionais"],
    ["empresas", "empresas"],
  ] as const)
    await apagar(
      nome,
      db.from(tabela).delete({ count: "exact" }).eq("exemplo", true),
    );

  // Técnico de exemplo usado numa OS de verdade fica (a OS precisa dele).
  const tecnicos = await db.from("tecnicos").select("id").eq("exemplo", true);
  if (tecnicos.error) throw new Error(tecnicos.error.message);
  const usados = new Set<string>();
  const todos = (tecnicos.data ?? []).map((t) => t.id);
  if (todos.length) {
    const { data, error } = await db
      .from("sessao_tecnicos")
      .select("tecnico_id")
      .in("tecnico_id", todos);
    if (error) throw new Error(error.message);
    for (const s of data ?? []) usados.add(s.tecnico_id);
  }
  const livres = todos.filter((t) => !usados.has(t));
  if (livres.length)
    await apagar(
      "tecnicos",
      db.from("tecnicos").delete({ count: "exact" }).in("id", livres),
    );
  await apagar(
    "lojas",
    db.from("lojas").delete({ count: "exact" }).eq("exemplo", true),
  );

  await registrarEvento({
    modulo: "os",
    evento: "os_exemplo_apagado",
    descricao: `Apagou os dados de exemplo: ${contagens.chamados ?? 0} chamados, ${contagens.lojas ?? 0} lojas, ${contagens.ativos ?? 0} ativos e ${contagens.vistorias ?? 0} vistorias`,
    usuarioId,
    detalhes: { contagens, tecnicos_mantidos: usados.size },
  });
  return contagens;
}

/** Caminhos no bucket do que vai sumir junto com o exemplo. */
async function arquivosDoExemplo(lojas: string[]): Promise<string[]> {
  const db = osAdmin();
  const consultas = await Promise.all([
    db.from("anexos").select("path").eq("exemplo", true),
    db
      .from("anexos")
      .select("path, chamado:chamados!inner(exemplo)")
      .eq("chamado.exemplo", true),
    db
      .from("anexos")
      .select("path, vistoria:vistorias!inner(exemplo)")
      .eq("vistoria.exemplo", true),
    // Fotos e manuais que alguém anexou a um ativo de exemplo.
    db
      .from("anexos")
      .select("path, ativo:ativos!inner(exemplo)")
      .eq("ativo.exemplo", true),
  ]);
  const paths = new Set<string>();
  for (const c of consultas) {
    if (c.error) throw new Error(`Arquivos do exemplo: ${c.error.message}`);
    for (const a of c.data ?? []) paths.add(a.path);
  }
  for (let i = 0; i < lojas.length; i += 200) {
    const { data, error } = await db
      .from("vistorias")
      .select("anexos(path)")
      .in("loja_id", lojas.slice(i, i + 200))
      .is("criado_por", null);
    if (error) throw new Error(error.message);
    for (const v of data ?? []) for (const a of v.anexos) paths.add(a.path);
  }
  return [...paths];
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

/** Quantos dados de exemplo existem (pela sessão; o RLS vale). */
export async function exemploAtual(): Promise<Record<string, number>> {
  const db = await os();
  const contar = async (
    q: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  ) => {
    const { count, error } = await q;
    if (error) throw new Error(`Exemplo: ${error.message}`);
    return count ?? 0;
  };
  const [lojas, chamados, ordens, ativos, vistorias] = await Promise.all([
    contar(
      db
        .from("lojas")
        .select("id", { count: "exact", head: true })
        .eq("exemplo", true),
    ),
    contar(
      db
        .from("chamados")
        .select("id", { count: "exact", head: true })
        .eq("exemplo", true),
    ),
    contar(
      db
        .from("chamados")
        .select("id", { count: "exact", head: true })
        .eq("exemplo", true)
        .eq("tipo", "os"),
    ),
    contar(
      db
        .from("ativos")
        .select("id", { count: "exact", head: true })
        .eq("exemplo", true),
    ),
    contar(
      db
        .from("vistorias")
        .select("id", { count: "exact", head: true })
        .eq("exemplo", true),
    ),
  ]);
  return { lojas, chamados, os: ordens, ativos, vistorias };
}
