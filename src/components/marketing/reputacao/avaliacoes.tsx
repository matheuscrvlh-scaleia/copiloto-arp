import { Info, Star } from "lucide-react";
import { SeloStatus } from "@/components/dashboard/indicador";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { AbrirNaFerramenta } from "@/components/dashboard/tela";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  type AvaliacaoLinha,
  SITUACOES,
  type Situacao,
} from "@/lib/marketing/reputacao";

// Peças da Reputação usadas na aba ARP e no detalhe do locatário: a lista de
// avaliações (mesmo formato nos dois lugares), as estrelas e o selo de
// situação.

/** Cinco estrelas, as cheias em âmbar; o número fica para leitor de tela. */
export function EstrelasVisuais({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${n} de 5 estrelas`}
      title={`${n} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={
            i <= n
              ? "size-3.5 fill-amber-400 text-amber-400"
              : "size-3.5 text-neutral-300"
          }
        />
      ))}
    </span>
  );
}

export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const s = SITUACOES[situacao];
  return <SeloStatus status={s.status} rotulo={s.rotulo} />;
}

const PASSOS_GERENTE = [
  "Entrar no Google com a conta que é proprietária do perfil da loja.",
  "Pesquisar o nome da loja no Google (ou abrir business.google.com) até aparecer o painel “Seu Perfil da Empresa”.",
  "Clicar no menu ⋮ (Mais) e em Configurações do perfil › Pessoas e acesso.",
  "Clicar em Adicionar, digitar o e-mail Google da ARP (o Marketing da ARP informa) e escolher o acesso Gerente, não Proprietário.",
  "Clicar em Convidar. A ARP aceita o convite e passa a ver todas as avaliações da loja.",
];

/** Passo a passo para o locatário pôr o perfil dele no Google sob a ARP. */
export function ComoAdicionarAArp() {
  return (
    <details className="group mt-3 rounded-2xl bg-neutral-900/[0.03] px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-neutral-600 [&::-webkit-details-marker]:hidden">
        <span className="grid size-5 place-items-center rounded-full bg-neutral-900 text-white">
          <Info className="size-3" aria-hidden />
        </span>
        Como o locatário coloca o perfil dele sob a ARP (passo a passo)
      </summary>
      <p className="mt-2 text-neutral-600">
        Para a ARP ver todas as avaliações, o dono do perfil da loja no Google
        adiciona a ARP como gerente. A loja continua proprietária e pode tirar o
        acesso quando quiser. Passos para enviar ao locatário:
      </p>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-neutral-600">
        {PASSOS_GERENTE.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className="mt-2 text-neutral-500">
        Depois que a ARP aceitar, mude o acesso do locatário para “Gerente do
        perfil” em Configurações.
      </p>
    </details>
  );
}

/** "no mesmo dia", "1 dia", "2,5 dias". */
export function textoDias(d: number): string {
  if (d < 1) return "no mesmo dia";
  const n = formatarNumero(d, Number.isInteger(d) ? 0 : 1);
  return `${n} ${d < 2 ? "dia" : "dias"}`;
}

const COLUNAS = [
  { titulo: "Data" },
  { titulo: "Estrelas" },
  { titulo: "Comentário", classe: "min-w-64 max-w-md whitespace-normal" },
  { titulo: "Autor" },
  { titulo: "Respondida" },
  { titulo: "Tempo para responder", numero: true },
  { titulo: "Tema" },
  { titulo: "" },
];

/** Lista de avaliações (a mais recente primeiro), com o link para responder no Google. */
export function ListaDeAvaliacoes({
  avaliacoes,
  mapsUri,
  vazio = "Nenhuma avaliação nesse filtro.",
}: {
  avaliacoes: AvaliacaoLinha[];
  mapsUri: string | null;
  vazio?: string;
}) {
  const media = avaliacoes.length
    ? avaliacoes.reduce((s, a) => s + a.estrelas, 0) / avaliacoes.length
    : null;
  const respondidas = avaliacoes.filter((a) => a.respondida).length;
  return (
    <TabelaLista
      colunas={COLUNAS}
      ordemInicial={{ coluna: 0, desc: true }}
      placeholder="Buscar no comentário, autor ou tema…"
      vazio={vazio}
      alturaMax="max-h-[40rem]"
      linhas={avaliacoes.map((a) => ({
        chave: a.id,
        busca: `${a.comentario} ${a.autor} ${a.tema ?? ""}`,
        tom: a.reclamacao && !a.respondida ? "atencao" : undefined,
        celulas: [
          <span key="d" className="whitespace-nowrap tabular-nums">
            {formatarData(a.data)}
          </span>,
          <EstrelasVisuais key="e" n={a.estrelas} />,
          a.comentario || (
            <span key="c" className="text-neutral-400">
              (sem comentário)
            </span>
          ),
          <span key="a" className="whitespace-nowrap">
            {a.autor}
          </span>,
          a.respondida ? (
            "Sim"
          ) : (
            <span
              key="r"
              className={a.reclamacao ? "font-semibold text-red-700" : ""}
            >
              Não
              {a.diasSemResposta !== null &&
                (a.diasSemResposta === 0
                  ? " (de hoje)"
                  : ` (há ${a.diasSemResposta} ${a.diasSemResposta === 1 ? "dia" : "dias"})`)}
            </span>
          ),
          a.diasParaResponder === null ? (
            <span key="t" className="text-neutral-300">
              —
            </span>
          ) : (
            textoDias(a.diasParaResponder)
          ),
          a.tema ?? (
            <span key="tm" className="text-neutral-400">
              sem tema
            </span>
          ),
          mapsUri ? (
            <AbrirNaFerramenta
              key="g"
              href={mapsUri}
              ferramenta="Google"
              compacto
            />
          ) : (
            ""
          ),
        ],
        ordem: [
          a.criadaEm,
          a.estrelas,
          a.comentario,
          a.autor,
          a.respondida ? 1 : 0,
          a.diasParaResponder,
          a.tema,
          null,
        ],
      }))}
      rodape={[
        "Total",
        media === null ? "" : `média ${formatarNumero(media, 1)}`,
        `${formatarNumero(avaliacoes.length)} avaliações`,
        "",
        `${formatarNumero(respondidas)} respondidas`,
        "",
        "",
        "",
      ]}
    />
  );
}
