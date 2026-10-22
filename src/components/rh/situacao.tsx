import { ROTULO_SITUACAO, type Situacao } from "@/lib/rh/funcionarios";

// Cor do ponto ao lado do texto (o texto vem sempre junto).
const COR: Record<Situacao, string> = {
  ativo: "#0ca30c",
  afastado: "#fab219",
  a_admitir: "#3b82f6",
  desligado: "#a3a3a3",
  fora_do_copiloto: "#a3a3a3",
};

export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-900/[0.06] px-2.5 py-1 text-xs font-medium text-neutral-700">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: COR[situacao] }}
      />
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}
