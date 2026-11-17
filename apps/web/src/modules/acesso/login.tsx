import { entradaEntrar } from "@arp/shared/contratos/auth";
import { destinoSeguro } from "@arp/shared/destino-seguro";
import { useActionState, useState } from "react";
import { TelaDeAcesso } from "@/components/tela-de-acesso";
import { INICIO } from "@/config/navigation";
import { mensagemDoErro } from "@/lib/api";
import { useParametrosDeBusca, useTitulo } from "@/lib/navegacao";
import { entrar as entrarNoSistema, SoSemSessao } from "@/lib/sessao";

interface EstadoLogin {
  erro?: string;
  email?: string;
}

/**
 * Confere o e-mail e a senha na API. Dando certo, guarda a sessão: a guarda
 * da tela (SoSemSessao) leva a pessoa para o destino.
 */
async function entrar(
  _anterior: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim();
  const dados = entradaEntrar.safeParse({ email, senha: form.get("senha") });
  if (!dados.success)
    return { erro: "Informe um e-mail válido e a senha.", email };
  try {
    await entrarNoSistema(dados.data);
    return { email };
  } catch (erro) {
    return { erro: mensagemDoErro(erro), email };
  }
}

const campo =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5";

function LoginForm({ expirou }: { expirou: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(
    entrar,
    {},
  );
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.email}
          placeholder="nome@arp.com.br"
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Senha</span>
        <span className="relative">
          <input
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${campo} pr-20`}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {mostrarSenha ? "Ocultar" : "Mostrar"}
          </button>
        </span>
      </label>

      {expirou && !estado.erro && (
        <output className="block rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sua sessão expirou. Entre de novo para continuar.
        </output>
      )}

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
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function Login() {
  useTitulo("Entrar");
  const params = useParametrosDeBusca();
  // "next" era o nome do parâmetro no sistema antigo (links já enviados).
  const destino = destinoSeguro(
    params.get("destino") ?? params.get("next"),
    INICIO,
  );
  return (
    <SoSemSessao inicio={destino}>
      <TelaDeAcesso
        titulo="Bem-vindo de volta"
        subtitulo="Entre com seu e-mail e senha para continuar."
      >
        <LoginForm expirou={params.get("motivo") === "expirou"} />
      </TelaDeAcesso>
    </SoSemSessao>
  );
}
