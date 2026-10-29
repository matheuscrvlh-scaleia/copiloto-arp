import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import {
  checklistInicial,
  extrairMencoes,
  lerChecklist,
  motivoParaNaoConcluir,
  type ValorCampo,
} from "@/lib/os/chamado";
import {
  type AcaoChamado,
  acoesDisponiveis,
  type Papel,
  statusAoConcluir,
} from "@/lib/os/ciclo";
import { formatarNumeroChamado } from "@/lib/os/numeros";
import { calcularPrazo } from "@/lib/os/prazo";
import type { Recorrencia } from "@/lib/os/recorrencia";
import { rotaChamado } from "@/lib/os/rotas";
import {
  MOTIVOS_AGUARDANDO,
  type MotivoAguardando,
  STATUS,
  TIPOS,
} from "@/lib/os/rotulos";
import { paraBrasilia } from "@/lib/os/tempo";
import type { Json } from "@/lib/supabase/database.types";
import { erroDoBanco } from "@/server/acoes";
import { podeConcluirOS } from "@/server/os/ordem";
import {
  type Contexto,
  calendario,
  caminhoDoArquivo,
  contexto,
  type Enum,
  enviarArquivo,
  membrosDoSetor,
  notificar,
  os,
  osAdmin,
  pessoas,
  registrar,
  registrarComoSistema,
  type Tabela,
} from "./base";

// Chamado aberto e movido por um usuário logado: tudo pela sessão (RLS e os
// gatilhos os.validar_chamado e os.ciclo_do_chamado decidem o que vale).
// Criação pelo sistema (portal, modelos, preventivas) fica em ./criar.ts.

export type Chamado = Tabela<"chamados">;

export interface Resultado {
  ok?: string;
  erro?: string;
}

const NAO_ENCONTRADO: Resultado = {
  erro: "Chamado não encontrado ou sem acesso.",
};
const MUDOU: Resultado = {
  erro: "O chamado mudou enquanto você olhava. Atualize a tela e tente de novo.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O chamado inteiro, se a pessoa pode vê-lo (RLS). */
export async function lerChamado(id: string): Promise<Chamado | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await (await os())
    .from("chamados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("ler chamado", id, error);
    return null;
  }
  return data;
}

/** Gestor do setor: a mesma regra de os.gerencia no banco. */
export function gerencia(ctx: Contexto, setorId: string): boolean {
  return (
    ctx.pode("os.gerenciar_setor") &&
    (ctx.pode("os.todos_setores") || ctx.setores.includes(setorId))
  );
}

/** Quem a pessoa é em relação ao chamado. */
export function papelNoChamado(
  ch: Pick<Chamado, "aberto_por" | "responsavel_id" | "setor_id">,
  ctx: Contexto,
): Papel {
  const eu = ctx.usuario.id;
  return {
    solicitante: ch.aberto_por === eu,
    responsavel: ch.responsavel_id === eu,
    doSetor: ctx.setores.includes(ch.setor_id),
    gestor: gerencia(ctx, ch.setor_id),
  };
}

/**
 * Antes de tirar o chamado de perto de quem age (transferir para outro
 * setor, devolver à fila): o RLS confere a linha nova contra a política de
 * leitura, e a troca falha inteira ("new row violates row-level security")
 * se a pessoa deixar de ver o chamado. Quem não continuaria vendo passa a
 * seguir o chamado (os.envolvido), como quem foi citado.
 */
export async function manterAcesso(
  ch: Pick<Chamado, "id" | "aberto_por">,
  ctx: Contexto,
  depois: { setorId: string; responsavelId: string | null },
): Promise<void> {
  const eu = ctx.usuario.id;
  const continuaVendo =
    ch.aberto_por === eu ||
    depois.responsavelId === eu ||
    ctx.pode("os.todos_setores") ||
    ctx.pode("os.painel_geral") ||
    gerencia(ctx, depois.setorId) ||
    (ctx.setores.includes(depois.setorId) &&
      (depois.responsavelId === null ||
        ctx.pode("os.meu_setor") ||
        ctx.pode("os.painel_setor")));
  if (continuaVendo) return;
  const { error } = await (await os())
    .from("participantes")
    .upsert(
      { chamado_id: ch.id, usuario_id: eu, motivo: "seguindo" },
      { onConflict: "chamado_id,usuario_id", ignoreDuplicates: true },
    );
  if (error) console.error("seguir antes de transferir", ch.id, error);
}

