import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Secao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { NovaVistoria } from "@/components/os/vistorias/nova";
import { Cartao, PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { ROTAS_OS } from "@/lib/os/rotas";
import { TIPOS_VISTORIA, type TipoVistoria } from "@/lib/os/rotulos";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { localDaUnidade } from "@/lib/os/vistoria-regras";
import { contexto } from "@/server/os/base";
import { lojasParaVistoria } from "@/server/os/vistorias";

export const metadata: Metadata = { title: "Nova vistoria" };

export default function Page({
  searchParams,
}: PageProps<"/os/vistorias/nova">) {
  return (
    <>
      <Link
        href={ROTAS_OS.vistorias}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Vistorias
      </Link>
      <PageHeader
        title="Nova vistoria"
        description="Escolha o tipo e o contrato. Os ambientes padrão já vêm prontos para preencher e fotografar."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Formulario searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

async function Formulario({
  searchParams,
}: Pick<PageProps<"/os/vistorias/nova">, "searchParams">) {
  const ctx = await contexto();
  if (!ctx.pode("os.vistorias")) return <SemAcesso />;
  const [sp, lojas] = await Promise.all([searchParams, lojasParaVistoria()]);
  const tipo = um(sp.tipo);
  const loja = um(sp.loja);

  return (
    <Cartao>
      <Secao
        titulo="Contrato e tipo"
        descricao="Pelo link do contrato (?loja=…&tipo=entrada) a vistoria já chega preenchida."
      >
        <NovaVistoria
          hoje={hojeEmBrasilia(new Date())}
          tipoInicial={
            Object.hasOwn(TIPOS_VISTORIA, tipo) ? (tipo as TipoVistoria) : null
          }
          lojaInicial={lojas.some((l) => l.id === loja) ? loja : null}
          lojas={lojas.map((l) => ({
            id: l.id,
            rotulo: `${localDaUnidade(l.bloco, l.luc)} · ${l.nome}`,
            descricao: [
              l.locatario,
              l.situacao === "encerrado" ? "contrato encerrado" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      </Secao>
    </Cartao>
  );
}
