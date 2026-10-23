import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormAtivo } from "@/components/os/ativos/form-ativo";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { rotaAtivo } from "@/lib/os/rotas";
import { opcoesDoCadastro } from "@/server/os/ativos";
import { contexto, os } from "@/server/os/base";
import { salvarAtivo } from "../../actions";

export const metadata: Metadata = { title: "Editar ativo" };

type Props = { params: Promise<{ id: string }> };

export default function Page({ params }: Props) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-[48rem]" />
        </TelaCarregando>
      }
    >
      <Formulario params={params} />
    </Suspense>
  );
}

async function Formulario({ params }: Props) {
  const ctx = await contexto();
  if (!ctx.pode("os.ativos_gerenciar")) return <SemAcesso />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: ativo, error } = await (await os())
    .from("ativos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o ativo: ${error.message}`);
  if (!ativo) notFound();
  const opcoes = await opcoesDoCadastro(ativo);
  // Sem os.custos, os reais nem chegam ao navegador.
  const verCustos = ctx.pode("os.custos");
  const reais = (v: number | null) =>
    verCustos && v !== null ? Number(v) : null;
  return (
    <>
      <Link
        href={rotaAtivo(ativo.id)}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← {ativo.codigo} · {ativo.nome}
      </Link>
      <PageHeader
        title="Editar ativo"
        description={`${ativo.codigo}. Situação e baixa ficam na ficha.`}
      />
      <FormAtivo
        acao={salvarAtivo}
        verCustos={verCustos}
        valores={{
          id: ativo.id,
          nome: ativo.nome,
          categoria_id: ativo.categoria_id,
          fabricante: ativo.fabricante,
          modelo: ativo.modelo,
          numero_serie: ativo.numero_serie,
          bloco: ativo.bloco,
          loja_id: ativo.loja_id,
          area: ativo.area,
          ponto: ativo.ponto,
          compra_data: ativo.compra_data,
          garantia_fim: ativo.garantia_fim,
          fornecedor_id: ativo.fornecedor_id,
          setor_id: ativo.setor_id,
          responsavel_id: ativo.responsavel_id,
          observacao: ativo.observacao,
          compra_valor: reais(ativo.compra_valor),
          valor_reposicao: reais(ativo.valor_reposicao),
          vida_util_anos:
            ativo.vida_util_anos === null ? null : Number(ativo.vida_util_anos),
        }}
        {...opcoes}
      />
    </>
  );
}
