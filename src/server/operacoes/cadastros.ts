import "server-only";
import { cache } from "react";
import { lerTudo } from "@/server/supabase-paginas";
import { op } from "./base";

// Cadastros de Operações (tela /operacoes/cadastros e escolha do hidrômetro
// na importação), com a sessão: o RLS decide quem vê cada lista.

export interface HidrometroCadastrado {
  id: string;
  numero: string;
  bloco: string;
  sala: string;
  sala_id: string | null;
  salaCodigo: string | null;
  descricao: string | null;
  observacoes: string | null;
  ativo: boolean;
  exemplo: boolean;
  /** Mês (AAAA-MM-01) da leitura mais recente que vale, se houver. */
  ultimaLeitura: string | null;
  meses: number;
}

export const hidrometrosCadastrados = cache(
  async (): Promise<HidrometroCadastrado[]> => {
    const db = await op();
    const [hidrometros, leituras] = await Promise.all([
      lerTudo(() =>
        db
          .from("hidrometros")
          .select(
            "id, numero, bloco, sala, sala_id, descricao, observacoes, ativo, exemplo, salas(codigo)",
          )
          .order("bloco")
          .order("numero"),
      ),
      lerTudo(() =>
        db
          .from("agua_leituras")
          .select("hidrometro, referencia")
          .eq("vigente", true)
          .order("id"),
      ),
    ]);
    const porNumero = new Map<string, { ultima: string; meses: number }>();
    for (const l of leituras) {
      const a = porNumero.get(l.hidrometro);
      if (!a) porNumero.set(l.hidrometro, { ultima: l.referencia, meses: 1 });
      else {
        a.meses++;
        if (l.referencia > a.ultima) a.ultima = l.referencia;
      }
    }
    return hidrometros.map(({ salas, ...h }) => ({
      ...h,
      salaCodigo: salas?.codigo ?? null,
      ultimaLeitura: porNumero.get(h.numero)?.ultima ?? null,
      meses: porNumero.get(h.numero)?.meses ?? 0,
    }));
  },
);

export const salasCadastradas = cache(async () => {
  const db = await op();
  const [salas, caixas] = await Promise.all([
    lerTudo(() =>
      db
        .from("salas")
        .select(
          "id, codigo, bloco, sala, pavimento, armario, projeto, disjuntor, rota, observacoes, exemplo",
        )
        .order("codigo"),
    ),
    lerTudo(() =>
      db
        .from("caixas")
        .select("sala_id")
        .not("sala_id", "is", null)
        .order("id"),
    ),
  ]);
  const nCaixas = new Map<string, number>();
  for (const c of caixas)
    if (c.sala_id) nCaixas.set(c.sala_id, (nCaixas.get(c.sala_id) ?? 0) + 1);
  return salas.map((s) => ({ ...s, caixas: nCaixas.get(s.id) ?? 0 }));
});
export type SalaCadastrada = Awaited<
  ReturnType<typeof salasCadastradas>
>[number];
