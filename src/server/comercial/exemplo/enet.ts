import {
  competenciasEntre,
  diasEntre,
  fimDoMesDe,
  somarDias,
  somarMeses,
} from "@/lib/comercial/datas";
import type {
  EnetCliente,
  EnetContaReceber,
  EnetContrato,
  EnetLuc,
  FontesEnet,
  Indice,
} from "@/lib/comercial/fontes";
import { arred, type Sorteio, sorteio } from "@/lib/sorteio";
import { cnpj, cpf, empresa, nascimento, pessoa } from "./nomes";

// ENET de exemplo (spec seção 6): 396 LUCs em 15 locais, 84 áreas
// publicitárias, ~269 locados. A carteira começa montada em INICIO_MOV e,
// mês a mês (semente própria por mês), há entradas, saídas e
// transferências (o mesmo locatário rescinde e assina outro LUC em até 30
// dias). Só vale o que aconteceu até hoje; o status do LUC sai daí, então
// LUC locado sempre tem contrato ativo. Contas a receber: uma linha por LUC
// e competência desde jan/2025, proporcional aos dias de contrato no mês,
// mais os eventos.

/** Início do histórico de entradas e saídas (24 meses antes do mockup). */
export const INICIO_MOV = "2024-11-01";
export const INICIO_CONTAS = "2025-01-01";
/** Soma da ABL dos LUCs (relatório "Relação dos LUC's" da spec). */
const ABL_TOTAL = 41_316.81;
const VALOR_M2 = 27.6;

const BLOCOS: [local: string, quantidade: number, rua: string][] = [
  ["Bloco 01", 26, "Rua 1911"],
  ["Bloco 02", 26, "Rua das Rendas"],
  ["Bloco 03", 46, "Rua 1911"],
  ["Bloco 04", 26, "Rua da Tinturaria"],
  ["Bloco 05", 35, "Rua 1911"],
  ["Bloco 07", 1, "Rua das Artes"],
  ["Bloco 09", 30, "Rua da Tinturaria"],
  ["Bloco 10", 28, "Rua das Borboletas"],
  ["Bloco 11", 46, "Rua do Relógio"],
  ["Bloco 12", 22, "Rua do Relógio"],
  ["Bloco 14", 4, "Rua Freiburg"],
  ["Bloco 16", 1, "Rua Freiburg"],
  ["Bloco 85", 4, "R. Tiradentes"],
  ["Locações externas", 4, "Av Julius ARP"],
  ["ARP", 97, "Mídia"],
];
const AREAS_PUBLICITARIAS = 84;
const OUTROS_ARP: [tipo: string, prefixo: string, de: number, ate: number][] = [
  ["Quiosque", "QUIO", 6, 12],
  ["Quiosque", "QUIO", 6, 12],
  ["Quiosque", "QUIO", 6, 12],
  ["Stand", "STAN", 6, 15],
  ["Stand", "STAN", 6, 15],
  ["Eventos", "EVEN", 400, 900],
  ["Eventos", "EVEN", 150, 400],
  ["Casarão", "CASA", 180, 320],
  ["Vaga de Garagem", "VAGA", 12, 12],
  ["Vaga de Garagem", "VAGA", 12, 12],
  ["Vaga de Garagem", "VAGA", 12, 12],
  ["Outros", "OUTR", 20, 60],
  ["Loja Comercial", "LOJA", 30, 80],
];

export const ATIVIDADES = [
  "Serviços",
  "Clínicas e Médicos",
  "Comércio",
  "Alimentação",
  "Academias e Condicionamento",
  "Educação",
  "Veterinária",
  "Entretenimento",
];

const pad = (n: number, t = 2) => String(n).padStart(t, "0");
const ehMidia = (l: EnetLuc) => l.tipo_loja === "Área Publicitária";
const ehEvento = (l: EnetLuc) => l.tipo_loja === "Eventos";

