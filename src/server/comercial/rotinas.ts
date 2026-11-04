import "server-only";
import { fimDoMesDe, somarDias } from "@/lib/comercial/datas";
import { type FotoOcupacao, fotoDaOcupacao } from "@/lib/comercial/ocupacao";
import {
  aniversariosParaLembrar,
  chaveDoLembrete,
  quandoEh,
} from "@/lib/comercial/relacionamento";
import { formatarData } from "@/lib/formato";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { registrarDepois } from "@/server/logs";
import { comAdmin } from "./base";
import { dadosEnetSemSessao } from "./fontes";

// Lembretes do Comercial, uma vez por dia (/api/cron/comercial, service
// role), só dentro do sistema (nada vai para o locatário): aniversário de
// contrato e de sócio X dias antes (lembrete_aniversario_dias), para quem
// tem comercial.relacionamento.ver, e documento do kit vencendo
// (kit_aviso_dias) para quem tem comercial.kit.editar. Vão para o sino
// (os.notificacoes) com uma chave por aviso: rodar de novo não repete.
// Também grava a foto da ocupação do fim do mês para o Painel.

export interface ResultadoRotinaCom {
  chave: string;
  rotulo: string;
  ok: boolean;
  /** Avisos novos. */
  registros: number;
  erro?: string;
}

interface Aviso {
  tipo: "comercial_aniversario" | "comercial_kit";
  titulo: string;
  texto: string;
  href: string;
  chave: string;
}

/** Usuários ativos com a permissão (individual ou do cargo ativo), como core.pode. */
async function quemTem(p: Permissao): Promise<string[]> {
  const core = createAdminClient().schema("core");
  const [usuarios, individuais, doCargo] = await Promise.all([
    core.from("usuarios").select("id, cargo_id").eq("ativo", true),
    core.from("usuario_permissoes").select("usuario_id").eq("permissao", p),
    core
      .from("cargo_permissoes")
      .select("cargo_id, cargos!inner(ativo)")
      .eq("permissao", p)
      .eq("cargos.ativo", true),
  ]);
  for (const r of [usuarios, individuais, doCargo])
    if (r.error) throw new Error(`Permissões: ${r.error.message}`);
  const sim = new Set((individuais.data ?? []).map((x) => x.usuario_id));
  const cargos = new Set((doCargo.data ?? []).map((x) => x.cargo_id));
  return (usuarios.data ?? [])
    .filter(
      (u) => sim.has(u.id) || (u.cargo_id !== null && cargos.has(u.cargo_id)),
    )
    .map((u) => u.id);
}

