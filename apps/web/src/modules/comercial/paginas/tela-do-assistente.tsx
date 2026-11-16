import {
  dadosIniciais,
  imovelDosLucs,
  lerDados,
  lerDistrato,
  semValores,
} from "@arp/shared/comercial/contrato";
import { lerObrigatorios } from "@arp/shared/comercial/contrato-revisao";
import type { FichaParaContrato } from "@arp/shared/comercial/contratos/contratos";
import { useSuspenseQueries } from "@tanstack/react-query";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { SemAcesso } from "@/components/protegido";
import { useSessao } from "@/lib/sessao";
import {
  Assistente,
  type InicialDoContrato,
} from "@/modules/comercial/components/contratos/assistente";
import { Aviso } from "@/modules/comercial/components/contratos/campos";
import { EditorDistrato } from "@/modules/comercial/components/contratos/distrato";
import { Historico } from "@/modules/comercial/components/contratos/historico";
import { EXEMPLO, TopoComercial } from "@/modules/comercial/components/tela";
import {
  consultaApoioContrato,
  consultaContratoOuNada,
} from "../api/contratos";

// O assistente (contrato novo ou existente) e o distrato existente: tudo o
// que a tela precisa, lido em paralelo. Fica em <Suspense>.

export function TelaDoAssistente({
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
  const ctx = useSessao();
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
  return <Carregado id={id} etapa={etapa} previa={previa} pode={pode} />;
}

interface Pode {
  ver: boolean;
  editar: boolean;
  valores: boolean;
  fichas: boolean;
  gerar: boolean;
}

function Carregado({
  id,
  etapa,
  previa,
  pode,
}: {
  id: string | null;
  etapa: number;
  previa?: { luc?: string; ficha?: string };
  pode: Pode;
}) {
  const [{ data: apoio }, { data: um }] = useSuspenseQueries({
    queries: [consultaApoioContrato, consultaContratoOuNada(id)],
  });
  const ctx = { hoje: apoio.hoje };
  const lucs = { lucs: apoio.lucs, exemplo: apoio.exemplo };
  const fichas = apoio.fichas;
  const kit = apoio.kit;
  const anexos = um?.anexos ?? [];
  const versoes = um?.versoes ?? [];
  const contrato = um?.contrato ?? null;
  if (id && !contrato)
    return (
      <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
        Contrato não encontrado.
      </p>
    );

  const historico = <Historico versoes={versoes} />;

  if (contrato?.tipo === "distrato") {
    const vistoria = um?.vistoriaSaida ?? null;
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

  const params = apoio.parametros;
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
        dados: lerDados(contrato.dados),
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
        obrigatorios={lerObrigatorios(apoio.obrigatorios)}
        lucs={lucs.lucs}
        fichas={fichas}
        kit={kit}
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
