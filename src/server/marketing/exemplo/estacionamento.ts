import type { Passagem } from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import { sorteio } from "./sorteio";

// Passagens de exemplo do estacionamento (WPS), nos campos esperados (a
// confirmar com o WPS): placa, entrada, saída e cancela. ~260 carros num dia
// de semana, ~760 no sábado, mais nos dias com evento do calendário. Uma
// parte das placas volta (frequentadores), o que forma a recorrência. As
// placas são inventadas e nunca saem do servidor.

/** Dias de passagens: 16 semanas da tela + 30 de janela da recorrência. */
export const DIAS_ESTACIONAMENTO = 16 * 7 + 30;

const LETRAS = "ABCDEFGHJKLMNPRSTUVWXYZ";
function placa(n: number): string {
  const l = (k: number) =>
    LETRAS[Math.floor(n / LETRAS.length ** k) % LETRAS.length];
  return `${l(0)}${l(1)}${l(2)}${n % 10}${l(3)}${Math.floor(n / 7) % 10}${Math.floor(n / 13) % 10}`;
}

/** Peso de cada hora de entrada (7h às 23h). */
const HORAS_SEMANA = [
  0, 0, 0, 0, 0, 0, 0, 2, 5, 7, 8, 9, 11, 10, 7, 7, 8, 10, 12, 11, 8, 5, 3, 1,
];
const HORAS_FDS = [
  0, 0, 0, 0, 0, 0, 0, 1, 3, 6, 10, 13, 14, 13, 12, 11, 10, 10, 11, 10, 8, 5, 3,
  1,
];

export function gerarPassagens(hoje: string, eventos: Set<string>): Passagem[] {
  const passagens: Passagem[] = [];
  const pesos = (lista: number[]) =>
    lista.map((p, h) => [h, p] as const).filter(([, p]) => p > 0);
  const semana = pesos(HORAS_SEMANA);
  const fds = pesos(HORAS_FDS);
  // Frequentadores: 1.400 placas que voltam com alguma frequência.
  const FREQUENTES = 1_400;
  let novas = 100_000;

  for (let i = DIAS_ESTACIONAMENTO; i >= 1; i--) {
    const data = somarDias(hoje, -i);
    const d = diaDaSemana(data);
    const s = sorteio(`wps:${data}`);
    const evento = eventos.has(data);
    const base = d === 6 ? 760 : d === 0 ? 620 : d === 5 ? 340 : 260;
    const total = Math.round(s.perto(base * (evento ? 1.25 : 1), 0.1));
    const horas = d === 0 || d === 6 ? fds : semana;
    for (let k = 0; k < total; k++) {
      const h = s.pesada(
        evento && s.chance(0.25)
          ? ([
              [19, 3],
              [20, 3],
              [18, 2],
              [21, 1],
            ] as const)
          : horas,
      );
      const m = s.int(0, 59);
      const frequente = s.chance(0.42);
      const n = frequente ? Math.floor(s.n() ** 1.8 * FREQUENTES) : novas++;
      const permanencia = Math.round(
        Math.min(
          600,
          25 +
            -Math.log(1 - s.n()) *
              (evento ? 120 : d === 0 || d === 6 ? 100 : 75),
        ),
      );
      const fim = h * 60 + m + permanencia;
      const saida =
        fim >= 24 * 60
          ? `${somarDias(data, 1)}T${String(Math.floor((fim - 1440) / 60)).padStart(2, "0")}:${String((fim - 1440) % 60).padStart(2, "0")}`
          : `${data}T${String(Math.floor(fim / 60)).padStart(2, "0")}:${String(fim % 60).padStart(2, "0")}`;
      passagens.push({
        placa: placa(n),
        entrada: `${data}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        saida,
        cancela: s.chance(0.62)
          ? "Entrada Rua do Relógio"
          : "Entrada Av. Alberto Braune",
      });
    }
  }
  return passagens;
}
