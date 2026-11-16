import { lerCamposExtras, lerChecklist } from "@arp/shared/os/chamado";
import type {
  CategoriaDoFormulario,
  DadosDoFormulario,
  EntradaTerceirizadoRapido,
  InicialDoFormulario,
  OpcoesDeVinculo,
} from "@arp/shared/os/contratos/base";
import { numeroDo } from "@arp/shared/os/numeros";
import { UNIDADES_PRAZO } from "@arp/shared/os/rotulos";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { UUID } from "./alvo";
import * as base from "./base.repository";
import { contextoOs, pessoas } from "./base.service";
import * as repo from "./chamados.repository";
import { lerChamado } from "./chamados.service";
import * as lojas from "./lojas.repository";

// O que o formulário de abrir chamado precisa (configuração do módulo):
// setores e categorias ativos, pessoas do módulo e agendas. Lojas e ativos só
// vêm quando a pessoa abre "Mais detalhes" (opcoesDeVinculo). O botão
// "+ Novo", a página /os/novo e a gestão do detalhe pedem o mesmo.

export async function dadosDoFormularioCom(
  tx: Tx,
  ctx: Contexto,
): Promise<DadosDoFormulario> {
  const cx = await contextoOs(tx, ctx);
  const todosSetores = await base.setores(tx);
  const todas = await base.categorias(tx);
  const gente = await pessoas(tx);
  const todasAgendas = await base.agendas(tx);
  const ativos = todosSetores.filter((s) => s.ativo);
  const idsAtivos = new Set(ativos.map((s) => s.id));
  // Subcategoria some junto com a categoria de cima desativada.
  const porId = new Map(todas.map((c) => [c.id, c]));
  const disponivel = (c: (typeof todas)[number] | undefined): boolean =>
    Boolean(
      c?.ativo &&
        idsAtivos.has(c.setor_id) &&
        (!c.pai_id || disponivel(porId.get(c.pai_id))),
    );
  const cats: CategoriaDoFormulario[] = todas
    .filter((c) => disponivel(c))
    .map((c) => ({
      id: c.id,
      setorId: c.setor_id,
      paiId: c.pai_id,
      nome: c.nome,
      icone: c.icone,
      cor: c.cor,
      tipo: c.tipo_padrao,
      prioridade: c.prioridade_padrao,
      responsavelId: c.responsavel_padrao_id,
      prazo: c.prazo_valor
        ? `${c.prazo_valor} ${c.prazo_valor === 1 && c.prazo_unidade === "horas" ? "hora" : c.prazo_valor === 1 ? "dia útil" : UNIDADES_PRAZO[c.prazo_unidade]}`
        : null,
      precisaConfirmacao: c.precisa_confirmacao,
      vincularAtivo: c.vincular_ativo,
      vincularLoja: c.vincular_loja,
      agendaId: c.agenda_id,
      campos: lerCamposExtras(c.campos),
      itensChecklist: lerChecklist(c.checklist).length,
    }));
  return {
    eu: { id: ctx.usuario.id, nome: ctx.usuario.nome },
    meusSetores: cx.setores.filter((s) => idsAtivos.has(s)),
    setores: ativos.map((s) => ({
      id: s.id,
      nome: s.nome,
      cor: s.cor,
      icone: s.icone,
    })),
    categorias: cats,
    pessoas: gente.map((p) => ({
      id: p.id,
      nome: p.nome,
      setores: p.setores,
    })),
    agendas: todasAgendas
      .filter((a) => a.ativo)
      .map((a) => ({ id: a.id, nome: a.nome })),
  };
}

/** GET /os/formulario */
export function dadosDoFormulario(ctx: Contexto): Promise<DadosDoFormulario> {
  return banco.comoUsuario(ctx.usuario.id, (tx) =>
    dadosDoFormularioCom(tx, ctx),
  );
}

const um = (v: unknown) =>
  (Array.isArray(v) ? v[0] : v)?.toString().trim() || undefined;
const id = (v: unknown) => {
  const t = um(v);
  return t && UUID.test(t) ? t : undefined;
};

/**
 * GET /os/formulario/inicial: abrir chamado (/os/novo) ou OS
 * (/os/ordens/nova) com contexto pela URL: ?ativo=<id> (etiqueta QR do
 * ativo), ?loja=<id>, ?vinculado=<id> (chamado ligado),
 * ?vistoria=<id>&ambiente=<id> ("Gerar OS"), ?duplicar=<id> e
 * ?titulo=&descricao= (texto pronto, como o "Precisa de outro setor?" do
 * Comercial). Um não vira o outro: a cópia e o vínculo só valem dentro do
 * que a página abre. Lido pela sessão: só o que a pessoa vê.
 */