function gerarLucs(): EnetLuc[] {
  const s = sorteio("comercial:enet:lucs");
  const lucs: EnetLuc[] = [];
  const area = (de: number, ate: number) => de + s.n() * (ate - de);
  const inicio = () =>
    `${s.int(2008, 2011)}-${pad(s.int(1, 12))}-${pad(s.int(1, 28))}`;
  for (const [local, quantidade, rua] of BLOCOS) {
    const bloco = local.startsWith("Bloco") ? local.slice(6) : "";
    for (let i = 0; i < quantidade; i++) {
      let luc: Omit<EnetLuc, "area_util" | "status" | "situacao">;
      if (local === "ARP" && i < AREAS_PUBLICITARIAS) {
        luc = {
          numero: `OOH_${pad(i + 1)}`,
          tipo_loja: "Área Publicitária",
          abl: 0,
          local,
          piso: "ARP",
          rua: "Mídia",
          data_inicio: inicio(),
        };
      } else if (local === "ARP") {
        const [tipo, prefixo, de, ate] = OUTROS_ARP[
          i - AREAS_PUBLICITARIAS
        ] as (typeof OUTROS_ARP)[number];
        luc = {
          numero: `${prefixo}_${pad(i - AREAS_PUBLICITARIAS + 1)}`,
          tipo_loja: tipo,
          abl: area(de, ate),
          local,
          piso: "ARP",
          rua: "Av Julius ARP",
          data_inicio: inicio(),
        };
      } else if (!bloco) {
        luc = {
          numero: `EXT_${pad(i + 1)}`,
          tipo_loja: "Casa",
          abl: area(60, 180),
          local,
          piso: "Térreo",
          rua,
          data_inicio: inicio(),
        };
      } else {
        const tipo = s.pesada([
          ["Loja Comercial", 50],
          ["Sala Comercial", 45],
          ["Galpão", 5],
          ["Outros", 4],
        ] as const);
        const piso = s.pesada([
          [1, 60],
          [2, 28],
          [3, 12],
        ] as const);
        const [de, ate] =
          tipo === "Galpão"
            ? [300, 1500]
            : tipo === "Loja Comercial"
              ? [25, 160]
              : tipo === "Sala Comercial"
                ? [20, 110]
                : [15, 80];
        luc = {
          numero: `${bloco}_${piso}${pad(i + 1)}`,
          tipo_loja: tipo,
          abl: area(de, ate),
          local,
          piso: `Piso ${piso}`,
          rua,
          data_inicio: inicio(),
        };
      }
      lucs.push({
        ...luc,
        area_util: 0,
        status: "Vago",
        situacao: "Ativo",
      });
    }
  }
  // A soma da ABL fecha com a do relatório; a diferença do arredondamento
  // fica no maior LUC.
  const fator = ABL_TOTAL / lucs.reduce((t, l) => t + l.abl, 0);
  for (const l of lucs) {
    l.abl = arred(l.abl * fator);
    l.area_util = arred(l.abl * s.perto(0.9, 0.04));
  }
  const maior = lucs.reduce((a, b) => (b.abl > a.abl ? b : a));
  maior.abl = arred(
    maior.abl + ABL_TOTAL - lucs.reduce((t, l) => t + l.abl, 0),
  );
  return lucs;
}

const LUCS = gerarLucs();

/** Vagos do relatório: 52 áreas publicitárias e 75 LUCs pequenos (~3.000 m²). */
const VAGOS_ALVO = { midia: 52, lojas: 75 };

const DIFICEIS = (() => {
  const s = sorteio("comercial:enet:vagos");
  // Sorteio puxado para os menores (como no relatório).
  const chave = new Map(
    LUCS.map((l) => [l.numero, (l.abl || 1) * s.perto(1, 0.2)]),
  );
  const por = (a: EnetLuc, b: EnetLuc) =>
    (chave.get(a.numero) ?? 0) - (chave.get(b.numero) ?? 0);
  const midia = LUCS.filter(ehMidia).sort(por).slice(0, VAGOS_ALVO.midia);
  const lojas = LUCS.filter((l) => !ehMidia(l) && !ehEvento(l))
    .sort(por)
    .slice(0, VAGOS_ALVO.lojas);
  return new Set([...midia, ...lojas].map((l) => l.numero));
})();

interface Estado {
  clientes: EnetCliente[];
  contratos: EnetContrato[];
  /** Contrato ativo por LUC. */
  ativo: Map<string, EnetContrato>;
  /** Prazo de cada renovação por aditivo e se cada uma acontece. */
  renovacoes: Map<EnetContrato, { meses: number; renova: boolean[] }>;
}

function novoCliente(s: Sorteio, e: Estado, atividade?: string): EnetCliente {
  const pj = s.chance(0.65);
  const nome = pj
    ? `${empresa(s)} ${s.escolha(["Ltda", "ME", "Ltda"])}`
    : pessoa(s);
  const doc = pj ? cnpj(s) : cpf(s);
  const socios = pj
    ? Array.from({ length: s.int(1, 2) }, () => ({
        nome: pessoa(s),
        cpf: cpf(s),
        data_nascimento: s.chance(0.75) ? nascimento(s, 1958, 1998) : null,
      }))
    : [
        {
          nome,
          cpf: doc,
          data_nascimento: s.chance(0.75) ? nascimento(s, 1958, 1998) : null,
        },
      ];
  const cliente: EnetCliente = {
    codigo: `CL${pad(e.clientes.length + 1, 5)}`,
    nome,
    cpf_cnpj: doc,
    tipo_pessoa: pj ? "PJ" : "PF",
    socios,
    atividade: atividade ?? s.escolha(ATIVIDADES),
  };
  e.clientes.push(cliente);
  return cliente;
}

