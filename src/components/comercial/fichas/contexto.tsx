"use client";

import { createContext, use } from "react";
import type { RespostasFicha } from "@/lib/comercial/ficha";

export type Caminho = string;

interface Contexto {
  r: RespostasFicha;
  definir: (caminho: Caminho, valor: unknown) => void;
  erros: Record<string, string>;
  hoje: string;
  /** Link da ficha (as consultas de CEP e CNPJ sem login pedem o token). */
  token: string | null;
}

export const Ctx = createContext<Contexto | null>(null);
export const useFicha = () => {
  const c = use(Ctx);
  if (!c) throw new Error("campo fora da ficha");
  return c;
};

export function ler(obj: unknown, caminho: Caminho): unknown {
  return caminho
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

export function com<T>(obj: T, caminho: string[], valor: unknown): T {
  const [k, ...resto] = caminho;
  if (k === undefined)
    return (typeof valor === "function" ? valor(obj) : valor) as T;
  if (Array.isArray(obj)) {
    const copia = [...obj];
    copia[Number(k)] = com(copia[Number(k)], resto, valor);
    return copia as T;
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  return { ...o, [k]: com(o[k], resto, valor) } as T;
}

export const idDo = (caminho: Caminho) =>
  `campo-${caminho.normalize("NFD").replace(/[^A-Za-z0-9_]+/g, "-")}`;
export const alta = (v: string) => v.toLocaleUpperCase("pt-BR");

export function mascara(digitos: string, molde: string): string {
  let i = 0;
  let s = "";
  for (const c of molde) {
    if (i >= digitos.length) break;
    s += c === "0" ? digitos[i++] : c;
  }
  return s;
}
export const mascaraTelefone = (d: string) =>
  mascara(d, d.length > 10 ? "(00) 00000-0000" : "(00) 0000-00000");
