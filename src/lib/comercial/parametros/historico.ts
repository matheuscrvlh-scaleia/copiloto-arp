import { formatarData, formatarMes } from "@/lib/formato";
import { CAMPOS } from "./campos";
import { CAMPOS_GARANTIA, type Garantia, INDICES } from "./contratos";
import { LISTAS, type NomeLista } from "./listas";
import { BLOCOS, type Bloco } from "./quadro";

// Histórico (core.auditoria)

export interface LinhaAuditoria {
  id: number;
  tabela: string;
  registro_id: string;
  acao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  usuario_id: string | null;
  em: string;
}

export type GrupoHistorico = "parametros" | "cadastros";

/** Tabelas que entram no Histórico de Configurações (sem as importações). */
export const TABELAS_COM: Record<
  string,
  { rotulo: string; grupo: GrupoHistorico; bloco?: Bloco | "metas" }
> = {
  "comercial.parametros": { rotulo: "Parâmetros", grupo: "parametros" },
  "comercial.listas": { rotulo: "Lista", grupo: "parametros" },
  "comercial.fontes_de_para": {
    rotulo: "De-para de fontes",
    grupo: "parametros",
    bloco: "funil",
  },
  "comercial.tipos_luc": {
    rotulo: "Tipo de LUC",
    grupo: "parametros",
    bloco: "ocupacao",
  },
  "comercial.faixas_evento": {
    rotulo: "Faixa de preço de evento",
    grupo: "parametros",
    bloco: "eventos",
  },
  "os.feriados": {
    rotulo: "Feriado",
    grupo: "parametros",
    bloco: "calendario",
  },
  "core.metas": {
    rotulo: "Meta do Painel",
    grupo: "parametros",
    bloco: "metas",
  },
  "comercial.kit_documentos": {
    rotulo: "Documento do kit",
    grupo: "cadastros",
    bloco: "kit",
  },
  "comercial.kit_versoes": {
    rotulo: "Versão de documento do kit",
    grupo: "cadastros",
    bloco: "kit",
  },
  "comercial.censo_temas": {
    rotulo: "Tema do Censo",
    grupo: "cadastros",
    bloco: "censo",
  },
  "comercial.censo_sugestao_temas": {
    rotulo: "Tema de sugestão do Censo",
    grupo: "cadastros",
    bloco: "censo",
  },
  "comercial.pesquisa_imoveis": {
    rotulo: "Imóvel pesquisado",
    grupo: "cadastros",
    bloco: "pesquisa",
  },
};

const ROTULO_COLUNA: Record<string, string> = {
  valor: "Valor",
  ativo: "Ativo",
  ordem: "Ordem",
  lista: "Lista",
  fonte_rd: "Fonte no RD",
  fonte_ajustada: "Fonte ajustada",
  tipo: "Tipo",
  conta_ocupacao: "Conta na ocupação",
  nome: "Nome",
  area_de: "De (m²)",
  area_ate: "Até (m²)",
  fixo: "Valor fixo por dia",
  valor_comum: "Dias comuns",
  valor_sazonal: "Datas sazonais",
  data: "Data",
  meta: "Meta",
  limite_atencao: "Limite de atenção",
  indicador: "Indicador",
  vigente_desde: "Mês",
};

const IGNORAR = new Set([
  "id",
  "atualizado_em",
  "criado_em",
  "importacao_id",
  "exemplo",
]);

/** Valor do banco como se lê na tela. */
export function valorLegivel(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (campo === "obrigatorios_garantia" && typeof v === "object") {
    const o = v as Record<string, string[]>;
    return (
      Object.entries(o)
        .filter(([, cs]) => Array.isArray(cs) && cs.length)
        .map(
          ([g, cs]) =>
            `${CAMPOS_GARANTIA[g as Garantia]?.rotulo ?? g}: ${cs
              .map(
                (c) =>
                  (
                    CAMPOS_GARANTIA[g as Garantia]?.campos as Record<
                      string,
                      string
                    >
                  )?.[c] ?? c,
              )
              .join(", ")}`,
        )
        .join(" · ") || "—"
    );
  }
  if (campo === "extra" && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ligados = Object.entries(o)
      .filter(([, x]) => x === true)
      .map(([k]) =>
        k === "feedback"
          ? "entra em Feedbacks"
          : k === "obrigatorio"
            ? "obrigatório"
            : k,
      );
    return ligados.length ? ligados.join(", ") : "—";
  }
  if (Array.isArray(v))
    return v.length ? v.join(campo === "evento_notas" ? " · " : "; ") : "—";
  if (campo === "lista") return LISTAS[v as NomeLista]?.rotulo ?? String(v);
  if (campo === "indice_padrao")
    return INDICES[v as keyof typeof INDICES] ?? String(v);
  if (campo === "data") return formatarData(String(v));
  if (campo === "vigente_desde") return formatarMes(String(v).slice(0, 7));
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "object") return JSON.stringify(v);
  const t = String(v);
  return /^-?\d+\.\d+$/.test(t) ? t.replace(".", ",") : t;
}

