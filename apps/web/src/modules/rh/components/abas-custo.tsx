import { Abas } from "@/components/abas";
import { useSearchParams } from "@/lib/navegacao";

const RAIZ = "/rh/custo-de-pessoal";

/** Dashboard e Comparação; a competência e o departamento vão junto. */
export function AbasDoCusto() {
  const params = useSearchParams();
  const comum = new URLSearchParams();
  for (const nome of ["mes", "dep"]) {
    const v = params.get(nome);
    if (v) comum.set(nome, v);
  }
  const comparar = params.get("comparar");
  const com = (href: string, extra?: string | null) => {
    const q = new URLSearchParams(comum);
    if (extra) q.set("comparar", extra);
    const s = q.toString();
    return s ? `${href}?${s}` : href;
  };
  return (
    <Abas
      rotulo="Telas do custo de pessoal"
      abas={[
        { href: com(RAIZ), rotulo: "Dashboard" },
        { href: com(`${RAIZ}/comparacao`, comparar), rotulo: "Comparação" },
      ]}
    />
  );
}
