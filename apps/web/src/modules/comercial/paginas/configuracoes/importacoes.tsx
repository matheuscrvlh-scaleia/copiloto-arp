import type { ImportacaoNoHistorico } from "@arp/shared/comercial/contratos/importacoes";
import {
  type AcaoConfirmacao,
  type AcaoPrevia,
  TIPOS_IMPORTACAO,
  TIPOS_ORDEM,
  type TipoImportacao,
} from "@arp/shared/comercial/importacao";
import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Secao, Tabela } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { SemAcesso } from "@/components/protegido";
import { AcaoRapida } from "@/modules/admin/components/acao-rapida";
import {
  ImportarHistorico,
  type TipoNaTela,
} from "@/modules/comercial/components/configuracoes/importar";
import {
  confirmar,
  consultaImportacoes,
  desfazerImportacao,
  previa,
} from "../../api/importacoes";

// /comercial/configuracoes/importacoes

// Leitura de cada tipo: a rota é uma só por tipo e a API escolhe o leitor
// (o do módulo dono do dado; apps/api/.../importacoes.tipos.ts). Tipo sem
// leitor responde "em preparação".
const ACOES: Record<
  TipoImportacao,
  { previa: AcaoPrevia; confirmar: AcaoConfirmacao } | null
> = {
  censo: { previa: previa("censo"), confirmar: confirmar("censo") },
  fichas: { previa: previa("fichas"), confirmar: confirmar("fichas") },
  pesquisa: { previa: previa("pesquisa"), confirmar: confirmar("pesquisa") },
  contatos: { previa: previa("contatos"), confirmar: confirmar("contatos") },
};

const SITUACAO = {
  previa: { rotulo: "Prévia", status: "sem_dado" },
  confirmada: { rotulo: "Importada", status: "ok" },
  desfeita: { rotulo: "Desfeita", status: "sem_meta" },
} as const;

export default function Page() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-56" />
          <CartaoCarregando altura="h-72" />
        </TelaCarregando>
      }
    >
      <Tela />
    </Suspense>
  );
}

function Tela() {
  const {
    data: { tipos: permitidos, historico },
  } = useSuspenseQuery(consultaImportacoes);
  if (!permitidos.length) return <SemAcesso />;
  const tipos: TipoNaTela[] = TIPOS_ORDEM.filter((t) =>
    permitidos.includes(t),
  ).map((t) => ({ tipo: t, ...TIPOS_IMPORTACAO[t], acoes: ACOES[t] }));
  const ultima = historico[0];

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={
          ultima
            ? `Última importação em ${formatarDataHora(ultima.confirmadoEm ?? ultima.enviadoEm)}, por ${ultima.confirmadoPor ?? ultima.enviadoPor}`
            : "Nenhuma importação ainda"
        }
      />
      <Secao
        titulo="Importar histórico"
        descricao="Uma vez só, para trazer o que já existe nas planilhas, sem editar os arquivos. Cabeçalho diferente do esperado bloqueia e mostra as colunas; o mesmo arquivo duas vezes pergunta se substitui. Toda importação pode ser desfeita no histórico abaixo."
      >
        <ImportarHistorico tipos={tipos} />
      </Secao>
      <Secao
        titulo="Histórico de importações"
        descricao="Desfazer apaga só o que aquela importação trouxe e volta ao estado anterior."
      >
        <Tabela
          caber
          linhas={historico}
          chave={(l) => l.id}
          vazio="Nenhuma importação confirmada."
          colunas={[
            {
              titulo: "Quando",
              valor: (l) => formatarDataHora(l.confirmadoEm ?? l.enviadoEm),
              numero: true,
            },
            {
              titulo: "Tipo",
              valor: (l) => TIPOS_IMPORTACAO[l.tipo]?.rotulo ?? l.tipo,
            },
            { titulo: "Arquivo", valor: (l) => l.arquivo },
            { titulo: "Quem", valor: (l) => l.confirmadoPor ?? l.enviadoPor },
            {
              titulo: "Linhas",
              valor: (l) => formatarNumero(l.linhas),
              numero: true,
            },
            {
              titulo: "Duplicadas",
              valor: (l) => formatarNumero(l.duplicadas),
              numero: true,
            },
            {
              titulo: "Com aviso",
              valor: (l) => formatarNumero(l.comAviso),
              numero: true,
            },
            { titulo: "Situação", valor: (l) => <Situacao l={l} /> },
            {
              titulo: "Desfazer",
              valor: (l) =>
                l.status === "confirmada" && permitidos.includes(l.tipo) ? (
                  <AcaoRapida
                    acao={desfazerImportacao}
                    campos={{ id: l.id }}
                    rotulo="Desfazer"
                    icone={<Undo2 className="size-4" aria-hidden />}
                    confirmar={`Desfazer a importação de “${l.arquivo}”? Os ${formatarNumero(l.linhas)} registros que ela trouxe são apagados.`}
                    perigo
                    comTexto
                  />
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </Secao>
    </div>
  );
}

function Situacao({ l }: { l: ImportacaoNoHistorico }) {
  const s = SITUACAO[l.status];
  return (
    <span className="flex flex-col gap-0.5">
      <SeloStatus status={s.status} rotulo={s.rotulo} />
      {l.status === "desfeita" && l.desfeitoEm && (
        <span className="text-xs text-neutral-500">
          {formatarDataHora(l.desfeitoEm)} · {l.desfeitoPor ?? "—"}
        </span>
      )}
    </span>
  );
}