function aluguel(s: Sorteio, l: EnetLuc): number {
  if (ehMidia(l)) return s.int(45, 135) * 10;
  if (l.tipo_loja === "Vaga de Garagem") return s.int(15, 35) * 10;
  return arred(l.abl * s.perto(VALOR_M2, 0.3));
}

function novoContrato(
  s: Sorteio,
  e: Estado,
  l: EnetLuc,
  inicio: string,
  cliente: EnetCliente,
): EnetContrato {
  const indeterminado = s.chance(0.32);
  const meses = s.escolha([12, 24, 36, 60]);
  const renova = Array.from({ length: 12 }, () => s.chance(0.97));
  const termino = somarMeses(inicio, meses);
  const indice: Indice = s.chance(0.85) ? "IGPM" : "IPCA";
  const contrato: EnetContrato = {
    codigo: `CT${pad(e.contratos.length + 1, 5)}`,
    luc: l.numero,
    cliente: cliente.codigo,
    locatario: cliente.nome,
    data_inicio: inicio,
    data_termino: indeterminado ? null : somarDias(termino, -1),
    prazo: indeterminado ? "Indeterminado" : "Determinado",
    valor_aluguel: aluguel(s, l),
    indice,
    mes_reajuste: Number(inicio.slice(5, 7)),
    data_rescisao: null,
  };
  e.contratos.push(contrato);
  e.ativo.set(l.numero, contrato);
  e.renovacoes.set(contrato, { meses, renova });
  return contrato;
}

/** Cliente de um contrato novo: às vezes um locatário que já tem LUC. */
function clienteDoNovo(s: Sorteio, e: Estado): EnetCliente {
  const ativos = [...new Set([...e.ativo.values()].map((c) => c.cliente))];
  if (ativos.length && s.chance(0.12)) {
    const codigo = s.escolha(ativos);
    return e.clientes.find((c) => c.codigo === codigo) as EnetCliente;
  }
  return novoCliente(s, e);
}

/**
 * Probabilidade por mês de saída (LUC locado) e de entrada (LUC vago). Os
 * LUCs "difíceis" (VAGOS_ALVO) quase sempre estão vagos e os outros quase
 * sempre locados: o total fica perto do relatório mesmo com o sorteio.
 */
function ritmo(l: EnetLuc): { saida: number; entrada: number } {
  return DIFICEIS.has(l.numero)
    ? { saida: 0.08, entrada: 0.006 }
    : { saida: 0.007, entrada: 0.4 };
}

interface Evento {
  dia: string;
  ordem: number;
  aplicar: () => void;
}

