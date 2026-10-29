import type { AsanaProjeto, AsanaTarefa } from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import { sorteio } from "./sorteio";

// Asana de exemplo, com os nomes de projeto e tag do ponto de partida de
// Parâmetros (se alguém trocar o nome lá para um que não existe aqui, o
// Radar avisa). 3 projetos do Marketing com ~150 tarefas, o calendário de
// eventos (passado recente e 40 nos próximos 6 meses) e a ronda, com 35
// sinalizações "S" e 20 "E" abertas (caso do spec). O código da ronda fica
// no início do nome ("S - …"); o local, no campo "Local".

export const PROJETOS_ASANA: AsanaProjeto[] = [
  { gid: "p-mkt", name: "Marketing", archived: false },
  { gid: "p-dem", name: "Demandas internas", archived: false },
  { gid: "p-cont", name: "Conteúdo e redes", archived: false },
  { gid: "p-cal", name: "Calendário de eventos", archived: false },
  { gid: "p-ronda", name: "Ronda de ambiência", archived: false },
  { gid: "p-velho", name: "Campanha Dia das Mães 2026", archived: true },
];

export const TAGS_ASANA = [
  "Locatário",
  "Terceiro",
  "Gratuito",
  "Pago",
  "Urgente",
  "Redes",
  "Impressos",
  "Site",
];

const TIME = [
  "Ana Ribeiro",
  "Bruno Teles",
  "Carla Mendes",
  "Diego Prado",
  "Elisa Rocha",
];

const TAREFAS = [
  "Arte do post da feira autoral",
  "Revisar textos do site",
  "Briefing do vídeo institucional",
  "Fotos das lojas novas do térreo",
  "Roteiro de stories do fim de semana",
  "Banner da Rua do Relógio",
  "Atualizar agenda no site",
  "Relatório de redes do mês",
  "Cardápio digital do pátio",
  "Pedido de orçamento de impressos",
  "Planejar conteúdo de dezembro",
  "Ajustar landing page de eventos",
  "Aprovar peças com a diretoria",
  "Enviar newsletter da agenda",
  "Mapa do complexo atualizado",
  "Placas de sinalização do galpão 3",
  "Campanha 108 anos: peças finais",
  "Material para lojista novo",
  "Pauta de imprensa do Natal",
  "Responder briefing de locatário",
];

const EVENTOS = [
  "Feira Autoral da Rua do Relógio",
  "Sarau no Pátio",
  "Cinema ao Ar Livre",
  "Feira de Natal",
  "Show Acústico ao Pôr do Sol",
  "Encontro de Carros Antigos",
  "Festival Gastronômico da Serra",
  "Dia dos Pets",
  "Oficina de Crochê",
  "Casamento no Galpão",
  "Formatura",
  "Palestra de Empreendedorismo",
  "Feira de Vinil e Antiguidades",
  "Corrida Rústica 108 anos",
  "Mercado de Pulgas",
  "Festa Junina do Espaço",
  "Exposição Rendas de 1911",
  "Workshop de Fotografia",
];

const SINALIZACOES = [
  "Placa da Rua do Relógio apagada",
  "Totem de entrada com adesivo descolando",
  "Seta para o estacionamento virada",
  "Banner da feira rasgado",
  "Placa do banheiro faltando",
  "Mapa do complexo desatualizado",
  "Letreiro do galpão 2 com lâmpada queimada",
  "Adesivo de piso gasto",
  "Placa de loja fechada ainda exposta",
  "Cartaz vencido no mural",
];
const ESTRUTURAS = [
  "Calçada com piso solto",
  "Lâmpada do corredor queimada",
  "Infiltração no teto do galpão",
  "Corrimão solto na escada",
  "Ralo entupido no pátio",
  "Portão com dobradiça quebrada",
];
const LOCAIS = [
  "Rua do Relógio",
  "Pátio central",
  "Galpão 1",
  "Galpão 2",
  "Galpão 3",
  "Estacionamento",
  "Entrada principal",
  "Térreo",
];

export interface DadosAsana {
  projetos: AsanaProjeto[];
  tarefas: AsanaTarefa[];
}

const link = (gid: string) => `https://app.asana.com/0/0/${gid}`;
const hora = (s: ReturnType<typeof sorteio>) =>
  `T${String(s.int(8, 18)).padStart(2, "0")}:${String(s.int(0, 59)).padStart(2, "0")}:00.000Z`;

