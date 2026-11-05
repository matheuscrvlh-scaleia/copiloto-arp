import "server-only";
import { cache } from "react";
import {
  calcularOS,
  type ResultadoOS,
  type Sessao,
  type VigenciaValor,
} from "@/lib/os/calculos";
import { statusAoConcluir } from "@/lib/os/ciclo";
import {
  assinaturaDoLink,
  motivoParaNaoConcluir,
  osEncerrada,
  outrosCustos,
  paraSessao,
  precisaAprovacao,
  rateioDaOS,
  resultadoParaBanco,
  tipoDeServico,
} from "@/lib/os/ordem";
import { dataBr } from "@/lib/os/relatorios";
import { rotaOrdem } from "@/lib/os/rotas";
import { STATUS } from "@/lib/os/rotulos";
import {
  type ChaveMensagem,
  MENSAGENS_PADRAO,
  preencher,
} from "@/lib/os/whatsapp";
import type { Json } from "@/lib/supabase/database.types";
import type { Usuario } from "@/server/auth";
import {
  type Contexto,
  categorias,
  contexto,
  os,
  osAdmin,
  type Parametros,
  parametros,
  type Tabela,
  urlDoSistema,
  urlsAssinadas,
} from "./base";
import { type Cadastros, cadastros, localDa } from "./ordem-consulta";

// Ordem de Serviço (spec 4.8 e 4.16 F): o que o bloco da OS mostra, o
// recálculo gravado pelo servidor, a regra de conclusão e o vínculo com o
// ativo e o técnico do usuário. A leitura é pela sessão (RLS); a service
// role só entra no recálculo (valor por minuto de todos os técnicos), no
// cadastro automático do técnico e na situação do ativo, sempre depois de
// conferir que a pessoa mexe no chamado.

const COLUNAS_CHAMADO =
  "id, numero, tipo, titulo, descricao, setor_id, categoria_id, status, prioridade, aberto_por, responsavel_id, loja_id, ativo_id, execucao, local, bloco, empresa_id, visita_data, visita_periodo, prazo_terceirizado, solucao, causa_falha, ativo_parado, rateio, assinatura_nome, assinatura_path, assinado_em, criado_em, concluido_em, fechado_em, legado_origem, checklist, pessoal, precisa_confirmacao" as const;

export type ChamadoOS = Pick<
  Tabela<"ordens">,
  | "id"
  | "numero"
  | "tipo"
  | "titulo"
  | "descricao"
  | "setor_id"
  | "categoria_id"
  | "status"
  | "prioridade"
  | "aberto_por"
  | "responsavel_id"
  | "loja_id"
  | "ativo_id"
  | "execucao"
  | "local"
  | "bloco"
  | "empresa_id"
  | "visita_data"
  | "visita_periodo"
  | "prazo_terceirizado"
  | "solucao"
  | "causa_falha"
  | "ativo_parado"
  | "rateio"
  | "assinatura_nome"
  | "assinatura_path"
  | "assinado_em"
  | "criado_em"
  | "concluido_em"
  | "fechado_em"
  | "legado_origem"
  | "checklist"
  | "pessoal"
  | "precisa_confirmacao"
>;

export interface SessaoNaTela extends Sessao {
  id: string;
  observacao: string | null;
}

export interface MaterialNaTela {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string | null;
  /** null: sem preço ou quem vê não tem os.custos. */
  valor_unitario: number | null;
}

export interface Arquivo {
  id: string;
  nome: string;
  categoria: string;
  url: string | null;
  imagem: boolean;
  enviadoPor: string | null;
  em: string;
  meu: boolean;
}

export type LinkDaOS = Tabela<"terceirizado_links">;

