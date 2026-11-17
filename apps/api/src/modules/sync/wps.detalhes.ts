import type { LeituraDoDia, RespostaDoDia } from "@/connectors/wps/client";
import type {
  AcessosDoDia,
  Clientes,
  Garagens,
  Lancamentos,
  Setores,
} from "@/connectors/wps/schemas";

// Regras puras da sincronização detalhada da WPS: o que a API devolve vira as
// linhas de financeiro.estacionamento_{acessos,eventos,contratos,
// mensalidades,garagens}. Nada de placa, CPF/CNPJ, cartão, operador ou nome
// de cliente pessoa física (os schemas já não leem a maior parte).

const INSTANTE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(:\d{2})?/;

/** "2026-10-15 16:46:07" (horário local) como a WPS manda, ou null. */
export function instante(v: string | null | undefined): string | null {
  const m = v ? INSTANTE.exec(v) : null;
  return m ? `${m[1]} ${m[2]}:${m[3]}${m[4] ?? ":00"}` : null;
}

/** Só a data ("aaaa-mm-dd") de um instante da WPS, ou null. */
export function soData(v: string | null | undefined): string | null {
  return instante(v)?.slice(0, 10) ?? null;
}

function horaDe(v: string): number | null {
  const m = INSTANTE.exec(v);
  const h = m ? Number(m[2]) : Number.NaN;
  return h >= 0 && h <= 23 ? h : null;
}

const vazioViraNull = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

// --- Acessos -------------------------------------------------------------------

export interface LinhaAcesso {
  sentido: "entrada" | "saida";
  hora: number;
  tipo_cliente: string;
  tipo_veiculo: string;
  servico: string;
  quantidade: number;
  cancelados: number;
}

/**
 * Entradas e saídas do dia somadas por hora, tipo de cliente, tipo de veículo
 * e serviço. `semDetalhe` conta os acessos que a WPS somou mas não listou (ou
 * listou sem hora): ficam de fora das linhas, mas não do movimento do dia.
 */
export function acessosDoDia(
  entradas: AcessosDoDia,
  saidas: AcessosDoDia,
): { linhas: LinhaAcesso[]; semDetalhe: number } {
  const porChave = new Map<string, LinhaAcesso>();
  let semDetalhe = 0;
  const somar = (sentido: LinhaAcesso["sentido"], dia: AcessosDoDia) => {
    for (const [tipo_veiculo, grupo] of Object.entries(dia.subdetalhes)) {
      const lista = grupo.detalhes ?? [];
      semDetalhe += Math.max(grupo.quantidade - lista.length, 0);
      for (const a of lista) {
        const hora = horaDe(a.data);
        if (hora === null) {
          semDetalhe++;
          continue;
        }
        const linha = {
          sentido,
          hora,
          tipo_cliente: vazioViraNull(a.descricao)?.toUpperCase() ?? "OUTROS",
          tipo_veiculo,
          servico: vazioViraNull(a.tipoServico?.descricao) ?? "",
        };
        const chave = Object.values(linha).join("|");
        const atual = porChave.get(chave) ?? {
          ...linha,
          quantidade: 0,
          cancelados: 0,
        };
        atual.quantidade++;
        if (a.ticketCancelado) atual.cancelados++;
        porChave.set(chave, atual);
      }
    }
  };
  somar("entrada", entradas);
  somar("saida", saidas);
  return { linhas: [...porChave.values()], semDetalhe };
}

/** Só as quantidades (o bruto guardado não leva a lista de acessos). */
export function acessosSemLista(dia: AcessosDoDia) {
  return {
    quantidade: dia.quantidade,
    subdetalhes: Object.fromEntries(
      Object.entries(dia.subdetalhes).map(([k, g]) => [
        k,
        { quantidade: g.quantidade, descricao: g.descricao },
      ]),
    ),
  };
}

// --- Eventos -------------------------------------------------------------------

export interface LinhaEvento {
  tipo: LeituraDoDia;
  ocorrido_em: string | null;
  ticket: string | null;
  categoria: string | null;
  situacao: string | null;
  detalhe: string | null;
  setor: string | null;
  valor: number | null;
  quantidade: number;
  dados: Record<string, string | number>;
}

type Evento = Partial<Omit<LinhaEvento, "tipo" | "dados">> & {
  dados?: Record<string, string | number | null | undefined>;
};

/** Tira do `dados` o que veio vazio. */
function limpo(
  dados: Record<string, string | number | null | undefined> = {},
): Record<string, string | number> {
  const r: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (v !== null && v !== undefined && v !== "") r[k] = v;
  }
  return r;
}

/** Itens de `detalhes: [{ GRUPO: X }]` (validações e selos) com o grupo. */
function porGrupo<T>(
  detalhes: Record<string, T>[] | null | undefined,
): [string, T][] {
  return (detalhes ?? []).flatMap((d) => Object.entries(d));
}

