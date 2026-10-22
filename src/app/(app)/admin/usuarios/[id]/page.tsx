import { CircleCheck, Power, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { CampoSenha } from "@/components/admin/campo-senha";
import { EscolhaDeCargo } from "@/components/admin/permissoes";
import { Avatar, Secao, Situacao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Carregando } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { PERMISSOES } from "@/lib/permissions";
import { cargos, usuarios } from "@/server/admin/dados";
import { usuarioAtual } from "@/server/auth";
import {
  alternarUsuario,
  excluirUsuario,
  removerIndividuais,
  salvarUsuario,
  trocarSenha,
} from "../actions";

export const metadata: Metadata = { title: "Usuário" };

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
/** Botão embaixo da coluna dos campos (largura do título da Secao + vão). */
const ALINHADO = "md:pl-[17rem]";

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
          <h1 className="flex flex-wrap items-center gap-3 text-4xl font-semibold tracking-tight md:text-5xl">
            <span className="truncate">{u.nome}</span>
            {u.ativo ? (
              <Situacao tipo="ok">Ativo</Situacao>
            ) : (
              <Situacao tipo="neutro">Inativo</Situacao>
            )}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {u.email} · criado em {formatarData(u.criadoEm)} ·{" "}
            {u.ultimoAcesso
              ? `último acesso ${formatarDataHora(u.ultimoAcesso)}`
              : "nunca acessou"}
          </p>
        </div>
        {!souEu && (
          <div className="flex flex-wrap gap-2">
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
              comTexto
            />
            <AcaoRapida
              acao={excluirUsuario}
              campos={{ id: u.id }}
              rotulo="Excluir"
              icone={<Trash2 className="size-4" aria-hidden />}
              confirmar={`Excluir ${u.nome} de vez? Não tem volta. Para só bloquear o acesso, use Inativar.`}
              perigo
              comTexto
            />
          </div>
        )}
      </header>

      {busca.criado === "1" && (
        <output className="flex items-center gap-2 rounded-3xl bg-green-50 px-4 py-3 text-sm text-green-800">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          Usuário criado. Passe o e-mail e a senha provisória; no primeiro
          acesso a pessoa define a própria senha.
        </output>
      )}

      {!u.ativo && (
        <p className="rounded-3xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          Usuário inativo: o login está bloqueado e nenhuma tela abre. O
          histórico continua.
        </p>
      )}

      <FormAcao
        acao={salvarUsuario}
        botaoNoFim={false}
        className="vidro rounded-[1.75rem] p-6 md:p-8"
      >
        <input type="hidden" name="id" value={u.id} />
        <Secao titulo="Dados" descricao="O e-mail é o login e não muda.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={rotulo}>
              Nome
              <input
                name="nome"
                required
                defaultValue={u.nome}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              E-mail
              <input value={u.email} disabled className={classeCampo} />
            </label>
          </div>
        </Secao>
        <Secao
          titulo="Acesso"
          descricao="O cargo define as telas e ações liberadas. Mudar vale na hora."
        >
          <EscolhaDeCargo cargos={todosCargos} cargoInicial={u.cargoId} />
        </Secao>
        <EnvioDaAcao className={ALINHADO} />
      </FormAcao>

      {u.permissoes.length > 0 && (
        <FormAcao
          acao={removerIndividuais}
          rotulo="Remover permissões individuais"
          rotuloEnviando="Removendo…"
          variante="secundario"
          confirmar={`Remover as ${u.permissoes.length} permissões individuais de ${u.nome}? Fica só o que vem do cargo.`}
          className="flex flex-col gap-4 rounded-[1.75rem] border border-amber-200 bg-amber-50/80 p-6"
        >
          <input type="hidden" name="id" value={u.id} />
          <div>
            <h2 className="text-sm font-semibold text-amber-950">
              Permissões fora do cargo
            </h2>
            <p className="mt-1 text-xs text-amber-900">
              Esta pessoa ainda tem permissões dadas direto a ela, somadas às do
              cargo. Agora o acesso vem só do cargo: escolha um cargo que cubra
              o que ela precisa e remova estas.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {u.permissoes.map((p) => (
              <li
                key={p}
                className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-amber-950"
              >
                {PERMISSOES[p]}
              </li>
            ))}
          </ul>
        </FormAcao>
      )}

      <FormAcao
        acao={trocarSenha}
        rotulo="Redefinir senha"
        rotuloEnviando="Redefinindo…"
        variante="secundario"
        botaoNoFim={false}
        className="vidro rounded-[1.75rem] p-6 md:p-8"
      >
        <input type="hidden" name="id" value={u.id} />
        <Secao
          titulo="Redefinir senha"
          descricao={
            souEu
              ? "Troque a sua senha."
              : "Se a pessoa esqueceu a senha, defina uma provisória. No próximo acesso ela escolhe uma nova."
          }
        >
          <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
            <CampoSenha
              rotulo={souEu ? "Nova senha" : "Senha provisória"}
              ajuda="Mínimo de 10 caracteres."
            />
            {/* A provisória fica visível e será trocada; a sua, confirme. */}
            {souEu && (
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
            )}
          </div>
        </Secao>
        <EnvioDaAcao className={ALINHADO} />
      </FormAcao>
    </div>
  );
}
