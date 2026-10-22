import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Abas, Avatar, BotaoLink, Situacao } from "@/components/admin/ui";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import { cargos, type UsuarioAdmin, usuarios } from "@/server/admin/dados";
import { usuarioAtual } from "@/server/auth";
import { ABAS_USUARIOS } from "./abas";
import { alternarUsuario, excluirUsuario } from "./actions";

export const metadata: Metadata = { title: "Usuários e cargos" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Usuários e cargos"
        description="Quem acessa o sistema e o que cada um vê. O cargo dá um conjunto de permissões; dá para somar permissões individuais."
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Abas abas={ABAS_USUARIOS} atual="/admin/usuarios" />
        <BotaoLink href="/admin/usuarios/novo">
          <span className="grid size-7 place-items-center rounded-full bg-white/15">
            <Plus className="size-4" aria-hidden />
          </span>
          Novo usuário
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
  const [lista, todosCargos, eu] = await Promise.all([
    usuarios(),
    cargos(),
    usuarioAtual(),
  ]);
  const nomeDoCargo = new Map(
    todosCargos.map((c) => [c.id, c.ativo ? c.nome : `${c.nome} (inativo)`]),
  );
  const ativos = lista.filter((u) => u.ativo).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="destaque rounded-[1.75rem] p-6">
          <p className="text-sm text-[rgb(255_255_255/0.60)]">Com acesso</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">
            {formatarNumero(ativos)}
          </p>
          <p className="mt-1 text-xs text-[rgb(255_255_255/0.60)]">
            usuários ativos
          </p>
        </div>
        <div className="vidro rounded-[1.75rem] p-6">
          <p className="text-sm text-neutral-500">Inativos</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">
            {formatarNumero(lista.length - ativos)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            mantidos para o histórico
          </p>
        </div>
        <div className="vidro rounded-[1.75rem] p-6">
          <p className="text-sm text-neutral-500">Cargos</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">
            {formatarNumero(todosCargos.length)}
          </p>
          <Link
            href="/admin/usuarios/cargos"
            className="mt-1 inline-block text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            Ver e editar cargos →
          </Link>
        </div>
      </div>

      <section className="vidro rounded-[1.75rem] p-3 md:p-4">
        <ul className="flex flex-col">
          {lista.map((u) => {
            const souEu = u.id === eu.id;
            return (
              <li
                key={u.id}
                className="flex items-center gap-2 rounded-3xl pr-2 transition hover:bg-white/70"
              >
                <Link
                  href={`/admin/usuarios/${u.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4 px-3 py-3"
                >
                  <Avatar nome={u.nome} apagado={!u.ativo} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{u.nome}</span>
                      {souEu && (
                        <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white">
                          você
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {u.email}
                    </span>
                    {/* No celular o cargo vem embaixo do e-mail. */}
                    <span className="block truncate text-xs text-neutral-600 md:hidden">
                      <Cargo u={u} nome={nomeDoCargo} />
                    </span>
                  </span>
                  <span className="hidden w-56 shrink-0 truncate text-sm text-neutral-600 md:block">
                    <Cargo u={u} nome={nomeDoCargo} />
                  </span>
                  <span className="hidden w-24 shrink-0 md:block">
                    {u.ativo ? (
                      <Situacao tipo="ok">Ativo</Situacao>
                    ) : (
                      <Situacao tipo="neutro">Inativo</Situacao>
                    )}
                  </span>
                  <span className="hidden w-52 shrink-0 text-right text-xs text-neutral-500 lg:block">
                    {u.ultimoAcesso
                      ? `Último acesso ${formatarDataHora(u.ultimoAcesso)}`
                      : "Nunca acessou"}
                  </span>
                </Link>
                <div className="flex shrink-0 items-center text-neutral-700">
                  <Link
                    href={`/admin/usuarios/${u.id}`}
                    title="Editar"
                    aria-label={`Editar ${u.nome}`}
                    className="grid size-9 place-items-center rounded-full opacity-60 transition hover:bg-[rgb(127_127_127/0.15)] hover:opacity-100"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Link>
                  {/* Ninguém inativa nem exclui a si mesmo. */}
                  {souEu ? (
                    <span aria-hidden className="w-18" />
                  ) : (
                    <>
                      <AcaoRapida
                        acao={alternarUsuario}
                        campos={{ id: u.id, ativo: String(!u.ativo) }}
                        rotulo={u.ativo ? "Inativar" : "Reativar"}
                        icone={<Power className="size-4" aria-hidden />}
                        confirmar={
                          u.ativo
                            ? `Inativar ${u.nome}? O login fica bloqueado; o histórico continua.`
                            : undefined
                        }
                      />
                      <AcaoRapida
                        acao={excluirUsuario}
                        campos={{ id: u.id }}
                        rotulo="Excluir"
                        icone={<Trash2 className="size-4" aria-hidden />}
                        confirmar={`Excluir ${u.nome} de vez? Não tem volta. Para só bloquear o acesso, use Inativar.`}
                        perigo
                      />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Cargo({ u, nome }: { u: UsuarioAdmin; nome: Map<string, string> }) {
  const n = u.permissoes.length;
  return (
    <>
      {u.cargoId ? (nome.get(u.cargoId) ?? "—") : "Sem cargo"}
      {n > 0 && (
        <span className="text-neutral-400">
          {" "}
          · +{n} {n === 1 ? "individual" : "individuais"}
        </span>
      )}
    </>
  );
}
