"use client";

import { Info, Loader, Plus, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import { type Opcao, Selecao } from "@/components/selecao";
import { caixaAlta, type Endereco } from "@/lib/comercial/contrato";
import { idCampo } from "@/lib/comercial/contrato-revisao";
import { soDigitos, UFS } from "@/lib/documentos";
import { consultarCep } from "@/server/comercial/consultas";

// Campos do assistente de contratos, com o visual dos formulários do app
// (classeCampo, Selecao, rótulo pequeno em cima). Texto digitado vira caixa
// alta na hora, sem pular o cursor; e-mail, datas e números ficam como são.
// O id de cada campo é o que a Revisão usa para "Corrigir agora".

const ROTULO =
  "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-neutral-600";

/** Largura do campo na grade de 6 colunas. */
const LARGURA = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
} as const;
export type Largura = keyof typeof LARGURA;

export function Grade({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">{children}</div>
  );
}

function Rotulo({
  rotulo,
  obrigatorio,
  novo,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  novo?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {rotulo}
      {obrigatorio && <span className="text-red-700">*</span>}
      {novo && (
        <span className="rounded-full bg-marca/30 px-1.5 py-px text-[10px] font-semibold text-neutral-800">
          novo
        </span>
      )}
    </span>
  );
}

interface Comum {
  id: string;
  rotulo: string;
  largura?: Largura;
  obrigatorio?: boolean;
  novo?: boolean;
  dica?: React.ReactNode;
  desabilitado?: boolean;
}

export function Campo({
  id,
  rotulo,
  largura = 2,
  obrigatorio,
  novo,
  dica,
  children,
}: Omit<Comum, "desabilitado"> & { children: React.ReactNode }) {
  return (
    <label htmlFor={id} className={`${ROTULO} ${LARGURA[largura]}`}>
      <Rotulo rotulo={rotulo} obrigatorio={obrigatorio} novo={novo} />
      {children}
      {dica && <span className="font-normal text-neutral-500">{dica}</span>}
    </label>
  );
}

/** Texto em caixa alta (ou e-mail/telefone como digitado, com `livre`). */
export function Texto({
  valor,
  aoMudar,
  livre = false,
  tipo = "text",
  max = 200,
  placeholder,
  aoSair,
  ...c
}: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
  livre?: boolean;
  tipo?: "text" | "email" | "tel";
  max?: number;
  placeholder?: string;
  aoSair?: (v: string) => void;
}) {
  return (
    <Campo {...c}>
      <input
        id={c.id}
        type={tipo}
        value={valor}
        maxLength={max}
        placeholder={placeholder}
        disabled={c.desabilitado}
        autoComplete="off"
        onChange={(e) => {
          const el = e.target;
          if (!livre && tipo === "text") {
            const alto = caixaAlta(el.value);
            if (alto !== el.value) {
              const [i, f] = [el.selectionStart, el.selectionEnd];
              el.value = alto;
              el.setSelectionRange(i, f);
            }
          }
          aoMudar(el.value);
        }}
        onBlur={aoSair ? (e) => aoSair(e.target.value) : undefined}
        className={classeCampo}
      />
    </Campo>
  );
}

export function TextoLongo({
  valor,
  aoMudar,
  linhas = 3,
  max = 4000,
  placeholder,
  ...c
}: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
  linhas?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <Campo {...c}>
      <textarea
        id={c.id}
        value={valor}
        rows={linhas}
        maxLength={max}
        placeholder={placeholder}
        disabled={c.desabilitado}
        onChange={(e) => {
          const el = e.target;
          const alto = caixaAlta(el.value);
          if (alto !== el.value) {
            const [i, f] = [el.selectionStart, el.selectionEnd];
            el.value = alto;
            el.setSelectionRange(i, f);
          }
          aoMudar(el.value);
        }}
        className={classeCampo}
      />
    </Campo>
  );
}

