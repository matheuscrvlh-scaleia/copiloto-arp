import { ChevronRight, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Abas, BotaoLink } from "@/components/admin/ui";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import { PERMISSOES } from "@/lib/permissions";
import { cargos } from "@/server/admin/dados";
import { ABAS_USUARIOS } from "../abas";

export const metadata: Metadata = { title: "Cargos" };

const MODULOS = [
  { prefixo: "admin.", nome: "Administração" },
  { prefixo: "rh.", nome: "RH" },
  { prefixo: "financeiro.", nome: "Financeiro" },
];

export default function Page() {
  return (
    <>
      <PageHeader
        title="Usuários e cargos"
        description="Cada cargo é um conjunto de permissões. Mudar um cargo vale na hora para todos os usuários dele."
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Abas abas={ABAS_USUARIOS} atual="/admin/usuarios/cargos" />
        <BotaoLink href="/admin/usuarios/cargos/novo">
          <span className="grid size-7 place-items-center rounded-full bg-white/15">
            <Plus className="size-4" aria-hidden />
          </span>
          Novo cargo
        </BotaoLink>
      </div>
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.usuarios">
          <Lista />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Lista() {
  const lista = await cargos();
  if (lista.length === 0) {
    return (
      <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-500">
        Nenhum cargo ainda. Crie o primeiro para agrupar permissões.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {lista.map((c) => {
        // O cargo com acesso a tudo ganha o cartão escuro de destaque.
        const tudo = c.permissoes.length === Object.keys(PERMISSOES).length;
        return (
          <li key={c.id}>
            <Link
              href={`/admin/usuarios/cargos/${c.id}`}
              className={`flex h-full flex-col gap-4 rounded-[1.75rem] p-6 transition hover:-translate-y-0.5 ${tudo ? "destaque" : "vidro"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{c.nome}</h2>
                  <p
                    className={`mt-1 line-clamp-2 text-xs ${tudo ? "text-[rgb(255_255_255/0.60)]" : "text-neutral-500"}`}
                  >
                    {c.descricao ?? "Sem descrição"}
                  </p>
                </div>
                <ChevronRight
                  className={`size-4 shrink-0 ${tudo ? "text-[rgb(255_255_255/0.50)]" : "text-neutral-400"}`}
                  aria-hidden
                />
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {c.permissoes.length === 0 && (
                  <span className="text-xs text-neutral-500">
                    Sem permissões
                  </span>
                )}
                {MODULOS.map((m) => {
                  const n = c.permissoes.filter((p) =>
                    p.startsWith(m.prefixo),
                  ).length;
                  if (n === 0) return null;
                  return (
                    <span
                      key={m.prefixo}
                      className={`rounded-full px-2.5 py-1 text-xs ${tudo ? "ladrilho" : "border border-neutral-200 bg-white/70 text-neutral-600"}`}
                    >
                      {m.nome} · {n}
                    </span>
                  );
                })}
              </div>
              <p
                className={`flex items-center gap-2 text-sm ${tudo ? "text-[rgb(255_255_255/0.80)]" : "text-neutral-600"}`}
              >
                <Users className="size-4" aria-hidden />
                {formatarNumero(c.usuarios)}{" "}
                {c.usuarios === 1 ? "usuário" : "usuários"}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
