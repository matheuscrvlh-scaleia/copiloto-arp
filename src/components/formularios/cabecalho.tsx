import { ArrowLeft, ExternalLink, Eye } from "lucide-react";
import Link from "next/link";
import { AbasDaTela } from "@/components/dashboard/tela";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import {
  type Formulario,
  ROTA_FORMULARIOS,
  rotaDoFormulario,
} from "@/server/formularios/base";
import { SeloSituacao } from "./blocos";

// Topo das telas de um formulário: voltar, título, situação, números e as
// abas Respostas, Perguntas e Configurações (as duas últimas só para quem
// edita). Prévia sempre; "Abrir link" só com o formulário publicado.

export const BOTAO_SECUNDARIO =
  "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

export type Aba = "respostas" | "perguntas" | "configuracoes";

/** Por que o publicado não recebe mais (data ou limite). */
export function motivoDoEncerramento(f: Formulario): string | undefined {
  if (f.situacao !== "publicado" || f.efetiva !== "encerrado") return undefined;
  if (f.limite_respostas !== null && f.total_respostas >= f.limite_respostas)
    return "limite atingido";
  return "data passou";
}

export function CabecalhoDoFormulario({
  f,
  aba,
  edita,
}: {
  f: Formulario;
  aba: Aba;
  edita: boolean;
}) {
  const abas = [
    {
      chave: "respostas",
      rotulo: `Respostas (${formatarNumero(f.total_respostas)})`,
      href: rotaDoFormulario(f.id),
    },
    ...(edita
      ? [
          {
            chave: "perguntas",
            rotulo: "Perguntas",
            href: rotaDoFormulario(f.id, "editar"),
          },
          {
            chave: "configuracoes",
            rotulo: "Link e configurações",
            href: rotaDoFormulario(f.id, "configuracoes"),
          },
        ]
      : []),
  ];
  return (
    <div className="mb-6 flex flex-col gap-4">
      <Link
        href={ROTA_FORMULARIOS}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Formulários
      </Link>
      <header data-guia="titulo" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
            {f.titulo}
          </h1>
          <SeloSituacao
            situacao={f.efetiva}
            detalhe={motivoDoEncerramento(f)}
          />
        </div>
        <p className="text-sm text-neutral-500">
          {f.campos.filter((c) => c.tipo !== "secao").length} perguntas ·
          atualizado em {formatarDataHora(f.atualizado_em)}
          {f.ultima_resposta_em &&
            ` · última resposta em ${formatarDataHora(f.ultima_resposta_em)}`}
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AbasDaTela abas={abas} ativa={aba} rotulo="Partes do formulário" />
        <div className="flex flex-wrap gap-2">
          <Link
            href={rotaDoFormulario(f.id, "previa")}
            className={BOTAO_SECUNDARIO}
          >
            <Eye className="size-4" aria-hidden />
            Prévia
          </Link>
          {f.efetiva === "publicado" && (
            <a
              href={f.link}
              target="_blank"
              rel="noreferrer"
              className={BOTAO_SECUNDARIO}
            >
              <ExternalLink className="size-4" aria-hidden />
              Abrir link
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