export function inicialDoFormulario(
  ctx: Contexto,
  busca: Record<string, unknown>,
  ehOS: boolean,
): Promise<InicialDoFormulario> {
  const inicial: InicialDoFormulario = ehOS
    ? { tipo: "os", contexto: [] }
    : { contexto: [] };
  inicial.titulo = um(busca.titulo)?.slice(0, 200);
  inicial.descricao = um(busca.descricao)?.slice(0, 5000);
  const origemId = id(busca.duplicar);
  const vinculadoId = id(busca.vinculado);
  const ativoId = id(busca.ativo);
  const lojaId = id(busca.loja);
  const vistoriaId = id(busca.vistoria);
  const ambienteId = id(busca.ambiente);
  if (!origemId && !vinculadoId && !ativoId && !lojaId && !vistoriaId)
    return Promise.resolve(inicial);

  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lida = origemId ? await lerChamado(tx, origemId) : null;
    const ligado = vinculadoId ? await lerChamado(tx, vinculadoId) : null;
    const ativo = ativoId
      ? (await repo.ativosParaVincular(tx, ativoId))[0]
      : undefined;
    const loja = lojaId ? await lojas.lojaResumida(tx, lojaId) : undefined;
    const v = vistoriaId ? await repo.vistoriaCurta(tx, vistoriaId) : undefined;
    const amb =
      vistoriaId && ambienteId
        ? await repo.ambienteDaVistoria(tx, ambienteId, vistoriaId)
        : undefined;

    // Duplicar: só OS vira OS e só chamado vira chamado.
    const origem = lida && (lida.tipo === "os") === ehOS ? lida : null;
    if (origem) {
      Object.assign(inicial, {
        titulo: origem.titulo,
        descricao: origem.descricao ?? undefined,
        prioridade: origem.prioridade,
        etiquetas: origem.etiquetas.join(", "),
        lojaId: origem.loja_id ?? undefined,
        ativoId: origem.ativo_id ?? undefined,
        setorId: origem.setor_id,
        categoriaId: origem.categoria_id,
        tipo: origem.tipo,
      });
      inicial.contexto.push({
        rotulo: "Cópia de",
        valor: `${numeroDo(origem)} ${origem.titulo}`,
      });
    }

    // O vínculo é sempre com um chamado (a OS aponta para o chamado).
    if (ligado && ligado.tipo !== "os") {
      inicial.vinculadoAId = ligado.id;
      inicial.lojaId ??= ligado.loja_id ?? undefined;
      inicial.ativoId ??= ligado.ativo_id ?? undefined;
      inicial.contexto.push({
        rotulo: "Ligado a",
        valor: `${numeroDo(ligado)} ${ligado.titulo}`,
      });
    }

    if (ativo) {
      inicial.ativoId = ativo.id;
      inicial.contexto.push({
        rotulo: "Ativo",
        valor: `${ativo.codigo} · ${ativo.nome}`,
      });
    }

    if (loja) {
      inicial.lojaId = loja.id;
      inicial.contexto.push({
        rotulo: "Loja",
        valor: `${loja.luc} · ${loja.nome}`,
      });
    }

    if (v) {
      inicial.vistoriaId = v.id;
      inicial.lojaId ??= v.loja_id ?? undefined;
      inicial.contexto.push({ rotulo: "Vistoria", valor: `Laudo ${v.codigo}` });
      if (amb) {
        inicial.ambienteId = amb.id;
        inicial.titulo ??= `${amb.titulo} – ${v.bloco} ${v.unidade}`.slice(
          0,
          200,
        );
        inicial.descricao ??= amb.descricao ?? undefined;
        inicial.contexto.push({ rotulo: "Ambiente", valor: amb.titulo });
      }
    }
    return inicial;
  });
}

/**
 * GET /os/formulario/vinculos: lojas vigentes e ativos, carregados só quando
 * a pessoa abre "Mais detalhes".
 */
export function opcoesDeVinculo(ctx: Contexto): Promise<OpcoesDeVinculo> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const vigentes = await lojas.lojasVigentes(tx);
    const ativos = await repo.ativosParaVincular(tx);
    return {
      lojas: vigentes.map((l) => ({
        id: l.id,
        rotulo: `${l.luc} · ${l.nome}`,
        descricao: "",
      })),
      ativos: ativos.map((a) => ({
        id: a.id,
        rotulo: `${a.codigo} · ${a.nome}`,
        descricao: a.local,
      })),
    };
  });
}

/**
 * POST /os/categorias/rapida: categoria criada no "Novo chamado" por quem
 * usa o módulo: só nome, setor, ícone e tipo. Editar e excluir seguem com
 * os.catalogo (o RLS só deixa inserir a simples).
 */
export async function criarCategoriaRapida(
  ctx: Contexto,
  d: {
    nome: string;
    setorId: string;
    icone: string;
    tipo: "tarefa" | "solicitacao" | "os" | "aviso";
  },
): Promise<CategoriaDoFormulario> {
  if (!ctx.permissoes.has("os.acessar"))
    throw new ErroDePermissao("Você não tem permissão para esta alteração.");
  const { nome, setorId, icone, tipo } = d;
  const criada = await banco.comoUsuario(ctx.usuario.id, async (tx) =>
    repo.inserirCategoriaSimples(tx, {
      nome,
      setor_id: setorId,
      icone,
      tipo_padrao: tipo,
      precisa_confirmacao: tipo !== "aviso",
      ordem: await repo.proximaOrdemDeCategoria(tx, setorId),
    }),
  );
  return {
    id: criada.id,
    setorId,
    paiId: null,
    nome,
    icone,
    cor: null,
    tipo,
    prioridade: criada.prioridade_padrao,
    responsavelId: null,
    prazo: null,
    precisaConfirmacao: tipo !== "aviso",
    vincularAtivo: false,
    vincularLoja: false,
    agendaId: null,
    campos: [],
    itensChecklist: 0,
  };
}

/**
 * POST /os/terceirizados/rapido: terceirizado criado no "Novo chamado" por
 * quem usa o módulo: só a empresa, ativa. Editar, desativar e os
 * profissionais seguem com os.terceirizados (o RLS só deixa inserir).
 */
export async function criarTerceirizadoRapido(
  ctx: Contexto,
  d: EntradaTerceirizadoRapido,
): Promise<string> {
  if (!ctx.permissoes.has("os.acessar"))
    throw new ErroDePermissao("Você não tem permissão para esta alteração.");
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.inserirEmpresa(tx, { ...d, cnpj: d.cnpj ?? null }),
  );
  return `${d.nome} cadastrado como terceirizado.`;
}
