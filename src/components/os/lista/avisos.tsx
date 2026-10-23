"use client";

import { CircleCheck, CircleX, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// Retorno das alterações rápidas (lista, quadro, calendário): uma faixa no
// rodapé, que some sozinha no sucesso e fica até fechar no erro (o banco
// recusou e a pessoa precisa ler o motivo).

export interface Aviso {
  tipo: "ok" | "erro";
  texto: string;
}

const Contexto = createContext<((a: Aviso) => void) | null>(null);

/** Mostra um aviso no rodapé; fora do provedor, não faz nada. */
export function useAvisar(): (a: Aviso) => void {
  return useContext(Contexto) ?? (() => undefined);
}

const SOME_MS = 3500;

export function ProvedorAvisos({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<(Aviso & { n: number }) | null>(null);
  const [montado, setMontado] = useState(false);
  const contador = useRef(0);
  useEffect(() => setMontado(true), []);

  const avisar = useCallback((a: Aviso) => {
    contador.current++;
    setAviso({ ...a, n: contador.current });
  }, []);

  useEffect(() => {
    if (aviso?.tipo !== "ok") return;
    const t = setTimeout(() => setAviso(null), SOME_MS);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <Contexto value={avisar}>
      {children}
      {montado &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
            {aviso && (
              <div
                key={aviso.n}
                role={aviso.tipo === "erro" ? "alert" : "status"}
                className={`aviso-entrar pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-[0_20px_40px_-16px_rgb(0_0_0/0.45)] ${aviso.tipo === "erro" ? "bg-red-600 text-[#fff]" : "fume"}`}
              >
                {aviso.tipo === "erro" ? (
                  <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <CircleCheck
                    className="mt-0.5 size-4 shrink-0 text-marca"
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1">{aviso.texto}</span>
                <button
                  type="button"
                  onClick={() => setAviso(null)}
                  aria-label="Fechar aviso"
                  className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full opacity-80 transition hover:bg-white/15 hover:opacity-100"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </Contexto>
  );
}