const CONVERSORES: {
  [K in LeituraDoDia]: (r: RespostaDoDia<K>) => Evento[];
} = {
  cancela_manual_entrada: (r) =>
    (r.detalhes ?? []).map((a) => ({
      ocorrido_em: instante(a.data),
      detalhe: a.descricao,
      setor: a.setor?.descricao,
    })),
  cancela_manual_saida: (r) =>
    (r.detalhes ?? []).map((a) => ({
      ocorrido_em: instante(a.data),
      detalhe: a.descricao,
      setor: a.setor?.descricao,
    })),
  pagamento_cancelado: (r) =>
    (r.detalhes ?? []).map((c) => ({
      ocorrido_em: instante(c.data_cancelamento),
      ticket: c.pagamento?.ticket,
      categoria: c.pagamento?.formaPagamento?.descricao,
      detalhe: c.justificativa,
      valor: c.valor_cancelado,
    })),
  devolucao_troco: (r) =>
    (r.detalhes ?? []).map((d) => ({
      ocorrido_em: instante(d.data),
      ticket: d.ticket,
      categoria: d.descricao,
      detalhe: d.terminal?.descricao,
      valor: d.valor_retirado,
    })),
  manutencao_patio: (r) =>
    (r.detalhes ?? []).map((m) => ({
      ocorrido_em: instante(m.data_manut) ?? instante(m.data_hora),
      quantidade: Math.max(m.quantidade_excluido ?? 0, 0),
    })),
  desconto: (r) =>
    (r.detalhes ?? []).map((d) => ({
      ocorrido_em: instante(d.data),
      ticket: d.ticket,
      categoria: d.nomeDesconto,
      valor: d.valorDescontado,
      dados: { valor_tarifa: d.valorTarifa },
    })),
  validacao: (r) =>
    porGrupo(r.detalhes).flatMap(([situacao, porTipo]) =>
      Object.entries(porTipo).flatMap(([tipo, itens]) =>
        (itens ?? []).map((v) => ({
          ocorrido_em: instante(v.data_hora_validacao),
          ticket: v.ticket,
          categoria: v.tipo_abono ?? tipo,
          situacao,
          detalhe: v.cliente_validador,
          valor: v.valor_abonado,
          dados: { minutos: v.tempo_abonado },
        })),
      ),
    ),
  abono_utilizado: (r) =>
    (r.detalhes ?? []).map((a) => ({
      ocorrido_em: instante(a.data),
      ticket: a.ticket,
      categoria: a.descricao_evento,
      valor: a.valor_abonado,
      dados: {
        valor_tarifa: a.valor_tarifa,
        minutos: a.tempo_abono,
        permanencia_min: a.permanencia,
      },
    })),
  abono_gerado: (r) =>
    (r.detalhes ?? []).map((a) => ({
      ocorrido_em: instante(a.data_criacao),
      categoria: a.tipo,
      situacao: a.status,
      detalhe: a.grupo,
      // O preço do cartão; o desconto que ele dá vai em `dados`.
      valor: a.valor_unitario,
      dados: {
        validade: soData(a.validade_final),
        minutos: a.valor_desconto_tempo,
        desconto: a.valor_desconto_preco,
      },
    })),
  selo_utilizado: (r) =>
    porGrupo(r.detalhes).flatMap(([tipo, g]) =>
      (g.detalhes ?? []).map((s) => ({
        ocorrido_em: instante(s.data_utilizacao),
        ticket: s.ticket,
        categoria: s.selo?.tipo ?? tipo,
        valor: s.selo?.valor_descontado_preco,
        dados: {
          lote: s.selo?.lote,
          minutos: s.selo?.valor_descontado_tempo,
          percentual: s.selo?.valor_descontado_percentual,
        },
      })),
    ),
  selo_gerado: (r) =>
    porGrupo(r.detalhes).flatMap(([tipo, g]) =>
      (g.detalhes ?? []).map((s) => ({
        ocorrido_em: instante(s.data_criacao),
        categoria: s.tipo ?? tipo,
        situacao: s.status,
        detalhe: s.nome_cliente,
        valor: s.valor_desconto_preco,
        dados: {
          lote: s.lote,
          validade: soData(s.data_validade),
          minutos: s.valor_desconto_tempo,
          percentual: s.valor_desconto_percentual,
        },
      })),
    ),
  manobra: (r) =>
    (r.detalhes ?? []).map((m) => ({
      ocorrido_em: instante(m.data),
      ticket: m.ticket,
      categoria: m.descricao_evento,
      setor: m.setor,
      detalhe: m.terminal?.descricao,
    })),
};

