import type { Metadata } from "next";
import { Suspense } from "react";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { setores } from "@/server/os/base";
import {
  categoriaNova,
  EdicaoDeCategoria,
  EsqueletoCategoria,
} from "../editar";

export const metadata: Metadata = { title: "Nova categoria" };

export default function Page({
  searchParams,
}: PageProps<"/os/configuracoes/catalogo/nova">) {
  return (
    <Suspense fallback={<EsqueletoCategoria />}>
      <Protegido permissao="os.catalogo">
        <Nova busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Nova({
  busca,
}: {
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ setor: pedido }, lista] = await Promise.all([busca, setores()]);
  const setor =
    lista.find((s) => s.id === pedido && s.ativo) ?? lista.find((s) => s.ativo);
  if (!setor)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Cadastre um setor ativo antes de criar categorias.
        </p>
      </Cartao>
    );
  return <EdicaoDeCategoria categoria={categoriaNova(setor.id)} />;
}
