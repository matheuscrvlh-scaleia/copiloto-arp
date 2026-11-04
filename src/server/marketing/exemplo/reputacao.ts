import type {
  Estrelas,
  GoogleAvaliacao,
  GoogleLocal,
  TemaDaAvaliacao,
} from "@/lib/marketing/fontes";
import { somarDias } from "@/lib/marketing/periodo";
import { arred, sorteio } from "@/lib/sorteio";

// Avaliações de exemplo (Google Perfil da Empresa) da ARP e dos locatários
// cadastrados em Configurações, nos últimos 13 meses. Quem é "gerente" traz
// todas; "consulta_publica" traz nota, total e até 5 avaliações (dados
// parciais); "sem_acesso" não traz nada. Casos do spec: em ordem alfabética,
// o 1º locatário tem 4 reclamações nos últimos 30 dias (Alerta, quase todas
// de atendimento), o 5º tem 2 e o 10º tem 1 (Atenção); a ARP tem uma de
// 1 estrela sem resposta há 4 dias. O tema imita a classificação da IA,
// sempre dentro da lista cadastrada.

export interface LocatarioParaExemplo {
  id: string;
  nome: string;
  forma_acesso: string;
  perfil_url: string | null;
}

export interface DadosReputacao {
  locais: GoogleLocal[];
  avaliacoes: GoogleAvaliacao[];
  temas: TemaDaAvaliacao[];
}

const ESTRELAS: Estrelas[] = ["ONE", "TWO", "THREE", "FOUR", "FIVE"];
const PRIMEIROS = [
  "Marina",
  "Paulo",
  "Rita",
  "Jorge",
  "Clara",
  "André",
  "Luíza",
  "Márcio",
  "Tânia",
  "Sérgio",
  "Bianca",
  "Fábio",
  "Isabela",
  "Henrique",
  "Joana",
  "Leandro",
  "Mônica",
  "Nelson",
  "Priscila",
  "Ricardo",
  "Silvia",
  "Vitor",
] as const;

const ELOGIOS: Record<string, string[]> = {
  Estacionamento: [
    "Estacionamento fácil e seguro.",
    "Deu para parar o carro rápido, mesmo no sábado.",
  ],
  Sinalização: [
    "Fácil de achar as lojas.",
    "Tudo bem sinalizado, inclusive o banheiro.",
  ],
  Atendimento: [
    "Atendimento excelente, muito simpáticos.",
    "Fomos muito bem recebidos.",
    "Equipe atenciosa do começo ao fim.",
  ],
  Limpeza: [
    "Lugar muito limpo e bem cuidado.",
    "Banheiros limpos, tudo organizado.",
  ],
  Eventos: [
    "A feira de sábado estava ótima.",
    "Show maravilhoso no pátio.",
    "Programação para a família inteira.",
  ],
  Gastronomia: [
    "Comida deliciosa e bem servida.",
    "Melhor café da cidade, ambiente lindo.",
    "Pratos caprichados.",
  ],
};
const QUEIXAS: Record<string, string[]> = {
  Estacionamento: [
    "Fila enorme para sair do estacionamento.",
    "Cancela travou e ninguém apareceu.",
    "Caro para ficar só uma hora.",
  ],
  Sinalização: [
    "Difícil achar a entrada, falta placa.",
    "Rodamos um tempão procurando a loja.",
  ],
  Atendimento: [
    "Fui mal atendido, demoraram demais.",
    "Atendente sem paciência nenhuma.",
    "Pedido errado e ninguém resolveu.",
    "Esperei 40 minutos e fui embora.",
  ],
  Limpeza: [
    "Banheiro sujo no domingo à tarde.",
    "Lixo acumulado perto das mesas.",
  ],
  Eventos: ["Evento lotado, sem organização.", "Som alto demais no show."],
  Gastronomia: ["Comida fria e cara.", "Prato veio diferente do cardápio."],
};

function texto(s: ReturnType<typeof sorteio>, tema: string, ruim: boolean) {
  const lista =
    (ruim ? QUEIXAS : ELOGIOS)[tema] ??
    (ruim ? ["Experiência ruim."] : ["Gostei muito."]);
  return s.escolha(lista);
}

