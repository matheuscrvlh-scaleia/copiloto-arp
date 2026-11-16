// Lançar ronda (spec 4.6): o que vira linha, quais coletores abrem chamado de
// recolhimento e a mensagem final. Regras puras; a gravação fica em
// src/server/sustentabilidade/acoes/rondas.ts.

import { z } from "zod";
import { formatarNumero } from "@/lib/formato";
import { type CorColetor, coletoresCheios, type ItemRonda } from "./rondas";

/** Botões da tela: 0 a 100, de 10 em 10. */
export const PASSOS_OCUPACAO: readonly number[] = Array.from(
  { length: 11 },
  (_, i) => i * 10,
);

export const ROTULO_COR: Record<CorColetor, string> = {
  preto: "preto (não reciclável)",
  azul: "azul (reciclável)",
};

/** Foto de coletor ou da ronda: até 12 MB. */
export const FOTO_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Confere pelo começo do arquivo (16 bytes) se é uma foto: JPEG, PNG, WebP ou
 * HEIC/HEIF (o que o celular manda). Não confia no tipo que o navegador disse.
 */
export function ehImagem(inicio: Uint8Array): boolean {
  const b = (i: number) => inicio[i] ?? -1;
  const texto = (de: number, ate: number) =>
    String.fromCharCode(...Array.from(inicio.slice(de, ate)));
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return true;
  if (b(0) === 0x89 && texto(1, 4) === "PNG") return true;
  if (texto(0, 4) === "RIFF" && texto(8, 12) === "WEBP") return true;
  return (
    texto(4, 8) === "ftyp" &&
    ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(
      texto(8, 12),
    )
  );
}

const texto = (max: number) => z.string().trim().max(max).nullish();

export const esquemaItemDaRonda = z.object({
  coletorId: z.uuid("Coletor inválido."),
  conteineres: z
    .number("Informe a quantidade de contêineres.")
    .int("Contêineres: use um número inteiro.")
    .min(0, "Contêineres não pode ser negativo.")
    .max(999, "Contêineres: número alto demais."),
  /** null = coletor não visitado (fica em branco, nunca vira zero). */
  ocupacaoPct: z
    .number()
    .int()
    .min(0)
    .max(100)
    .refine((v) => v % 10 === 0, "A ocupação vai de 10 em 10.")
    .nullable(),
  observacao: texto(1000),
  foto: z.string().max(400).nullish(),
});

export const esquemaRonda = z.object({
  itens: z.array(esquemaItemDaRonda).max(200),
  observacao: texto(1000),
  foto: z.string().max(400).nullish(),
});

export type ItemDaRonda = z.infer<typeof esquemaItemDaRonda>;
export type EntradaDaRonda = z.infer<typeof esquemaRonda>;
export type ItemLancado = ItemDaRonda & { ocupacaoPct: number };

/** Só o coletor com ocupação informada vira linha: em branco não grava (não é zero). */
export function itensLancados(itens: readonly ItemDaRonda[]): ItemLancado[] {
  const vistos = new Set<string>();
  const lancados: ItemLancado[] = [];
  for (const i of itens) {
    if (i.ocupacaoPct === null || vistos.has(i.coletorId)) continue;
    vistos.add(i.coletorId);
    lancados.push({ ...i, ocupacaoPct: i.ocupacaoPct });
  }
  return lancados;
}

export interface ColetorDaRonda {
  id: string;
  local: string;
  cor: CorColetor;
}

export interface RecolhimentoAAbrir {
  coletorId: string;
  /** "recolhimento:<ronda>:<coletor>": acha o chamado depois. */
  origemRef: string;
  titulo: string;
  descricao: string;
  ocupacaoPct: number;
}

/**
 * Um chamado de recolhimento para cada coletor lançado com ocupação no
 * limite ou acima (limite dos Parâmetros). `quando` já vem escrito
 * ("16/11/2026 às 09:30"). Coletor desconhecido é ignorado.
 */
export function recolhimentosAAbrir(p: {
  itens: readonly ItemLancado[];
  coletores: readonly ColetorDaRonda[];
  limitePct: number;
  rondaId: string;
  quando: string;
}): RecolhimentoAAbrir[] {
  const porId = new Map(p.coletores.map((c) => [c.id, c]));
  const itens: ItemRonda[] = p.itens.flatMap((i) => {
    const c = porId.get(i.coletorId);
    return c
      ? [
          {
            coletorId: c.id,
            cor: c.cor,
            conteineres: i.conteineres,
            ocupacaoPct: i.ocupacaoPct,
          },
        ]
      : [];
  });
  const conteineres = new Map(p.itens.map((i) => [i.coletorId, i.conteineres]));
  return coletoresCheios(itens, p.limitePct).flatMap((i) => {
    const c = porId.get(i.coletorId);
    if (!c) return [];
    const n = conteineres.get(c.id) ?? 0;
    return [
      {
        coletorId: c.id,
        origemRef: `recolhimento:${p.rondaId}:${c.id}`,
        titulo: `Recolhimento de coletor: ${c.local} (${c.cor})`,
        descricao: [
          `Local: ${c.local}`,
          `Cor: ${ROTULO_COR[c.cor]}`,
          `Ocupação: ${formatarNumero(i.ocupacaoPct)}% (limite de ${formatarNumero(p.limitePct)}%), na ronda de ${p.quando}`,
          `Contêineres encontrados: ${formatarNumero(n)}`,
          "Acionar a empresa de coleta e fechar este chamado quando o coletor for recolhido.",
        ].join("\n"),
        ocupacaoPct: i.ocupacaoPct,
      },
    ];
  });
}

const plural = (n: number, um: string, varios: string) =>
  `${formatarNumero(n)} ${n === 1 ? um : varios}`;

/** Mensagem depois de salvar: quantos lançados, chamado da semana e recolhimentos. */
export function mensagemDaRonda(p: {
  lancados: number;
  chamadoFechado: boolean;
  recolhimentosAbertos: number;
  /** Coletores no limite que ficaram sem chamado (sem setor nos Parâmetros). */
  recolhimentosSemSetor?: number;
  /** Falhas ao abrir o chamado de recolhimento (a ronda foi salva). */
  recolhimentosComFalha?: number;
}): string {
  const partes = [
    `Ronda salva: ${plural(p.lancados, "coletor lançado", "coletores lançados")}.`,
    p.chamadoFechado
      ? "Chamado da semana fechado."
      : "Não havia chamado da ronda em aberto.",
  ];
  if (p.recolhimentosAbertos)
    partes.push(
      `${plural(p.recolhimentosAbertos, "chamado de recolhimento aberto", "chamados de recolhimento abertos")}.`,
    );
  if (p.recolhimentosSemSetor)
    partes.push(
      `${plural(p.recolhimentosSemSetor, "coletor passou", "coletores passaram")} do limite, mas os Parâmetros não dizem quem recebe o recolhimento: abra o chamado à mão.`,
    );
  if (p.recolhimentosComFalha)
    partes.push(
      `Não foi possível abrir ${plural(p.recolhimentosComFalha, "chamado de recolhimento", "chamados de recolhimento")}: abra à mão.`,
    );
  return partes.join(" ");
}
