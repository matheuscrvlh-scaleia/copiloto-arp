import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  Assistente,
  type InicialDoContrato,
} from "@/components/comercial/contratos/assistente";
import { EditorDistrato } from "@/components/comercial/contratos/distrato";
import { Historico } from "@/components/comercial/contratos/historico";
import { EXEMPLO, TopoComercial } from "@/components/comercial/tela";
import { SemAcesso } from "@/components/protegido";
import {
  dadosIniciais,
  lerDistrato,
  semValores,
} from "@/lib/comercial/contrato";
import { lerObrigatorios } from "@/lib/comercial/contrato-revisao";
import { contextoCom, parametros } from "@/server/comercial/base";
import {
  anexosDoContrato,
  contratoComDados,
  fichasParaContrato,
  lucsParaContrato,
  parametrosDoContrato,
  versoesDoContrato,
  vistoriaDoLuc,
} from "@/server/comercial/contratos";
import { documentosDoKit } from "@/server/comercial/kit";

// O assistente (contrato novo ou existente) e o distrato existente: tudo o
// que a tela precisa, lido em paralelo. Lê a sessão: fica em <Suspense>.

export async function TelaDoAssistente({
  id,
  etapa,
}: {
  /** null = contrato novo. */
  id: string | null;
  etapa: number;
}) {
  const ctx = await contextoCom();
  const pode = {
    ver:
      ctx.pode("comercial.contratos.ver") ||
      ctx.pode("comercial.contratos.editar") ||
      ctx.pode("comercial.contratos.gerar"),
    editar: ctx.pode("comercial.contratos.editar"),
    valores: ctx.pode("comercial.valores.ver"),
    fichas: ctx.pode("comercial.formulario.ver"),
    gerar: ctx.pode("comercial.contratos.gerar"),
  };
  if (!pode.ver || (!id && !pode.editar)) return <SemAcesso />;

  const [p, contrato, lucs, fichas, kit, anexos, versoes] = await Promise.all([
    parametros(),
    id ? contratoComDados(id) : Promise.resolve(null),
    lucsParaContrato(),
    pode.editar ? fichasParaContrato() : Promise.resolve([]),
    documentosDoKit(),
    id ? anexosDoContrato(id) : Promise.resolve([]),
    id ? versoesDoContrato(id) : Promise.resolve([]),
  ]);
  if (id && !contrato)
    return (
      <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
        Contrato não encontrado.
      </p>
    );

  const historico = <Historico versoes={versoes} />;

  if (contrato?.tipo === "distrato") {
    const vistoria = await vistoriaDoLuc(
      contrato.dados.luc ? [contrato.dados.luc] : [],
      "saida",
    );
    return (
      <>
        <EditorDistrato
          inicial={{
            id: contrato.id,
            status: contrato.status,
            versao: contrato.versao,
            atualizadoEm: contrato.atualizadoEm,
            atualizadoPor: contrato.atualizadoPor,
            dados: lerDistrato(contrato.dados),
          }}
          vistoriaSaida={vistoria}
          pode={pode}
          exemplo={lucs.exemplo}
        />
        {historico}
      </>
    );
  }

  const params = parametrosDoContrato(p);
  const novo = dadosIniciais(params);
  const inicial: InicialDoContrato = contrato
    ? {
        id: contrato.id,
        status: contrato.status,
        versao: contrato.versao,
        atualizadoEm: contrato.atualizadoEm,
        atualizadoPor: contrato.atualizadoPor,
        etapa: etapa || contrato.etapaAtual,
        dados: contrato.dados,
      }
    : {
        id: null,
        status: "rascunho",
        versao: 1,
        atualizadoEm: null,
        atualizadoPor: null,
        etapa: etapa || 1,
        dados: pode.valores ? novo : semValores(novo),
      };

  return (
    <div className="flex flex-col gap-4">
      {lucs.exemplo && <TopoComercial exemplo={EXEMPLO.enet} />}
      <Assistente
        inicial={inicial}
        parametros={params}
        obrigatorios={lerObrigatorios(p.obrigatorios_garantia)}
        lucs={lucs.lucs}
        fichas={fichas}
        kit={kit.map((d) => ({
          documentoId: d.id,
          nome: d.nome,
          ativo: d.ativo,
          todo_contrato: d.todo_contrato,
          blocos: d.blocos,
          ordem: d.ordem,
          versaoId: d.atual?.id ?? null,
          versao: d.atual?.versao ?? null,
          validade: d.atual?.validade ?? null,
        }))}
        anexos={anexos}
        hoje={ctx.hoje}
        pode={pode}
      >
        {historico}
      </Assistente>
    </div>
  );
}

export function EsqueletoDoAssistente() {
  return (
    <TelaCarregando>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <CartaoCarregando altura="h-96" />
        <CartaoCarregando altura="h-[32rem]" />
      </div>
    </TelaCarregando>
  );
}
