import { formatarNumero } from "@arp/shared/formato";
import {
  CARTOES_OS,
  type CartaoOS,
  extrasAtivos,
  type FiltrosOS,
  lerFiltrosOS,
  urlDosFiltros,
} from "@arp/shared/os/ordem-lista";
import { paginaDaUrl, totalDePaginas } from "@arp/shared/os/paginacao";
import { PARAM_PAINEL } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  Building2,
  CircleCheck,
  Inbox,
  type LucideIcon,
  Timer,
} from "lucide-react";
import { Suspense, useMemo } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { TOM } from "@/components/estilos";
import { BotaoExportar } from "@/components/exportar";
import { Protegido } from "@/components/protegido";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/tons";
import { Link, Redirecionar, useBusca } from "@/lib/navegacao";
import { consultaDasOrdens, exportarOrdens } from "@/modules/os/api-ordens";
import { Atualizado, PainelDaBusca } from "@/modules/os/components/lista/topo";
import { CabecalhoOrdens } from "@/modules/os/components/operacoes";
import { FiltrosOrdens } from "@/modules/os/components/ordens/filtros";
import { ListaOrdens } from "@/modules/os/components/ordens/lista";
import { Relatorios } from "@/modules/os/components/ordens/relatorios";
import { hrefDaPagina, Paginacao } from "@/modules/os/components/paginacao";
import { useBuscaDaTela } from "@/modules/os/components/telas/lista";

const CAMINHO = "/os/ordens";

export default function Pagina() {
  return (
    <>
      <CabecalhoOrdens descricao="Acompanhe todas as OS, de todos os setores: as atrasadas, as em execução e as com terceirizado, com responsável, prazo, tempo, técnicos, minuto-homem e custo. Filtre por setor ou pessoa, abra o detalhe ao lado, imprima em lote e baixe as planilhas." />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="os.acessar">
          <Ordens />
          <Suspense fallback={null}>
            <PainelDaBusca caminho={CAMINHO} />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

function Ordens() {
  // Sem a janela lateral (?c=): abrir o detalhe não busca a lista de novo.
  const params = useBuscaDaTela();
  const naUrl = useBusca();
  const { data } = useSuspenseQuery(consultaDasOrdens(params));
  const f = useMemo(() => lerFiltrosOS(naUrl), [naUrl]);
  const pagina = paginaDaUrl(naUrl.pagina);
  const { total, comCustos } = data;
  // A exportação relê o filtro inteiro no clique (sem a página e a janela).
  const filtros = useMemo(() => {
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(naUrl))
      if (typeof v === "string" && k !== "pagina" && k !== PARAM_PAINEL)
        r[k] = v;
    return r;
  }, [naUrl]);

  const ultima = totalDePaginas(total);
  const lida = typeof params.pagina === "string" ? params.pagina : undefined;
  if (paginaDaUrl(lida) > ultima)
    return <Redirecionar para={hrefDaPagina(CAMINHO, naUrl, ultima)} />;

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={data.hora} />
      <FiltrosOrdens
        f={f}
        extras={extrasAtivos(f)}
        setores={data.opcoes.setores}
        pessoas={data.opcoes.pessoas}
        categorias={data.opcoes.categorias}
        tecnicos={data.opcoes.tecnicos}
        empresas={data.opcoes.empresas}
      />
      <Cartoes f={f} contagem={data.contagem} />
      <ListaOrdens
        key={pagina}
        linhas={data.linhas}
        total={total}
        comCustos={comCustos}
        acoes={
          data.podeExportar && (
            <BotaoExportar
              titulo="Ordens de serviço"
              filtros={data.filtros}
              nomeArquivo="ordens-de-servico"
              total={total}
              carregar={() => exportarOrdens(filtros)}
            />
          )
        }
        paginacao={
          <Paginacao
            pagina={pagina}
            total={total}
            href={(p) => hrefDaPagina(CAMINHO, naUrl, p)}
          />
        }
      />
      {data.podeExportar && (
        <Relatorios hoje={data.hoje} comCustos={comCustos} />
      )}
    </div>
  );
}

const ICONES: Record<CartaoOS, LucideIcon> = {
  abertas: Inbox,
  atrasadas: AlarmClock,
  em_execucao: Timer,
  terceirizadas: Building2,
  finalizadas_mes: CircleCheck,
};

const DETALHE: Record<CartaoOS, string> = {
  abertas: "aberto, em andamento ou aguardando",
  atrasadas: "em aberto e com o prazo vencido",
  em_execucao: "com o cronômetro rodando",
  terceirizadas: "com o terceirizado, ainda abertas",
  finalizadas_mes: "fechadas neste mês",
};

const ORDEM_DOS_CARTOES: CartaoOS[] = [
  "abertas",
  "atrasadas",
  "em_execucao",
  "terceirizadas",
  "finalizadas_mes",
];

const TONS = tonsDaTela("ordens", ORDEM_DOS_CARTOES.length);

/** Os cartões; clicar filtra a lista (de novo, volta para todas). */
function Cartoes({
  f,
  contagem,
}: {
  f: FiltrosOS;
  contagem: Record<CartaoOS, number>;
}) {
  return (
    <nav
      aria-label="Filtrar pelos indicadores"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5"
    >
      {ORDEM_DOS_CARTOES.map((c, i) => {
        const Icone = ICONES[c];
        const marcado = f.cartao === c;
        return (
          <Link
            key={c}
            href={urlDosFiltros(CAMINHO, f, { cartao: marcado ? null : c })}
            aria-current={marcado ? "true" : undefined}
            scroll={false}
            className={`flutua flex min-h-32 flex-col gap-2 rounded-[1.75rem] p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-marca md:p-5 ${TOM[TONS[i] ?? "claro"]} ${marcado ? CLASSE_MARCADO : ""}`}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-neutral-600">
                {CARTOES_OS[c]}
              </span>
              <Icone className="size-4 shrink-0 opacity-60" aria-hidden />
            </span>
            <span className="mt-auto text-3xl font-semibold tracking-tight tabular-nums">
              {formatarNumero(contagem[c])}
            </span>
            <span className="text-xs text-neutral-500">
              {marcado ? "Filtrando · toque para ver todas" : DETALHE[c]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        quantidade={5}
        className="grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      />
      <CartaoCarregando altura="h-[36rem]" />
    </TelaCarregando>
  );
}
