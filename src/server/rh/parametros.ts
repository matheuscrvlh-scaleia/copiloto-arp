import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { lerTudo } from "../supabase-paginas";
import {
  cargosDoRh,
  departamentosDoRh,
  type EncargosDoRh,
  empresaDoRh,
  encargosDoRh,
  rubricasDoRh,
} from "./configuracao";

// Leituras da tela de Parâmetros. A configuração do módulo vem do cache
// (configuracao.ts); jornadas (há uma por funcionário), funcionários e
// histórico, com a sessão do usuário (RLS).

export type NivelJornada = "empresa" | "departamento" | "cargo" | "colaborador";

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

export const dadosDosParametros = cache(async () => {
  const supabase = await createClient();
  const rh = supabase.schema("rh");
  const [
    deps,
    empresas,
    encargos,
    rubricas,
    auditoria,
    jornadas,
    cargos,
    colaboradores,
  ] = await Promise.all([
    departamentosDoRh(),
    empresaDoRh(),
    encargosDoRh(),
    rubricasDoRh(),
    supabase
      .schema("core")
      .from("auditoria")
      .select("id, tabela, registro_id, acao, usuario_id, em")
      .order("em", { ascending: false })
      .limit(30),
    // Há uma jornada por funcionário (e por vigência) e os colaboradores são
    // todos, desde sempre: de mil em mil.
    lerTudo(() =>
      rh
        .from("jornadas")
        .select(
          "departamento_id, cargo_id, colaborador_id, horas_mes_min, vigente_desde",
        )
        .order("vigente_desde", { ascending: false })
        .order("id"),
    ),
    cargosDoRh(),
    lerTudo(() =>
      rh
        .from("colaboradores")
        .select("id, nome, desligamento")
        .order("nome")
        .order("id"),
    ),
  ]);
  falhar(auditoria.error);

  // Nomes de quem alterou: o RLS só mostra os que o usuário pode ver.
  const ids = [
    ...new Set(
      (auditoria.data ?? [])
        .map((a) => a.usuario_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase
      .schema("core")
      .from("usuarios")
      .select("id, nome")
      .in("id", ids);
    for (const u of data ?? []) nomes.set(u.id, u.nome);
  }

  // Encargos: só a linha vigente (mais recente) de cada tipo de contrato.
  const vigentes = new Map<string, EncargosDoRh>();
  for (const e of encargos) {
    if (!vigentes.has(e.tipo_contrato)) vigentes.set(e.tipo_contrato, e);
  }

  // Jornadas: a linha vigente de cada alvo (empresa, departamento, cargo ou
  // funcionário), com o nome de quem ela cobre.
  const nomeDe = new Map<string, string>([
    ...deps.map((d) => [`departamento:${d.id}`, d.nome] as const),
    ...cargos.map((c) => [`cargo:${c.id}`, c.nome] as const),
    ...colaboradores.map((c) => [`colaborador:${c.id}`, c.nome] as const),
  ]);
  const jornadasVigentes = new Map<
    string,
    {
      alvo: string;
      nivel: NivelJornada;
      nome: string;
      horas_mes_min: number;
      vigente_desde: string;
    }
  >();
  for (const j of jornadas) {
    const [nivel, id] = j.colaborador_id
      ? (["colaborador", j.colaborador_id] as const)
      : j.cargo_id
        ? (["cargo", j.cargo_id] as const)
        : j.departamento_id
          ? (["departamento", j.departamento_id] as const)
          : (["empresa", null] as const);
    const alvo = id ? `${nivel}:${id}` : nivel;
    if (jornadasVigentes.has(alvo)) continue;
    jornadasVigentes.set(alvo, {
      alvo,
      nivel,
      nome: id ? (nomeDe.get(alvo) ?? "—") : "Empresa (todos)",
      horas_mes_min: j.horas_mes_min,
      vigente_desde: j.vigente_desde,
    });
  }
  const ordemNivel = ["empresa", "departamento", "cargo", "colaborador"];

  return {
    departamentos: deps,
    // A vigência mais recente (a lista vem da mais antiga para a mais nova).
    empresa: empresas.at(-1) ?? null,
    encargos: [...vigentes.values()],
    jornadas: [...jornadasVigentes.values()].sort(
      (a, b) =>
        ordemNivel.indexOf(a.nivel) - ordemNivel.indexOf(b.nivel) ||
        a.nome.localeCompare(b.nome),
    ),
    cargos,
    colaboradoresAtivos: colaboradores.filter((c) => !c.desligamento),
    rubricas,
    auditoria: (auditoria.data ?? []).map((a) => ({
      ...a,
      autor: a.usuario_id
        ? (nomes.get(a.usuario_id) ?? "Outro usuário")
        : "Sistema (carga ou sincronização)",
    })),
  };
});
