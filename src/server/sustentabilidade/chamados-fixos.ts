import "server-only";
import { lerRecorrencia } from "@/lib/os/automacao";
import { descreverRecorrencia, proximaData } from "@/lib/os/recorrencia";
import { rotaChamado } from "@/lib/os/rotas";
import { hojeEmBrasilia, somarDias } from "@/lib/os/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { MODULO_DOS_CHAMADOS } from "@/lib/sustentabilidade/entrevistas-chamados";
import {
  CHAMADOS_FIXOS,
  type ChamadoFixo,
  recorrenciaDoChamadoFixo,
} from "@/lib/sustentabilidade/painel-parametros";
import { podeAgora } from "@/server/auth";
import { usuariosComPermissao } from "@/server/comercial/usuarios";
import { osAdmin } from "@/server/os/base";
import { criarChamadoSistema } from "@/server/os/criar";
import { falhar } from "./base";
import { categoriaDoModulo, prazoNoDia } from "./rotinas";

// Chamados fixos do módulo (ronda dos coletores, nota do RCC, relatório do
// mês). O spec manda recorrência e responsável configurados no próprio
// chamado ("Repetir" do Chamados), e não em Parâmetros: aqui só se cria o
// primeiro chamado recorrente, já com Repetir e responsável, e se mostra se
// ele existe. Depois a rotina de recorrências do Chamados cria os seguintes,
// copiando a ação, a conclusão pelo módulo e a origem.
//
// Tudo pela service role, depois de conferir sustentabilidade.parametros.

const EM_ABERTO = ["aberto", "em_andamento", "aguardando"] as const;
const AUTOR = "Sistema (Sustentabilidade)";

export interface EstadoDoChamadoFixo {
  tipo: ChamadoFixo;
  /** O chamado em aberto da série; null se ainda não existe. */
  aberto: {
    id: string;
    numero: number;
    href: string;
    prazo: string | null;
    responsavel: string | null;
    /** "Toda semana, ter". */
    repeticao: string | null;
  } | null;
}

export interface Candidato {
  id: string;
  nome: string;
}

/** Quem pode receber o chamado: quem tem a permissão da área dele. */
export async function candidatosAResponsavel(
  tipo: ChamadoFixo,
): Promise<Candidato[]> {
  if (!(await podeAgora("sustentabilidade.parametros"))) return [];
  const ids = await usuariosComPermissao(CHAMADOS_FIXOS[tipo].permissao);
  if (!ids.length) return [];
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", ids)
    .order("nome");
  falhar(error);
  return data ?? [];
}

/** Se cada chamado fixo já existe (em aberto); null sem a permissão. */
export async function chamadosFixos(): Promise<EstadoDoChamadoFixo[] | null> {
  if (!(await podeAgora("sustentabilidade.parametros"))) return null;
  const tipos = Object.keys(CHAMADOS_FIXOS) as ChamadoFixo[];
  const { data, error } = await osAdmin()
    .from("chamados")
    .select("id, numero, prazo, responsavel_id, recorrencia, origem_ref")
    .eq("origem_modulo", MODULO_DOS_CHAMADOS)
    .in("origem_ref", tipos)
    .in("status", EM_ABERTO)
    .order("criado_em");
  falhar(error);
  const nomes = new Map<string, string>();
  const responsaveis = [
    ...new Set((data ?? []).map((c) => c.responsavel_id).filter(Boolean)),
  ] as string[];
  if (responsaveis.length) {
    const u = await createAdminClient()
      .schema("core")
      .from("usuarios")
      .select("id, nome")
      .in("id", responsaveis);
    falhar(u.error);
    for (const x of u.data ?? []) nomes.set(x.id, x.nome);
  }
  return tipos.map((tipo) => {
    const c = (data ?? []).find((x) => x.origem_ref === tipo);
    const r = c ? lerRecorrencia(c.recorrencia) : null;
    return {
      tipo,
      aberto: c
        ? {
            id: c.id,
            numero: c.numero,
            href: rotaChamado(c.id),
            prazo: c.prazo,
            responsavel: c.responsavel_id
              ? (nomes.get(c.responsavel_id) ?? null)
              : null,
            repeticao: r ? descreverRecorrencia(r) : null,
          }
        : null,
    };
  });
}

export type ResultadoDoChamadoFixo =
  | { ok: true; id: string; numero: number; repeticao: string; prazo: Date }
  | { ok: false; erro: string };

/**
 * Cria o chamado recorrente (Repetir) do tipo, com o responsável escolhido,
 * o "Executar" da tela do módulo e a conclusão só pelo módulo. Se já existe
 * um em aberto, não cria outro. O prazo do primeiro é o fim do expediente da
 * primeira data da recorrência a partir de hoje.
 */
export async function criarChamadoFixo(p: {
  tipo: ChamadoFixo;
  responsavelId: string;
  diaSemana?: number;
  diaMes?: number;
  abertoPor: string;
  agora?: Date;
}): Promise<ResultadoDoChamadoFixo> {
  const agora = p.agora ?? new Date();
  const def = CHAMADOS_FIXOS[p.tipo];
  const [candidatos, estados] = await Promise.all([
    candidatosAResponsavel(p.tipo),
    chamadosFixos(),
  ]);
  if (!candidatos.some((c) => c.id === p.responsavelId))
    return {
      ok: false,
      erro: "O responsável precisa ser alguém com acesso a essa área do módulo.",
    };
  const existente = estados?.find((e) => e.tipo === p.tipo)?.aberto;
  if (existente)
    return {
      ok: false,
      erro: `Já existe o chamado #${existente.numero} em aberto. Mude o Repetir ou o responsável direto nele.`,
    };

  const categoria = await categoriaDoModulo(def.categoria);
  if (!categoria)
    return {
      ok: false,
      erro: `A categoria “${def.categoria}” não existe no Chamados. Peça ao administrador para recriá-la.`,
    };

  const recorrencia = recorrenciaDoChamadoFixo(p.tipo, {
    diaSemana: p.diaSemana,
    diaMes: p.diaMes,
  });
  const hoje = hojeEmBrasilia(agora);
  const primeira = proximaData(recorrencia, somarDias(hoje, -1));
  if (!primeira)
    return { ok: false, erro: "Não foi possível calcular a primeira data." };

  const prazo = await prazoNoDia(primeira);
  const criado = await criarChamadoSistema(
    {
      setorId: categoria.setorId,
      categoriaId: categoria.id,
      titulo: def.titulo,
      descricao: `${def.descricao} Toque em Executar para abrir a tela do módulo; o chamado fecha sozinho ao salvar ${def.acaoRotulo}, e o próximo nasce pelo Repetir.`,
      tipo: "tarefa",
      origem: "modulo",
      abertoPor: p.abertoPor,
      autorNome: AUTOR,
      responsavelId: p.responsavelId,
      prazo,
      recorrencia: recorrencia as unknown as Json,
      acaoUrl: def.acaoUrl,
      acaoRotulo: def.acaoRotulo,
      conclusaoExterna: true,
      origemModulo: MODULO_DOS_CHAMADOS,
      origemRef: p.tipo,
    },
    agora,
  );
  if (!criado)
    return { ok: false, erro: "O chamado já existia. Atualize a página." };
  return {
    ok: true,
    id: criado.id,
    numero: criado.numero,
    repeticao: descreverRecorrencia(recorrencia),
    prazo,
  };
}
