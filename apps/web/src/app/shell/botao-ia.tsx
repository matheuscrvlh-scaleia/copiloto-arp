import { Sparkles } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { usePermissao } from "@/lib/sessao";

// Botão da IA ARP no cabeçalho de toda tela (quem tem `ia.usar`). O painel
// do chat é baixado no primeiro clique e fica montado depois de fechado:
// reabrir mostra a mesma conversa.

const Assistente = lazy(() => import("@/modules/ia/components/assistente"));

export function BotaoIa() {
  const pode = usePermissao("ia.usar");
  const [aberto, setAberto] = useState(false);
  const [usado, setUsado] = useState(false);
  if (!pode) return null;
  return (
    <>
      <button
        type="button"
        data-guia="ia"
        onClick={() => {
          setUsado(true);
          setAberto((a) => !a);
        }}
        aria-expanded={aberto}
        title="IA ARP: pergunte sobre os dados do sistema"
        className="vidro flex shrink-0 items-center gap-2 rounded-full p-1.5 text-sm font-medium text-neutral-700 transition hover:text-neutral-900 sm:pr-4"
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#58c069] to-[#2f7d3d] text-[#ffffff]">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <span className="sr-only sm:not-sr-only">IA ARP</span>
      </button>
      {usado && (
        <Suspense fallback={null}>
          <Assistente aberto={aberto} aoFechar={() => setAberto(false)} />
        </Suspense>
      )}
    </>
  );
}
