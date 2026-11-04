import "server-only";
import { cache } from "react";
import {
  type DadosContrato,
  type DadosDistrato,
  distratoSemValores,
  type Garantia,
  lerDados,
  lerDistrato,
  type ParametrosContrato,
  type StatusContrato,
  semValores,
  type TipoAnexo,
  type TipoContrato,
  type TipoParte,
} from "@/lib/comercial/contrato";
import {
  type ContextoRevisao,
  lerObrigatorios,
} from "@/lib/comercial/contrato-revisao";
import { ativoEm } from "@/lib/comercial/fontes";
import { blocoDoLuc } from "@/lib/comercial/kit";
import { rotaVistoria } from "@/lib/os/rotas";
import { paraBrasilia } from "@/lib/os/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { podeAgora } from "@/server/auth";
import { lerTudo } from "@/server/supabase-paginas";
import {
  com,
  comAdmin,
  contextoCom,
  type Parametros,
  parametros,
} from "./base";
import { dadosEnet } from "./fontes";
import { type ItemDoKit, kitDoBloco } from "./kit";
import { nomesDeUsuarios } from "./usuarios";

// Contratos e distratos (spec 4.11): lista, o contrato do assistente, o
// histórico de versões, os anexos, o kit do LUC, as fichas para a etapa
// Partes e os dados do ENET (LUCs e contratos para o distrato). Tudo pela
// sessão (RLS de comercial.contratos.*). Sem comercial.valores.ver, o
// aluguel e os valores de `dados` não saem do servidor.

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler os contratos: ${erro.message}`);
}

/** Campos dos parâmetros que o assistente usa. */
export function parametrosDoContrato(p: Parametros): ParametrosContrato {
  return {
    empreendimento_nome: p.empreendimento_nome,
    endereco_cep: p.endereco_cep,
    endereco_logradouro: p.endereco_logradouro,
    endereco_numero: p.endereco_numero,
    endereco_complemento: p.endereco_complemento,
    endereco_bairro: p.endereco_bairro,
    endereco_cidade: p.endereco_cidade,
    endereco_uf: p.endereco_uf,
    indice_padrao: p.indice_padrao,
    dia_vencimento_padrao: p.dia_vencimento_padrao,
    caucao_alugueis: Number(p.caucao_alugueis),
    caucao_prazo_dias: p.caucao_prazo_dias,
    capitalizacao_prazo_dias: p.capitalizacao_prazo_dias,
    nc004_versao: p.nc004_versao,
    obras_tapume_dias: p.obras_tapume_dias,
    obras_retirada_dias: p.obras_retirada_dias,
    obras_projetos_dias: p.obras_projetos_dias,
    multa_alugueis: Number(p.multa_alugueis),
    vaga_promocional_padrao: p.vaga_promocional_padrao,
    consumo_agua_padrao: p.consumo_agua_padrao,
    entrega_tipo_imovel: p.entrega_tipo_imovel,
    entrega_padrao: p.entrega_padrao,
    entrega_prazo_implantacao_dias: p.entrega_prazo_implantacao_dias,
  };
}

/** Obrigatórios por garantia (parâmetros) e os anexos já enviados. */
export async function contextoDaRevisao(
  anexos: TipoAnexo[],
): Promise<ContextoRevisao> {
  const p = await parametros();
  return { obrigatorios: lerObrigatorios(p.obrigatorios_garantia), anexos };
}

/** Nome de quem alterou (ids que a pessoa já vê nos contratos). */
const nomesDe = (ids: (string | null)[]) =>
  nomesDeUsuarios(ids, [
    "comercial.contratos.ver",
    "comercial.contratos.editar",
  ]);

/**
 * Aluguel e dados (com os valores) dos contratos. O banco não deixa a sessão
 * ler essas colunas: a service role lê só ids que a sessão acabou de ver pelo
 * RLS do contrato, depois de conferir a permissão agora. Quem chama tira os
 * valores sem comercial.valores.ver.
 */
export async function dadosGuardados(
  ids: string[],
): Promise<Map<string, { aluguel: number | null; dados: Json }>> {
  const mapa = new Map<string, { aluguel: number | null; dados: Json }>();
  const unicos = [...new Set(ids)];
  if (!unicos.length) return mapa;
  if (
    !(
      (await podeAgora("comercial.contratos.ver")) ||
      (await podeAgora("comercial.contratos.editar")) ||
      (await podeAgora("comercial.contratos.gerar"))
    )
  )
    return mapa;
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await comAdmin()
      .from("contratos")
      .select("id, aluguel, dados")
      .in("id", unicos.slice(i, i + 150));
    falhar(error);
    for (const c of data ?? [])
      mapa.set(c.id, { aluguel: c.aluguel, dados: c.dados });
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export interface LinhaContrato {
  id: string;
  tipo: TipoContrato;
  status: StatusContrato;
  versao: number;
  lucs: string[];
  bloco: string | null;
  locatario: string | null;
  parte: TipoParte | null;
  garantia: Garantia | null;
  /** null sem comercial.valores.ver. */
  aluguel: number | null;
  atualizadoEm: string;
  atualizadoPor: string | null;
  geradoEm: string | null;
  exemplo: boolean;
}

/** Contratos e distratos atualizados desde a data (null = todos). */
export const listaDeContratos = cache(
  async (desde: string | null): Promise<LinhaContrato[]> => {
    const [ctx, db] = await Promise.all([contextoCom(), com()]);
    const valores = ctx.pode("comercial.valores.ver");
    const linhas = await lerTudo(() => {
      const q = db
        .from("contratos")
        .select(
          "id, tipo, status, versao, lucs, bloco, locatario_nome, parte_tipo, garantia, atualizado_em, atualizado_por, gerado_em, exemplo",
        );
      return (desde ? q.gte("atualizado_em", desde) : q)
        .order("atualizado_em", { ascending: false })
        .order("id");
    });
    const brutas = linhas as unknown as {
      id: string;
      tipo: string;
      status: string;
      versao: number;
      lucs: string[];
      bloco: string | null;
      locatario_nome: string | null;
      parte_tipo: string | null;
      garantia: string | null;
      atualizado_em: string;
      atualizado_por: string | null;
      gerado_em: string | null;
      exemplo: boolean;
    }[];
    const [nomes, guardados] = await Promise.all([
      nomesDe(brutas.map((l) => l.atualizado_por)),
      valores ? dadosGuardados(brutas.map((l) => l.id)) : null,
    ]);
    return brutas.map((l) => ({
      id: l.id,
      tipo: l.tipo as TipoContrato,
      status: l.status as StatusContrato,
      versao: l.versao,
      lucs: l.lucs,
      bloco: l.bloco,
      locatario: l.locatario_nome,
      parte: l.parte_tipo as TipoParte | null,
      garantia: l.garantia as Garantia | null,
      aluguel: guardados?.get(l.id)?.aluguel ?? null,
      atualizadoEm: l.atualizado_em,
      atualizadoPor: l.atualizado_por
        ? (nomes.get(l.atualizado_por) ?? null)
        : null,
      geradoEm: l.gerado_em,
      exemplo: l.exemplo,
    }));
  },
);

// ---------------------------------------------------------------------------
// Um contrato
// ---------------------------------------------------------------------------

export interface ContratoEditado {
  id: string;
  tipo: TipoContrato;
  status: StatusContrato;
  versao: number;
  etapaAtual: number;
  /** Para conferir, ao gravar, se ninguém mudou no meio. */
  atualizadoEm: string;
  atualizadoPor: string | null;
  exemplo: boolean;
  contratoEnet: string | null;
}

export type ContratoComDados =
  | (ContratoEditado & { tipo: "contrato"; dados: DadosContrato })
  | (ContratoEditado & { tipo: "distrato"; dados: DadosDistrato });

/** O contrato (ou distrato) com os dados; null se não existe ou não vê. */
export const contratoComDados = cache(
  async (id: string): Promise<ContratoComDados | null> => {
    const [ctx, db] = await Promise.all([contextoCom(), com()]);
    const { data, error } = await db
      .from("contratos")
      .select(
        "id, tipo, status, versao, etapa_atual, atualizado_em, atualizado_por, exemplo, contrato_enet_id",
      )
      .eq("id", id)
      .maybeSingle();
    falhar(error);
    if (!data) return null;
    const valores = ctx.pode("comercial.valores.ver");
    const [nomes, guardados] = await Promise.all([
      nomesDe([data.atualizado_por]),
      dadosGuardados([data.id]),
    ]);
    const dados = guardados.get(data.id)?.dados ?? {};
    const base: ContratoEditado = {
      id: data.id,
      tipo: data.tipo as TipoContrato,
      status: data.status as StatusContrato,
      versao: data.versao,
      etapaAtual: data.etapa_atual,
      atualizadoEm: data.atualizado_em,
      atualizadoPor: data.atualizado_por
        ? (nomes.get(data.atualizado_por) ?? null)
        : null,
      exemplo: data.exemplo,
      contratoEnet: data.contrato_enet_id,
    };
    if (data.tipo === "distrato") {
      const d = lerDistrato(dados);
      return {
        ...base,
        tipo: "distrato",
        dados: valores ? d : distratoSemValores(d),
      };
    }
    const d = lerDados(dados);
    return { ...base, tipo: "contrato", dados: valores ? d : semValores(d) };
  },
);

export interface VersaoDoContrato {
  id: number;
  versao: number;
  status: StatusContrato;
  etapa: number;
  por: string | null;
  em: string;
}

/** Quem alterou e quando (cada gravação), da mais nova para a mais antiga. */
export async function versoesDoContrato(
  id: string,
): Promise<VersaoDoContrato[]> {
  const { data, error } = await (await com())
    .from("contrato_versoes")
    .select("id, versao, status, etapa_atual, por, em")
    .eq("contrato_id", id)
    .order("em", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  falhar(error);
  const nomes = await nomesDe((data ?? []).map((v) => v.por));
  return (data ?? []).map((v) => ({
    id: v.id,
    versao: v.versao,
    status: v.status as StatusContrato,
    etapa: v.etapa_atual,
    por: v.por ? (nomes.get(v.por) ?? null) : null,
    em: v.em,
  }));
}

export interface AnexoDoContrato {
  id: string;
  tipo: TipoAnexo;
  nome: string;
  tamanho: number | null;
  enviadoEm: string;
  enviadoPor: string | null;
}

export async function anexosDoContrato(id: string): Promise<AnexoDoContrato[]> {
  const { data, error } = await (await com())
    .from("contrato_anexos")
    .select("id, tipo, arquivo_nome, tamanho, enviado_em, enviado_por")
    .eq("contrato_id", id)
    .order("enviado_em");
  falhar(error);
  const nomes = await nomesDe((data ?? []).map((a) => a.enviado_por));
  return (data ?? []).map((a) => ({
    id: a.id,
    tipo: a.tipo as TipoAnexo,
    nome: a.arquivo_nome,
    tamanho: a.tamanho,
    enviadoEm: a.enviado_em,
    enviadoPor: a.enviado_por ? (nomes.get(a.enviado_por) ?? null) : null,
  }));
}

/** Versões do kit já guardadas no contrato (comercial.contrato_kit). */
export async function kitGuardado(id: string): Promise<string[]> {
  const { data, error } = await (await com())
    .from("contrato_kit")
    .select("versao_id")
    .eq("contrato_id", id);
  falhar(error);
  return (data ?? []).map((k) => k.versao_id);
}

// ---------------------------------------------------------------------------
// Kit e ENET
// ---------------------------------------------------------------------------

/** Kit dos LUCs do contrato: os de todo contrato + mapas de cada bloco. */
export async function kitDosLucs(lucs: string[]): Promise<ItemDoKit[]> {
  const enet = await dadosEnet();
  const blocos = [
    ...new Set(
      lucs.map((n) => {
        const l = enet.lucs.find((x) => x.numero === n);
        return l ? blocoDoLuc(l) : null;
      }),
    ),
  ];
  const listas = await Promise.all(
    (blocos.length ? blocos : [null]).map((b) => kitDoBloco(b)),
  );
  const unicos = new Map<string, ItemDoKit>();
  for (const i of listas.flat()) unicos.set(i.documentoId, i);
  return [...unicos.values()];
}

/** Bloco do contrato (o do primeiro LUC), como no Kit: "11", "Casarão". */
export async function blocoDosLucs(lucs: string[]): Promise<string | null> {
  if (!lucs.length) return null;
  const l = (await dadosEnet()).lucs.find((x) => x.numero === lucs[0]);
  return l ? blocoDoLuc(l) : null;
}

export interface LucParaContrato {
  numero: string;
  local: string;
  piso: string;
  tipo: string;
  abl: number;
  status: "Locado" | "Vago";
  rua: string;
}

/** LUCs do ENET para a busca da etapa Imóvel (sem as áreas publicitárias). */
export async function lucsParaContrato(): Promise<{
  lucs: LucParaContrato[];
  exemplo: boolean;
}> {
  const enet = await dadosEnet();
  return {
    exemplo: enet.exemplo,
    lucs: enet.lucs
      .filter((l) => l.abl > 0)
      .map((l) => ({
        numero: l.numero,
        local: l.local,
        piso: l.piso,
        tipo: l.tipo_loja,
        abl: l.abl,
        status: l.status,
        rua: l.rua,
      }))
      .sort((a, b) => a.numero.localeCompare(b.numero)),
  };
}

export interface ContratoEnetParaDistrato {
  codigo: string;
  luc: string;
  bloco: string;
  locatario: string;
  documento: string;
  tipoPessoa: "PF" | "PJ";
  inicio: string;
  termino: string | null;
  indeterminado: boolean;
  rua: string;
}

/** Contratos ativos do ENET, para escolher de qual sai o distrato. */
export async function contratosParaDistrato(): Promise<{
  contratos: ContratoEnetParaDistrato[];
  exemplo: boolean;
}> {
  const [enet, { hoje }] = await Promise.all([dadosEnet(), contextoCom()]);
  const clientes = new Map(enet.clientes.map((c) => [c.codigo, c]));
  const lucs = new Map(enet.lucs.map((l) => [l.numero, l]));
  return {
    exemplo: enet.exemplo,
    contratos: enet.contratos
      .filter((c) => ativoEm(c, hoje))
      .map((c) => {
        const cli = clientes.get(c.cliente);
        const l = lucs.get(c.luc);
        return {
          codigo: c.codigo,
          luc: c.luc,
          bloco: l?.local ?? "",
          locatario: c.locatario,
          documento: cli?.cpf_cnpj ?? "",
          tipoPessoa: cli?.tipo_pessoa ?? "PJ",
          inicio: c.data_inicio,
          // Determinado vencido segue por prazo indeterminado.
          termino: c.data_termino,
          indeterminado:
            c.prazo === "Indeterminado" ||
            (c.data_termino !== null && c.data_termino < hoje),
          rua: l?.rua ?? "",
        };
      })
      .sort((a, b) => a.luc.localeCompare(b.luc)),
  };
}

// ---------------------------------------------------------------------------
// Fichas (etapa Partes e fiadores)
// ---------------------------------------------------------------------------

export interface FichaParaContrato {
  id: string;
  tipo: "pj" | "pf" | "fiador";
  nome: string;
  luc: string | null;
  data: string;
  situacao: string;
}

/** Fichas recebidas (e já usadas), para escolher na etapa Partes. */
export async function fichasParaContrato(): Promise<FichaParaContrato[]> {
  const { data, error } = await (await com())
    .from("fichas")
    .select("id, tipo, nome, luc, situacao, recebida_em, gerada_em")
    .in("situacao", ["recebida", "usada"])
    .not("tipo", "is", null)
    .order("recebida_em", { ascending: false, nullsFirst: false })
    .limit(500);
  falhar(error);
  return (data ?? []).map((f) => ({
    id: f.id,
    tipo: f.tipo as FichaParaContrato["tipo"],
    nome: f.nome ?? "(sem nome)",
    luc: f.luc,
    data: paraBrasilia(new Date(f.recebida_em ?? f.gerada_em)).data,
    situacao: f.situacao,
  }));
}

// ---------------------------------------------------------------------------
// Vistorias do Tickets
// ---------------------------------------------------------------------------

export interface VistoriaDoLuc {
  id: string;
  codigo: string;
  data: string;
  href: string;
}

/**
 * Última vistoria (entrada ou saída) do LUC no Tickets. Lida pela service
 * role depois de conferir no banco que a pessoa usa os contratos.
 */
export async function vistoriaDoLuc(
  lucs: string[],
  tipo: "entrada" | "saida",
): Promise<VistoriaDoLuc | null> {
  // Vai num filtro .or() do PostgREST: só o formato do código do LUC.
  lucs = lucs.filter((l) => /^[A-Za-z0-9_-]{1,30}$/.test(l));
  if (!lucs.length) return null;
  const acesso = await Promise.all([
    podeAgora("comercial.contratos.editar"),
    podeAgora("comercial.contratos.ver"),
  ]);
  if (!acesso.some(Boolean)) return null;
  const os = createAdminClient().schema("os");
  const lojas = await os.from("lojas").select("id").in("luc", lucs);
  falhar(lojas.error);
  const ids = (lojas.data ?? []).map((l) => l.id);
  const lista = (v: string[]) => v.map((x) => `"${x}"`).join(",");
  const filtro = ids.length
    ? `loja_id.in.(${ids.join(",")}),unidade.in.(${lista(lucs)})`
    : `unidade.in.(${lista(lucs)})`;
  const { data, error } = await os
    .from("vistorias")
    .select("id, codigo, data")
    .eq("tipo", tipo)
    .neq("status", "cancelado")
    .or(filtro)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  falhar(error);
  return data ? { ...data, href: rotaVistoria(data.id) } : null;
}
