"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { cnpjValido, cpfValido, soDigitos, UFS } from "@/lib/documentos";
import { formatarNumero, lerValorBr } from "@/lib/formato";
import { consultarCep } from "@/server/comercial/consultas";
import {
  alta,
  type Caminho,
  idDo,
  ler,
  mascara,
  mascaraTelefone,
  useFicha,
} from "./contexto";

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

function Rotulo({
  n,
  rotulo,
  obrigatoria,
  htmlFor,
}: {
  n?: number;
  rotulo: string;
  obrigatoria: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-800">
      {n !== undefined && <span className="text-neutral-400">{n}. </span>}
      {rotulo}
      {obrigatoria && (
        <span className="text-red-600" aria-hidden>
          {" "}
          *
        </span>
      )}
    </label>
  );
}

export function Erro({ caminho }: { caminho: Caminho }) {
  const { erros } = useFicha();
  const e = erros[caminho];
  if (!e) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-700" role="alert">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden />
      {e}
    </p>
  );
}

interface PropsCampo {
  n?: number;
  rotulo: string;
  caminho: Caminho;
  obrigatoria?: boolean;
  dica?: string;
  className?: string;
}

function Campo({
  n,
  rotulo,
  caminho,
  obrigatoria = true,
  dica,
  className = "",
  children,
}: PropsCampo & { children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <Rotulo
        n={n}
        rotulo={rotulo}
        obrigatoria={obrigatoria}
        htmlFor={idDo(caminho)}
      />
      {children}
      {dica && <p className="text-xs text-neutral-500">{dica}</p>}
      <Erro caminho={caminho} />
    </div>
  );
}

const classe = (erro: boolean) =>
  `${classeCampo} ${erro ? "border-red-400 focus:border-red-600" : ""}`;

export function Texto(
  p: PropsCampo & {
    max?: number;
    placeholder?: string;
    email?: boolean;
    aoSair?: (v: string) => void;
    desligado?: boolean;
  },
) {
  const { r, definir, erros } = useFicha();
  const v = String(ler(r, p.caminho) ?? "");
  return (
    <Campo {...p}>
      <input
        id={idDo(p.caminho)}
        type={p.email ? "email" : "text"}
        inputMode={p.email ? "email" : undefined}
        autoCapitalize={p.email ? "none" : "characters"}
        value={v}
        maxLength={p.max ?? 150}
        placeholder={p.placeholder}
        disabled={p.desligado}
        aria-invalid={!!erros[p.caminho]}
        onChange={(e) =>
          definir(
            p.caminho,
            p.email ? e.target.value.toLowerCase() : alta(e.target.value),
          )
        }
        onBlur={(e) => p.aoSair?.(e.target.value)}
        className={classe(!!erros[p.caminho])}
      />
    </Campo>
  );
}

export function Digitos(
  p: PropsCampo & {
    tipo: "cpf" | "cnpj" | "cep" | "telefone";
    aoCompletar?: (d: string) => void;
  },
) {
  const { r, definir, erros } = useFicha();
  const d = String(ler(r, p.caminho) ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const max = { cpf: 11, cnpj: 14, cep: 8, telefone: 11 }[p.tipo];
  const mostrado =
    p.tipo === "cpf"
      ? mascara(d, "000.000.000-00")
      : p.tipo === "cnpj"
        ? mascara(d, "00.000.000/0000-00")
        : p.tipo === "cep"
          ? mascara(d, "00000-000")
          : mascaraTelefone(d);
  function sair() {
    if (!d) return setAviso(null);
    if (p.tipo === "cpf")
      setAviso(
        d.length === 11 && cpfValido(d)
          ? null
          : "CPF com número errado. Confira os 11 dígitos.",
      );
    else if (p.tipo === "cnpj")
      setAviso(
        d.length === 14 && cnpjValido(d)
          ? null
          : "CNPJ com número errado. Confira os 14 dígitos.",
      );
    else if (p.tipo === "telefone")
      setAviso(d.length >= 10 ? null : "Telefone com DDD: 10 ou 11 números.");
    else setAviso(d.length === 8 ? null : "CEP com 8 números.");
    if (d.length === max) p.aoCompletar?.(d);
  }
  return (
    <Campo {...p}>
      <input
        id={idDo(p.caminho)}
        type="text"
        inputMode={p.tipo === "telefone" ? "tel" : "numeric"}
        autoComplete={
          p.tipo === "cep"
            ? "postal-code"
            : p.tipo === "telefone"
              ? "tel"
              : "off"
        }
        value={mostrado}
        placeholder={
          {
            cpf: "000.000.000-00",
            cnpj: "00.000.000/0000-00",
            cep: "00000-000",
            telefone: "(00) 00000-0000",
          }[p.tipo]
        }
        aria-invalid={!!erros[p.caminho] || !!aviso}
        onChange={(e) =>
          definir(p.caminho, soDigitos(e.target.value).slice(0, max))
        }
        onBlur={sair}
        className={classe(!!erros[p.caminho] || !!aviso)}
      />
      {aviso && !erros[p.caminho] && (
        <p className="text-xs text-amber-700">{aviso}</p>
      )}
    </Campo>
  );
}

export function Data(p: PropsCampo & { passado?: boolean }) {
  const { r, definir, erros, hoje } = useFicha();
  return (
    <Campo {...p}>
      <input
        id={idDo(p.caminho)}
        type="date"
        value={String(ler(r, p.caminho) ?? "")}
        max={p.passado ? hoje : undefined}
        aria-invalid={!!erros[p.caminho]}
        onChange={(e) => definir(p.caminho, e.target.value)}
        className={classe(!!erros[p.caminho])}
      />
    </Campo>
  );
}

export function Valor(p: PropsCampo) {
  const { r, definir, erros } = useFicha();
  const atual = ler(r, p.caminho) as number | null;
  const [texto, setTexto] = useState(
    atual === null ? "" : formatarNumero(atual, 2),
  );
  const [invalido, setInvalido] = useState(false);
  // O valor pode mudar por fora (a consulta do CNPJ preenche o capital).
  useEffect(() => {
    setTexto(atual === null ? "" : formatarNumero(atual, 2));
  }, [atual]);
  return (
    <Campo {...p} dica={p.dica ?? "Em reais, ex.: 5.000,00"}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-neutral-400">
          R$
        </span>
        <input
          id={idDo(p.caminho)}
          type="text"
          inputMode="decimal"
          value={texto}
          aria-invalid={!!erros[p.caminho] || invalido}
          onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))}
          onBlur={() => {
            const v = lerValorBr(texto);
            const ok = v === null || (Number.isFinite(v) && v >= 0);
            setInvalido(!ok);
            definir(p.caminho, ok ? v : null);
            if (ok && v !== null) setTexto(formatarNumero(v, 2));
          }}
          className={`${classe(!!erros[p.caminho] || invalido)} pl-9`}
        />
      </div>
      {invalido && (
        <p className="text-xs text-amber-700">
          Valor inválido. Use o formato 5.000,00.
        </p>
      )}
    </Campo>
  );
}

