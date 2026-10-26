import "server-only";
import { cache } from "react";
import type {
  CategoriaDoFormulario,
  DadosDoFormulario,
} from "@/components/os/novo/tipos";
import { lerCamposExtras, lerChecklist } from "@/lib/os/chamado";
import { UNIDADES_PRAZO } from "@/lib/os/rotulos";
import { categorias, contexto, os, pessoas, setores } from "@/server/os/base";

// O que o formulário de abrir chamado precisa, lido com a sessão: setores e
// categorias ativos, pessoas do módulo e agendas. Lojas e ativos só vêm
// quando a pessoa abre "Mais detalhes" (opcoesDeVinculo). Uma vez por
// requisição: o botão "+ Novo", a página /os/novo e a gestão do detalhe
// pedem o mesmo.

export const dadosDoFormulario = cache(
  async (): Promise<DadosDoFormulario | null> => {
    const ctx = await contexto();
    if (!ctx.pode("os.acessar")) return null;
    const [todosSetores, todas, gente, agendas] = await Promise.all([
      setores(),
      categorias(),
      pessoas(),
      (await os()).from("agendas").select("id, nome").eq("ativo", true),
    ]);
    const ativos = todosSetores.filter((s) => s.ativo);
    const idsAtivos = new Set(ativos.map((s) => s.id));
    const cats: CategoriaDoFormulario[] = todas
      .filter((c) => c.ativo && idsAtivos.has(c.setor_id))
      .map((c) => ({
        id: c.id,
        setorId: c.setor_id,
        paiId: c.pai_id,
        nome: c.nome,
        icone: c.icone,
        cor: c.cor,
        tipo: c.tipo_padrao,
        prioridade: c.prioridade_padrao,
        responsavelId: c.responsavel_padrao_id,
        prazo: c.prazo_valor
          ? `${c.prazo_valor} ${c.prazo_valor === 1 && c.prazo_unidade === "horas" ? "hora" : c.prazo_valor === 1 ? "dia útil" : UNIDADES_PRAZO[c.prazo_unidade]}`
          : null,
        precisaConfirmacao: c.precisa_confirmacao,
        vincularAtivo: c.vincular_ativo,
        vincularLoja: c.vincular_loja,
        agendaId: c.agenda_id,
        campos: lerCamposExtras(c.campos),
        itensChecklist: lerChecklist(c.checklist).length,
      }));
    return {
      eu: { id: ctx.usuario.id, nome: ctx.usuario.nome },
      meusSetores: ctx.setores.filter((s) => idsAtivos.has(s)),
      setores: ativos.map((s) => ({
        id: s.id,
        nome: s.nome,
        cor: s.cor,
        icone: s.icone,
      })),
      categorias: cats,
      pessoas: gente.map((p) => ({
        id: p.id,
        nome: p.nome,
        setores: p.setores,
      })),
      agendas: (agendas.data ?? []).map((a) => ({ id: a.id, nome: a.nome })),
    };
  },
);