/** Quantos destinatários o chamado tem (vários: cada um conclui o seu). */
export async function contarDestinos(chamadoId: string): Promise<number> {
  const { count } = await (await os())
    .from("destinatarios")
    .select("id", { count: "exact", head: true })
    .eq("chamado_id", chamadoId);
  return count ?? 0;
}

/**
 * O que impede concluir: item obrigatório do checklist pendente ou, na OS,
 * orçamento do terceirizado acima do teto sem aprovação. O valor do
 * terceirizado é lido pela service role (quem conclui pode não ver custos),
 * e só o motivo volta para a tela.
 */
export async function motivoDoBloqueio(ch: Chamado): Promise<string | null> {
  const checklist = motivoParaNaoConcluir({
    checklist: lerChecklist(ch.checklist),
  });
  if (checklist) return checklist;
  // Regras do tempo e da OS (cronômetro rodando, solução da terceirizada,
  // orçamento acima do teto): um lugar só, no módulo da OS.
  return podeConcluirOS(ch.id);
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

const TIPOS_ACEITOS =
  /^(image\/|application\/pdf$|text\/plain$|text\/csv$|application\/(msword|vnd\.openxmlformats-officedocument\.|vnd\.ms-excel|vnd\.ms-powerpoint))/;
// A Vercel recusa requisições acima de 4,5 MB.
export const LIMITE_ARQUIVO = 4 * 1024 * 1024;
export const LIMITE_ARQUIVOS = 10;

/** Recusa arquivo grande demais, em excesso ou de tipo estranho. */
export function conferirArquivos(arquivos: File[]): string | null {
  if (arquivos.length > LIMITE_ARQUIVOS)
    return `Envie no máximo ${LIMITE_ARQUIVOS} arquivos por vez.`;
  for (const a of arquivos) {
    if (a.size > LIMITE_ARQUIVO)
      return `“${a.name}” passa de 4 MB. Envie um arquivo menor.`;
    if (!TIPOS_ACEITOS.test(a.type || ""))
      return `“${a.name}”: envie foto, PDF, planilha, documento ou texto.`;
  }
  return null;
}

/**
 * Anexa arquivos ao chamado: a linha em os.anexos passa pelo RLS (quem mexe
 * no chamado) e só então o arquivo vai para o bucket. Devolve os nomes.
 */
export async function anexar(
  chamadoId: string,
  arquivos: File[],
  opcoes: { eventoId?: number | null; visivelLojista?: boolean } = {},
): Promise<{ nomes: string[]; erro?: string }> {
  const ctx = await contexto();
  const db = await os();
  const nomes: string[] = [];
  for (const arquivo of arquivos) {
    const path = caminhoDoArquivo("chamados", chamadoId, arquivo.name);
    const foto = arquivo.type.startsWith("image/");
    const { data, error } = await db
      .from("anexos")
      .insert({
        chamado_id: chamadoId,
        evento_id: opcoes.eventoId ?? null,
        categoria: foto ? "foto" : "anexo",
        nome: arquivo.name.slice(0, 200),
        path,
        mime: arquivo.type || null,
        tamanho: arquivo.size,
        visivel_lojista: opcoes.visivelLojista ?? false,
        enviado_por: ctx.usuario.id,
      })
      .select("id")
      .single();
    if (error) return { nomes, erro: erroDoBanco(error).erro };
    try {
      await enviarArquivo(
        path,
        new Uint8Array(await arquivo.arrayBuffer()),
        arquivo.type || "application/octet-stream",
      );
      nomes.push(arquivo.name);
    } catch (e) {
      console.error("anexo", chamadoId, e);
      await db.from("anexos").delete().eq("id", data.id);
      return { nomes, erro: `Não foi possível enviar “${arquivo.name}”.` };
    }
  }
  return { nomes };
}

// ---------------------------------------------------------------------------
// Abrir um chamado
// ---------------------------------------------------------------------------

export interface NovoChamado {
  tipo: Enum<"tipo_chamado">;
  setorId: string;
  categoriaId: string | null;
  titulo: string;
  descricao: string | null;
  /** null: a da categoria (ou Média). */
  prioridade: Enum<"prioridade"> | null;
  /** null: o prazo da categoria a partir de agora. */
  prazo: Date | null;
  /** undefined: o responsável padrão da categoria; null: fila do setor. */
  responsavelId: string | null | undefined;
  /** Tarefa pessoal rápida: para mim mesmo, fecha sem confirmação. */
  pessoal: boolean;
  setoresExtras: string[];
  pessoasExtras: string[];
  /** O que cabe a cada destino, pelo id do setor ou da pessoa. */
  tarefas: Record<string, string>;
  etiquetas: string[];
  lojaId: string | null;
  ativoId: string | null;
  vistoriaId: string | null;
  ambienteId: string | null;
  vinculadoAId: string | null;
  /** Converter em OS: o chamado de origem (fecha ao criar a OS). */
  convertidoDeId: string | null;
  recorrencia: Recorrencia | null;
  campos: Record<string, ValorCampo>;
  /** Arquivos soltos e os dos campos de foto/anexo da categoria. */
  arquivos: File[];
  arquivosDosCampos: Record<string, File[]>;
  horario: { agendaId: string; inicio: Date; fim: Date } | null;
}

export interface ChamadoAberto {
  id: string;
  numero: number;
  /** Abriu, mas algo opcional falhou (horário, arquivo). */
  aviso?: string;
}

/** Abre o chamado em nome de quem está logado (RLS: aberto_por = eu). */
export async function criarChamado(
  n: NovoChamado,
): Promise<ChamadoAberto | { erro: string }> {
  const ctx = await contexto();
  if (!ctx.pode("os.acessar"))
    return { erro: "Você não tem permissão para abrir chamados." };
  const eu = ctx.usuario.id;
  const db = await os();
  const agora = new Date();

  // A categoria (lida com a sessão: só a que a pessoa vê) e a original da
  // conversão não dependem uma da outra.
  const [lidaCategoria, original] = await Promise.all([
    n.categoriaId
      ? db.from("categorias").select("*").eq("id", n.categoriaId).maybeSingle()
      : null,
    n.convertidoDeId ? lerChamado(n.convertidoDeId) : null,
  ]);
  let categoria: Tabela<"categorias"> | null = null;
  if (n.categoriaId) {
    const data = lidaCategoria?.data;
    if (!data || !data.ativo) return { erro: "Categoria indisponível." };
    if (data.setor_id !== n.setorId)
      return { erro: "A categoria não é deste setor." };
    if (data.pai_id) {
      const { data: pai } = await db
        .from("categorias")
        .select("ativo")
        .eq("id", data.pai_id)
        .maybeSingle();
      if (!pai?.ativo) return { erro: "Categoria indisponível." };
    }
    categoria = data;
  }
  if (n.convertidoDeId) {
    if (!original) return NAO_ENCONTRADO as { erro: string };
    if (!["aberto", "em_andamento", "aguardando"].includes(original.status))
      return { erro: "Só dá para converter um chamado que ainda está aberto." };
  }

  const prazo =
    n.prazo ??
    (categoria?.prazo_valor && !n.pessoal
      ? calcularPrazo(
          {
            abertura: agora,
            valor: categoria.prazo_valor,
            unidade: categoria.prazo_unidade,
          },
          await calendario(),
        )
      : null);
  const responsavel = n.pessoal
    ? eu
    : n.responsavelId !== undefined
      ? n.responsavelId
      : (categoria?.responsavel_padrao_id ?? null);
  const precisaConfirmacao =
    !n.pessoal &&
    n.tipo !== "aviso" &&
    (categoria?.precisa_confirmacao ?? true);

  // Id gerado aqui: na conversão a OS fica no nome de quem pediu a
  // original, e quem converte pode não conseguir lê-la de volta (RLS).
  const novoId = randomUUID();
  // Pedido do portal convertido: a OS segue sendo o pedido da loja (o
  // lojista acompanha por ela, com o mesmo contato).
  const doPortal = original?.origem === "portal";
  const { error } = await db.from("chamados").insert({
    id: novoId,
    tipo: n.tipo,
    titulo: n.titulo,
    descricao: n.descricao,
    setor_id: n.setorId,
    categoria_id: n.categoriaId,
    prioridade: n.prioridade ?? categoria?.prioridade_padrao ?? "media",
    origem: doPortal ? "portal" : "sistema",
    solicitante_nome: doPortal ? original.solicitante_nome : null,
    solicitante_telefone: doPortal ? original.solicitante_telefone : null,
    pessoal: n.pessoal,
    precisa_confirmacao: precisaConfirmacao,
    // Fora o Aviso, os destinos extras andam um depois do outro.
    destinos_em_ordem:
      n.tipo !== "aviso" && n.setoresExtras.length + n.pessoasExtras.length > 0,
    // Converter em OS: o solicitante continua sendo quem pediu a original.
    aberto_por: original ? (original.aberto_por ?? eu) : eu,
    responsavel_id: responsavel,
    prazo: prazo?.toISOString() ?? null,
    loja_id: doPortal ? original.loja_id : n.lojaId,
    ativo_id: n.ativoId,
    vistoria_id: n.vistoriaId,
    ambiente_id: n.ambienteId,
    vinculado_a_id: n.vinculadoAId,
    convertido_de_id: n.convertidoDeId,
    campos: n.campos as Json,
    etiquetas: n.etiquetas,
    checklist: checklistInicial(categoria?.checklist) as unknown as Json,
    execucao: n.tipo === "os" ? "interna" : null,
    recorrencia: (n.recorrencia ?? null) as Json,
    // A série leva o id do primeiro chamado (o mesmo das rotinas e do
    // "Parar série", que procuram por serie_id = id).
    serie_id: n.recorrencia ? novoId : null,
    serie_data: n.recorrencia ? paraBrasilia(prazo ?? agora).data : null,
  });
  if (error) return { erro: erroDoBanco(error).erro ?? "Falha ao abrir." };
  // O número e os destinos juntos; depois, com os destinos já gravados (o
  // RLS dos anexos e da linha do tempo olha quem mexe no chamado), os
  // arquivos, a linha do tempo e o horário, também juntos.
  const [lido, destinos] = await Promise.all([
    numeroDe(novoId),
    gravarDestinos(novoId, n, responsavel),
  ]);
  const ch = { id: novoId, numero: lido.numero };

  const criado = {
    tipo: "criado" as const,
    texto: original
      ? `${TIPOS[n.tipo]} criada a partir do chamado ${formatarNumeroChamado(original.numero)}, convertido por ${ctx.usuario.nome}.`
      : `${TIPOS[n.tipo]} aberta.`,
    dados: { origem: "sistema", convertido_por: original ? eu : undefined },
  };
  const [arquivos, , reserva, gente] = await Promise.all([
    gravarArquivos(ch.id, n),
    // Quem converte e não vê a OS fica registrado pelo nome.
    registrar(ch.id, criado).then((r) =>
      r === null && original
        ? registrarComoSistema(ch.id, {
            ...criado,
            autorNome: ctx.usuario.nome,
          })
        : r,
    ),
    n.horario ? reservar(ch.id, n.horario, n.lojaId) : null,
    n.descricao ? pessoas() : [],
  ]);

  const avisos: string[] = [];
  // Converter em OS para outro setor: a OS fica no nome de quem pediu e
  // quem converteu pode não vê-la (a tela não leva a um chamado vazio).
  if (!lido.vejo)
    avisos.push(
      "A OS ficou no nome de quem pediu o chamado original e você não tem acesso a ela.",
    );
  if (destinos.erro) avisos.push(destinos.erro);
  if (arquivos.erro) avisos.push(arquivos.erro);
  if (reserva) avisos.push(reserva);
  if (original) await fecharConvertido(original, ch);

  const citados = n.descricao ? extrairMencoes(n.descricao, gente) : [];
  await avisarNovo(
    { id: ch.id, numero: ch.numero, titulo: n.titulo, setorId: n.setorId },
    {
      responsavel,
      // Em ordem, os outros destinos são avisados quando chega a vez deles.
      destinos: n.tipo === "aviso" ? destinos.lista : [],
      citados,
      autor: eu,
    },
  );

  return {
    id: ch.id,
    numero: ch.numero,
    aviso: avisos.length ? avisos.join(" ") : undefined,
  };
}

/**
 * Número do chamado recém-criado. Pela sessão; se quem converteu não vê a
 * OS (RLS), lê só o número pela service role: o chamado acabou de ser
 * gravado por esta pessoa.
 */
async function numeroDe(
  id: string,
): Promise<{ numero: number; vejo: boolean }> {
  const { data } = await (await os())
    .from("chamados")
    .select("numero")
    .eq("id", id)
    .maybeSingle();
  if (data) return { numero: data.numero, vejo: true };
  const admin = await osAdmin()
    .from("chamados")
    .select("numero")
    .eq("id", id)
    .maybeSingle();
  return { numero: admin.data?.numero ?? 0, vejo: false };
}

interface Destino {
  setor_id: string | null;
  usuario_id: string | null;
  responsavel_id: string | null;
}

/**
 * Mais de um destino (Aviso para vários setores ou pessoas extras): uma
 * linha de andamento para cada um, a primeira é o setor principal.
 */
async function gravarDestinos(
  chamadoId: string,
  n: NovoChamado,
  responsavel: string | null,
): Promise<{ lista: Destino[]; erro?: string }> {
  const setores = [...new Set(n.setoresExtras)].filter((s) => s !== n.setorId);
  const pessoasExtras = [...new Set(n.pessoasExtras)].filter(
    (p) => p !== responsavel,
  );
  if (!setores.length && !pessoasExtras.length) return { lista: [] };
  const lista: Destino[] = [
    { setor_id: n.setorId, usuario_id: null, responsavel_id: responsavel },
    ...setores.map((s) => ({
      setor_id: s,
      usuario_id: null,
      responsavel_id: null,
    })),
    ...pessoasExtras.map((p) => ({
      setor_id: null,
      usuario_id: p,
      responsavel_id: null,
    })),
  ];
  const { error } = await (await os()).from("destinatarios").insert(
    lista.map((d, ordem) => ({
      ...d,
      chamado_id: chamadoId,
      ordem,
      titulo: n.tarefas[d.usuario_id ?? d.setor_id ?? ""] || null,
    })),
  );
  if (error) {
    console.error("destinatários", chamadoId, error);
    return { lista: [], erro: "Os destinatários extras não foram gravados." };
  }
  return { lista };
}

/** Arquivos soltos e os dos campos da categoria (o nome vai para o campo). */
async function gravarArquivos(
  chamadoId: string,
  n: NovoChamado,
): Promise<{ erro?: string }> {
  const soltos = await anexar(chamadoId, n.arquivos);
  if (soltos.erro) return { erro: soltos.erro };
  const campos = { ...n.campos };
  let erro: string | undefined;
  let mudou = false;
  for (const [chave, arquivos] of Object.entries(n.arquivosDosCampos)) {
    if (!arquivos.length || erro) continue;
    const r = await anexar(chamadoId, arquivos);
    if (r.nomes.length) {
      campos[chave] = r.nomes;
      mudou = true;
    }
    erro = r.erro;
  }
  if (mudou)
    await (await os())
      .from("chamados")
      .update({ campos: campos as Json })
      .eq("id", chamadoId);
  return { erro };
}

/** Reserva o horário da agenda (o banco confere limite, choque e bloqueio). */
async function reservar(
  chamadoId: string,
  h: NonNullable<NovoChamado["horario"]>,
  lojaId: string | null,
): Promise<string | null> {
  const { error } = await (await os()).rpc("reservar_horario", {
    p_agenda: h.agendaId,
    p_inicio: h.inicio.toISOString(),
    p_fim: h.fim.toISOString(),
    // O banco aceita sem loja; o tipo gerado não sabe disso.
    p_loja: lojaId as string,
    p_chamado: chamadoId,
  });
  if (!error) return null;
  return `O chamado foi aberto, mas o horário não foi reservado: ${erroDoBanco(error).erro}`;
}

/** Converter em OS: a original aponta para a nova e fecha. */
async function fecharConvertido(
  original: Chamado,
  nova: { id: string; numero: number },
) {
  const { error } = await (await os())
    .from("chamados")
    .update({ convertido_em_id: nova.id, status: "fechado" })
    .eq("id", original.id);
  if (error) {
    console.error("converter", original.id, error);
    return;
  }
  await registrar(original.id, {
    tipo: "conversao",
    texto: `Convertido em Ordem de Serviço ${formatarNumeroChamado(nova.numero)}.`,
    dados: { de: original.status, para: "fechado", os_id: nova.id },
  });
}

/**
 * Avisos de chamado novo: o responsável; sem responsável, a fila do setor;
 * cada destino extra; e quem foi citado na descrição. Nunca quem abriu.
 * Quem foi citado passa a acompanhar o chamado já (é acesso); os avisos
 * saem depois da resposta (after), sem segurar quem abriu.
 */
async function avisarNovo(
  ch: { id: string; numero: number; titulo: string; setorId: string },
  p: {
    responsavel: string | null;
    destinos: Destino[];
    citados: string[];
    autor: string;
  },
) {
  if (p.citados.length)
    await (await os()).from("participantes").upsert(
      p.citados.map((usuario_id) => ({
        chamado_id: ch.id,
        usuario_id,
        motivo: "mencionado",
      })),
      { onConflict: "chamado_id,usuario_id", ignoreDuplicates: true },
    );
  after(async () => {
    const href = rotaChamado(ch.id);
    const titulo = `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`;
    const setoresAvisados = [
      ...(p.responsavel ? [] : [ch.setorId]),
      ...p.destinos.slice(1).flatMap((d) => (d.setor_id ? [d.setor_id] : [])),
    ];
    const membros = await Promise.all(
      setoresAvisados.map((s) => membrosDoSetor(s)),
    );
    const quem = new Set<string>(membros.flat());
    if (p.responsavel) quem.add(p.responsavel);
    for (const d of p.destinos.slice(1))
      if (d.usuario_id) quem.add(d.usuario_id);
    await Promise.all([
      notificar(
        [...quem],
        {
          tipo: "novo",
          titulo,
          texto: p.responsavel
            ? "Novo chamado para você."
            : "Novo chamado na fila do seu setor.",
          href,
          chamadoId: ch.id,
        },
        p.autor,
      ),
      notificar(
        p.citados.filter((c) => !quem.has(c)),
        {
          tipo: "mencao",
          titulo,
          texto: "Você foi citado num chamado novo.",
          href,
          chamadoId: ch.id,
        },
        p.autor,
      ),
    ]);
  });
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

export interface ExtraDaAcao {
  /** Aguardando */
  aguardandoTipo?: MotivoAguardando;
  /** Aguardando, Reabrir, Cancelar */
  motivo?: string;
  /** Concluir */
  solucao?: string | null;
  causaFalha?: string | null;
}

type Patch = Partial<Chamado>;

function patchDaAcao(
  acao: AcaoChamado,
  ch: Chamado,
  eu: string,
  x: ExtraDaAcao,
): Patch | { erro: string } {
  const motivo = x.motivo?.trim() ?? "";
  switch (acao) {
    case "assumir":
      return { responsavel_id: eu, status: "em_andamento" };
    case "iniciar":
      return { status: "em_andamento" };
    case "aguardar":
      if (!x.aguardandoTipo) return { erro: "Escolha o motivo da espera." };
      if (x.aguardandoTipo === "outro" && !motivo)
        return { erro: "Conte o que está esperando." };
      return {
        status: "aguardando",
        aguardando_tipo: x.aguardandoTipo,
        aguardando_motivo: motivo || null,
      };
    case "retomar":
      return {
        status: "em_andamento",
        aguardando_tipo: null,
        aguardando_motivo: null,
      };
    case "concluir":
      return {
        status: statusAoConcluir(ch),
        solucao: x.solucao?.trim() || ch.solucao,
        causa_falha: x.causaFalha?.trim() || ch.causa_falha,
      };
    case "confirmar":
      return { status: "fechado" };
    case "reabrir":
      if (!motivo) return { erro: "Conte por que está reabrindo." };
      return { status: "em_andamento", ultimo_motivo_reabertura: motivo };
    case "cancelar":
      if (!motivo) return { erro: "Conte por que está cancelando." };
      return { status: "cancelado", motivo_cancelamento: motivo };
    case "devolver":
      return { status: "aberto", responsavel_id: null };
  }
}

function textoDaAcao(acao: AcaoChamado, patch: Patch, x: ExtraDaAcao): string {
  const motivo = x.motivo?.trim();
  switch (acao) {
    case "assumir":
      return "Assumiu o chamado.";
    case "iniciar":
      return "Iniciou o atendimento.";
    case "aguardar":
      return `Aguardando ${MOTIVOS_AGUARDANDO[x.aguardandoTipo ?? "outro"].toLowerCase()}${motivo ? `: ${motivo}` : "."}`;
    case "retomar":
      return "Retomou o atendimento.";
    case "concluir":
      return patch.status === "fechado"
        ? "Concluiu e fechou."
        : "Concluiu. Aguardando a confirmação de quem pediu.";
    case "confirmar":
      return "Confirmou que está resolvido e fechou.";
    case "reabrir":
      return `Reabriu: ${motivo}`;
    case "cancelar":
      return `Cancelou: ${motivo}`;
    case "devolver":
      return "Devolveu à fila do setor.";
  }
}

/** Grava o patch só se o status não mudou desde a leitura. */
async function aplicar(ch: Chamado, patch: Patch): Promise<Resultado> {
  const { data, error } = await (await os())
    .from("chamados")
    .update(patch)
    .eq("id", ch.id)
    .eq("status", ch.status)
    .select("id");
  if (error) return erroDoBanco(error);
  return data?.length ? {} : MUDOU;
}

/** Uma ação do topo do detalhe (Assumir, Concluir, Reabrir…). */
export async function executarAcao(
  chamadoId: string,
  acao: AcaoChamado,
  x: ExtraDaAcao = {},
): Promise<Resultado> {
  // Os destinos só dependem do id: saem junto com o chamado.
  const [ctx, ch, destinos] = await Promise.all([
    contexto(),
    lerChamado(chamadoId),
    contarDestinos(chamadoId),
  ]);
  if (!ch) return NAO_ENCONTRADO;
  const eu = ctx.usuario.id;
  const multiplos = destinos > 1;
  const permitidas = acoesDisponiveis(
    { ...ch, multiplos },
    papelNoChamado(ch, ctx),
  );
  if (!permitidas.includes(acao))
    return { erro: "Esta ação não está disponível para você agora." };
  if (acao === "concluir") {
    const bloqueio = await motivoDoBloqueio(ch);
    if (bloqueio) return { erro: bloqueio };
  }
  const patch = patchDaAcao(acao, ch, eu, x);
  if ("erro" in patch) return patch;
  if (acao === "devolver")
    await manterAcesso(ch, ctx, { setorId: ch.setor_id, responsavelId: null });
  const r = await aplicar(ch, patch);
  if (r.erro) return r;

  // Reabrir um chamado de vários destinos: todos voltam a andar (em ordem,
  // só o último).
  if (acao === "reabrir" && multiplos) {
    let q = (await os())
      .from("destinatarios")
      .update({ status: "em_andamento" })
      .eq("chamado_id", ch.id);
    if (ch.destinos_em_ordem) q = q.eq("ordem", destinos - 1);
    await q;
  }
  await registrar(ch.id, {
    tipo: "status",
    texto: textoDaAcao(acao, patch, x),
    dados: {
      acao,
      de: ch.status,
      para: patch.status ?? ch.status,
      motivo: x.motivo?.trim() || undefined,
    },
  });
  // Os avisos saem depois da resposta: não seguram quem agiu.
  const depois = { ...ch, ...patch } as Chamado;
  after(() => avisarAcao(acao, depois, eu));
  return { ok: `${STATUS[(patch.status ?? ch.status) as Chamado["status"]]}.` };
}

/** Avisos do ciclo: concluído (quem pediu), reaberto e cancelado (executor). */
async function avisarAcao(acao: AcaoChamado, ch: Chamado, eu: string) {
  const base = {
    titulo: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
    href: rotaChamado(ch.id),
    chamadoId: ch.id,
  };
  if (acao === "concluir" && ch.status === "concluido")
    await notificar(
      [ch.aberto_por],
      {
        ...base,
        tipo: "concluido",
        texto: "Concluído. Confirme se ficou resolvido.",
      },
      eu,
    );
  if (acao === "reabrir")
    await notificar(
      [ch.responsavel_id],
      { ...base, tipo: "reaberto", texto: "Quem pediu reabriu o chamado." },
      eu,
    );
  if (acao === "cancelar")
    await notificar(
      [ch.responsavel_id],
      { ...base, tipo: "cancelado", texto: "O chamado foi cancelado." },
      eu,
    );
  if (acao === "devolver")
    await notificar(
      await membrosDoSetor(ch.setor_id),
      { ...base, tipo: "novo", texto: "Voltou para a fila do seu setor." },
      eu,
    );
}

/**
 * Começar a trabalhar no chamado (ex.: o cronômetro de tempo da OS): Aberto
 * ou Aguardando vai para Em andamento; sem responsável, quem iniciou assume.
 * Em andamento já está certo. Exportada para o bloco da OS.
 */
export async function assumirOuIniciar(chamadoId: string): Promise<Resultado> {
  const [ctx, ch, destinos] = await Promise.all([
    contexto(),
    lerChamado(chamadoId),
    contarDestinos(chamadoId),
  ]);
  if (!ch) return NAO_ENCONTRADO;
  if (ch.status === "em_andamento") return {};
  if (!["aberto", "aguardando"].includes(ch.status))
    return { erro: "O chamado já foi concluído ou cancelado." };
  // As mesmas regras dos botões do detalhe (o quadro e o cronômetro chegam
  // aqui sem passar por eles).
  const permitidas = acoesDisponiveis(
    { ...ch, multiplos: destinos > 1 },
    papelNoChamado(ch, ctx),
  );
  if (!permitidas.some((a) => ["assumir", "iniciar", "retomar"].includes(a)))
    return { erro: "Esta ação não está disponível para você agora." };
  const patch: Patch = {
    status: "em_andamento",
    aguardando_tipo: null,
    aguardando_motivo: null,
  };
  if (!ch.responsavel_id) patch.responsavel_id = ctx.usuario.id;
  const r = await aplicar(ch, patch);
  if (r.erro) return r;
  await registrar(ch.id, {
    tipo: "status",
    texto: patch.responsavel_id
      ? "Assumiu e iniciou o atendimento."
      : ch.status === "aguardando"
        ? "Retomou o atendimento."
        : "Iniciou o atendimento.",
    dados: { de: ch.status, para: "em_andamento" },
  });
  return { ok: "Em andamento." };
}
