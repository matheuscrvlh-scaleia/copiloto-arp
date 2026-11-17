import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import type {
  ContatoDoPrograma,
  Programa,
} from "@arp/shared/sustentabilidade/contratos/programas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { consultaDosLinks } from "../../../api-programas";
import { LinkDoParceiro } from "../../../components/programas/link";
import { useContextoSu } from "../../../contexto-su";
import type { ContextoDaAba } from "../programa";

// Aba "Link do parceiro" (só "Programas – gerenciar"): um link ativo por
// programa. O parceiro não tem usuário nem menu; pelo link vê só o
// formulário e o que ele mesmo lançou no mês. A cobrança de quem não lança
// é um chamado para a equipe, nunca para o parceiro.

export function AbaLink({
  c,
  programa,
  contato,
}: {
  c: ContextoDaAba;
  programa: Programa;
  /** null sem "Ver contato" (a API não manda). */
  contato: ContatoDoPrograma;
}) {
  const { data: links, dataUpdatedAt } = useSuspenseQuery(
    consultaDosLinks(c.programaId),
  );
  const ctx = useContextoSu(dataUpdatedAt);
  const podeContato = ctx.pode("sustentabilidade.contato");
  const ativo = links.find((l) => !l.desligadoEm);
  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela dadosDe={ctx.dadosDe} />
      <Secao
        titulo="Link do parceiro"
        descricao="Link único do programa, sem senha. O endereço aparece só na hora de gerar: envie na hora. Gerar um novo desliga o anterior."
      >
        <div className="flex flex-col gap-5" data-guia="link-parceiro">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-neutral-500">Situação</p>
              <p className="font-medium">
                {!programa.ativo
                  ? "Programa inativo: o link não abre"
                  : ativo
                    ? "Ativo"
                    : "Nenhum link ativo"}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Gerado em</p>
              <p>
                {ativo
                  ? `${formatarDataHora(ativo.criadoEm)}${ativo.criadoPor ? ` por ${ativo.criadoPor}` : ""}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">
                Último acesso do parceiro
              </p>
              <p>
                {ativo?.ultimoAcesso
                  ? formatarDataHora(ativo.ultimoAcesso)
                  : ativo
                    ? "ainda não abriu"
                    : "—"}
              </p>
            </div>
          </div>
          <LinkDoParceiro
            programaId={programa.id}
            programa={programa.nome}
            temAtivo={Boolean(ativo)}
            ativo={programa.ativo}
            telefone={podeContato ? (contato?.telefone ?? null) : null}
            email={podeContato ? (contato?.email ?? null) : null}
          />
          {!podeContato && (
            <p className="text-xs text-neutral-500">
              Sem “Ver contato”, o WhatsApp e o e-mail abrem sem o destinatário:
              escolha o contato na hora de enviar.
            </p>
          )}
        </div>
      </Secao>
      {links.length > 0 && (
        <Secao titulo="Links gerados" descricao="Do mais novo ao mais antigo.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="px-2 py-2 font-medium">Gerado em</th>
                  <th className="px-2 py-2 font-medium">Situação</th>
                  <th className="px-2 py-2 font-medium">Último acesso</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Lançamentos
                  </th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className="border-t border-neutral-900/5">
                    <td className="px-2 py-2.5">
                      {formatarDataHora(l.criadoEm)}
                      {l.criadoPor && (
                        <span className="block text-xs text-neutral-500">
                          por {l.criadoPor}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {l.desligadoEm
                        ? `Desligado em ${formatarDataHora(l.desligadoEm)}${l.desligadoPor ? ` por ${l.desligadoPor}` : ""}`
                        : "Ativo"}
                    </td>
                    <td className="px-2 py-2.5">
                      {l.ultimoAcesso ? formatarDataHora(l.ultimoAcesso) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatarNumero(l.lancamentos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
    </div>
  );
}