const igual = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface Mudanca {
  campo: string;
  rotulo: string;
  antes: string;
  depois: string;
}

/** Campos que a alteração mudou (incluir: os preenchidos; remover: os que havia). */
export function mudancas(
  l: Pick<LinhaAuditoria, "acao" | "antes" | "depois">,
): Mudanca[] {
  const campos = [
    ...new Set([...Object.keys(l.antes ?? {}), ...Object.keys(l.depois ?? {})]),
  ].filter((c) => !IGNORAR.has(c));
  return campos
    .filter((c) =>
      l.antes && l.depois
        ? !igual(l.antes[c], l.depois[c])
        : (l.antes ?? l.depois)?.[c] !== null,
    )
    .map((campo) => ({
      campo,
      rotulo: CAMPOS[campo]?.rotulo ?? ROTULO_COLUNA[campo] ?? campo,
      antes: l.antes ? valorLegivel(campo, l.antes[campo]) : "",
      depois: l.depois ? valorLegivel(campo, l.depois[campo]) : "",
    }));
}

/** Bloco de uma alteração (a linha de parâmetros e as listas dizem pelo conteúdo). */
export function blocoDaAuditoria(
  l: Pick<LinhaAuditoria, "tabela" | "acao" | "antes" | "depois">,
): Bloco | "metas" | null {
  const t = TABELAS_COM[l.tabela];
  if (!t) return null;
  if (t.bloco) return t.bloco;
  if (l.tabela === "comercial.listas") {
    const lista = (l.depois ?? l.antes)?.lista as NomeLista | undefined;
    return lista && LISTAS[lista] ? LISTAS[lista].bloco : null;
  }
  const campo = mudancas(l).find((m) => CAMPOS[m.campo])?.campo;
  return campo ? (CAMPOS[campo]?.bloco ?? null) : null;
}

export const rotuloDoBloco = (b: Bloco | "metas" | null) =>
  b === "metas" ? "Painel (metas)" : b ? BLOCOS[b] : "—";

/** Do que é a linha alterada (ex.: "Tipos de contato · Reclamação"). */
export function descreverRegistro(
  l: Pick<
    LinhaAuditoria,
    "tabela" | "registro_id" | "antes" | "depois" | "acao"
  >,
): string {
  const r = { ...(l.antes ?? {}), ...(l.depois ?? {}) };
  switch (l.tabela) {
    case "comercial.parametros":
      return rotuloDoBloco(blocoDaAuditoria(l));
    case "comercial.listas":
      return `${valorLegivel("lista", r.lista)} · ${r.valor ?? ""}`;
    case "comercial.fontes_de_para":
      return String(r.fonte_rd ?? l.registro_id);
    case "comercial.tipos_luc":
      return String(r.tipo ?? l.registro_id);
    case "comercial.faixas_evento":
      return `Faixa ${r.nome ?? ""}`.trim();
    case "os.feriados":
      return `${valorLegivel("data", r.data)} · ${r.nome ?? ""}`;
    case "core.metas":
      return `${String(r.indicador ?? "").replace(/^comercial\./, "")} · ${valorLegivel("vigente_desde", r.vigente_desde)}`;
    case "comercial.kit_documentos":
    case "comercial.censo_temas":
    case "comercial.censo_sugestao_temas":
      return String(r.nome ?? r.tema ?? l.registro_id);
    case "comercial.pesquisa_imoveis":
      return String(r.endereco ?? r.bairro ?? l.registro_id);
  }
  return l.registro_id;
}
