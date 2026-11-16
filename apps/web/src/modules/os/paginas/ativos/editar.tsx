import { rotaAtivo } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, naoEncontrado, useNavegar, useParametro } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDaEdicao, salvarAtivo } from "@/modules/os/api-ativos";
import { FormAtivo } from "@/modules/os/components/ativos/form-ativo";

// /os/ativos/:id/editar: o cadastro do ativo (situação e baixa na ficha).

export default function Pagina() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-[48rem]" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="os.ativos_gerenciar">
        <Formulario />
      </Protegido>
    </Suspense>
  );
}

function Formulario() {
  const id = useParametro("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) naoEncontrado();
  const verCustos = usePermissao("os.custos");
  const navegar = useNavegar();
  const acao = useMemo(() => salvarAtivo(navegar.push), [navegar]);
  // O ativo e as listas do formulário vêm juntos.
  const { data } = useSuspenseQuery(consultaDaEdicao(id));
  const { ativo, opcoes } = data;
  // Sem os.custos, os reais nem chegam ao navegador (a API os tira).
  const reais = (v: number | null) => (verCustos && v !== null ? v : null);
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
        acao={acao}
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
          vida_util_anos: ativo.vida_util_anos,
        }}
        {...opcoes}
      />
    </>
  );
}
