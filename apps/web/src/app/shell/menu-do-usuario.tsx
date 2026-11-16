import { iniciais } from "@arp/shared/formato";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut } from "lucide-react";
import { useState } from "react";
import { sair, useSessao } from "@/lib/sessao";
import { consultaDosAvisos } from "@/modules/shell/api";
import { AlternarTema } from "./alternar-tema";
import { Notificacoes } from "./notificacoes";
import { useSecoes } from "./secoes";
import { SidebarNav } from "./sidebar-nav";

/**
 * Menu com só o que o usuário pode ver, notificações, tema e o cartão dele.
 * Lê a sessão. O menu sai assim que a sessão chega; as pendências do sino
 * vêm da API e chegam depois, sem segurar o resto.
 */
export function MenuDoUsuario() {
  const { usuario } = useSessao();
  const sections = useSecoes();
  const [saindo, setSaindo] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.length > 0 ? (
          <SidebarNav sections={sections} />
        ) : (
          <p className="px-3 text-sm text-neutral-500">
            Nenhuma tela liberada para você ainda.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div
          data-guia="avisos"
          className="flex items-center gap-2 rounded-2xl bg-neutral-100 p-1.5"
        >
          <AlternarTema />
          <SinoDoUsuario />
        </div>

        <div className="flex items-center gap-3 px-1">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
            {iniciais(usuario.nome)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {usuario.nome}
            </span>
            <span className="block truncate text-xs text-neutral-500">
              {usuario.email}
            </span>
          </span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (saindo) return;
              setSaindo(true);
              void sair();
            }}
          >
            <button
              type="submit"
              aria-label="Sair"
              title="Sair"
              className="grid size-9 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-500">
          Desenvolvido por{" "}
          <a
            href="https://scaleia.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-[#8b5cf6] to-[#4f46e5] bg-clip-text font-semibold text-transparent underline-offset-2 hover:underline hover:decoration-[#6d5ce7]"
          >
            Scale
          </a>
        </p>
      </div>
    </div>
  );
}

function SinoDoUsuario() {
  const { data: avisos, isPending } = useQuery(consultaDosAvisos);
  if (isPending) return <SinoCarregando />;
  // Sem resposta dos avisos, o sino abre só com as notificações.
  return <Notificacoes avisos={avisos ?? []} />;
}

/** No lugar do sino enquanto as pendências chegam (mesmo tamanho). */
function SinoCarregando() {
  return (
    <span
      aria-hidden
      className="grid size-10 place-items-center rounded-xl bg-white text-neutral-400 shadow-sm ring-1 ring-black/5"
    >
      <Bell className="size-4" />
    </span>
  );
}
