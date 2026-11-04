import type {
  ColunaLista,
  LinhaLista,
} from "@/components/dashboard/tabela-lista";
import type { Detalhe } from "@/components/modal-detalhe";
import type { CelulaExportar, ColunaExportar } from "@/components/os/exportar";
import type { Estado } from "@/lib/comercial/fontes";
import { formatarValor } from "@/lib/comercial/formato";
import type { OportunidadeFunil } from "@/lib/comercial/funil";
import { formatarData, formatarNumero } from "@/lib/formato";

// Lista do Funil comercial (spec 4.4): as colunas da tabela de 4.4, o
// detalhe ao clicar e a exportação. Valor único e recorrente só entram com a
// permissão de valores; o contato, só no detalhe e só com a permissão (a
// linha já chega sem eles do servidor).

const SEM_INTERACAO = "Sem interação";
const vazio = (v: string | null | undefined) => v || "—";

const COR_ESTADO: Record<Estado, string> = {
  Vendida: "bg-green-400/20 text-green-800",
  Perdida: "bg-red-500/15 text-red-800",
  "Em andamento": "bg-sky-400/20 text-sky-800",
};

export function SeloEstado({ estado }: { estado: Estado }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${COR_ESTADO[estado]}`}
    >
      {estado}
    </span>
  );
}

export function colunasFunil(valores: boolean): ColunaLista[] {
  return [
    { titulo: "Data de criação" },
    { titulo: "Oportunidade", classe: "min-w-48" },
    { titulo: "Empresa", classe: "min-w-40" },
    { titulo: "Etapa" },
    { titulo: "Estado" },
    { titulo: "Fonte" },
    { titulo: "Fonte ajustada" },
    { titulo: "Campanha" },
    { titulo: "Perfil do imóvel" },
    { titulo: "Tamanho" },
    { titulo: "Segmento" },
    { titulo: "Responsável" },
    { titulo: "Última interação" },
    {
      titulo: "Dias sem interação",
      numero: true,
      dica: "Hoje menos a data da última interação",
    },
    { titulo: "Motivo de perda" },
    ...(valores
      ? [
          { titulo: "Valor único", numero: true },
          { titulo: "Valor recorrente", numero: true },
        ]
      : []),
  ];
}

function diasSem(o: OportunidadeFunil): React.ReactNode {
  if (o.diasSemInteracao === null)
    return <span className="text-amber-800">{SEM_INTERACAO}</span>;
  return formatarNumero(o.diasSemInteracao);
}

export function linhasFunil(
  ops: OportunidadeFunil[],
  nomesLp: ReadonlyMap<string, string>,
  valores: boolean,
): LinhaLista[] {
  return ops.map((o) => ({
    chave: o.id,
    busca: [
      o.nome,
      o.empresa,
      o.etapa,
      o.estado,
      o.fonte,
      o.fonteAjustada,
      o.campanha,
      o.perfil,
      o.tamanho,
      o.segmento,
      o.responsavel,
      o.motivoPerda,
    ]
      .filter(Boolean)
      .join(" "),
    detalhe: detalheDaOportunidade(o, nomesLp),
    celulas: [
      <span key="d" className="whitespace-nowrap tabular-nums">
        {formatarData(o.criacao)}
      </span>,
      <span key="n" className="font-medium">
        {o.nome}
      </span>,
      vazio(o.empresa),
      o.etapa,
      <SeloEstado key="e" estado={o.estado} />,
      o.fonte,
      o.fonteAjustada,
      vazio(o.campanha),
      vazio(o.perfil),
      vazio(o.tamanho),
      vazio(o.segmento),
      o.responsavel,
      <span key="u" className="whitespace-nowrap tabular-nums">
        {formatarData(o.ultimaInteracao)}
      </span>,
      diasSem(o),
      vazio(o.motivoPerda),
      ...(valores
        ? [formatarValor(o.valorUnico), formatarValor(o.valorRecorrente)]
        : []),
    ],
    ordem: [
      o.criacao,
      o.nome,
      o.empresa,
      o.etapa,
      o.estado,
      o.fonte,
      o.fonteAjustada,
      o.campanha || null,
      o.perfil || null,
      o.tamanho || null,
      o.segmento || null,
      o.responsavel,
      o.ultimaInteracao,
      o.diasSemInteracao,
      o.motivoPerda,
      ...(valores ? [o.valorUnico, o.valorRecorrente] : []),
    ],
  }));
}

export function detalheDaOportunidade(
  o: OportunidadeFunil,
  nomesLp: ReadonlyMap<string, string>,
): Detalhe {
  const campos: [string, string][] = [
    ["Empresa", vazio(o.empresa)],
    ["Funil de vendas", o.funil],
    ["Etapa", o.etapa],
    ["Estado", o.estado],
    ["Qualificação", `${o.qualificacao} de 5`],
    ["Pausada", o.pausada ? "Sim" : "Não"],
    ["Data de criação", formatarData(o.criacao)],
    ["Primeira interação", formatarData(o.primeiraInteracao)],
    ["Última interação", formatarData(o.ultimaInteracao)],
    [
      "Dias sem interação",
      o.diasSemInteracao === null
        ? SEM_INTERACAO
        : formatarNumero(o.diasSemInteracao),
    ],
    [
      "Próxima tarefa",
      o.proximaTarefa
        ? `${formatarData(o.proximaTarefa.data)} · ${o.proximaTarefa.assunto}`
        : "—",
    ],
    ["Previsão de fechamento", formatarData(o.previsaoFechamento)],
    ["Data de fechamento", formatarData(o.dataFechamento)],
    ["Motivo de perda", vazio(o.motivoPerda)],
    ["Anotação do motivo de perda", vazio(o.anotacaoPerda)],
    ["Fonte", o.fonte],
    ["Fonte ajustada", o.fonteAjustada],
    ["Campanha", vazio(o.campanha)],
    [
      "Landing page de origem",
      o.landingPage ? (nomesLp.get(o.landingPage) ?? o.landingPage) : "—",
    ],
    ["Imóvel", vazio(o.imovel)],
    ["Perfil do imóvel", vazio(o.perfil)],
    ["Tamanho pretendido", vazio(o.tamanho)],
    ["Segmento", vazio(o.segmento)],
    ["Responsável", o.responsavel],
    ...(o.valorUnico !== null
      ? ([
          ["Valor único", formatarValor(o.valorUnico)],
          ["Valor recorrente", formatarValor(o.valorRecorrente)],
        ] as [string, string][])
      : []),
  ];
  return {
    secao: "Funil comercial",
    titulo: o.nome,
    subtitulo: o.empresa ?? undefined,
    resumo: [
      { rotulo: "Estado", valor: o.estado },
      { rotulo: "Etapa", valor: o.etapa },
      { rotulo: "Criação", valor: formatarData(o.criacao) },
      {
        rotulo: "Dias sem interação",
        valor:
          o.diasSemInteracao === null
            ? SEM_INTERACAO
            : formatarNumero(o.diasSemInteracao),
      },
    ],
    fontes: [
      {
        rotulo: "Fonte",
        valor:
          "RD Station CRM (oportunidade, campos personalizados e contatos) e RD Station Marketing (landing page)",
      },
      {
        rotulo: "Somente leitura",
        valor:
          "Para mover o card, mudar a etapa ou criar oportunidade, use o RD Station.",
      },
    ],
    tabelas: [
      {
        titulo: "Oportunidade",
        colunas: [{ titulo: "Campo" }, { titulo: "Valor" }],
        linhas: campos.map(([c, v]) => ({ chave: c, celulas: [c, v] })),
      },
      ...(o.contatos
        ? [
            {
              titulo: "Contato",
              colunas: [
                { titulo: "Nome", pessoa: true },
                { titulo: "Cargo" },
                { titulo: "E-mail" },
                { titulo: "Telefone" },
              ],
              linhas: o.contatos.map((c, i) => ({
                chave: String(i),
                celulas: [
                  c.nome,
                  vazio(c.cargo),
                  vazio(c.email),
                  vazio(c.telefone),
                ],
              })),
              vazio: "Sem contato na oportunidade.",
            },
          ]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------

export function colunasExportarFunil(valores: boolean): ColunaExportar[] {
  return colunasFunil(valores).map((c) => ({
    titulo: c.titulo,
    numero: c.numero,
    formato:
      c.titulo === "Valor único" || c.titulo === "Valor recorrente"
        ? "#,##0.00"
        : undefined,
  }));
}

export function linhasExportarFunil(
  ops: OportunidadeFunil[],
  valores: boolean,
): CelulaExportar[][] {
  return ops.map((o) => [
    formatarData(o.criacao),
    o.nome,
    o.empresa ?? "",
    o.etapa,
    o.estado,
    o.fonte,
    o.fonteAjustada,
    o.campanha,
    o.perfil,
    o.tamanho,
    o.segmento,
    o.responsavel,
    o.ultimaInteracao ? formatarData(o.ultimaInteracao) : "",
    o.diasSemInteracao ?? SEM_INTERACAO,
    o.motivoPerda ?? "",
    ...(valores ? [o.valorUnico, o.valorRecorrente] : []),
  ]);
}
