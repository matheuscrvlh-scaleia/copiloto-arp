import type {
  NivelJornada,
  RespostaParametros,
} from "@arp/shared/rh/contratos/parametros";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import * as repo from "./dados.repository";
import { auditoria, colaboradores, jornadas } from "./parametros.repository";

// Leituras da tela de Parâmetros (parametros.ts do antigo), com a sessão:
// configuração do módulo, jornadas (há uma por funcionário), funcionários e
// as últimas alterações. As gravações ficam com o recurso da parte B.

const ORDEM_NIVEL: NivelJornada[] = [
  "empresa",
  "departamento",
  "cargo",
  "colaborador",
];

export function parametros(ctx: Contexto): Promise<RespostaParametros> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const deps = await repo.departamentos(tx);
    const empresas = await repo.parametrosEmpresa(tx);
    const encargos = await repo.encargos(tx);
    const rubricas = await repo.rubricas(tx);
    const historico = await auditoria(tx);
    const todasAsJornadas = await jornadas(tx);
    const cargos = await repo.cargos(tx);
    const todos = await colaboradores(tx);
    const metas = await repo.metas(tx);
    // Nomes de quem alterou: o RLS só mostra os que o usuário pode ver.
    const nomes = await repo.nomesDeUsuarios(tx, [
      ...new Set(
        historico.map((a) => a.usuario_id).filter((id): id is string => !!id),
      ),
    ]);

    // Encargos: só a linha vigente (mais recente) de cada tipo de contrato.
    const vigentes = new Map<string, (typeof encargos)[number]>();
    for (const e of encargos)
      if (!vigentes.has(e.tipo_contrato)) vigentes.set(e.tipo_contrato, e);

    // Jornadas: a linha vigente de cada alvo (empresa, departamento, cargo ou
    // funcionário), com o nome de quem ela cobre.
    const nomeDe = new Map<string, string>([
      ...deps.map((d) => [`departamento:${d.id}`, d.nome] as const),
      ...cargos.map((c) => [`cargo:${c.id}`, c.nome] as const),
      ...todos.map((c) => [`colaborador:${c.id}`, c.nome] as const),
    ]);
    const jornadasVigentes = new Map<
      string,
      RespostaParametros["jornadas"][number]
    >();
    for (const j of todasAsJornadas) {
      const [nivel, id]: [NivelJornada, string | null] = j.colaborador_id
        ? ["colaborador", j.colaborador_id]
        : j.cargo_id
          ? ["cargo", j.cargo_id]
          : j.departamento_id
            ? ["departamento", j.departamento_id]
            : ["empresa", null];
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

    return {
      departamentos: deps,
      // A vigência mais recente (a lista vem da mais antiga para a mais nova).
      empresa: empresas.at(-1) ?? null,
      encargos: [...vigentes.values()],
      jornadas: [...jornadasVigentes.values()].sort(
        (a, b) =>
          ORDEM_NIVEL.indexOf(a.nivel) - ORDEM_NIVEL.indexOf(b.nivel) ||
          a.nome.localeCompare(b.nome),
      ),
      cargos,
      colaboradoresAtivos: todos.filter((c) => !c.desligamento),
      rubricas,
      auditoria: historico.map((a) => ({
        ...a,
        autor: a.usuario_id
          ? (nomes.get(a.usuario_id) ?? "Outro usuário")
          : "Sistema (carga ou sincronização)",
      })),
      metas,
    };
  });
}