/** As linhas de evento de uma leitura do dia. */
export function eventosDe<K extends LeituraDoDia>(
  tipo: K,
  resposta: RespostaDoDia<K>,
): LinhaEvento[] {
  const converter: (r: RespostaDoDia<K>) => Evento[] = CONVERSORES[tipo];
  return converter(resposta).map((e) => ({
    tipo,
    ocorrido_em: e.ocorrido_em ?? null,
    ticket: vazioViraNull(e.ticket),
    categoria: vazioViraNull(e.categoria),
    situacao: vazioViraNull(e.situacao),
    detalhe: vazioViraNull(e.detalhe),
    setor: vazioViraNull(e.setor),
    valor: e.valor ?? null,
    quantidade: e.quantidade ?? 1,
    dados: limpo(e.dados),
  }));
}

// --- Cadastros -----------------------------------------------------------------

export interface LinhaContrato {
  contrato: number;
  tipo: string;
  situacao: string;
  /** Só pessoa jurídica (CNPJ): nome de pessoa física não é gravado. */
  cliente: string | null;
  plano: string | null;
  valor_mensalidade: number;
  vagas: number;
  usuarios: number;
  veiculos: number;
  grupo_acesso: string | null;
  criado_em: string | null;
}

export function contratosDe(clientes: Clientes): LinhaContrato[] {
  return (clientes.detalhes ?? []).flatMap((c) => {
    const pj = (c.documento ?? "").replace(/\D/g, "").length === 14;
    return (c.vagas ?? []).map((v) => ({
      contrato: v.contrato,
      tipo: v.tipo.toUpperCase(),
      situacao: v.situacao.toUpperCase(),
      cliente: pj ? vazioViraNull(c.nome_cliente) : null,
      plano: vazioViraNull(v.descricao_mensalidade),
      valor_mensalidade: v.valor_mensalidade ?? 0,
      vagas: v.numero_vagas ?? 0,
      usuarios: v.usuarios?.length ?? 0,
      veiculos: (v.usuarios ?? []).reduce(
        (s, u) => s + (u.veiculos?.length ?? 0),
        0,
      ),
      grupo_acesso: vazioViraNull(v.grupo_acesso?.descricao_grupo_acesso),
      criado_em: soData(v.data_criacao),
    }));
  });
}

export interface LinhaMensalidade {
  contrato: number;
  status_contrato: string | null;
  contrato_inicio: string | null;
  contrato_fim: string | null;
  vencimento: string;
  pago_em: string | null;
  forma_pagamento: string | null;
  valor: number;
  valor_pago: number;
  status: string;
}

/** Mensalidade sem vencimento legível fica de fora (e vira aviso). */
export function mensalidadesDe(l: Lancamentos): {
  linhas: LinhaMensalidade[];
  descartadas: number;
} {
  let descartadas = 0;
  const linhas = (l.detalhes ?? []).flatMap((c) =>
    (c.lancamentos ?? []).flatMap((m) => {
      const vencimento = soData(m.data_vencimento);
      if (!vencimento) {
        descartadas++;
        return [];
      }
      return [
        {
          contrato: c.contrato,
          status_contrato:
            vazioViraNull(c.status_contrato)?.toUpperCase() ?? null,
          contrato_inicio: instante(c.data_inicio_contrato),
          contrato_fim: instante(c.data_fim_contrato),
          vencimento,
          pago_em: instante(m.data_pagamento),
          forma_pagamento: vazioViraNull(m.forma_pagamento),
          valor: m.valor_pendencia,
          valor_pago: m.valor_pago ?? 0,
          status: m.status_lancamento.toUpperCase(),
        },
      ];
    }),
  );
  return { linhas, descartadas };
}

export interface LinhaGaragem {
  descricao: string | null;
  cidade: string | null;
  uf: string | null;
  vagas: number | null;
  vagas_mensalistas: number | null;
  clientes_mensalistas: number | null;
  clientes_credenciados: number | null;
  setores: {
    codigo: number | null;
    setor: string | null;
    sla: number | null;
    sla2: number | null;
    tempo_pos_checkout: number | null;
  }[];
}

/** O cadastro da garagem configurada, ou null se a WPS não a listou. */
export function garagemDe(
  garagens: Garagens,
  estacionamentoId: number,
  setores: Setores | null,
  clientes: { mensalistas: number | null; credenciados: number | null },
): LinhaGaragem | null {
  const g = garagens.find((x) => x.id === estacionamentoId);
  if (!g) return null;
  return {
    descricao: vazioViraNull(g.descricao),
    cidade: vazioViraNull(g.cidade),
    uf: vazioViraNull(g.uf),
    vagas: g.qtdVagas ?? null,
    vagas_mensalistas: g.qtdVagasMensalista ?? null,
    clientes_mensalistas: clientes.mensalistas,
    clientes_credenciados: clientes.credenciados,
    setores: (setores?.detalhes ?? []).map((s) => ({
      codigo: s.codigo ?? null,
      setor: vazioViraNull(s.setor),
      sla: s.sla ?? null,
      sla2: s.sla2 ?? null,
      tempo_pos_checkout: s.tempo_pos_checkout ?? null,
    })),
  };
}