/** Grava os avisos para cada pessoa; devolve quantos eram novos. */
async function avisar(usuarios: string[], avisos: Aviso[]): Promise<number> {
  const linhas = usuarios.flatMap((usuario_id) =>
    avisos.map((a) => ({
      usuario_id,
      tipo: a.tipo,
      titulo: a.titulo.slice(0, 200),
      texto: a.texto.slice(0, 500),
      href: a.href,
      chave: a.chave,
    })),
  );
  let novos = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const { data, error } = await createAdminClient()
      .schema("os")
      .from("notificacoes")
      .upsert(linhas.slice(i, i + 500), {
        onConflict: "usuario_id,chave",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(`Notificações: ${error.message}`);
    novos += data?.length ?? 0;
  }
  return novos;
}

async function lerParametros() {
  const { data, error } = await comAdmin()
    .from("parametros")
    .select("lembrete_aniversario_dias, kit_aviso_dias")
    .eq("id", true)
    .single();
  if (error) throw new Error(`Parâmetros: ${error.message}`);
  return data;
}

type Params = Awaited<ReturnType<typeof lerParametros>>;

async function rotinaAniversarios(hoje: string, p: Params): Promise<number> {
  const enet = await dadosEnetSemSessao(hoje);
  const lista = aniversariosParaLembrar(
    { ...enet, hoje },
    p.lembrete_aniversario_dias,
  );
  if (!lista.length) return 0;
  const avisos: Aviso[] = lista.map((a) => {
    const dia = formatarData(a.data).slice(0, 5);
    const quando = quandoEh(a.data, hoje);
    return {
      tipo: "comercial_aniversario",
      titulo:
        a.tipo === "contrato"
          ? `Aniversário de contrato: ${a.locatario} (${a.luc})`
          : `Aniversário de sócio: ${a.socio}, de ${a.locatario}`,
      texto:
        a.tipo === "contrato"
          ? `${a.anos} ${a.anos === 1 ? "ano" : "anos"} de ARP em ${dia} (${quando}).`
          : `Dia ${dia} (${quando}). ${a.luc}, ${a.bloco}.`,
      href: `/comercial/relacionamento?aba=aniversarios&mes=${Number(a.data.slice(5, 7))}`,
      chave: chaveDoLembrete(a),
    };
  });
  return avisar(await quemTem("comercial.relacionamento.ver"), avisos);
}

async function rotinaKit(hoje: string, p: Params): Promise<number> {
  const ate = somarDias(hoje, p.kit_aviso_dias);
  const db = comAdmin();
  const [versoes, documentos] = await Promise.all([
    db
      .from("kit_versoes")
      .select("id, documento_id, versao, validade")
      .eq("atual", true)
      .not("validade", "is", null)
      .lte("validade", ate),
    db.from("kit_documentos").select("id, nome").eq("ativo", true),
  ]);
  if (versoes.error) throw new Error(`Kit: ${versoes.error.message}`);
  if (documentos.error) throw new Error(`Kit: ${documentos.error.message}`);
  const nome = new Map((documentos.data ?? []).map((d) => [d.id, d.nome]));
  const avisos: Aviso[] = [];
  for (const v of versoes.data ?? []) {
    const doc = nome.get(v.documento_id);
    if (!doc || !v.validade) continue;
    const venceu = v.validade < hoje;
    avisos.push({
      tipo: "comercial_kit",
      titulo: `${venceu ? "Documento do kit vencido" : "Documento do kit vencendo"}: ${doc}`,
      texto: `Versão ${v.versao}, ${venceu ? "venceu" : "vence"} em ${formatarData(v.validade)}. Suba a versão nova no Kit de entrega.`,
      href: "/comercial/kit",
      chave: `comercial:kit:${v.id}:${v.validade}:${venceu ? "venceu" : "vence"}`,
    });
  }
  if (!avisos.length) return 0;
  return avisar(await quemTem("comercial.kit.editar"), avisos);
}

/**
 * Foto da ocupação do fim do mês (Painel, 4.10): o mês anterior, se ainda
 * não tem (cobre o dia em que a rotina não rodou), e o mês atual no último
 * dia dele. A foto gravada não muda (ignora a repetida).
 */
async function rotinaFotoOcupacao(hoje: string): Promise<number> {
  const db = comAdmin();
  const tipos = await db.from("tipos_luc").select("tipo, conta_ocupacao");
  if (tipos.error) throw new Error(`Tipos de LUC: ${tipos.error.message}`);
  const contam = new Set(
    (tipos.data ?? []).filter((t) => t.conta_ocupacao).map((t) => t.tipo),
  );
  const enet = await dadosEnetSemSessao(hoje);
  const dias = [somarDias(`${hoje.slice(0, 7)}-01`, -1)];
  if (fimDoMesDe(hoje) === hoje) dias.push(hoje);
  const fotos = dias.map((d) => fotoDaOcupacao(enet, d, contam));
  const { data, error } = await db
    .from("ocupacao_fotos")
    .upsert(fotos as (FotoOcupacao & { por_bloco: Json; por_tipo: Json })[], {
      onConflict: "mes",
      ignoreDuplicates: true,
    })
    .select("mes");
  if (error) throw new Error(`Foto da ocupação: ${error.message}`);
  return data?.length ?? 0;
}

const ROTINAS = [
  {
    chave: "foto_ocupacao",
    rotulo: "Foto da ocupação do fim do mês",
    rodar: rotinaFotoOcupacao,
  },
  {
    chave: "aniversarios",
    rotulo: "Aniversários de contrato e de sócio",
    rodar: rotinaAniversarios,
  },
  { chave: "kit", rotulo: "Documentos do kit vencendo", rodar: rotinaKit },
] as const;

/** Cada rotina isolada: uma falha não impede a outra. */
export async function rodarRotinasComercial(
  agora = new Date(),
): Promise<ResultadoRotinaCom[]> {
  const hoje = hojeEmBrasilia(agora);
  let p: Params;
  try {
    p = await lerParametros();
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : "falha desconhecida";
    return ROTINAS.map((r) => ({
      chave: r.chave,
      rotulo: r.rotulo,
      ok: false,
      registros: 0,
      erro: msg,
    }));
  }
  const resultados: ResultadoRotinaCom[] = [];
  for (const r of ROTINAS) {
    try {
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: true,
        registros: await r.rodar(hoje, p),
      });
    } catch (erro) {
      console.error("rotina do comercial", r.chave, erro);
      resultados.push({
        chave: r.chave,
        rotulo: r.rotulo,
        ok: false,
        registros: 0,
        erro: erro instanceof Error ? erro.message : "falha desconhecida",
      });
    }
  }
  const total = resultados.reduce((t, r) => t + r.registros, 0);
  const falhas = resultados.filter((r) => !r.ok);
  if (total > 0 || falhas.length > 0)
    registrarDepois({
      modulo: "comercial",
      evento: "comercial_rotina",
      descricao: [
        `Lembretes do dia: ${total} ${total === 1 ? "aviso" : "avisos"}`,
        falhas.length
          ? `falha em ${falhas.map((f) => f.rotulo).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      usuarioId: null,
      detalhes: {
        rotinas: resultados.map((r) => ({
          rotina: r.chave,
          ok: r.ok,
          registros: r.registros,
          erro: r.erro ?? null,
        })),
      },
    });
  return resultados;
}
