import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CampoSenha } from "@/components/admin/campo-senha";
import { CargoEPermissoes } from "@/components/admin/permissoes";
import { Avatar, Situacao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Carregando } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { cargos, usuarios } from "@/server/admin/dados";
import { usuarioAtual } from "@/server/auth";
import { salvarUsuario, trocarSenha } from "../actions";

export const metadata: Metadata = { title: "Usuário" };

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export default function Page({
  params,
  searchParams,
}: PageProps<"/admin/usuarios/[id]">) {
  return (
    <>
      <Link
        href="/admin/usuarios"
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Usuários
      </Link>
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.usuarios">
          <Edicao params={params} searchParams={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Edicao({
  params,
  searchParams,
}: Pick<PageProps<"/admin/usuarios/[id]">, "params" | "searchParams">) {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const [lista, todosCargos, eu] = await Promise.all([
    usuarios(),
    cargos(),
    usuarioAtual(),
  ]);
  const u = lista.find((x) => x.id === id);
  if (!u) notFound();
  const souEu = u.id === eu.id;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar nome={u.nome} apagado={!u.ativo} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-4xl font-semibold tracking-tight md:text-5xl">
            {u.nome}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {u.email} · criado em {formatarData(u.criadoEm)} ·{" "}
            {u.ultimoAcesso
              ? `último acesso ${formatarDataHora(u.ultimoAcesso)}`
              : "nunca acessou"}
          </p>
        </div>
        {u.ativo ? (
          <Situacao tipo="ok">Ativo</Situacao>
        ) : (
          <Situacao tipo="neutro">Bloqueado</Situacao>
        )}
      </header>

      {busca.criado === "1" && (
        <output className="flex items-center gap-2 rounded-3xl bg-green-50 px-4 py-3 text-sm text-green-800">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          Usuário criado. Passe o e-mail e a senha para a pessoa entrar.
        </output>
      )}

      <FormAcao
        acao={salvarUsuario}
        className="vidro flex flex-col gap-6 rounded-[1.75rem] p-6"
      >
        <input type="hidden" name="id" value={u.id} />
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,24rem)_1fr]">
          <label className={rotulo}>
            Nome
            <input
              name="nome"
              required
              defaultValue={u.nome}
              className={classeCampo}
            />
          </label>
          <label
            className={`flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm ${souEu ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={u.ativo}
              disabled={souEu}
              className="size-4 accent-neutral-900"
            />
            {/* Desabilitado não vai no formulário: o próprio usuário segue ativo. */}
            {souEu && <input type="hidden" name="ativo" value="on" />}
            <span>
              Acesso liberado
              <span className="block text-xs text-neutral-500">
                {souEu
                  ? "Você não pode bloquear o seu próprio acesso."
                  : "Desmarque para bloquear o login. O histórico continua."}
              </span>
            </span>
          </label>
        </div>
        <CargoEPermissoes
          cargos={todosCargos}
          cargoInicial={u.cargoId}
          marcadas={u.permissoes}
        />
      </FormAcao>

      <FormAcao
        acao={trocarSenha}
        rotulo="Trocar senha"
        rotuloEnviando="Trocando…"
        variante="secundario"
        className="vidro flex flex-col gap-4 rounded-[1.75rem] p-6"
      >
        <div>
          <h2 className="text-base font-semibold">Senha</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Defina uma senha nova se a pessoa esqueceu a dela.
          </p>
        </div>
        <input type="hidden" name="id" value={u.id} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoSenha rotulo="Nova senha" ajuda="Mínimo de 10 caracteres." />
          <label className={rotulo}>
            Repita a nova senha
            <input
              name="confirmacao"
              type="password"
              required
              autoComplete="new-password"
              className={`${classeCampo} font-mono`}
            />
          </label>
        </div>
      </FormAcao>
    </div>
  );
}
