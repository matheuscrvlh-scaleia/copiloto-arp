import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { dadosDoFormulario } from "@/components/os/novo/dados";
import type { InicialDoFormulario } from "@/components/os/novo/tipos";
import { Cartao, PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarNumeroChamado } from "@/lib/os/numeros";
import { os } from "@/server/os/base";
import { lerChamado } from "@/server/os/chamados";
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
  const [busca, dados] = await Promise.all([searchParams, dadosDoFormulario()]);
  if (!dados) return <SemAcesso />;
  const inicial = await montarInicial(busca);
  return (
    <Cartao className="p-5 md:p-7">
      <NovoNaPagina dados={dados} inicial={inicial} />
    </Cartao>
  );
}

/** Lê o contexto da URL (sempre pela sessão: só o que a pessoa vê). */
async function montarInicial(busca: Busca): Promise<InicialDoFormulario> {
  const db = await os();
  const inicial: InicialDoFormulario = { contexto: [] };

  const origem = um(busca.converter) ?? um(busca.duplicar);
  if (origem) {
    const ch = await lerChamado(origem);
    if (ch) {
      const converter = Boolean(um(busca.converter));
      Object.assign(inicial, {
        titulo: ch.titulo,
        descricao: ch.descricao ?? undefined,
        prioridade: ch.prioridade,
        etiquetas: ch.etiquetas.join(", "),
        lojaId: ch.loja_id ?? undefined,
        ativoId: ch.ativo_id ?? undefined,
      });
      if (converter) {
        inicial.tipo = "os";
        inicial.convertidoDeId = ch.id;
        inicial.vinculadoAId = ch.vinculado_a_id ?? undefined;
        inicial.contexto.push({
          rotulo: "Convertendo",
          valor: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
        });
      } else {
        inicial.setorId = ch.setor_id;
        inicial.categoriaId = ch.categoria_id;
        inicial.tipo = ch.tipo;
        inicial.contexto.push({
          rotulo: "Cópia de",
          valor: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
        });
      }
    }
  }

  const vinculado = um(busca.vinculado);
  if (vinculado) {
    const ch = await lerChamado(vinculado);
    if (ch) {
      inicial.vinculadoAId = ch.id;
      inicial.lojaId ??= ch.loja_id ?? undefined;
      inicial.ativoId ??= ch.ativo_id ?? undefined;
      inicial.contexto.push({
        rotulo: "Ligado a",
        valor: `${formatarNumeroChamado(ch.numero)} ${ch.titulo}`,
      });
    }
  }

  const ativo = um(busca.ativo);
  if (ativo) {
    const { data } = await db.rpc("ativos_para_vincular");
    const a = (data ?? []).find((x) => x.id === ativo);
    if (a) {
      inicial.ativoId = a.id;
      inicial.contexto.push({
        rotulo: "Ativo",
        valor: `${a.codigo} · ${a.nome}`,
      });
    }
  }

  const loja = um(busca.loja);
  if (loja) {
    const { data } = await db
      .from("lojas")
      .select("id, luc, nome")
      .eq("id", loja)
      .maybeSingle();
    if (data) {
      inicial.lojaId = data.id;
      inicial.contexto.push({
        rotulo: "Loja",
        valor: `${data.luc} · ${data.nome}`,
      });
    }
  }

  const vistoria = um(busca.vistoria);
  if (vistoria) {
    const [v, amb] = await Promise.all([
      db
        .from("vistorias")
        .select("id, codigo, loja_id, bloco, unidade")
        .eq("id", vistoria)
        .maybeSingle(),
      um(busca.ambiente)
        ? db
            .from("vistoria_ambientes")
            .select("id, titulo, descricao")
            .eq("id", um(busca.ambiente) as string)
            .eq("vistoria_id", vistoria)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (v.data) {
      inicial.tipo = "os";
      inicial.vistoriaId = v.data.id;
      inicial.lojaId ??= v.data.loja_id ?? undefined;
      inicial.contexto.push({
        rotulo: "Vistoria",
        valor: `Laudo ${v.data.codigo}`,
      });
      if (amb.data) {
        inicial.ambienteId = amb.data.id;
        inicial.titulo ??=
          `${amb.data.titulo} – ${v.data.bloco} ${v.data.unidade}`.slice(
            0,
            200,
          );
        inicial.descricao ??= amb.data.descricao ?? undefined;
        inicial.contexto.push({ rotulo: "Ambiente", valor: amb.data.titulo });
      }
    }
  }
  return inicial;
}