export function Escolha(
  p: PropsCampo & {
    opcoes: readonly (string | { valor: string; rotulo: string })[];
    vazio?: string;
  },
) {
  const { r, definir, erros } = useFicha();
  return (
    <Campo {...p}>
      <select
        id={idDo(p.caminho)}
        value={String(ler(r, p.caminho) ?? "")}
        aria-invalid={!!erros[p.caminho]}
        onChange={(e) => definir(p.caminho, e.target.value)}
        className={classe(!!erros[p.caminho])}
      >
        <option value="">{p.vazio ?? "Selecione"}</option>
        {p.opcoes.map((o) => {
          const { valor, rotulo } =
            typeof o === "string" ? { valor: o, rotulo: o } : o;
          return (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          );
        })}
      </select>
    </Campo>
  );
}

export function Marca({
  caminho,
  rotulo,
}: {
  caminho: Caminho;
  rotulo: string;
}) {
  const { r, definir } = useFicha();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
      <input
        type="checkbox"
        checked={ler(r, caminho) === true}
        onChange={(e) => definir(caminho, e.target.checked)}
        className="size-4 accent-neutral-900"
      />
      {rotulo}
    </label>
  );
}

export function Endereco({
  n,
  rotulo,
  caminho,
  obrigatoria = true,
}: {
  n: number;
  rotulo: string;
  caminho: Caminho;
  obrigatoria?: boolean;
}) {
  const { definir, token } = useFicha();
  const consultado = useRef("");
  async function buscar(cep: string) {
    if (consultado.current === cep) return;
    consultado.current = cep;
    const e = await consultarCep(cep, token);
    if (!e) {
      notificar(
        "info",
        "Não achamos o CEP agora. Preencha o endereço normalmente.",
      );
      return;
    }
    definir(caminho, (atual: Record<string, string> = {}) => ({
      ...atual,
      cep: e.cep,
      logradouro: alta(e.logradouro) || atual.logradouro || "",
      bairro: alta(e.bairro) || atual.bairro || "",
      cidade: alta(e.cidade),
      uf: e.uf,
    }));
    notificar("ok", "CEP localizado. Confira o endereço e informe o número.");
  }
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-medium text-neutral-800">
        <span className="text-neutral-400">{n}. </span>
        {rotulo}
        {obrigatoria && <span className="text-red-600"> *</span>}
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Digitos
          tipo="cep"
          rotulo="CEP"
          caminho={`${caminho}.cep`}
          obrigatoria={obrigatoria}
          aoCompletar={buscar}
          className="col-span-2 sm:col-span-2"
        />
        <Texto
          rotulo="Logradouro"
          caminho={`${caminho}.logradouro`}
          obrigatoria={obrigatoria}
          className="col-span-2 sm:col-span-4"
        />
        <Texto
          rotulo="Número"
          caminho={`${caminho}.numero`}
          obrigatoria={obrigatoria}
          max={20}
          className="col-span-1 sm:col-span-2"
        />
        <Texto
          rotulo="Complemento"
          caminho={`${caminho}.complemento`}
          obrigatoria={false}
          max={80}
          className="col-span-1 sm:col-span-4"
        />
        <Texto
          rotulo="Bairro"
          caminho={`${caminho}.bairro`}
          obrigatoria={obrigatoria}
          max={80}
          className="col-span-2 sm:col-span-3"
        />
        <Texto
          rotulo="Cidade"
          caminho={`${caminho}.cidade`}
          obrigatoria={obrigatoria}
          max={80}
          className="col-span-1 sm:col-span-2"
        />
        <Escolha
          rotulo="UF"
          caminho={`${caminho}.uf`}
          obrigatoria={obrigatoria}
          opcoes={UFS}
          vazio="UF"
          className="col-span-1 sm:col-span-1"
        />
      </div>
    </fieldset>
  );
}

export function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        {descricao && (
          <p className="mt-1 text-xs text-neutral-500">{descricao}</p>
        )}
      </div>
      {children}
    </section>
  );
}
