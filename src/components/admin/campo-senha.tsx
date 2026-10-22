"use client";

import { Check, Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { classeCampo } from "@/components/estilos";

const ALFABETO =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";

/** Senha forte de 16 caracteres, gerada no navegador. */
function gerar(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

/** Campo de senha com "mostrar", "gerar senha forte" e "copiar". */
export function CampoSenha({
  name = "senha",
  rotulo = "Senha inicial",
  ajuda = "Mínimo de 10 caracteres. Passe a senha ao usuário por um canal seguro.",
  gerarAoAbrir = false,
}: {
  name?: string;
  rotulo?: string;
  ajuda?: string;
  /** Já abre com uma senha gerada (só no navegador, depois de montar). */
  gerarAoAbrir?: boolean;
}) {
  const [valor, setValor] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [copiada, setCopiada] = useState(false);
  useEffect(() => {
    if (!gerarAoAbrir) return;
    setValor(gerar());
    setVisivel(true);
  }, [gerarAoAbrir]);
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
      <label htmlFor={`campo-${name}`}>{rotulo}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={`campo-${name}`}
            name={name}
            type={visivel ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={72}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={`${classeCampo} pr-10 font-mono`}
          />
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-2 grid place-items-center px-1 text-neutral-400 hover:text-neutral-900"
          >
            {visivel ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setValor(gerar());
            setVisivel(true);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 transition hover:border-neutral-400"
        >
          <Wand2 className="size-4" aria-hidden />
          Gerar
        </button>
        <button
          type="button"
          disabled={!valor}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(valor);
              setCopiada(true);
              setTimeout(() => setCopiada(false), 2000);
            } catch {
              // Sem acesso à área de transferência: a senha está visível.
              setVisivel(true);
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 transition hover:border-neutral-400 disabled:opacity-50"
        >
          {copiada ? (
            <Check className="size-4 text-green-700" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copiada ? "Copiada" : "Copiar"}
        </button>
      </div>
      <span className="font-normal text-neutral-400">{ajuda}</span>
    </div>
  );
}
