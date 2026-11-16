import { CircleAlert, Info, TriangleAlert, Undo2 } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { SeloStatus } from "@/components/dashboard/indicador";
import type { LinhaLista } from "@/components/dashboard/tabela-lista";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import type { Aviso, NivelAviso } from "@/lib/sustentabilidade/importacao";
import {
  NOME_DO_TIPO,
  PENDENCIAS_DA_ARP,
  rotaDaImportacaoSu,
  type SituacaoNaLista,
  situacaoNaLista,
  TEXTO_PENDENCIA,
} from "@/lib/sustentabilidade/importacao-historico";
import { desfazerImportacaoSu } from "@/server/sustentabilidade/acoes/importacoes";
import type { ImportacaoNaListaSu } from "@/server/sustentabilidade/importacoes";

// Peças da tela de Importações do módulo (spec 4.10 e mockup): a lista
// (Arquivo, Tipo, O que foi lido, Situação, Conferências, Quem/Quando), as
// pendências "Aguardando arquivo", os passos, os avisos e o Desfazer. No
// mesmo desenho das Importações de Operações (componentes de lá são presos
// à ação e aos tipos de Operações).

const SELO: Record<SituacaoNaLista, "ok" | "atencao" | "fora" | "sem_dado"> = {
  Importado: "ok",
  "Com avisos": "atencao",
  Prévia: "sem_dado",
  Desfeita: "fora",
  Substituída: "sem_dado",
  "Aguardando arquivo": "sem_dado",
};

export function SeloDaSituacao({ s }: { s: SituacaoNaLista }) {
  return <SeloStatus status={SELO[s]} rotulo={s} />;
}

export const COLUNAS_DA_LISTA = [
  { titulo: "Arquivo", classe: "min-w-48" },
  { titulo: "Tipo", classe: "min-w-40" },
  { titulo: "O que foi lido", classe: "min-w-44" },
  { titulo: "Situação" },
  { titulo: "Conferências", classe: "min-w-56" },
  { titulo: "Quem / quando", classe: "min-w-40" },
];

export const situacaoDa = (i: ImportacaoNaListaSu): SituacaoNaLista =>
  situacaoNaLista(i.status, i.resumo.conferencias.length);

function quemQuando(i: ImportacaoNaListaSu) {
  return (
    <span className="flex flex-col text-xs text-neutral-500">
      <span className="text-sm text-neutral-900">{i.criadoPor ?? "—"}</span>
      <span className="tabular-nums">{formatarDataHora(i.criadoEm)}</span>
      {i.confirmadoEm && (
        <span>
          Confirmada {formatarDataHora(i.confirmadoEm)}
          {i.confirmadoPor && i.confirmadoPor !== i.criadoPor
            ? ` por ${i.confirmadoPor}`
            : ""}
        </span>
      )}
      {i.desfeitoEm && (
        <span>
          Desfeita {formatarDataHora(i.desfeitoEm)}
          {i.desfeitoPor ? ` por ${i.desfeitoPor}` : ""}
        </span>
      )}
    </span>
  );
}

/** Linha da lista para a TabelaLista (clicar abre a importação). */
export function linhaDaImportacao(i: ImportacaoNaListaSu): LinhaLista {
  const s = situacaoDa(i);
  const conf = i.resumo.conferencias.join(" · ") || "—";
  return {
    chave: i.id,
    href: rotaDaImportacaoSu(i.id),
    tom: s === "Prévia" ? "atencao" : undefined,
    celulas: [
      <span key="a" className="font-medium">
        {i.arquivo}
      </span>,
      NOME_DO_TIPO[i.tipo],
      <span key="l" className="flex flex-col">
        <span>{i.resumo.texto || "—"}</span>
        {i.resumo.destino && (
          <span className="text-xs text-neutral-500">{i.resumo.destino}</span>
        )}
      </span>,
      <SeloDaSituacao key="s" s={s} />,
      <span key="c" className="text-xs text-neutral-700">
        {conf}
      </span>,
      quemQuando(i),
    ],
    ordem: [
      i.arquivo,
      NOME_DO_TIPO[i.tipo],
      i.resumo.linhas,
      s,
      i.resumo.conferencias.length,
      i.criadoEm,
    ],
    busca: [
      i.arquivo,
      NOME_DO_TIPO[i.tipo],
      i.resumo.texto,
      s,
      conf,
      i.criadoPor ?? "",
    ].join(" "),
  };
}

