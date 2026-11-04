import { Secao, Tabela } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import {
  type Bloco,
  blocoDaAuditoria,
  descreverRegistro,
  mudancas,
  rotuloDoBloco,
  TABELAS_COM,
} from "@/lib/comercial/parametros";
import { formatarDataHora } from "@/lib/formato";
import type { AlteracaoCom } from "@/server/comercial/parametros";

// Histórico de Comercial › Configurações: quem mudou o quê e quando, só os
// campos alterados (antes → depois), lido de core.auditoria.

const ACOES: Record<string, string> = {
  insert: "Incluiu",
  update: "Alterou",
  delete: "Removeu",
};

/** "Última alteração em dd/mm/aaaa às hh:mm, por Fulano" no topo. */
export function TopoConfiguracoes({
  ultima,
  bloco,
}: {
  ultima?: AlteracaoCom;
  bloco?: Bloco | "metas" | null;
}) {
  if (!ultima)
    return <TopoDaTela dadosDe="Nenhuma alteração registrada ainda" />;
  const [d, h] = formatarDataHora(ultima.em).split(" ");
  const onde = bloco ? ` (${rotuloDoBloco(bloco)})` : "";
  return (
    <TopoDaTela
      dadosDe={`Última alteração em ${d} às ${h}, por ${ultima.autor}${onde}`}
    />
  );
}

export function BlocoHistorico({
  linhas,
  descricao,
}: {
  linhas: AlteracaoCom[];
  descricao?: string;
}) {
  return (
    <Secao
      titulo="Histórico de alterações"
      descricao={
        descricao ??
        `As ${linhas.length} alterações mais recentes, com quem alterou, quando, o valor antes e o depois.`
      }
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
          { titulo: "Bloco", valor: (l) => rotuloDoBloco(blocoDaAuditoria(l)) },
          {
            titulo: "O quê",
            valor: (l) => (
              <>
                <span className="block text-xs text-neutral-500">
                  {TABELAS_COM[l.tabela]?.rotulo ?? l.tabela}
                </span>
                {descreverRegistro(l)}
              </>
            ),
          },
          { titulo: "Ação", valor: (l) => ACOES[l.acao] ?? l.acao },
          {
            titulo: "Antes → depois",
            valor: (l) => {
              const ms = mudancas(l);
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
        ]}
      />
    </Secao>
  );
}
