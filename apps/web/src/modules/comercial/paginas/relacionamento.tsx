import { linhaDeFiltros } from "@arp/shared/comercial/formato";
import {
  type Aniversario,
  PERIODOS_CONTATO,
  type PeriodoContato,
  ROTULO_SOCIO_FICHA,
  TIPOS_DATA,
  type TipoData,
} from "@arp/shared/comercial/relacionamento";
import { NOMES_DOS_MESES } from "@arp/shared/comercial/vencimentos";
import { formatarData, formatarNumero } from "@arp/shared/formato";
import { useSuspenseQueries } from "@tanstack/react-query";
import {
  Building2,
  Cake,
  CalendarDays,
  CalendarRange,
  MessageSquare,
} from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/exportar";
import { type Detalhe, ProvedorDetalhe } from "@/components/modal-detalhe";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  COLUNAS_EXPORTAR_CONTATOS,
  exportarContatos,
  ListaDeContatos,
} from "@/modules/comercial/components/relacionamento/contatos";
import { RegistrarContato } from "@/modules/comercial/components/relacionamento/form-contato";
import {
  AbasDaTela,
  CartaoDaTela,
  CartoesComercial,
  EXEMPLO,
  FiltrosComercial,
  Fonte,
  hrefCom,
  TabelaLista,
  TopoComercial,
} from "@/modules/comercial/components/tela";
import {
  consultaAniversariosSe,
  consultaConfigRelacionamento,
  consultaContatosSe,
  consultaLocatariosSe,
  registrarContato,
} from "../api/relacionamento";
import { type FiltrosCom, useFiltrosCom } from "../base";

// /comercial/relacionamento (app/(app)/comercial/relacionamento/page.tsx).

const BASE = "/comercial/relacionamento";
type Aba = "aniversarios" | "contatos";
const ABAS: Record<Aba, string> = {
  aniversarios: "Aniversários",
  contatos: "Contatos registrados",
};