export function gerarReputacao(
  hoje: string,
  locatarios: LocatarioParaExemplo[],
  temasCadastrados: string[],
): DadosReputacao {
  const out: DadosReputacao = { locais: [], avaliacoes: [], temas: [] };
  const temas = temasCadastrados.length ? temasCadastrados : ["Atendimento"];
  const temaValido = (t: string, s: ReturnType<typeof sorteio>) =>
    temas.includes(t) ? t : s.escolha(temas);

  function avaliacoesDe(
    localId: string,
    porMes: number,
    notas: readonly (readonly [number, number])[],
    reclamacoesForcadas: { dias: number; tema: string }[],
    respondeChance: number,
  ) {
    const lista: GoogleAvaliacao[] = [];
    for (let i = 400; i >= 0; i--) {
      const data = somarDias(hoje, -i);
      const s = sorteio(`rev:${localId}:${data}`);
      const n = s.contagem(porMes / 30);
      for (let k = 0; k < n; k++) {
        let nota = s.pesada(notas);
        // Nos últimos 35 dias só as reclamações combinadas para o caso de teste.
        if (i <= 35 && nota <= 2) nota = 4;
        lista.push(montar(localId, data, k, nota, s, respondeChance));
      }
    }
    reclamacoesForcadas.forEach((r, k) => {
      const data = somarDias(hoje, -r.dias);
      const s = sorteio(`rev-forcada:${localId}:${k}`);
      lista.push(
        montar(
          localId,
          data,
          9 + k,
          s.chance(0.5) ? 1 : 2,
          s,
          respondeChance,
          r.tema,
        ),
      );
    });
    return lista;
  }

  function montar(
    localId: string,
    data: string,
    k: number,
    nota: number,
    s: ReturnType<typeof sorteio>,
    respondeChance: number,
    temaFixo?: string,
  ): GoogleAvaliacao {
    const ruim = nota <= 2;
    const tema = temaValido(
      temaFixo ??
        s.pesada(
          ruim
            ? [
                ["Atendimento", 3],
                ["Estacionamento", 3],
                ["Limpeza", 2],
                ["Sinalização", 2],
                ["Gastronomia", 1],
                ["Eventos", 1],
              ]
            : [
                ["Atendimento", 4],
                ["Gastronomia", 3],
                ["Eventos", 3],
                ["Limpeza", 1],
                ["Estacionamento", 1],
                ["Sinalização", 1],
              ],
        ),
      s,
    );
    const hora = `${String(s.int(9, 22)).padStart(2, "0")}:${String(s.int(0, 59)).padStart(2, "0")}`;
    const createTime = `${data}T${hora}:00-03:00`;
    const dias = s.int(0, ruim ? 5 : 8);
    const resposta = s.chance(respondeChance)
      ? {
          comment: ruim
            ? "Sentimos muito pela experiência. Vamos falar com a equipe e queremos te receber de novo."
            : "Obrigado pela visita! Volte sempre.",
          updateTime: `${somarDias(data, dias)}T${hora}:00-03:00`,
        }
      : null;
    const id = `${localId}-${data}-${k}`;
    out.temas.push({ reviewId: id, tema });
    return {
      reviewId: id,
      localId,
      reviewer: {
        displayName: `${s.escolha(PRIMEIROS)} ${String.fromCharCode(65 + s.int(0, 22))}.`,
      },
      starRating: ESTRELAS[nota - 1] as Estrelas,
      comment: s.chance(0.12) ? "" : texto(s, tema, ruim),
      createTime,
      updateTime: createTime,
      reviewReply: resposta,
    };
  }

  // ARP: ~34 avaliações por mês.
  const arp = avaliacoesDe(
    "arp",
    34,
    [
      [5, 66],
      [4, 19],
      [3, 7],
      [2, 3],
      [1, 5],
    ],
    [],
    0.82,
  );
  // Algumas reclamações respondidas nos últimos 30 dias e uma de 1 estrela
  // sem resposta há 4 dias (alerta "sem resposta há mais de 2 dias").
  const s0 = sorteio(`arp-recentes:${hoje}`);
  arp.push(montar("arp", somarDias(hoje, -12), 7, 2, s0, 1, "Estacionamento"));
  arp.push(montar("arp", somarDias(hoje, -20), 8, 1, s0, 1, "Sinalização"));
  const semResposta = montar(
    "arp",
    somarDias(hoje, -4),
    9,
    1,
    s0,
    0,
    "Estacionamento",
  );
  arp.push(semResposta);
  out.avaliacoes.push(...arp);
  out.locais.push({
    id: "arp",
    title: "Espaço ARP",
    averageRating: 4.6,
    totalReviewCount: 2_846 + arp.length,
    mapsUri: "https://maps.google.com/?cid=1000",
  });

  const ordenados = [...locatarios].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
  ordenados.forEach((l, pos) => {
    if (l.forma_acesso === "sem_acesso") return;
    const s = sorteio(`loc:${l.nome}`);
    const forcadas =
      pos === 0
        ? [
            { dias: 3, tema: "Atendimento" },
            { dias: 9, tema: "Atendimento" },
            { dias: 17, tema: "Atendimento" },
            { dias: 26, tema: "Limpeza" },
          ]
        : pos === 4
          ? [
              { dias: 6, tema: "Estacionamento" },
              { dias: 21, tema: "Atendimento" },
            ]
          : pos === 9
            ? [{ dias: 14, tema: "Sinalização" }]
            : [];
    const boa = s.perto(0.7, 0.15);
    const lista = avaliacoesDe(
      l.id,
      s.perto(6, 0.6),
      [
        [5, boa * 100],
        [4, 18],
        [3, 6],
        [2, 3],
        [1, 4],
      ],
      forcadas,
      s.perto(0.55, 0.4),
    );
    const parcial = l.forma_acesso === "consulta_publica";
    const media =
      lista.reduce((t, a) => t + ESTRELAS.indexOf(a.starRating) + 1, 0) /
      Math.max(lista.length, 1);
    out.locais.push({
      id: l.id,
      title: l.nome,
      averageRating: arred(Math.min(5, media + s.perto(0.05, 1)), 1),
      totalReviewCount: lista.length + s.int(40, 300),
      mapsUri: l.perfil_url ?? "https://maps.google.com",
    });
    // Consulta pública: só 5 avaliações, sem garantia de serem as mais novas.
    out.avaliacoes.push(
      ...(parcial
        ? lista
            .filter(
              (_, k) => k % Math.max(1, Math.floor(lista.length / 5)) === 0,
            )
            .slice(0, 5)
        : lista),
    );
  });
  return out;
}
