import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  Assistente,
  type InicialDoContrato,
} from "@/components/comercial/contratos/assistente";
import { Aviso } from "@/components/comercial/contratos/campos";
import { EditorDistrato } from "@/components/comercial/contratos/distrato";
import { Historico } from "@/components/comercial/contratos/historico";
import { EXEMPLO, TopoComercial } from "@/components/comercial/tela";
import { SemAcesso } from "@/components/protegido";
import {
  dadosIniciais,
  imovelDosLucs,
  lerDistrato,
  semValores,
} from "@/lib/comercial/contrato";
import { lerObrigatorios } from "@/lib/comercial/contrato-revisao";
import { contextoCom, parametros } from "@/server/comercial/base";
import {
  anexosDoContrato,
  contratoComDados,
  type FichaParaContrato,
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
  previa,
}: {
  /** null = contrato novo. */
  id: string | null;
  etapa: number;
  /** Contrato novo já com o LUC e/ou a ficha (vindos da Ocupação ou da ficha). */
  previa?: { luc?: string; ficha?: string };
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
  const avisos: string[] = [];
  let novo = dadosIniciais(params);
  let fichaInicial: FichaParaContrato | null = null;
  if (!contrato && previa?.ficha) {
    const f = fichas.find((x) => x.id === previa.ficha);
    if (!pode.fichas)
      avisos.push(
        "Puxar os dados da ficha pede a permissão de ver fichas cadastrais. Peça a quem tem ou preencha manualmente.",
      );
    else if (!f)
      avisos.push(
        "A ficha indicada não foi encontrada entre as recebidas. Escolha outra na etapa Partes.",
      );
    else if (f.tipo === "fiador")
      avisos.push("Ficha de fiador: escolha-a na etapa Garantia.");
    else fichaInicial = f;
  }
  const lucPedido = contrato ? undefined : (previa?.luc ?? fichaInicial?.luc);
  if (lucPedido) {
    const doEnet = new Map(lucs.lucs.map((l) => [l.numero, l]));
    if (doEnet.has(lucPedido))
      novo = {
        ...novo,
        imovel: imovelDosLucs(novo.imovel, [lucPedido], doEnet),
      };
    else if (previa?.luc)
      avisos.push(
        `LUC ${previa.luc} não encontrado no ENET. Escolha o imóvel na etapa 1.`,
      );
  }
  // Com a ficha, abre na etapa Partes para mostrar o que veio dela.
  const etapaNova = etapa || (fichaInicial ? 2 : 1);
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
        etapa: etapaNova,
        dados: pode.valores ? novo : semValores(novo),
      };

  return (
    <div className="flex flex-col gap-4">
      {lucs.exemplo && <TopoComercial exemplo={EXEMPLO.enet} />}
      {avisos.map((a) => (
        <Aviso key={a} tom="atencao">
          {a}
        </Aviso>
      ))}
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
        fichaInicial={fichaInicial}
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
