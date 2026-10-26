import "server-only";
import { cache } from "react";
import { CONFIGURACOES_RH } from "@/config/navigation";
import { competenciaDe, formatarMes } from "@/lib/formato";
import { INDICADORES_RH, metaVigente } from "@/lib/indicadores";
import { createClient } from "@/lib/supabase/server";
import type { Usuario } from "./auth";

export interface Aviso {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
}

/**
 * Pendências reais do sistema, só para quem pode resolvê-las.
 * Lê com a sessão do usuário (o RLS vale aqui também). Todas as consultas
 * saem juntas; cada uma só para quem tem a permissão do aviso.
 */
export const avisosDo = cache(async (usuario: Usuario): Promise<Aviso[]> => {
  const pode = (p: string) => usuario.permissoes.includes(p as never);
  const veFolha = pode("rh.folha");
  const veParametros = pode("rh.parametros");
  if (!veFolha && !veParametros) return [];

  const supabase = await createClient();
  const rh = supabase.schema("rh");
  const hoje = new Date();
  const mesAnterior = competenciaDe(
    new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
  );

  const [rubricas, folha, empresa, metas, provisorios] = await Promise.all([
    rh
      .from("rubricas")
      .select("codigo", { count: "exact", head: true })
      .eq("grupo", "nao_classificada"),
    veFolha
      ? rh
          .from("folhas")
          .select("competencia")
          .eq("competencia", mesAnterior)
          .maybeSingle()
      : null,
    veParametros
      ? rh.from("parametros_empresa").select("vigente_desde").limit(1)
      : null,
    veParametros
      ? supabase
          .schema("core")
          .from("metas")
          .select("indicador, vigente_desde")
          .like("indicador", "rh.%")
      : null,
    veParametros
      ? rh
          .from("departamentos")
          .select("id", { count: "exact", head: true })
          .like("nome", "Departamento %")
      : null,
  ]);

  const avisos: Aviso[] = [];
  if (rubricas.count) {
    avisos.push({
      id: "rubricas",
      titulo: `${rubricas.count} rubrica${rubricas.count > 1 ? "s" : ""} para classificar`,
      descricao: "Vieram na folha e ainda não dizem como entram no custo.",
      href: `${CONFIGURACOES_RH.importacoes}#rubricas-novas`,
    });
  }

  if (folha && !folha.data) {
    avisos.push({
      id: "folha",
      titulo: `Folha de ${formatarMes(mesAnterior)} não importada`,
      descricao: "Envie o Extrato Mensal da Sousa e Couto.",
      href: CONFIGURACOES_RH.importacoes,
    });
  }

  if (empresa && !empresa.data?.length) {
    avisos.push({
      id: "empresa",
      titulo: "RAT, FAP e banco de horas não configurados",
      descricao: "Necessários para o cálculo dos encargos.",
      href: CONFIGURACOES_RH.parametros,
    });
  }
  if (metas) {
    const competencia = competenciaDe(hoje);
    const semMeta = Object.keys(INDICADORES_RH).filter(
      (i) => !metaVigente(metas.data ?? [], i, competencia),
    ).length;
    if (semMeta) {
      avisos.push({
        id: "metas",
        titulo: `${semMeta} indicador${semMeta > 1 ? "es" : ""} sem meta`,
        descricao:
          "Sem meta, o semáforo não mostra Ok, Atenção ou fora da meta.",
        href: `${CONFIGURACOES_RH.parametros}#metas`,
      });
    }
  }
  if (provisorios?.count) {
    avisos.push({
      id: "departamentos",
      titulo: `${provisorios.count} departamento${provisorios.count > 1 ? "s" : ""} para renomear`,
      descricao: "Criados pela importação da folha como “Departamento N”.",
      href: `${CONFIGURACOES_RH.cadastros}#departamentos`,
    });
  }

  return avisos;
});
