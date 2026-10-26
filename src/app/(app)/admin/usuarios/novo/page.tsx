import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CampoSenha } from "@/components/admin/campo-senha";
import { EscolhaDeCargo } from "@/components/admin/permissoes";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { criarUsuario } from "@/server/admin/acoes/usuarios";
import { cargos, cargosParaEscolha } from "@/server/admin/dados";

export const metadata: Metadata = { title: "Novo usuário" };

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

const PASSOS = [
  "Você cria o usuário com uma senha provisória.",
  "Passa o e-mail e a senha para a pessoa por um canal seguro.",
  "No primeiro acesso, ela define a própria senha.",
  "O que ela vê vem do cargo. As permissões de cada cargo ficam em Cargos.",
];

export default function Page() {
  return (
    <>
      <Link
        href="/admin/usuarios"
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Usuários
      </Link>
      <PageHeader
        title="Novo usuário"
        description="Dê acesso a alguém da equipe. O acesso vale assim que você criar."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.usuarios">
          <Formulario />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Formulario() {
  const lista = await cargos();
  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <FormAcao
        acao={criarUsuario}
        rotulo="Criar usuário"
        rotuloEnviando="Criando…"
        botaoNoFim={false}
        className="vidro rounded-[1.75rem] p-6 md:p-8"
      >
        <Secao titulo="Dados" descricao="O e-mail é o login e não muda depois.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={rotulo}>
              Nome
              <input
                name="nome"
                required
                autoComplete="off"
                placeholder="Nome e sobrenome"
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              E-mail
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                placeholder="nome@arp.com.br"
                className={classeCampo}
              />
            </label>
          </div>
        </Secao>
        <Secao
          titulo="Acesso"
          descricao="O cargo define as telas e ações liberadas."
        >
          <EscolhaDeCargo
            cargos={cargosParaEscolha(lista)}
            cargoInicial={null}
          />
        </Secao>
        <Secao
          titulo="Senha provisória"
          descricao="Gerada agora. Copie antes de criar: ela não aparece de novo."
        >
          <div className="max-w-xl">
            <CampoSenha
              rotulo="Senha"
              ajuda="No primeiro acesso a pessoa troca por uma senha só dela."
              gerarAoAbrir
            />
          </div>
        </Secao>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200/70 pt-6">
          <Link
            href="/admin/usuarios"
            className="rounded-full px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            Cancelar
          </Link>
          <EnvioDaAcao className="flex-row-reverse" />
        </div>
      </FormAcao>

      <aside className="vidro rounded-[1.75rem] p-6">
        <h2 className="text-sm font-semibold">Como funciona</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {PASSOS.map((p, i) => (
            <li key={p} className="flex gap-3 text-sm text-neutral-600">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                {i + 1}
              </span>
              {p}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