/** Número (inteiro ou com centavos); vazio vira null. */
export function Numero({
  valor,
  aoMudar,
  casas = 0,
  min = 0,
  max,
  sufixo,
  oculto = false,
  ...c
}: Comum & {
  valor: number | null;
  aoMudar: (v: number | null) => void;
  casas?: number;
  min?: number;
  max?: number;
  sufixo?: string;
  /** Sem comercial.valores.ver: o servidor não mandou o valor. */
  oculto?: boolean;
}) {
  if (oculto)
    return (
      <Campo {...c}>
        <input
          id={c.id}
          disabled
          value="Oculto (sem permissão de valores)"
          className={`${classeCampo} text-xs`}
        />
      </Campo>
    );
  return (
    <Campo {...c}>
      <span className="relative flex items-center">
        <input
          id={c.id}
          type="number"
          inputMode={casas ? "decimal" : "numeric"}
          step={casas ? 1 / 10 ** casas : 1}
          min={min}
          max={max}
          value={valor ?? ""}
          disabled={c.desabilitado}
          onChange={(e) => {
            const t = e.target.value;
            if (t === "") return aoMudar(null);
            const n = Number(t);
            if (Number.isFinite(n)) aoMudar(casas ? n : Math.trunc(n));
          }}
          className={`${classeCampo} tabular-nums ${sufixo ? "pr-12" : ""}`}
        />
        {sufixo && (
          <span className="pointer-events-none absolute right-3 text-xs text-neutral-400">
            {sufixo}
          </span>
        )}
      </span>
    </Campo>
  );
}

export function Data({
  valor,
  aoMudar,
  ...c
}: Comum & { valor: string; aoMudar: (v: string) => void }) {
  return (
    <Campo {...c}>
      <input
        id={c.id}
        type="date"
        value={valor}
        disabled={c.desabilitado}
        onChange={(e) => aoMudar(e.target.value)}
        className={classeCampo}
      />
    </Campo>
  );
}

export function Escolha({
  valor,
  aoMudar,
  opcoes,
  placeholder,
  ...c
}: Comum & {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: Opcao[];
  placeholder?: string;
}) {
  return (
    <div className={`${ROTULO} ${LARGURA[c.largura ?? 2]}`}>
      <label htmlFor={c.id}>
        <Rotulo rotulo={c.rotulo} obrigatorio={c.obrigatorio} novo={c.novo} />
      </label>
      <Selecao
        id={c.id}
        rotulo={c.rotulo}
        valor={valor}
        aoMudar={aoMudar}
        opcoes={opcoes}
        placeholder={placeholder}
        desabilitada={c.desabilitado}
      />
      {c.dica && <span className="font-normal text-neutral-500">{c.dica}</span>}
    </div>
  );
}

/** Lista simples → opções; o valor gravado vai em caixa alta, como o texto. */
export const opcoesDe = (valores: readonly string[]): Opcao[] =>
  valores.map((v) => ({ valor: caixaAlta(v), rotulo: v }));

export const opcoesDeRotulos = (r: Record<string, string>): Opcao[] =>
  Object.entries(r).map(([valor, rotulo]) => ({ valor, rotulo }));

export const OPCOES_UF = opcoesDe(UFS);

export function Marca({
  id,
  rotulo,
  valor,
  aoMudar,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
  desabilitado?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700"
    >
      <input
        id={id}
        type="checkbox"
        checked={valor}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="size-4 accent-neutral-900"
      />
      {rotulo}
    </label>
  );
}

