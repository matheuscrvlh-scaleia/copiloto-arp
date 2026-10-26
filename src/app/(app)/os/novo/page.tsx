import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import type { InicialDoFormulario } from "@/components/os/novo/tipos";
import { Cartao, PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarNumeroChamado } from "@/lib/os/numeros";
import { os } from "@/server/os/base";
import { lerAtivo } from "@/server/os/chamado-detalhe";
import { lerChamado } from "@/server/os/chamados";
import { dadosDoFormulario } from "@/server/os/formulario";
import { NovoNaPagina } from "./novo-na-pagina";

export const metadata: Metadata = { title: "Novo chamado" };

// Abrir chamado com contexto pela URL: ?ativo=<id> (etiqueta QR do ativo),
// ?loja=<id>, ?vinculado=<id>, ?vistoria=<id>&ambiente=<id> ("Gerar OS"),
// ?converter=<id> (Tarefa/Solicitação vira OS) e ?duplicar=<id>.

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Novo chamado"
        description="Escolha a categoria, escreva o título e envie. O resto é opcional."
      />
      <Suspense fallback={<CartaoCarregando altura="h-[32rem]" />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

async function Conteudo({ searchParams }: { searchParams: Promise<Busca> }) {
  const busca = await searchParams;
  // O formulário e o contexto da URL não dependem um do outro.
  const [dados, inicial] = await Promise.all([
    dadosDoFormulario(),
    montarInicial(busca),
  ]);
  if (!dados) return <SemAcesso />;
  return (
    <Cartao className="p-5 md:p-7">
      <NovoNaPagina dados={dados} inicial={inicial} />
    </Cartao>
  );
}

const nada = Promise.resolve({ data: null });

/**
 * Lê o contexto da URL (sempre pela sessão: só o que a pessoa vê). As
 * leituras saem juntas; a montagem segue a ordem de sempre (a loja e o
 * ativo da origem valem até a URL dizer outra coisa).
 */
async function montarInicial(busca: Busca): Promise<InicialDoFormulario> {
  const inicial: InicialDoFormulario = { contexto: [] };
  const origemId = um(busca.converter) ?? um(busca.duplicar);
  const vinculadoId = um(busca.vinculado);
  const ativoId = um(busca.ativo);
  const lojaId = um(busca.loja);
  const vistoriaId = um(busca.vistoria);
  const ambienteId = um(busca.ambiente);
  if (!origemId && !vinculadoId && !ativoId && !lojaId && !vistoriaId)
    return inicial;

  const db = await os();
  const [origem, ligado, ativo, loja, vistoria, ambiente] = await Promise.all([
    origemId ? lerChamado(origemId) : null,
    vinculadoId ? lerChamado(vinculadoId) : null,
    lerAtivo(ativoId ?? null),
    lojaId
      ? db.from("lojas").select("id, luc, nome").eq("id", lojaId).maybeSingle()
      : nada,
    vistoriaId
      ? db
          .from("vistorias")
          .select("id, codigo, loja_id, bloco, unidade")
          .eq("id", vistoriaId)
          .maybeSingle()
      : nada,
    vistoriaId && ambienteId
      ? db
          .from("vistoria_ambientes")
          .select("id, titulo, descricao")
          .eq("id", ambienteId)
          .eq("vistoria_id", vistoriaId)
          .maybeSingle()
      : nada,
  ]);

  if (origem) {
    const converter = Boolean(um(busca.converter));
    Object.assign(inicial, {
      titulo: origem.titulo,
      descricao: origem.descricao ?? undefined,
      prioridade: origem.prioridade,
      etiquetas: origem.etiquetas.join(", "),
      lojaId: origem.loja_id ?? undefined,
      ativoId: origem.ativo_id ?? undefined,
    });
    if (converter) {
      inicial.tipo = "os";
      inicial.convertidoDeId = origem.id;
      inicial.vinculadoAId = origem.vinculado_a_id ?? undefined;
      inicial.contexto.push({
        rotulo: "Convertendo",
        valor: `${formatarNumeroChamado(origem.numero)} ${origem.titulo}`,
      });
    } else {
      inicial.setorId = origem.setor_id;
      inicial.categoriaId = origem.categoria_id;
      inicial.tipo = origem.tipo;
      inicial.contexto.push({
        rotulo: "Cópia de",
        valor: `${formatarNumeroChamado(origem.numero)} ${origem.titulo}`,
      });
    }
  }

  if (ligado) {
    inicial.vinculadoAId = ligado.id;
    inicial.lojaId ??= ligado.loja_id ?? undefined;
    inicial.ativoId ??= ligado.ativo_id ?? undefined;
    inicial.contexto.push({
      rotulo: "Ligado a",
      valor: `${formatarNumeroChamado(ligado.numero)} ${ligado.titulo}`,
    });
  }

  if (ativo) {
    inicial.ativoId = ativo.id;
    inicial.contexto.push({
      rotulo: "Ativo",
      valor: `${ativo.codigo} · ${ativo.nome}`,
    });
  }

  if (loja.data) {
    inicial.lojaId = loja.data.id;
    inicial.contexto.push({
      rotulo: "Loja",
      valor: `${loja.data.luc} · ${loja.data.nome}`,
    });
  }

  const v = vistoria.data;
  if (v) {
    inicial.tipo = "os";
    inicial.vistoriaId = v.id;
    inicial.lojaId ??= v.loja_id ?? undefined;
    inicial.contexto.push({ rotulo: "Vistoria", valor: `Laudo ${v.codigo}` });
    const amb = ambiente.data;
    if (amb) {
      inicial.ambienteId = amb.id;
      inicial.titulo ??= `${amb.titulo} – ${v.bloco} ${v.unidade}`.slice(
        0,
        200,
      );
      inicial.descricao ??= amb.descricao ?? undefined;
      inicial.contexto.push({ rotulo: "Ambiente", valor: amb.titulo });
    }
  }
  return inicial;
}
