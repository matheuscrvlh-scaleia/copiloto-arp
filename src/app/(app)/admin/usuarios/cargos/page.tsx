import { Pencil, Plus, Power, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Abas, BotaoLink, Situacao } from "@/components/admin/ui";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import { MODULOS_DE_PERMISSAO as MODULOS, PERMISSOES } from "@/lib/permissions";
import { alternarCargo, apagarCargo } from "@/server/admin/acoes/usuarios";
import { cargos } from "@/server/admin/dados";
import { ABAS_USUARIOS } from "../abas";
import { confirmarExclusao, confirmarInativacao } from "./textos";

export const metadata: Metadata = { title: "Cargos" };

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
        // O cargo ativo com acesso a tudo ganha o cartão escuro de destaque.
        const tudo =
          c.ativo && c.permissoes.length === Object.keys(PERMISSOES).length;
        const apagado = tudo
          ? "text-[rgb(255_255_255/0.60)]"
          : "text-neutral-500";
        return (
          <li
            key={c.id}
            className={`relative flex h-full flex-col gap-4 rounded-[1.75rem] p-6 transition hover:-translate-y-0.5 ${tudo ? "destaque" : "vidro"}`}
          >
            <div className={c.ativo ? "" : "opacity-60"}>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {/* O link cobre o cartão; as ações ficam por cima dele. */}
                <Link
                  href={`/admin/usuarios/cargos/${c.id}`}
                  className="truncate after:absolute after:inset-0 after:rounded-[1.75rem]"
                >
                  {c.nome}
                </Link>
                {!c.ativo && <Situacao tipo="neutro">Inativo</Situacao>}
              </h2>
              <p className={`mt-1 line-clamp-2 text-xs ${apagado}`}>
                {c.descricao ?? "Sem descrição"}
              </p>
            </div>
            <div
              className={`mt-auto flex flex-wrap gap-2 ${c.ativo ? "" : "opacity-60"}`}
            >
              {c.permissoes.length === 0 && (
                <span className="text-xs text-neutral-500">Sem permissões</span>
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
                    {m.titulo} · {n}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p
                className={`flex items-center gap-2 text-sm ${tudo ? "text-[rgb(255_255_255/0.80)]" : "text-neutral-600"}`}
              >
                <Users className="size-4" aria-hidden />
                {formatarNumero(c.usuarios)}{" "}
                {c.usuarios === 1 ? "usuário" : "usuários"}
              </p>
              <div className="relative z-10 -mr-2 flex items-center">
                <Link
                  href={`/admin/usuarios/cargos/${c.id}`}
                  title="Editar"
                  aria-label={`Editar ${c.nome}`}
                  className="grid size-9 place-items-center rounded-full opacity-60 transition hover:bg-[rgb(127_127_127/0.15)] hover:opacity-100"
                >
                  <Pencil className="size-4" aria-hidden />
                </Link>
                <AcaoRapida
                  acao={alternarCargo}
                  campos={{ id: c.id, ativo: String(!c.ativo) }}
                  rotulo={c.ativo ? "Inativar" : "Reativar"}
                  icone={<Power className="size-4" aria-hidden />}
                  confirmar={c.ativo ? confirmarInativacao(c) : undefined}
                />
                <AcaoRapida
                  acao={apagarCargo}
                  campos={{ id: c.id }}
                  rotulo="Excluir"
                  icone={<Trash2 className="size-4" aria-hidden />}
                  confirmar={confirmarExclusao(c)}
                  perigo
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
