import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { resumo } from "@/lib/comercial/relacionamento";
import { formatarData, formatarNumero } from "@/lib/formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import type { ContatoLido } from "@/server/comercial/relacionamento";

// Lista de contatos com locatários (spec 4.7): Data, Locatário, LUC, Tipo,
// Canal, resumo da Descrição e Registrado por; clicar abre o registro.

export const hrefDoContato = (id: string) =>
  `/comercial/relacionamento/contatos/${id}`;

const COLUNAS = [
  { titulo: "Data" },
  { titulo: "Locatário", classe: "min-w-44" },
  { titulo: "LUC" },
  { titulo: "Tipo" },
  { titulo: "Canal" },
  { titulo: "Descrição", classe: "min-w-64" },
  { titulo: "Registrado por" },
];

export function SeloTipo({
  tipo,
  feedback,
}: {
  tipo: string;
  feedback?: boolean;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
        tipo === "Reclamação"
          ? "bg-red-500/10 text-red-800"
          : feedback
            ? "bg-green-400/20 text-green-800"
            : "bg-neutral-900/[0.06] text-neutral-700"
      }`}
    >
      {tipo}
    </span>
  );
}

const quem = (c: ContatoLido, nomes: Map<string, string>) =>
  c.registrado_por
    ? (nomes.get(c.registrado_por) ?? "—")
    : c.exemplo
      ? "Exemplo"
      : "—";

export function ListaDeContatos({
  contatos,
  nomes,
  feedbacks = new Set<string>(),
}: {
  contatos: ContatoLido[];
  nomes: Map<string, string>;
  /** Tipos que também vão para Feedbacks (destaque verde). */
  feedbacks?: ReadonlySet<string>;
}) {
  return (
    <TabelaLista
      colunas={COLUNAS}
      placeholder="Buscar locatário, LUC, descrição…"
      vazio="Nenhum contato registrado nesse filtro."
      alturaMax="max-h-[40rem]"
      linhas={contatos.map((c) => ({
        chave: c.id,
        busca: `${c.locatario_nome} ${c.luc ?? ""} ${c.bloco ?? ""} ${c.tipo} ${c.canal} ${c.descricao} ${quem(c, nomes)}`,
        href: hrefDoContato(c.id),
        celulas: [
          <span key="d" className="whitespace-nowrap tabular-nums">
            {formatarData(c.data)}
          </span>,
          <span key="l" className="font-medium">
            {c.locatario_nome}
          </span>,
          <span key="u" className="font-mono text-xs">
            {c.luc ?? "—"}
          </span>,
          <SeloTipo key="t" tipo={c.tipo} feedback={feedbacks.has(c.tipo)} />,
          c.canal,
          resumo(c.descricao),
          quem(c, nomes),
        ],
        ordem: [
          c.data,
          c.locatario_nome,
          c.luc,
          c.tipo,
          c.canal,
          c.descricao,
          quem(c, nomes),
        ],
      }))}
      rodape={["Total", `${formatarNumero(contatos.length)} contatos`]}
    />
  );
}

export const COLUNAS_EXPORTAR_CONTATOS: ColunaExportar[] = [
  { titulo: "Data" },
  { titulo: "Locatário" },
  { titulo: "LUC" },
  { titulo: "Bloco" },
  { titulo: "Tipo" },
  { titulo: "Canal" },
  { titulo: "Descrição" },
  { titulo: "Outro setor" },
  { titulo: "Registrado por" },
];

export const exportarContatos = (
  cs: ContatoLido[],
  nomes: Map<string, string>,
): CelulaExportar[][] =>
  cs.map((c) => [
    formatarData(c.data),
    c.locatario_nome,
    c.luc ?? "",
    c.bloco ?? "",
    c.tipo,
    c.canal,
    c.descricao,
    c.precisa_outro_setor ? "Sim" : "Não",
    quem(c, nomes),
  ]);