export function gerarAsana(hoje: string): DadosAsana {
  const tarefas: AsanaTarefa[] = [];
  const projeto = (gid: string) => {
    const p = PROJETOS_ASANA.find((x) => x.gid === gid) as AsanaProjeto;
    return { gid: p.gid, name: p.name };
  };

  // Projetos do Marketing: ~150 tarefas nos últimos 6 meses.
  for (let k = 0; k < 150; k++) {
    const s = sorteio(`asana-tarefa:${k}`);
    const criada = somarDias(hoje, -s.int(1, 180));
    const semPrazo = s.chance(0.1);
    const prazo = semPrazo ? null : somarDias(criada, s.int(3, 30));
    // Concluída: quase todas as vencidas há muito tempo; algumas atrasadas.
    const concluida =
      (prazo ?? criada) < somarDias(hoje, -20) ? s.chance(0.93) : s.chance(0.4);
    const atraso = s.chance(0.22) ? s.int(1, 9) : -s.int(0, 4);
    const concluidaEm = concluida
      ? (() => {
          const d = somarDias(prazo ?? somarDias(criada, s.int(2, 20)), atraso);
          return d >= hoje ? somarDias(hoje, -1) : d < criada ? criada : d;
        })()
      : null;
    const gid = `t-${k}`;
    const p = s.pesada([
      ["p-mkt", 5],
      ["p-dem", 3],
      ["p-cont", 4],
    ] as const);
    tarefas.push({
      gid,
      name: s.escolha(TAREFAS),
      projects: [projeto(p)],
      memberships: [
        {
          section: {
            name: concluida
              ? "Concluído"
              : s.escolha(["A fazer", "Em andamento", "Revisão"]),
          },
        },
      ],
      assignee: s.chance(0.06) ? null : { name: s.escolha(TIME) },
      created_at: `${criada}${hora(s)}`,
      due_on: prazo,
      start_on: null,
      completed: concluida,
      completed_at: concluidaEm ? `${concluidaEm}${hora(s)}` : null,
      tags: s.chance(0.5)
        ? [{ name: s.escolha(["Redes", "Impressos", "Site", "Urgente"]) }]
        : [],
      custom_fields: [],
      permalink_url: link(gid),
    });
  }

  // Calendário de eventos: ~2 por semana nas últimas 16 semanas e 40 nos
  // próximos 6 meses, quase sempre no fim de semana.
  const datasEventos: string[] = [];
  for (let i = -16 * 7; i < 0; i++) {
    const d = somarDias(hoje, i);
    const dia = diaDaSemana(d);
    if (
      (dia === 6 && sorteio(`ev-sab:${d}`).chance(0.75)) ||
      (dia === 0 && sorteio(`ev-dom:${d}`).chance(0.35)) ||
      (dia === 5 && sorteio(`ev-sex:${d}`).chance(0.2))
    )
      datasEventos.push(d);
  }
  let futuros = 0;
  for (let i = 0; i < 183 && futuros < 40; i++) {
    const d = somarDias(hoje, i);
    const dia = diaDaSemana(d);
    const s = sorteio(`ev-futuro:${d}`);
    if (
      dia === 6 ||
      (dia === 0 && s.chance(0.45)) ||
      (dia === 5 && s.chance(0.2))
    ) {
      datasEventos.push(d);
      futuros++;
    }
  }
  datasEventos.forEach((data, k) => {
    const s = sorteio(`evento:${data}`);
    const gid = `e-${k}`;
    const dias = s.chance(0.25) ? 1 : 0;
    const locatario = s.chance(0.45);
    tarefas.push({
      gid,
      name: s.escolha(EVENTOS),
      projects: [projeto("p-cal")],
      memberships: [
        { section: { name: data < hoje ? "Realizados" : "Confirmados" } },
      ],
      assignee: { name: s.escolha(TIME) },
      created_at: `${somarDias(data, -s.int(20, 90))}${hora(s)}`,
      start_on: dias ? data : null,
      due_on: somarDias(data, dias),
      completed: data < hoje,
      completed_at:
        data < hoje ? `${somarDias(data, dias)}T23:00:00.000Z` : null,
      tags: [
        { name: locatario ? "Locatário" : "Terceiro" },
        { name: s.chance(0.4) ? "Pago" : "Gratuito" },
      ],
      custom_fields: [],
      permalink_url: link(gid),
    });
  });

  // Ronda: sinalizações (S) e estrutura (E). As abertas crescem nas últimas
  // semanas até passar do limite de 30 (caso do spec: 35 S e 20 E abertas).
  const ronda = (codigo: "S" | "E", abertas: number, fechadas: number) => {
    const nomes = codigo === "S" ? SINALIZACOES : ESTRUTURAS;
    for (let k = 0; k < abertas + fechadas; k++) {
      const s = sorteio(`ronda:${codigo}:${k}`);
      const aberta = k < abertas;
      // Abertas mais recentes (umas com mais de 15 dias); fechadas ao longo de 12 semanas.
      const criada = aberta
        ? somarDias(hoje, -Math.floor((k / abertas) ** 1.6 * 75) - 1)
        : somarDias(hoje, -s.int(5, 90));
      const fechouEm = somarDias(criada, s.int(1, 12));
      const fechou = aberta
        ? null
        : fechouEm < hoje
          ? fechouEm
          : somarDias(hoje, -1);
      const gid = `r-${codigo}-${k}`;
      tarefas.push({
        gid,
        name: `${codigo} - ${s.escolha(nomes)}`,
        projects: [projeto("p-ronda")],
        memberships: [{ section: { name: aberta ? "Abertas" : "Resolvidas" } }],
        assignee: s.chance(0.3)
          ? null
          : { name: codigo === "S" ? s.escolha(TIME) : "Equipe de manutenção" },
        created_at: `${criada}${hora(s)}`,
        due_on: null,
        start_on: null,
        completed: !aberta,
        completed_at: fechou ? `${fechou}${hora(s)}` : null,
        tags: [],
        custom_fields: [{ name: "Local", display_value: s.escolha(LOCAIS) }],
        permalink_url: link(gid),
      });
    }
  };
  ronda("S", 35, 70);
  ronda("E", 20, 40);

  return { projetos: PROJETOS_ASANA, tarefas };
}
