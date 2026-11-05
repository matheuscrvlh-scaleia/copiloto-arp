import { Bell, LogOut } from "lucide-react";
import { Suspense } from "react";
import { iniciais } from "@/lib/formato";
import { sair } from "@/server/acesso/acoes/login";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { avisosDo } from "@/server/avisos";
import { AlternarTema } from "./alternar-tema";
import { Notificacoes } from "./notificacoes";
import { secoesDo } from "./secoes";
import { SidebarNav } from "./sidebar-nav";

/**
 * Menu com só o que o usuário pode ver, notificações, tema e o cartão dele.
 * Lê a sessão. O menu sai assim que o perfil chega (cache); as pendências
 * do sino vêm do banco e chegam no próprio <Suspense>.
 */
export async function MenuDoUsuario() {
  const usuario = await usuarioAtual();
  const sections = secoesDo(usuario);

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
          <Suspense fallback={<SinoCarregando />}>
            <SinoDoUsuario usuario={usuario} />
          </Suspense>
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
          <form action={sair}>
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

async function SinoDoUsuario({ usuario }: { usuario: Usuario }) {
  return <Notificacoes avisos={await avisosDo(usuario)} />;
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