export function gerarEnet(hoje: string): FontesEnet {
  const e: Estado = {
    clientes: [],
    contratos: [],
    ativo: new Map(),
    renovacoes: new Map(),
  };
  const s0 = sorteio("comercial:enet:carteira");
  for (const l of LUCS) {
    if (ehEvento(l)) continue;
    const { saida, entrada } = ritmo(l);
    if (!s0.chance(entrada / (entrada + saida))) continue;
    const inicio = somarDias(INICIO_MOV, -s0.int(30, 365 * 12));
    novoContrato(s0, e, l, inicio, clienteDoNovo(s0, e));
  }

  const abl = new Map(LUCS.map((l) => [l.numero, l.abl]));
  const rescindir = (c: EnetContrato, dia: string) => {
    c.data_rescisao = dia;
    if (e.ativo.get(c.luc) === c) e.ativo.delete(c.luc);
  };

  for (const mes of competenciasEntre(INICIO_MOV, hoje)) {
    const s = sorteio(`comercial:enet:mov:${mes}`);
    const fim = Number(fimDoMesDe(mes).slice(8));
    const eventos: Evento[] = [];
    const mexidos = new Set<string>();
    for (const l of LUCS) {
      const u = s.n();
      const dia = somarDias(mes, s.int(0, fim - 1));
      const sub = sorteio(`comercial:enet:mov:${mes}:${l.numero}`);
      if (ehEvento(l)) continue;
      const { saida, entrada } = ritmo(l);
      const atual = e.ativo.get(l.numero);
      if (atual && u < saida) {
        mexidos.add(l.numero);
        eventos.push({ dia, ordem: 0, aplicar: () => rescindir(atual, dia) });
      } else if (!atual && u < entrada) {
        mexidos.add(l.numero);
        eventos.push({
          dia,
          ordem: 1,
          aplicar: () => novoContrato(sub, e, l, dia, clienteDoNovo(sub, e)),
        });
      }
    }
    // Transferência: sai de um LUC e entra noutro vago, até 30 dias depois.
    if (s.chance(0.4)) {
      const origens = [...e.ativo.values()].filter(
        (c) =>
          !mexidos.has(c.luc) &&
          (abl.get(c.luc) ?? 0) > 0 &&
          (abl.get(c.luc) ?? 0) <= 150,
      );
      const destinos = LUCS.filter(
        (l) =>
          !ehMidia(l) &&
          !ehEvento(l) &&
          !DIFICEIS.has(l.numero) &&
          !e.ativo.has(l.numero) &&
          !mexidos.has(l.numero),
      );
      const origem = origens.length ? s.escolha(origens) : null;
      const destino = destinos.length ? s.escolha(destinos) : null;
      const sai = somarDias(mes, s.int(0, fim - 1));
      const entra = somarDias(sai, s.int(1, 30));
      if (origem && destino) {
        const sub = sorteio(`comercial:enet:transf:${mes}`);
        const cliente = e.clientes.find(
          (c) => c.codigo === origem.cliente,
        ) as EnetCliente;
        eventos.push({
          dia: sai,
          ordem: 0,
          aplicar: () => rescindir(origem, sai),
        });
        eventos.push({
          dia: entra,
          ordem: 1,
          aplicar: () => novoContrato(sub, e, destino, entra, cliente),
        });
      }
    }
    eventos.sort((a, b) => a.dia.localeCompare(b.dia) || a.ordem - b.ordem);
    for (const ev of eventos) if (ev.dia <= hoje) ev.aplicar();
  }

  // Renovação por aditivo ao vencer (até hoje ou até a rescisão); a que
  // não renova fica vencida.
  for (const [c, { meses, renova }] of e.renovacoes) {
    if (!c.data_termino) continue;
    const limite = c.data_rescisao ?? hoje;
    let termino = c.data_termino;
    for (const sim of renova) {
      if (termino >= limite || !sim) break;
      termino = somarDias(somarMeses(somarDias(termino, 1), meses), -1);
    }
    c.data_termino = termino;
  }

  const lucs = LUCS.map((l) => ({
    ...l,
    status: e.ativo.has(l.numero) ? ("Locado" as const) : ("Vago" as const),
  }));
  const contasReceber = gerarContas(e, hoje);
  return {
    lucs,
    contratos: e.contratos,
    clientes: e.clientes,
    contasReceber,
  };
}

/** Faturado por competência: aluguel proporcional aos dias, mais os eventos. */
function gerarContas(e: Estado, hoje: string): EnetContaReceber[] {
  const tipo = new Map(LUCS.map((l) => [l.numero, l.tipo_loja]));
  const contas: EnetContaReceber[] = [];
  const salas = LUCS.filter(ehEvento);
  const promotores: EnetCliente[] = [];
  for (const mes of competenciasEntre(INICIO_CONTAS, hoje)) {
    const fim = fimDoMesDe(mes);
    const dias = diasEntre(mes, fim) + 1;
    for (const c of e.contratos) {
      const de = c.data_inicio > mes ? c.data_inicio : mes;
      const ate =
        c.data_rescisao && c.data_rescisao <= fim
          ? somarDias(c.data_rescisao, -1)
          : fim;
      if (de > ate) continue;
      const ativos = diasEntre(de, ate) + 1;
      contas.push({
        competencia: mes,
        luc: c.luc,
        tipo_luc: tipo.get(c.luc) ?? "",
        cliente: c.cliente,
        valor_faturado: arred((c.valor_aluguel * ativos) / dias),
      });
    }
    const s = sorteio(`comercial:enet:eventos:${mes}`);
    const quantos = s.contagem(1.5);
    for (let i = 0; i < quantos; i++) {
      const sala = s.escolha(salas);
      const dia = somarDias(mes, s.int(0, dias - 1));
      const valor = s.int(25, 180) * 100;
      const novo = s.chance(0.5);
      const quem = s.n();
      if (dia > hoje) continue;
      const cliente =
        (novo && promotores.length < 12) || !promotores.length
          ? novoCliente(
              sorteio(`comercial:enet:eventos:${mes}:${i}`),
              e,
              "Entretenimento",
            )
          : (promotores[Math.floor(quem * promotores.length)] as EnetCliente);
      if (!promotores.includes(cliente)) promotores.push(cliente);
      contas.push({
        competencia: mes,
        luc: sala.numero,
        tipo_luc: sala.tipo_loja,
        cliente: cliente.codigo,
        valor_faturado: valor,
      });
    }
  }
  return contas;
}
