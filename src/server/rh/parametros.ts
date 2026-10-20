import "server-only";
import { createClient } from "@/lib/supabase/server";

// Leituras da tela de Parâmetros, com a sessão do usuário (RLS).

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

export async function dadosDosParametros() {
  const supabase = await createClient();
  const rh = supabase.schema("rh");
  const [deps, motivos, empresa, encargos, rubricas, auditoria] =
    await Promise.all([
      rh
        .from("departamentos")
        .select("id, nome, codigo_folha, secullum_id, ativo")
        .order("nome"),
      rh
        .from("motivos_desligamento")
        .select("id, descricao, tipo_turnover")
        .order("descricao"),
      rh
        .from("parametros_empresa")
        .select("*")
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle(),
      rh
        .from("encargos_por_contrato")
        .select("*")
        .order("vigente_desde", { ascending: false }),
      rh.from("rubricas").select("codigo, descricao, grupo").order("codigo"),
      supabase
        .schema("core")
        .from("auditoria")
        .select("id, tabela, registro_id, acao, usuario_id, em")
        .order("em", { ascending: false })
        .limit(30),
    ]);
  for (const r of [deps, motivos, empresa, encargos, rubricas, auditoria])
    falhar(r.error);

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
  const vigentes = new Map<string, NonNullable<typeof encargos.data>[number]>();
  for (const e of encargos.data ?? []) {
    if (!vigentes.has(e.tipo_contrato)) vigentes.set(e.tipo_contrato, e);
  }

  return {
    departamentos: deps.data ?? [],
    motivos: motivos.data ?? [],
    empresa: empresa.data,
    encargos: [...vigentes.values()],
    rubricas: rubricas.data ?? [],
    auditoria: (auditoria.data ?? []).map((a) => ({
      ...a,
      autor: a.usuario_id
        ? (nomes.get(a.usuario_id) ?? "Outro usuário")
        : "Sistema (carga ou sincronização)",
    })),
  };
}