export interface DadosOS {
  chamado: ChamadoOS;
  ehOS: boolean;
  categoria: Tabela<"categorias"> | null;
  /** Mexe no chamado (RLS) e a OS não está encerrada (ou gerencia o setor). */
  podeEditar: boolean;
  encerrada: boolean;
  gerencia: boolean;
  comCustos: boolean;
  podeTerceirizados: boolean;
  /** Técnico ligado ao usuário logado (cronômetro). */
  meuTecnico: string | null;
  sessoes: SessaoNaTela[];
  /** Minha sessão com o cronômetro rodando. */
  minhaSessaoAberta: SessaoNaTela | null;
  materiais: MaterialNaTela[];
  custos: Tabela<"os_custos"> | null;
  /** Calculado agora com o que a pessoa pode ver (sem valores sem os.custos). */
  resultado: ResultadoOS;
  cad: Cadastros;
  profissionais: string[];
  ativos: {
    id: string;
    codigo: string;
    nome: string;
    local: string;
    situacao: string;
  }[];
  links: LinkDaOS[];
  arquivos: Arquivo[];
  assinaturaUrl: string | null;
  /** Assinatura do terceirizado no link mais recente (se ele assinou). */
  assinaturaTerceirizadoUrl: string | null;
  parametros: Parametros;
  contatos: Pick<Tabela<"contatos">, "id" | "nome" | "telefone" | "empresa">[];
  local: string;
  mensagemOS: string;
  /** Orçamento do terceirizado acima do teto (o valor não vai junto). */
  orcamento: { pendente: boolean; aprovadoEm: string | null };
}

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler a OS: ${erro.message}`);
}

/** Gerencia o setor do chamado (troca responsável, aprova orçamento). */
export function gerenciaSetor(ctx: Contexto, setorId: string): boolean {
  return (
    ctx.pode("os.gerenciar_setor") &&
    (ctx.pode("os.todos_setores") || ctx.setores.includes(setorId))
  );
}

/** Modelo de mensagem dos parâmetros, ou o padrão. */
export function modeloMensagem(p: Parametros, chave: ChaveMensagem): string {
  const m = p.mensagens;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const v = (m as Record<string, Json | undefined>)[chave];
    if (typeof v === "string" && v.trim()) return v;
  }
  return MENSAGENS_PADRAO[chave];
}

const ehImagem = (mime: string | null) => !!mime?.startsWith("image/");

/**
 * Tudo o que o bloco da OS mostra; null se a pessoa não vê o chamado. Uma
 * leitura por requisição: o cronômetro e o bloco usam a mesma.
 */
export const dadosDaOS = cache(lerDadosDaOS);

async function lerDadosDaOS(ordemId: string): Promise<DadosOS | null> {
  const ctx = await contexto();
  const db = await os();
  const { data: chamado, error } = await db
    .from("ordens")
    .select(COLUNAS_CHAMADO)
    .eq("id", ordemId)
    .maybeSingle();
  falhar(error);
  if (!chamado) return null;

  const comCustos = ctx.pode("os.custos");
  const ehOS = chamado.tipo === "os";
  const [
    sessoes,
    materiais,
    custos,
    links,
    anexos,
    editavel,
    cad,
    p,
    cats,
    profissionais,
    ativos,
    contatos,
  ] = await Promise.all([
    db
      .from("sessoes")
      .select(
        "id, data, inicio, fim, almoco_inicio, almoco_fim, observacao, sessao_tecnicos(tecnico_id)",
      )
      .eq("ordem_id", ordemId),
    db
      .from("materiais")
      .select(
        "id, descricao, quantidade, unidade, material_valores(valor_unitario)",
      )
      .eq("ordem_id", ordemId)
      .order("criado_em"),
    comCustos
      ? db.from("os_custos").select("*").eq("ordem_id", ordemId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ehOS
      ? db
          .from("terceirizado_links")
          .select("*")
          .eq("ordem_id", ordemId)
          .order("criado_em", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as LinkDaOS[], error: null }),
    db
      .from("anexos")
      .select(
        "id, nome, categoria, path, mime, enviado_por, enviado_por_nome, em",
      )
      .eq("ordem_id", ordemId)
      .in("categoria", ["antes", "depois", "orcamento", "laudo"])
      .order("em"),
    db.rpc("pode_editar_ordem", { p_ordem: ordemId }),
    cadastros(),
    parametros(),
    categorias(),
    db
      .from("ordem_profissionais")
      .select("profissional_id")
      .eq("ordem_id", ordemId),
    ehOS
      ? db.rpc("ativos_para_vincular")
      : Promise.resolve({ data: [], error: null }),
    db.from("contatos").select("id, nome, telefone, empresa").order("nome"),
  ]);
  for (const r of [sessoes, materiais, custos, links, anexos, profissionais])
    falhar(r.error);

  const naTela: SessaoNaTela[] = (sessoes.data ?? []).map((s) => ({
    ...paraSessao(s),
    id: s.id,
    observacao: s.observacao,
  }));
  const meuTecnico =
    [...cad.tecnicos.values()].find((t) => t.usuario_id === ctx.usuario.id)
      ?.id ?? null;
  const minhaSessaoAberta =
    naTela.find(
      (s) =>
        s.fim === null &&
        meuTecnico !== null &&
        s.tecnicos.includes(meuTecnico),
    ) ?? null;

  const mats: MaterialNaTela[] = (materiais.data ?? []).map((m) => ({
    id: m.id,
    descricao: m.descricao,
    quantidade: Number(m.quantidade),
    unidade: m.unidade,
    valor_unitario: m.material_valores
      ? Number(m.material_valores.valor_unitario)
      : null,
  }));

  const vigencias = comCustos ? await vigenciasDe(naTela, false) : [];
  const k = custos.data;
  const resultado = calcularOS({
    sessoes: naTela,
    vigencias,
    materiais: mats,
    terceirizado: k?.valor_terceirizado ?? null,
    outros: outrosCustos(k?.outros_custos),
    rateio: rateioDaOS(
      chamado.rateio,
      k?.rateio_regra ?? null,
      k?.rateio_valor ?? null,
    ),
    legado: chamado.legado_origem !== null,
    nomes: Object.fromEntries(
      [...cad.tecnicos.values()].map((t) => [t.id, t.nome]),
    ),
  });

  const caminhos = (anexos.data ?? []).map((a) => a.path);
  if (chamado.assinatura_path) caminhos.push(chamado.assinatura_path);
  const assinaturaTerceirizado = links.data?.[0]?.assinatura_path ?? null;
  if (assinaturaTerceirizado) caminhos.push(assinaturaTerceirizado);
  const urls = await urlsAssinadas(caminhos);
  const gerencia = gerenciaSetor(ctx, chamado.setor_id);
  const orcamento = ehOS
    ? await situacaoDoOrcamento(ordemId, k, p.teto_terceirizado)
    : { pendente: false, aprovadoEm: null };
  const encerrada = osEncerrada(chamado.status);
  const local = localDa(chamado, cad);
  const categoria = cats.find((c) => c.id === chamado.categoria_id) ?? null;

  return {
    chamado,
    ehOS,
    categoria,
    podeEditar: editavel.data === true && (!encerrada || gerencia),
    encerrada,
    gerencia,
    comCustos,
    podeTerceirizados: ctx.pode("os.terceirizados"),
    meuTecnico,
    sessoes: naTela,
    minhaSessaoAberta,
    materiais: mats,
    custos: k,
    resultado,
    cad,
    profissionais: (profissionais.data ?? []).map((x) => x.profissional_id),
    ativos: ativos.data ?? [],
    links: links.data ?? [],
    arquivos: (anexos.data ?? []).map((a) => ({
      id: a.id,
      nome: a.nome,
      categoria: a.categoria,
      url: urls.get(a.path) ?? null,
      imagem: ehImagem(a.mime),
      enviadoPor:
        a.enviado_por_nome ??
        (a.enviado_por ? (cad.pessoas.get(a.enviado_por) ?? null) : null),
      em: a.em,
      meu: a.enviado_por === ctx.usuario.id,
    })),
    assinaturaUrl: chamado.assinatura_path
      ? (urls.get(chamado.assinatura_path) ?? null)
      : null,
    assinaturaTerceirizadoUrl: assinaturaTerceirizado
      ? (urls.get(assinaturaTerceirizado) ?? null)
      : null,
    parametros: p,
    contatos: contatos.data ?? [],
    local,
    orcamento,
    mensagemOS: preencher(modeloMensagem(p, "os"), {
      numero: chamado.numero,
      tipo: tipoDeServico(categoria?.nome),
      status: STATUS[chamado.status],
      data: dataBr(chamado.criado_em),
      local,
      descricao: chamado.descricao ?? chamado.titulo,
      link: urlDoSistema(rotaOrdem(chamado.id)),
    }),
  };
}

/**
 * Se o orçamento do terceirizado passou do teto e falta aprovar. Quem não
 * vê custos recebe só a situação: o valor é lido pela service role e não
 * sai daqui.
 */
async function situacaoDoOrcamento(
  ordemId: string,
  custos: Pick<
    Tabela<"os_custos">,
    "valor_terceirizado" | "orcamento_aprovado_em"
  > | null,
  teto: number | null,
): Promise<DadosOS["orcamento"]> {
  const k =
    custos ??
    (
      await osAdmin()
        .from("os_custos")
        .select("valor_terceirizado, orcamento_aprovado_em")
        .eq("ordem_id", ordemId)
        .maybeSingle()
    ).data;
  const acima = precisaAprovacao(k?.valor_terceirizado ?? null, teto);
  return {
    pendente: acima && !k?.orcamento_aprovado_em,
    aprovadoEm: acima ? (k?.orcamento_aprovado_em ?? null) : null,
  };
}

/**
 * Vigências do valor por minuto dos técnicos das sessões. Pela sessão
 * (RLS: só os.custos/os.parametros) para mostrar; pela service role só no
 * recálculo, e o resultado nunca volta para a tela.
 */
async function vigenciasDe(
  sessoes: Sessao[],
  servidor: boolean,
): Promise<VigenciaValor[]> {
  const ids = [...new Set(sessoes.flatMap((s) => s.tecnicos))];
  if (!ids.length) return [];
  const db = servidor ? osAdmin() : await os();
  const { data, error } = await db
    .from("tecnico_valores")
    .select("tecnico_id, vigente_desde, valor_minuto")
    .in("tecnico_id", ids);
  falhar(error);
  return (data ?? []).map((v) => ({
    ...v,
    valor_minuto: Number(v.valor_minuto),
  }));
}

/**
 * Recalcula a OS com o valor por minuto vigente na data de cada sessão e
 * grava o resultado (os.gravar_calculo_os, só a service role). Chame depois
 * de qualquer mudança em sessões, técnicos, materiais, valores ou rateio —
 * e só depois de conferir que a pessoa mexe no chamado.
 */
export async function recalcularOS(ordemId: string): Promise<void> {
  const db = osAdmin();
  const [ch, sessoes, materiais, custos] = await Promise.all([
    db
      .from("ordens")
      .select("rateio, legado_origem")
      .eq("id", ordemId)
      .single(),
    db
      .from("sessoes")
      .select(
        "id, data, inicio, fim, almoco_inicio, almoco_fim, sessao_tecnicos(tecnico_id)",
      )
      .eq("ordem_id", ordemId),
    db
      .from("materiais")
      .select("descricao, quantidade, material_valores(valor_unitario)")
      .eq("ordem_id", ordemId),
    db
      .from("os_custos")
      .select("valor_terceirizado, rateio_regra, rateio_valor, outros_custos")
      .eq("ordem_id", ordemId)
      .maybeSingle(),
  ]);
  for (const r of [ch, sessoes, materiais, custos]) falhar(r.error);
  if (!ch.data) return;

  const ss = (sessoes.data ?? []).map(paraSessao);
  const ids = [...new Set(ss.flatMap((s) => s.tecnicos))];
  const [vigencias, tecnicos] = await Promise.all([
    vigenciasDe(ss, true),
    ids.length
      ? db.from("tecnicos").select("id, nome").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const k = custos.data;
  const r = calcularOS({
    sessoes: ss,
    vigencias,
    materiais: (materiais.data ?? []).map((m) => ({
      descricao: m.descricao,
      quantidade: Number(m.quantidade),
      valor_unitario: m.material_valores
        ? Number(m.material_valores.valor_unitario)
        : null,
    })),
    terceirizado: k?.valor_terceirizado ?? null,
    outros: outrosCustos(k?.outros_custos),
    rateio: rateioDaOS(
      ch.data.rateio,
      k?.rateio_regra ?? null,
      k?.rateio_valor ?? null,
    ),
    legado: ch.data.legado_origem !== null,
    nomes: Object.fromEntries((tecnicos.data ?? []).map((t) => [t.id, t.nome])),
  });
  const { error } = await db.rpc("gravar_calculo_os", {
    p_ordem: ordemId,
    p_resultado: resultadoParaBanco(r) as unknown as Json,
  });
  if (error) console.error("gravar cálculo da OS", ordemId, error);
}

/**
 * Por que a OS ainda não pode ser concluída, ou null. Para o "Concluir" do
 * chamado (qualquer tipo com tempo: cronômetro rodando impede). Lê pela
 * service role só para devolver o motivo (o valor não sai daqui).
 */
export async function podeConcluirOS(ordemId: string): Promise<string | null> {
  const db = osAdmin();
  const [ch, abertas, custos, p, links] = await Promise.all([
    db
      .from("ordens")
      .select("tipo, execucao, solucao, assinado_em")
      .eq("id", ordemId)
      .maybeSingle(),
    db
      .from("sessoes")
      .select("id", { count: "exact", head: true })
      .eq("ordem_id", ordemId)
      .is("fim", null),
    db
      .from("os_custos")
      .select("valor_terceirizado, orcamento_aprovado_em")
      .eq("ordem_id", ordemId)
      .maybeSingle(),
    // O teto vem do cache (quem conclui usa o módulo).
    parametros(),
    db
      .from("terceirizado_links")
      .select("cancelado_em, recusado_em, assinado_em")
      .eq("ordem_id", ordemId),
  ]);
  if (!ch.data) return "Chamado não encontrado.";
  return motivoParaNaoConcluir({
    tipo: ch.data.tipo,
    execucao: ch.data.execucao,
    solucao: ch.data.solucao,
    sessoesAbertas: abertas.count ?? 0,
    valorTerceirizado: custos.data?.valor_terceirizado ?? null,
    teto: p.teto_terceirizado,
    orcamentoAprovado: !!custos.data?.orcamento_aprovado_em,
    assinaturaTerceirizado: assinaturaDoLink(links.data ?? []),
    assinadaPelaArp: ch.data.assinado_em !== null,
  });
}

// ---------------------------------------------------------------------------
// Ativo parado enquanto a OS está aberta
// ---------------------------------------------------------------------------

/**
 * Põe o ativo "Em manutenção" (parado = true) ou de volta "Em uso". Só mexe
 * em quem está na situação oposta (não desfaz uma baixa nem um "Parado"
 * marcado à mão). Quem não gerencia ativos passa pela service role: quem
 * chama já conferiu que a pessoa edita o chamado.
 */
export async function marcarAtivoParado(
  ativoId: string,
  parado: boolean,
  ctx: Contexto,
): Promise<void> {
  const db = ctx.pode("os.ativos_gerenciar") ? await os() : osAdmin();
  const { error } = await db
    .from("ativos")
    .update({ situacao: parado ? "em_manutencao" : "em_uso" })
    .eq("id", ativoId)
    .eq("situacao", parado ? "em_uso" : "em_manutencao");
  if (error) console.error("situação do ativo", ativoId, error);
}

/**
 * Ao fechar ou cancelar a OS: o ativo parado volta a "Em uso". O agente
 * do chamado (e o aceite automático) chamam depois de mudar o status.
 */
export async function liberarAtivoDaOS(ordemId: string): Promise<void> {
  const db = osAdmin();
  const { data } = await db
    .from("ordens")
    .select("ativo_id, ativo_parado, status")
    .eq("id", ordemId)
    .maybeSingle();
  if (!data?.ativo_id || !data.ativo_parado || !osEncerrada(data.status))
    return;
  const { error } = await db
    .from("ativos")
    .update({ situacao: "em_uso" })
    .eq("id", data.ativo_id)
    .eq("situacao", "em_manutencao");
  if (error) console.error("liberar ativo", ordemId, error);
}

// ---------------------------------------------------------------------------
// Técnico do usuário e início do atendimento
// ---------------------------------------------------------------------------

/**
 * Técnico ligado ao usuário (cronômetro). Se não existe, cria com o nome
 * dele (a tabela só aceita quem edita parâmetros: service role) e avisa
 * que falta o valor por minuto.
 */
export async function tecnicoDoUsuario(
  usuario: Usuario,
  setorId: string,
): Promise<{ id: string; criado: boolean; desligado: boolean }> {
  const db = osAdmin();
  const { data } = await db
    .from("tecnicos")
    .select("id, desligado_em")
    .eq("usuario_id", usuario.id)
    .maybeSingle();
  if (data)
    return { id: data.id, criado: false, desligado: !!data.desligado_em };
  const { data: novo, error } = await db
    .from("tecnicos")
    .insert({ nome: usuario.nome, usuario_id: usuario.id, setor_id: setorId })
    .select("id")
    .single();
  if (error)
    throw new Error(`Não foi possível criar o técnico: ${error.message}`);
  return { id: novo.id, criado: true, desligado: false };
}

/** Para onde a OS vai ao concluir (Fechado direto ou Concluído). */
export function destinoAoConcluir(ch: ChamadoOS): "fechado" | "concluido" {
  return statusAoConcluir(ch);
}

// ---------------------------------------------------------------------------
// Conferência das ações
// ---------------------------------------------------------------------------

export type ParaEditar =
  | { ctx: Contexto; ch: ChamadoOS; gerencia: boolean; erro?: undefined }
  | { erro: string };

/**
 * O chamado para uma ação do bloco da OS: a pessoa precisa mexer nele (RLS)
 * e, se a OS já fechou ou foi cancelada, gerenciar o setor (correção).
 */
export async function chamadoParaEditar(ordemId: string): Promise<ParaEditar> {
  const ctx = await contexto();
  const db = await os();
  const [{ data: ch }, editavel] = await Promise.all([
    db.from("ordens").select(COLUNAS_CHAMADO).eq("id", ordemId).maybeSingle(),
    db.rpc("pode_editar_ordem", { p_ordem: ordemId }),
  ]);
  if (!ch || editavel.data !== true)
    return { erro: "Você não pode mexer nesta OS." };
  const gerencia = gerenciaSetor(ctx, ch.setor_id);
  if (osEncerrada(ch.status) && !gerencia)
    return {
      erro: "A OS já foi fechada ou cancelada. Só quem gerencia o setor corrige.",
    };
  return { ctx, ch, gerencia };
}
