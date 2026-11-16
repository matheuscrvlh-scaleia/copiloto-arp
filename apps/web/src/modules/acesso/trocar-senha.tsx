import {
  entradaTrocarSenha,
  respostaMensagem,
  SENHA_MAXIMO,
  SENHA_MINIMO,
} from "@arp/shared/contratos/auth";
import { useActionState, useState } from "react";
import { TelaDeAcesso } from "@/components/tela-de-acesso";
import { api, mensagemDoErro } from "@/lib/api";
import { useTitulo } from "@/lib/navegacao";
import { atualizarSessao, sair } from "@/lib/sessao";

interface EstadoTroca {
  erro?: string;
}

/**
 * Troca a senha provisória pela da pessoa. Dando certo, pergunta de novo à
 * API quem está logado: sem a marca de provisória, a guarda da rota leva
 * para o início.
 */
async function definirSenha(
  _anterior: EstadoTroca,
  form: FormData,
): Promise<EstadoTroca> {
  const d = entradaTrocarSenha.safeParse({
    senha: form.get("senha"),
    confirmacao: form.get("confirmacao"),
  });
  if (!d.success) return { erro: d.error.issues[0]?.message };
  try {
    await api.post("/auth/trocar-senha", d.data, {
      esquema: respostaMensagem,
    });
    await atualizarSessao();
    return {};
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

const campo =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5";

function FormTrocarSenha() {
  const [estado, acao, enviando] = useActionState<EstadoTroca, FormData>(
    definirSenha,
    {},
  );
  const [mostrar, setMostrar] = useState(false);
  const tipo = mostrar ? "text" : "password";

  return (
    <form action={acao} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Nova senha</span>
        <span className="relative">
          <input
            name="senha"
            type={tipo}
            autoComplete="new-password"
            required
            minLength={SENHA_MINIMO}
            maxLength={SENHA_MAXIMO}
            className={`${campo} pr-20`}
          />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {mostrar ? "Ocultar" : "Mostrar"}
          </button>
        </span>
        <span className="text-xs text-neutral-400">
          Mínimo de 10 caracteres. Misture letras, números e símbolos.
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Repita a nova senha</span>
        <input
          name="confirmacao"
          type={tipo}
          autoComplete="new-password"
          required
          className={campo}
        />
      </label>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? "Salvando…" : "Definir senha e entrar"}
      </button>
    </form>
  );
}

/** Primeiro acesso (ou senha trocada pelo administrador): a guarda da rota traz para cá. */
export default function TrocarSenha() {
  useTitulo("Definir senha");
  return (
    <TelaDeAcesso
      titulo="Defina a sua senha"
      subtitulo="Você entrou com uma senha provisória. Escolha uma senha só sua para continuar."
    >
      <FormTrocarSenha />
      <form
        className="mt-4 text-center"
        onSubmit={(e) => {
          e.preventDefault();
          void sair();
        }}
      >
        <button
          type="submit"
          className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          Sair
        </button>
      </form>
    </TelaDeAcesso>
  );
}
