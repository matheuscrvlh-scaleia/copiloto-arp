import "server-only";
import {
  descreverPeriodos,
  formatarDuracao,
  minutoHomem,
  minutosDaOS,
} from "@/lib/os/calculos";
import {
  CARTOES_OS,
  FILTROS_STATUS,
  type FiltrosOS,
  PERIODOS_OS,
} from "@/lib/os/ordem-lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { EXECUCOES } from "@/lib/os/rotulos";
import {
  type Cadastros,
  type LinhaOS,
  localDa,
  sessoesDa,
  tecnicosDa,
  tipoServicoDa,
  valoresDa,
} from "@/server/os/ordem-consulta";
import type { LinhaOSTela } from "./tabela";

// Da OS lida no banco para a linha da tela (e do arquivo exportado).

export const CAMINHO_ORDENS = "/os/ordens";

type Busca = Record<string, string | string[] | undefined>;

export function paraTela(
  o: LinhaOS,
  cad: Cadastros,
  comCustos: boolean,
  params: Busca,
): LinhaOSTela {
  const sessoes = sessoesDa(o);
  const minutos = minutosDaOS(sessoes);
  const mh = minutoHomem(sessoes);
  const v = comCustos ? valoresDa(o) : { valor: null, valorRateio: null };
  const painel = new URLSearchParams();
  for (const [k, x] of Object.entries(params))
    if (k !== PARAM_PAINEL && typeof x === "string") painel.set(k, x);
  painel.set(PARAM_PAINEL, o.id);
  return {
    id: o.id,
    numero: o.numero,
    titulo: o.titulo,
    status: o.status,
    aguardando: o.aguardando_tipo,
    execucao: o.execucao,
    tipoServico: tipoServicoDa(o, cad),
    local: localDa(o, cad),
    tecnicos:
      o.execucao === "terceirizada" && o.empresa_id
        ? [cad.empresas.get(o.empresa_id)?.nome, ...tecnicosDa(o, cad)]
            .filter(Boolean)
            .join(", ")
        : tecnicosDa(o, cad).join(", "),
    periodos: descreverPeriodos(sessoes),
    minutos,
    duracao: formatarDuracao(minutos),
    minutoHomem: mh,
    hh: formatarDuracao(mh),
    rodando: sessoes.some((s) => s.fim === null),
    rateio: o.rateio,
    valor: comCustos ? (v.valor ?? 0) : null,
    valorRateio: comCustos ? (v.valorRateio ?? 0) : null,
    exemplo: o.exemplo,
    href: `${CAMINHO_ORDENS}?${painel.toString()}`,
  };
}

const dataBr = (d: string) => d.split("-").reverse().join("/");

/** Linha de filtros do arquivo exportado. */
export function descreverFiltros(f: FiltrosOS, cad: Cadastros): string {
  const partes = [
    f.q && `Busca: ${f.q}`,
    f.status && `Status: ${FILTROS_STATUS[f.status]}`,
    f.execucao && `Execução: ${EXECUCOES[f.execucao]}`,
    f.periodo && `Criadas: ${PERIODOS_OS[f.periodo].toLowerCase()}`,
    !f.periodo &&
      (f.de || f.ate) &&
      `Criadas: ${f.de ? dataBr(f.de) : "início"} a ${f.ate ? dataBr(f.ate) : "hoje"}`,
    f.categoria && `Tipo: ${cad.categorias.get(f.categoria)?.nome ?? "—"}`,
    f.tecnico && `Técnico: ${cad.tecnicos.get(f.tecnico)?.nome ?? "—"}`,
    f.empresa && `Empresa: ${cad.empresas.get(f.empresa)?.nome ?? "—"}`,
    f.rateio !== null && `Rateio: ${f.rateio ? "Sim" : "Não"}`,
    f.local && `Local: ${f.local}`,
    f.cartao && CARTOES_OS[f.cartao],
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Todas as OS";
}

export function opcoesDeCategoria(cad: Cadastros) {
  return [...cad.categorias.values()]
    .filter((c) => c.tipo_padrao === "os" || c.registrar_tempo)
    .map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      descricao: c.pai_id ? cad.categorias.get(c.pai_id)?.nome : undefined,
    }));
}