export default function Page() {
  return (
    <>
      <PageHeader
        title="Relacionamento"
        description="Aniversários de contrato na ARP e de sócio, e o registro de contatos com os locatários."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.relacionamento.ver">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

const diaMes = (d: string) => formatarData(d).slice(0, 5);

function Tela() {
  const f = useFiltrosCom("relacionamento");
  return f ? <Relacionamento f={f} /> : <Esqueleto />;
}

function Relacionamento({ f }: { f: FiltrosCom }) {
  const aba: Aba = f.um("aba") === "contatos" ? "contatos" : "aniversarios";
  const exportar = f.ctx.pode("comercial.exportar");
  const registra = f.ctx.pode("comercial.relacionamento.registrar");
  const [{ data: config }, { data: locs }] = useSuspenseQueries({
    queries: [consultaConfigRelacionamento, consultaLocatariosSe(registra)],
  });
  const locatarios = locs?.locatarios ?? [];
  // Filtros de cada aba (a API lê os contatos; os aniversários do mês vêm
  // inteiros e a tela filtra bloco e tipo, como antes).
  const periodo: PeriodoContato =
    f.um("periodo") in PERIODOS_CONTATO
      ? (f.um("periodo") as PeriodoContato)
      : "";
  const tipo = config.tipos.includes(f.um("tipo")) ? f.um("tipo") : "";
  const mesUrl = Number(f.um("mes"));
  const [{ data: daAba }, { data: doAno }] = useSuspenseQueries({
    queries: [
      consultaContatosSe(aba === "contatos", {
        periodo,
        tipo,
        bloco: f.um("bloco"),
      }),
      consultaAniversariosSe(
        aba === "aniversarios",
        mesUrl >= 1 && mesUrl <= 12 ? mesUrl : null,
      ),
    ],
  });
  const dados = daAba ?? doAno;
  if (!dados) return null;
  const ctx = { ...f.ctx, hoje: dados.hoje, dadosDe: dados.dadosDe };
  const enet = { exemplo: dados.exemplo };
  const blocos = dados.blocos;
  const bloco = blocos.includes(f.um("bloco")) ? f.um("bloco") : "";

  const botaoRegistrar = registra ? (
    <RegistrarContato
      acao={registrarContato}
      locatarios={locatarios}
      tipos={config.tipos}
      canais={config.canais}
      hoje={ctx.hoje}
      abreChamado={ctx.pode("os.acessar")}
    />
  ) : null;
  const abas = (
    <AbasDaTela
      rotulo="Relacionamento"
      ativa={aba}
      abas={(Object.keys(ABAS) as Aba[]).map((a) => ({
        chave: a,
        rotulo: ABAS[a],
        href: hrefCom(BASE, f.busca, { aba: a === "aniversarios" ? null : a }),
      }))}
    />
  );
  const barraBloco = {
    chave: "bloco",
    rotulo: "Bloco",
    todos: "Todos os blocos",
    valor: bloco,
    icone: <Building2 className="size-4" />,
    opcoes: blocos.map((b) => ({ valor: b, rotulo: b })),
  };

  if (daAba) {
    const contatos = daAba.contatos;
    const nomes = new Map(daAba.nomes.map((n) => [n.id, n.nome]));
    const linha = linhaDeFiltros([
      { rotulo: "Período", valor: PERIODOS_CONTATO[periodo].rotulo },
      { rotulo: "Tipo", valor: tipo || "Todos" },
      { rotulo: "Bloco", valor: bloco || "Todos" },
    ]);
    return (
      <div className="flex flex-col gap-6">
        <FiltrosComercial
          tela="relacionamento"
          hoje={ctx.hoje}
          lembrado={f.lembrado}
          selecoes={[
            {
              chave: "periodo",
              rotulo: "Período",
              todos: PERIODOS_CONTATO[""].rotulo,
              valor: periodo,
              icone: <CalendarRange className="size-4" />,
              largura: "w-48",
              opcoes: (Object.keys(PERIODOS_CONTATO) as PeriodoContato[])
                .filter((p) => p)
                .map((p) => ({ valor: p, rotulo: PERIODOS_CONTATO[p].rotulo })),
            },
            {
              chave: "tipo",
              rotulo: "Tipo",
              todos: "Todos os tipos",
              valor: tipo,
              icone: <MessageSquare className="size-4" />,
              largura: "w-48",
              opcoes: config.tipos.map((t) => ({ valor: t, rotulo: t })),
            },
            barraBloco,
          ]}
        />
        <TopoComercial
          dadosDe={ctx.dadosDe}
          filtros={linha}
          exemplo={
            contatos.some((c) => c.exemplo)
              ? "registros de contato de exemplo e locatários do ENET de exemplo"
              : enet.exemplo
                ? EXEMPLO.enet
                : undefined
          }
          acoes={
            <div className="flex flex-wrap items-center gap-2">
              {exportar && (
                <BotaoExportar
                  titulo="Contatos com locatários"
                  filtros={`${linha} · ${ctx.dadosDe}`}
                  nomeArquivo="contatos-com-locatarios"
                  colunas={COLUNAS_EXPORTAR_CONTATOS}
                  linhas={exportarContatos(contatos, nomes)}
                />
              )}
              {botaoRegistrar}
            </div>
          }
        />
        {abas}
        <Secao
          titulo="Contatos registrados"
          descricao="Substitui as abas Feedbacks e Base de atendimento da planilha. Feedback, reclamação e sugestão também aparecem nos Feedbacks do Censo."
        >
          <ListaDeContatos
            contatos={contatos}
            nomes={nomes}
            feedbacks={new Set(config.feedbacks)}
          />
          <Fonte>
            Registros feitos no sistema (quem registrou e quando são gravados
            sozinhos). Locatário, contrato e LUC vêm do ENET.
          </Fonte>
        </Secao>
      </div>
    );
  }

  if (!doAno) return null;
  const { mes, ano } = doAno;
  const mesAtual = Number(ctx.hoje.slice(5, 7));
  const tipoData = f.um("data") in TIPOS_DATA ? (f.um("data") as TipoData) : "";
  const doMes = doAno.aniversarios.filter((a) => !bloco || a.bloco === bloco);
  const lista = tipoData ? doMes.filter((a) => a.tipo === tipoData) : doMes;
  const contratos = doMes.filter((a) => a.tipo === "contrato").length;
  const socios = doMes.length - contratos;
  const semData = doAno.semData;
  const daFicha = doMes.some((a) => a.origem === "ficha");
  const nomeMes = NOMES_DOS_MESES[mes - 1] ?? "";
  const linha = linhaDeFiltros([
    { rotulo: "Mês", valor: `${nomeMes}/${ano}` },
    {
      rotulo: "Tipo de data",
      valor: tipoData ? TIPOS_DATA[tipoData] : "Todas",
    },
    { rotulo: "Bloco", valor: bloco || "Todos" },
  ]);
  const hrefTipo = (t: TipoData) =>
    hrefCom(BASE, f.busca, { data: tipoData === t ? null : t });
  const nomeDe = (a: Aniversario) =>
    a.socio ? `${a.socio} (sócio de ${a.locatario})` : a.locatario;
  const detalhe = (a: Aniversario): Detalhe => ({
    secao:
      a.tipo === "contrato"
        ? "Aniversário de contrato"
        : "Aniversário de sócio",
    titulo: nomeDe(a),
    subtitulo: `${a.luc} · ${a.bloco}`,
    resumo: [
      { rotulo: "Data", valor: diaMes(a.data) },
      ...(a.anos !== null
        ? [{ rotulo: "Anos de ARP", valor: String(a.anos) }]
        : []),
      { rotulo: "Locatário", valor: a.locatario },
      { rotulo: "Contrato", valor: a.contrato || "—" },
    ],
    fontes: [
      {
        rotulo: "Fonte",
        valor:
          a.tipo === "contrato"
            ? "ENET — Contratos (data de início)"
            : a.origem === "ficha"
              ? `${ROTULO_SOCIO_FICHA} (ficha cadastral usada em contrato; a idade não aparece)`
              : "ENET — Clientes (data de nascimento do sócio; a idade não aparece)",
      },
    ],
    tabelas: [],
    link:
      registra && a.contrato
        ? {
            href: `${BASE}/contatos/novo?contrato=${encodeURIComponent(a.contrato)}`,
            rotulo: "Registrar contato",
          }
        : undefined,
  });

  return (
    <ProvedorDetalhe exportar={exportar}>
      <div className="flex flex-col gap-6">
        <FiltrosComercial
          tela="relacionamento"
          hoje={ctx.hoje}
          lembrado={f.lembrado}
          selecoes={[
            {
              chave: "mes",
              rotulo: "Mês",
              todos: `${NOMES_DOS_MESES[mesAtual - 1]} (mês atual)`,
              valor:
                mesUrl >= 1 && mesUrl <= 12 && mesUrl !== mesAtual
                  ? String(mesUrl)
                  : "",
              icone: <CalendarDays className="size-4" />,
              largura: "w-52",
              opcoes: NOMES_DOS_MESES.map((m, i) => ({
                valor: String(i + 1),
                rotulo: m,
              })).filter((o) => Number(o.valor) !== mesAtual),
            },
            {
              chave: "data",
              rotulo: "Tipo de data",
              todos: "Todas as datas",
              valor: tipoData,
              icone: <Cake className="size-4" />,
              opcoes: Object.entries(TIPOS_DATA).map(([valor, rotulo]) => ({
                valor,
                rotulo,
              })),
            },
            barraBloco,
          ]}
        />
        <TopoComercial
          dadosDe={ctx.dadosDe}
          filtros={linha}
          exemplo={EXEMPLO.enet}
          acoes={
            <div className="flex flex-wrap items-center gap-2">
              {exportar && (
                <BotaoExportar
                  titulo={`Aniversários de ${nomeMes.toLowerCase()}`}
                  filtros={`${linha} · ${ctx.dadosDe}`}
                  nomeArquivo={`aniversarios-${String(mes).padStart(2, "0")}-${ano}`}
                  colunas={[
                    { titulo: "Data" },
                    { titulo: "Tipo" },
                    { titulo: "Anos de ARP", numero: true },
                    { titulo: "Locatário" },
                    { titulo: "Sócio" },
                    { titulo: "LUC" },
                    { titulo: "Bloco" },
                  ]}
                  linhas={lista.map((a) => [
                    diaMes(a.data),
                    TIPOS_DATA[a.tipo],
                    a.anos,
                    a.locatario,
                    a.socio
                      ? `${a.socio}${a.origem === "ficha" ? ` (${ROTULO_SOCIO_FICHA})` : ""}`
                      : "",
                    a.luc,
                    a.bloco,
                  ])}
                />
              )}
              {botaoRegistrar}
            </div>
          }
        />
        {abas}
        <CartoesComercial>
          <CartaoDaTela
            titulo="Aniversários de contrato no mês"
            valor={formatarNumero(contratos)}
            detalhe="Data de início do contrato na ARP"
            fonte="ENET — Contratos"
            exemplo={EXEMPLO.enet}
            href={hrefTipo("contrato")}
            ativo={tipoData === "contrato"}
          />
          <CartaoDaTela
            titulo="Aniversários de sócio no mês"
            valor={formatarNumero(socios)}
            detalhe={
              semData
                ? `${formatarNumero(semData)} sócios sem data de nascimento no ENET`
                : "Data de nascimento do sócio"
            }
            fonte="ENET — Clientes"
            exemplo={EXEMPLO.enet}
            href={hrefTipo("socio")}
            ativo={tipoData === "socio"}
          />
        </CartoesComercial>
        <Secao
          titulo={`Aniversários de ${nomeMes.toLowerCase()}`}
          descricao={`Lembrete dentro do sistema ${config.lembreteDias} ${config.lembreteDias === 1 ? "dia" : "dias"} antes (parâmetro), para quem tem a permissão desta tela; nada é enviado ao locatário. A idade do sócio não aparece.`}
        >
          <TabelaLista
            colunas={[
              { titulo: "Data" },
              { titulo: "Tipo" },
              { titulo: "Anos de ARP", numero: true },
              { titulo: "Locatário", classe: "min-w-56" },
              { titulo: "LUC" },
              { titulo: "Bloco" },
            ]}
            ordemInicial={{ coluna: 0, desc: false }}
            placeholder="Buscar locatário, sócio, LUC…"
            vazio="Nenhum aniversário nesse filtro."
            alturaMax="max-h-[40rem]"
            linhas={lista.map((a) => ({
              chave: `${a.tipo}:${a.chave}`,
              busca: `${a.locatario} ${a.socio ?? ""} ${a.luc} ${a.bloco} ${TIPOS_DATA[a.tipo]}`,
              detalhe: detalhe(a),
              tom: a.data === ctx.hoje ? "atencao" : undefined,
              celulas: [
                <span key="d" className="tabular-nums">
                  {diaMes(a.data)}
                </span>,
                <span
                  key="t"
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${a.tipo === "contrato" ? "bg-sky-400/20 text-sky-800" : "bg-green-400/20 text-green-800"}`}
                >
                  {TIPOS_DATA[a.tipo]}
                </span>,
                a.anos === null ? "" : formatarNumero(a.anos),
                <span key="l" className="font-medium">
                  {nomeDe(a)}
                  {a.origem === "ficha" && (
                    <span className="block text-xs font-normal text-neutral-500">
                      {ROTULO_SOCIO_FICHA}
                    </span>
                  )}
                </span>,
                <span key="u" className="font-mono text-xs">
                  {a.luc}
                </span>,
                a.bloco,
              ],
              ordem: [a.data, a.tipo, a.anos, nomeDe(a), a.luc, a.bloco],
            }))}
            rodape={["Total", `${formatarNumero(lista.length)} aniversários`]}
          />
          <Fonte>
            ENET — Contratos (data de início; só contratos ativos com 1 ano ou
            mais) e Clientes (data de nascimento dos sócios de locatários
            ativos). Sem a data no ENET, ela vem da ficha cadastral usada em
            contrato.
          </Fonte>
          {daFicha && <Nota>{ROTULO_SOCIO_FICHA}.</Nota>}
        </Secao>
      </div>
    </ProvedorDetalhe>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando className="sm:grid-cols-2" quantidade={2} />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
