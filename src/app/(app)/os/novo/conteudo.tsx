import type { InicialDoFormulario } from "@/components/os/novo/tipos";
import { Cartao } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { numeroDo } from "@/lib/os/numeros";
import { os } from "@/server/os/base";
import { lerAtivo } from "@/server/os/chamado-detalhe";
import { lerChamado } from "@/server/os/chamados";
import { dadosDoFormulario } from "@/server/os/formulario";
import { lojasDoModulo } from "@/server/os/lojas";
import { NovoNaPagina } from "./novo-na-pagina";

// Abrir chamado (/os/novo) ou OS (/os/ordens/nova) com contexto pela URL:
// ?ativo=<id> (etiqueta QR do ativo), ?loja=<id> (da lista de lojas em
// cache), ?vinculado=<id> (chamado ligado), ?vistoria=<id>&ambiente=<id>
// ("Gerar OS"), ?duplicar=<id> e ?titulo=&descricao= (texto pronto, como o
// "Precisa de outro setor?" do Comercial). Um não vira o outro: a cópia e o
// vínculo só valem dentro do que a página abre.

export type Busca = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export async function ConteudoDoNovo({
  searchParams,
  ehOS,
}: {
  searchParams: Promise<Busca>;
  ehOS: boolean;
}) {
  const busca = await searchParams;
  // O formulário e o contexto da URL não dependem um do outro.
  const [dados, inicial] = await Promise.all([
    dadosDoFormulario(),
    montarInicial(busca, ehOS),
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
 * A loja da URL, da lista em cache do módulo (lojasDoModulo). Sem acesso ao
 * módulo, ou loja que não existe: sem loja (como a leitura pelo RLS).
 */
const lojaDaUrl = (id: string) =>
  lojasDoModulo().then(
    (lista) => lista.find((l) => l.id === id) ?? null,
    () => null,
  );

/**
 * Lê o contexto da URL (pela sessão, ou do cache do módulo com o mesmo
 * acesso: só o que a pessoa vê). As leituras saem juntas; a montagem segue
 * a ordem de sempre (a loja e o ativo da origem valem até a URL dizer outra
 * coisa).
 */
async function montarInicial(
  busca: Busca,
  ehOS: boolean,
): Promise<InicialDoFormulario> {
  const inicial: InicialDoFormulario = ehOS
    ? { tipo: "os", contexto: [] }
    : { contexto: [] };
  inicial.titulo = um(busca.titulo)?.slice(0, 200);
  inicial.descricao = um(busca.descricao)?.slice(0, 5000);
  const origemId = um(busca.duplicar);
  const vinculadoId = um(busca.vinculado);
  const ativoId = um(busca.ativo);
  const lojaId = um(busca.loja);
  const vistoriaId = um(busca.vistoria);
  const ambienteId = um(busca.ambiente);
  if (!origemId && !vinculadoId && !ativoId && !lojaId && !vistoriaId)
    return inicial;

  const db = await os();
  const [lida, ligado, ativo, loja, vistoria, ambiente] = await Promise.all([
    origemId ? lerChamado(origemId) : null,
    vinculadoId ? lerChamado(vinculadoId) : null,
    lerAtivo(ativoId ?? null),
    lojaId ? lojaDaUrl(lojaId) : null,
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

  // Duplicar: só OS vira OS e só chamado vira chamado.
  const origem = lida && (lida.tipo === "os") === ehOS ? lida : null;
  if (origem) {
    Object.assign(inicial, {
      titulo: origem.titulo,
      descricao: origem.descricao ?? undefined,
      prioridade: origem.prioridade,
      etiquetas: origem.etiquetas.join(", "),
      lojaId: origem.loja_id ?? undefined,
      ativoId: origem.ativo_id ?? undefined,
      setorId: origem.setor_id,
      categoriaId: origem.categoria_id,
      tipo: origem.tipo,
    });
    inicial.contexto.push({
      rotulo: "Cópia de",
      valor: `${numeroDo(origem)} ${origem.titulo}`,
    });
  }

  // O vínculo é sempre com um chamado (a OS aponta para o chamado).
  if (ligado && ligado.tipo !== "os") {
    inicial.vinculadoAId = ligado.id;
    inicial.lojaId ??= ligado.loja_id ?? undefined;
    inicial.ativoId ??= ligado.ativo_id ?? undefined;
    inicial.contexto.push({
      rotulo: "Ligado a",
      valor: `${numeroDo(ligado)} ${ligado.titulo}`,
    });
  }

  if (ativo) {
    inicial.ativoId = ativo.id;
    inicial.contexto.push({
      rotulo: "Ativo",
      valor: `${ativo.codigo} · ${ativo.nome}`,
    });
  }

  if (loja) {
    inicial.lojaId = loja.id;
    inicial.contexto.push({
      rotulo: "Loja",
      valor: `${loja.luc} · ${loja.nome}`,
    });
  }

  const v = vistoria.data;
  if (v) {
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
