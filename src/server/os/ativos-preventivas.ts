import "server-only";
import { checklistDaOS } from "@/lib/os/ativos";
import { deBrasilia } from "@/lib/os/tempo";
import type { Tabela } from "./base";
import { type ChamadoCriado, criarChamadoSistema } from "./criar";

// OS preventiva de um plano: a mesma criação para a rotina de hora em hora
// e para o botão "Gerar agora" da ficha (que confere a permissão antes).
// O banco recusa a mesma data do mesmo plano duas vezes: aí devolve null.

type PlanoDaOS = Pick<
  Tabela<"planos_preventivos">,
  | "id"
  | "titulo"
  | "descricao"
  | "setor_id"
  | "categoria_id"
  | "responsavel_id"
  | "checklist"
>;

export type AtivoDaOS = Pick<
  Tabela<"ativos">,
  "id" | "nome" | "codigo" | "bloco" | "area" | "ponto" | "loja_id"
>;

export async function criarPreventiva(
  plano: PlanoDaOS,
  ativo: AtivoDaOS,
  data: string,
  opcoes: {
    /** "hh:mm" do fim do expediente: o prazo é o fim do dia da data. */
    expedienteFim: string;
    abertoPor?: string | null;
    autorNome: string;
    agora?: Date;
  },
): Promise<ChamadoCriado | null> {
  const checklist = checklistDaOS(plano.checklist);
  return criarChamadoSistema(
    {
      setorId: plano.setor_id,
      categoriaId: plano.categoria_id,
      tipo: "os",
      origem: "preventiva",
      titulo: `Preventiva: ${plano.titulo} — ${ativo.nome}`,
      descricao: plano.descricao,
      abertoPor: opcoes.abertoPor ?? null,
      autorNome: opcoes.autorNome,
      // Sem responsável no plano, vale o padrão da categoria.
      responsavelId: plano.responsavel_id ?? undefined,
      prazo: deBrasilia(data, opcoes.expedienteFim.slice(0, 5)),
      lojaId: ativo.loja_id,
      // O local da OS é o do ativo.
      bloco: ativo.bloco,
      local:
        [ativo.area, ativo.ponto].filter((p) => p?.trim()).join(" · ") || null,
      ativoId: ativo.id,
      planoId: plano.id,
      planoData: data,
      // Plano sem checklist: vale o da categoria.
      checklist: checklist.length ? checklist : undefined,
      aviso: { tipo: "preventiva", texto: "Preventiva criada." },
      // Plano de exemplo gera OS de exemplo (some junto ao apagar).
    },
    opcoes.agora,
  );
}
