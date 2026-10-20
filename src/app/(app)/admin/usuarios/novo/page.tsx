import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CampoSenha } from "@/components/admin/campo-senha";
import { CargoEPermissoes } from "@/components/admin/permissoes";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { cargos } from "@/server/admin/dados";
import { criarUsuario } from "../actions";

export const metadata: Metadata = { title: "Novo usuário" };

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

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
        description="A pessoa entra com o e-mail e a senha definidos aqui. O acesso vale na hora."
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
    <FormAcao
      acao={criarUsuario}
      rotulo="Criar usuário"
      rotuloEnviando="Criando…"
      className="vidro flex flex-col gap-6 rounded-[1.75rem] p-6"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            autoComplete="off"
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
            className={classeCampo}
          />
        </label>
        <CampoSenha />
      </div>
      <CargoEPermissoes cargos={lista} cargoInicial={null} marcadas={[]} />
    </FormAcao>
  );
}