/** As planilhas que a ARP ainda não mandou (spec 4.10). */
export function linhasPendentes(): LinhaLista[] {
  return PENDENCIAS_DA_ARP.map((p) => ({
    chave: `pendente:${p.chave}`,
    celulas: [
      <span key="a" className="font-medium">
        {p.arquivo}
      </span>,
      "—",
      "—",
      <SeloDaSituacao key="s" s="Aguardando arquivo" />,
      <span key="c" className="text-xs text-neutral-700">
        {TEXTO_PENDENCIA}
      </span>,
      "—",
    ],
    ordem: [p.arquivo, "", null, "Aguardando arquivo", 0, null],
    busca: `${p.arquivo} Aguardando arquivo pendência`,
  }));
}

/** Os três passos (como em Operações). */
export function EtapasDaImportacaoSu() {
  const passos = [
    {
      titulo: "Enviar",
      texto: "Escolha o tipo e envie o arquivo como recebeu, sem editar.",
    },
    {
      titulo: "Conferir a prévia",
      texto:
        "Veja o que foi lido (linhas, período, totais), os avisos e responda as decisões.",
    },
    {
      titulo: "Confirmar",
      texto:
        "Os dados entram e a importação fica na lista, com quem importou, quando e o Desfazer.",
    },
  ];
  return (
    <ol
      aria-label="Etapas da importação"
      data-guia="su-importacoes-etapas"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {passos.map((p, n) => (
        <li
          key={p.titulo}
          className="vidro flex items-start gap-3 rounded-3xl p-4"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-semibold text-white"
          >
            {n + 1}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              <span className="sr-only">Etapa {n + 1}: </span>
              {p.titulo}
            </span>
            <span className="text-xs text-neutral-500">{p.texto}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const ICONE: Record<NivelAviso, typeof Info> = {
  erro: CircleAlert,
  aviso: TriangleAlert,
  info: Info,
};
const COR: Record<NivelAviso, string> = {
  erro: "text-red-700",
  aviso: "text-amber-800",
  info: "text-neutral-600",
};
const ROTULO: Record<NivelAviso, string> = {
  erro: "Não entra",
  aviso: "Aviso",
  info: "Informação",
};
const PESO: Record<NivelAviso, number> = { erro: 0, aviso: 1, info: 2 };

/** Avisos da leitura, os mais graves primeiro (com aba e linha). */
export function ListaDeAvisos({
  avisos,
  max = 200,
}: {
  avisos: Aviso[];
  max?: number;
}) {
  if (!avisos.length)
    return <p className="text-sm text-neutral-500">Nenhum aviso na leitura.</p>;
  const ordenados = [...avisos].sort((a, b) => PESO[a.nivel] - PESO[b.nivel]);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto text-sm">
        {ordenados.slice(0, max).map((a, i) => {
          const Icone = ICONE[a.nivel];
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: avisos podem repetir texto; a posição é a identidade
              key={i}
              className={`flex items-start gap-2 ${COR[a.nivel]}`}
            >
              <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="sr-only">{ROTULO[a.nivel]}: </span>
                {(a.aba || a.linha) && (
                  <span className="text-xs text-neutral-500">
                    {[a.aba, a.linha && `linha ${a.linha}`]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    ·{" "}
                  </span>
                )}
                {a.mensagem}
              </span>
            </li>
          );
        })}
      </ul>
      {ordenados.length > max && (
        <p className="text-xs text-neutral-500">
          Mostrando {formatarNumero(max)} de {formatarNumero(ordenados.length)}{" "}
          avisos.
        </p>
      )}
    </div>
  );
}

/** Cancelar a prévia ou desfazer a importação (com confirmação). */
export function BotaoDesfazerSu({
  id,
  previa,
  texto,
}: {
  id: string;
  previa: boolean;
  /** "20 entrevistas" (o que a importação trouxe). */
  texto: string;
}) {
  return (
    <span data-guia="su-importacoes-desfazer">
      <AcaoRapida
        acao={desfazerImportacaoSu}
        campos={{ id }}
        rotulo={previa ? "Cancelar a prévia" : "Desfazer importação"}
        icone={<Undo2 className="size-4" aria-hidden />}
        perigo
        comTexto
        confirmar={
          previa
            ? "Cancelar a prévia? Nada dela entrou nos dados; o arquivo fica guardado."
            : `Desfazer a importação? Tudo o que ela trouxe (${texto}) sai dos dados. O arquivo e o registro continuam; para voltar, importe o arquivo de novo.`
        }
      />
    </span>
  );
}