/** Bloco da etapa: título, dica curta e os campos. */
export function Bloco({
  titulo,
  dica,
  novo,
  acoes,
  children,
}: {
  titulo: string;
  dica?: React.ReactNode;
  novo?: boolean;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {titulo}
            {novo && (
              <span className="rounded-full bg-marca/30 px-1.5 py-px text-[10px] font-semibold text-neutral-800">
                novo
              </span>
            )}
          </h2>
          {dica && <p className="mt-1 text-xs text-neutral-500">{dica}</p>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}

const TOM_AVISO = {
  info: "border-neutral-200 bg-white/70 text-neutral-700",
  atencao: "border-amber-300 bg-amber-50 text-amber-900",
  perigo: "border-red-300 bg-red-50 text-red-800",
  ok: "border-green-300 bg-green-50 text-green-900",
} as const;

export function Aviso({
  tom = "info",
  children,
}: {
  tom?: keyof typeof TOM_AVISO;
  children: React.ReactNode;
}) {
  const Icone = tom === "info" || tom === "ok" ? Info : TriangleAlert;
  return (
    <div
      role={tom === "perigo" ? "alert" : undefined}
      className={`flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-xs leading-relaxed ${TOM_AVISO[tom]}`}
    >
      <Icone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const BOTAO_SEC =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50";
export const BOTAO_PRI =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60";

export function Adicionar({
  id,
  children,
  onClick,
}: {
  id?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50"
    >
      <Plus className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

export function Remover({
  rotulo,
  onClick,
}: {
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
    >
      <X className="size-3.5" aria-hidden />
      {rotulo}
    </button>
  );
}

/** Subgrupo dentro de um bloco (ex.: "Representante 2"). */
export function Subgrupo({
  titulo,
  acoes,
  children,
}: {
  titulo: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-2xl border border-neutral-200/80 bg-white/40 p-4">
      <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-semibold text-neutral-800">
        {titulo}
        {acoes}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * CEP, logradouro, número, complemento, bairro, cidade e UF. Sair do CEP
 * consulta o endereço (BrasilAPI, ViaCEP de reserva); se o serviço falhar,
 * a pessoa digita normalmente.
 */
export function CamposEndereco({
  pre,
  valor,
  aoMudar,
  obrigatorio = true,
  desabilitado,
}: {
  /** Prefixo do id dos campos (o mesmo da Revisão). */
  pre: string;
  valor: Endereco;
  aoMudar: (e: Endereco) => void;
  obrigatorio?: boolean;
  desabilitado?: boolean;
}) {
  const [buscando, setBuscando] = useState(false);
  const up = (m: Partial<Endereco>) => aoMudar({ ...valor, ...m });

  async function buscar(texto: string) {
    const cep = soDigitos(texto);
    if (cep.length !== 8) return;
    setBuscando(true);
    const e = await consultarCep(cep).catch(() => null);
    setBuscando(false);
    if (!e) {
      notificar(
        "info",
        "Não achamos o CEP agora. Digite o endereço normalmente.",
      );
      return;
    }
    aoMudar({
      ...valor,
      cep,
      logradouro: caixaAlta(e.logradouro) || valor.logradouro,
      bairro: caixaAlta(e.bairro) || valor.bairro,
      cidade: caixaAlta(e.cidade),
      uf: caixaAlta(e.uf),
    });
    notificar("ok", "CEP localizado. Confira o endereço.");
  }

  const cep =
    valor.cep.length > 5
      ? `${valor.cep.slice(0, 5)}-${valor.cep.slice(5)}`
      : valor.cep;
  return (
    <Grade>
      <Campo
        id={idCampo(pre, "cep")}
        rotulo="CEP"
        obrigatorio={obrigatorio}
        dica={buscando ? "Consultando o CEP…" : undefined}
      >
        <span className="relative flex items-center">
          <input
            id={idCampo(pre, "cep")}
            value={cep}
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            disabled={desabilitado}
            onChange={(e) => up({ cep: soDigitos(e.target.value).slice(0, 8) })}
            onBlur={(e) => void buscar(e.target.value)}
            className={classeCampo}
          />
          {buscando && (
            <Loader
              className="absolute right-3 size-4 animate-spin text-neutral-400"
              aria-hidden
            />
          )}
        </span>
      </Campo>
      <Texto
        id={idCampo(pre, "logradouro")}
        rotulo="Logradouro"
        largura={4}
        obrigatorio={obrigatorio}
        valor={valor.logradouro}
        aoMudar={(v) => up({ logradouro: v })}
        desabilitado={desabilitado}
      />
      <Texto
        id={idCampo(pre, "numero")}
        rotulo="Número"
        largura={1}
        max={20}
        obrigatorio={obrigatorio}
        valor={valor.numero}
        aoMudar={(v) => up({ numero: v })}
        desabilitado={desabilitado}
      />
      <Texto
        id={idCampo(pre, "complemento")}
        rotulo="Complemento"
        largura={2}
        max={100}
        valor={valor.complemento}
        aoMudar={(v) => up({ complemento: v })}
        desabilitado={desabilitado}
      />
      <Texto
        id={idCampo(pre, "bairro")}
        rotulo="Bairro"
        largura={1}
        max={100}
        obrigatorio={obrigatorio}
        valor={valor.bairro}
        aoMudar={(v) => up({ bairro: v })}
        desabilitado={desabilitado}
      />
      <Texto
        id={idCampo(pre, "cidade")}
        rotulo="Cidade"
        largura={1}
        max={100}
        obrigatorio={obrigatorio}
        valor={valor.cidade}
        aoMudar={(v) => up({ cidade: v })}
        desabilitado={desabilitado}
      />
      <Escolha
        id={idCampo(pre, "uf")}
        rotulo="UF"
        largura={1}
        obrigatorio={obrigatorio}
        valor={valor.uf}
        aoMudar={(v) => up({ uf: v })}
        opcoes={OPCOES_UF}
        placeholder="UF"
        desabilitado={desabilitado}
      />
    </Grade>
  );
}
