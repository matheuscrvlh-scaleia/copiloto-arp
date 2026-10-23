"use client";

import {
  ArrowRight,
  Building2,
  Coins,
  FolderTree,
  HardHat,
  ListFilter,
  Loader,
  MapPin,
  User,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { type Opcao, Selecao } from "@/components/selecao";
import { FILTROS_STATUS } from "@/lib/os/ordem-lista";
import { PARAM_PAINEL } from "@/lib/os/rotas";
import { EXECUCOES } from "@/lib/os/rotulos";

// Filtros da tela Ordens de serviço, guardados na URL (o link leva os
// filtros junto). O local é busca de texto: espera a pessoa parar de digitar.

const ESPERA_MS = 400;
const CHAVES = [
  "status",
  "execucao",
  "categoria",
  "tecnico",
  "empresa",
  "rateio",
  "de",
  "ate",
  "local",
  "cartao",
];

export function FiltrosOrdens({
  categorias,
  tecnicos,
  empresas,
}: {
  categorias: Opcao[];
  tecnicos: Opcao[];
  empresas: Opcao[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();
  const [local, setLocal] = useState(params.get("local") ?? "");
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  function trocar(nome: string, valor: string) {
    const p = new URLSearchParams(params);
    p.delete(PARAM_PAINEL);
    if (valor) p.set(nome, valor);
    else p.delete(nome);
    iniciar(() =>
      router.replace(`${pathname}?${p.toString()}`, { scroll: false }),
    );
  }

  function digitarLocal(v: string) {
    setLocal(v);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => trocar("local", v.trim()), ESPERA_MS);
  }

  const filtrando = CHAVES.some((k) => params.has(k));
  const campoData =
    "rounded-full bg-transparent px-2 py-1.5 text-sm font-medium tabular-nums text-neutral-900 outline-none transition hover:bg-white/70 focus-visible:bg-white/90 focus-visible:ring-2 focus-visible:ring-neutral-900/15 [color-scheme:light] dark:[color-scheme:dark] dark:hover:bg-white/10";
  const selecao = (
    nome: string,
    rotulo: string,
    todos: string,
    opcoes: Opcao[],
    icone: React.ReactNode,
    largura: string,
  ) => (
    <Selecao
      variante="embutida"
      rotulo={rotulo}
      icone={icone}
      className={`${largura} max-w-full`}
      valor={params.get(nome) ?? ""}
      aoMudar={(v) => trocar(nome, v)}
      opcoes={[{ valor: "", rotulo: todos }, ...opcoes]}
    />
  );

  return (
    <fieldset
      className="vidro m-0 flex min-w-0 flex-wrap items-center gap-1 rounded-[1.75rem] p-1.5"
      aria-busy={carregando}
    >
      <legend className="sr-only">Filtros das ordens de serviço</legend>
      {selecao(
        "status",
        "Status",
        "Todos os status",
        Object.entries(FILTROS_STATUS).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        })),
        <ListFilter className="size-4" />,
        "w-48",
      )}
      {selecao(
        "execucao",
        "Execução",
        "Interna e terceirizada",
        Object.entries(EXECUCOES).map(([valor, rotulo]) => ({ valor, rotulo })),
        <HardHat className="size-4" />,
        "w-52",
      )}
      {selecao(
        "categoria",
        "Tipo de serviço",
        "Todos os tipos",
        categorias,
        <FolderTree className="size-4" />,
        "w-48",
      )}
      {selecao(
        "tecnico",
        "Técnico",
        "Todos os técnicos",
        tecnicos,
        <User className="size-4" />,
        "w-48",
      )}
      {selecao(
        "empresa",
        "Empresa",
        "Todas as empresas",
        empresas,
        <Building2 className="size-4" />,
        "w-48",
      )}
      {selecao(
        "rateio",
        "Rateio",
        "Rateio: todos",
        [
          { valor: "sim", rotulo: "Com rateio" },
          { valor: "nao", rotulo: "Sem rateio" },
        ],
        <Coins className="size-4" />,
        "w-40",
      )}
      <div className="flex items-center gap-0.5 px-1">
        <label className="flex items-center gap-1">
          <span className="pl-1 text-xs text-neutral-500">Criadas de</span>
          <input
            type="date"
            className={campoData}
            value={params.get("de") ?? ""}
            onChange={(e) => trocar("de", e.target.value)}
          />
        </label>
        <ArrowRight
          className="size-3.5 shrink-0 text-neutral-400"
          aria-hidden
        />
        <label className="flex items-center gap-1">
          <span className="sr-only">Até</span>
          <input
            type="date"
            className={campoData}
            value={params.get("ate") ?? ""}
            onChange={(e) => trocar("ate", e.target.value)}
          />
        </label>
      </div>
      <label className="flex min-w-48 flex-1 items-center gap-2 rounded-full px-3 py-1.5 text-sm hover:bg-white/70 dark:hover:bg-white/10">
        <MapPin className="size-4 shrink-0 text-neutral-500" aria-hidden />
        <span className="sr-only">Local</span>
        <input
          type="search"
          value={local}
          onChange={(e) => digitarLocal(e.target.value)}
          placeholder="Local: loja, bloco, ponto…"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
        />
      </label>
      {carregando && (
        <Loader
          className="mx-1 size-4 animate-spin text-neutral-500 motion-reduce:animate-none"
          aria-label="Atualizando"
        />
      )}
      {filtrando && (
        <button
          type="button"
          onClick={() => {
            setLocal("");
            iniciar(() => router.replace(pathname, { scroll: false }));
          }}
          className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-neutral-600 transition hover:bg-white/70 hover:text-neutral-900"
        >
          <X className="size-3.5" aria-hidden />
          Limpar
        </button>
      )}
    </fieldset>
  );
}
