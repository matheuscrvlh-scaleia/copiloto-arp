import { Secao, Tabela } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { formatarDataHora } from "@/lib/formato";
import {
  BLOCOS,
  blocoDaAuditoria,
  descreverRegistro,
  montarVoltar,
  mudancas,
  perguntaDoVoltar,
  TABELAS_MKT,
} from "@/lib/marketing/parametros";
import { voltarAlteracao } from "@/server/marketing/acoes/parametros";
import { INDICADORES_MKT } from "@/server/marketing/base";
import type { AlteracaoMkt } from "@/server/marketing/parametros";

// Histórico das Configurações: quem mudou o quê, só os campos alterados (antes
// → depois), com "Voltar" em cada alteração. A volta também entra aqui.

const ACOES: Record<string, string> = {
  insert: "Incluiu",
  update: "Alterou",
  delete: "Removeu",
};

const nomeIndicador = (i: string) =>
  INDICADORES_MKT[i as keyof typeof INDICADORES_MKT]?.nome ?? i;

export function BlocoHistorico({ linhas }: { linhas: AlteracaoMkt[] }) {
  return (
    <Secao
      titulo="Histórico de alterações"
      descricao={`As ${linhas.length} alterações mais recentes dos parâmetros e cadastros do Marketing. “Voltar” desfaz uma alteração: uma alteração volta os campos que ela mudou; uma inclusão é apagada; uma remoção é incluída de novo.`}
    >
      <Tabela
        caber
        linhas={linhas}
        chave={(l) => String(l.id)}
        vazio="Nenhuma alteração registrada."
        colunas={[
          {
            titulo: "Quando",
            valor: (l) => formatarDataHora(l.em),
            numero: true,
          },
          { titulo: "Quem", valor: (l) => l.autor },
          {
            titulo: "Bloco",
            valor: (l) => {
              const b = blocoDaAuditoria(l);
              return b ? BLOCOS[b] : "—";
            },
          },
          {
            titulo: "O quê",
            valor: (l) => (
              <>
                <span className="block text-xs text-neutral-500">
                  {TABELAS_MKT[l.tabela]?.rotulo ?? l.tabela}
                </span>
                {descreverRegistro(l, nomeIndicador)}
              </>
            ),
          },
          { titulo: "Ação", valor: (l) => ACOES[l.acao] ?? l.acao },
          {
            titulo: "O que mudou",
            valor: (l) => {
              const ms = mudancas(l, nomeIndicador);
              if (!ms.length) return "—";
              return (
                <ul className="flex flex-col gap-0.5 text-xs">
                  {ms.map((m) => (
                    <li key={m.campo}>
                      <span className="text-neutral-500">{m.rotulo}: </span>
                      {l.acao === "update" ? (
                        <>
                          <span className="text-neutral-500 line-through">
                            {m.antes}
                          </span>{" "}
                          → {m.depois}
                        </>
                      ) : l.acao === "delete" ? (
                        m.antes
                      ) : (
                        m.depois
                      )}
                    </li>
                  ))}
                </ul>
              );
            },
          },
          {
            titulo: "Voltar",
            valor: (l) => {
              const v = montarVoltar(l);
              if (v.tipo === "impossivel")
                return (
                  <span className="text-xs text-neutral-400" title={v.motivo}>
                    —
                  </span>
                );
              return (
                <FormAcao
                  acao={voltarAlteracao}
                  rotulo="Voltar"
                  rotuloEnviando="Voltando…"
                  variante={v.tipo === "apagar" ? "perigo" : "secundario"}
                  confirmar={perguntaDoVoltar(
                    v,
                    descreverRegistro(l, nomeIndicador),
                  )}
                >
                  <input type="hidden" name="id" value={l.id} />
                </FormAcao>
              );
            },
          },
        ]}
      />
    </Secao>
  );
}
