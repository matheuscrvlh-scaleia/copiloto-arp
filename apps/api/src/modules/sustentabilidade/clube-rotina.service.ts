import { formatarData } from "@arp/shared/formato";
import { deBrasilia, hojeEmBrasilia, somarDias } from "@arp/shared/os/tempo";
import { documentoComTipo } from "@arp/shared/sustentabilidade/clube-termo";
import { banco, type Tx } from "@/infra/banco";
import { configDoSistema } from "@/modules/os/automacao.service";
import { criarChamadoSistema } from "@/modules/os/criar.service";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/modules/os/sistema.service";
import * as clubeRepo from "./clube.repository";
import * as repo from "./rotinas.repository";

// Chamado "Renovar termo do Clube" (spec 4.5): a rotina diária que o abre e
// a conclusão ao salvar o termo novo. Service role, sem sessão.

export const MODULO_ORIGEM = "sustentabilidade";
export const CATEGORIA_RENOVAR_TERMO = "Renovar termo do Clube";
const SETOR = "Sustentabilidade";

/** Origem do chamado de renovação, uma por termo. */
export const origemDoTermo = (participanteId: string, ano: number) =>
  `termo:${participanteId}:${ano}`;

/** Setor Sustentabilidade e a categoria "Renovar termo do Clube" (se já existir). */
async function setorECategoria(
  tx: Tx,
): Promise<{ setorId: string; categoriaId: string | null } | null> {
  const setor = await repo.setorPorNome(tx, SETOR);
  if (!setor) return null;
  const categoria = await repo.categoriaAtivaDoSetor(
    tx,
    setor.id,
    CATEGORIA_RENOVAR_TERMO,
  );
  return { setorId: setor.id, categoriaId: categoria?.id ?? null };
}

/**
 * Rotina diária (service role): para o último termo de cada participante
 * que vence em até `termo_aviso_dias` (e ainda não venceu), abre o chamado
 * "Renovar termo do Clube" no setor Sustentabilidade, uma vez por termo
 * (origem `termo:<participante_id>:<ano>`), com o botão Executar levando ao
 * participante. O chamado só fecha pelo módulo, ao salvar o termo novo
 * (concluirRenovacoes). Quem saiu do clube e quem já renovou não recebe.
 *
 * Devolve quantos chamados criou (idempotente: rodar de novo não repete) e
 * lança erro se algo falhar, no formato de ROTINAS (rotinas.service.ts).
 */
export function rotinaClube(agora: Date): Promise<number> {
  return banco.comoServico(async (tx) => {
    const hoje = hojeEmBrasilia(agora);
    const p = await repo.termoAvisoDias(tx);
    const limite = somarDias(hoje, p.termo_aviso_dias);
    const termos = await repo.termosValidos(tx, hoje);
    const participantes = await repo.participantesAtivos(tx);
    const ativos = new Map(participantes.map((x) => [x.id, x]));
    // O último termo de cada participante (o que vence por último).
    const ultimo = new Map<string, (typeof termos)[number]>();
    for (const t of termos) {
      const atual = ultimo.get(t.participante_id);
      if (!atual || t.valido_ate > atual.valido_ate)
        ultimo.set(t.participante_id, t);
    }
    const aVencer = [...ultimo.values()].filter(
      (t) =>
        t.valido_ate <= limite &&
        !t.chamado_id &&
        ativos.has(t.participante_id),
    );
    if (!aVencer.length) return 0;

    const destino = await setorECategoria(tx);
    if (!destino)
      throw new Error(
        `O setor ${SETOR} não existe no Chamados: crie-o em Chamados › Configurações.`,
      );
    const { cal } = await configDoSistema(tx);

    let novos = 0;
    for (const t of aVencer) {
      const dono = ativos.get(t.participante_id);
      if (!dono) continue;
      const ref = origemDoTermo(t.participante_id, t.ano);
      const aberto = await chamadoAbertoDaOrigem(tx, MODULO_ORIGEM, ref);
      let chamadoId = aberto?.id ?? null;
      if (!aberto) {
        const criado = await criarChamadoSistema(
          tx,
          {
            setorId: destino.setorId,
            categoriaId: destino.categoriaId,
            titulo: `${CATEGORIA_RENOVAR_TERMO}: ${dono.nome}`,
            descricao:
              `O termo do Clube SustentArp de ${dono.nome} (${documentoComTipo(dono.cliente_doc)}) ` +
              `vence em ${formatarData(t.valido_ate)}. Colha a nova assinatura e lance o termo no Clube; ` +
              "este chamado fecha sozinho ao salvar o termo renovado.",
            origem: "modulo",
            autorNome: "Sistema (Sustentabilidade)",
            prazo: deBrasilia(t.valido_ate, cal.expedienteFim),
            acaoUrl: `/sustentabilidade/clube/${t.participante_id}`,
            acaoRotulo: "o termo renovado",
            conclusaoExterna: true,
            origemModulo: MODULO_ORIGEM,
            origemRef: ref,
          },
          agora,
        );
        chamadoId = criado?.id ?? null;
        if (criado) novos += 1;
      }
      if (chamadoId) await repo.ligarChamadoAoTermo(tx, t.id, chamadoId);
    }
    return novos;
  });
}

/**
 * Ao salvar um termo novo, conclui os chamados de renovação dos termos
 * anteriores do participante que ainda estavam abertos. Quem chama já
 * conferiu a permissão (clube.editar) e passa a `tx` do `comoServico`.
 * Devolve quantos fechou.
 */
export async function concluirRenovacoes(
  tx: Tx,
  p: {
    participanteId: string;
    /** Termo recém-salvo: ano e fim da validade. */
    novo: { ano: number; validoAte: string };
    concluidoPor: string;
  },
): Promise<number> {
  const termos = await clubeRepo.termosComChamadoAntes(
    tx,
    p.participanteId,
    p.novo.ano,
    p.novo.validoAte,
  );
  let fechados = 0;
  for (const t of termos) {
    if (!t.chamado_id) continue;
    const ok = await concluirPeloSistema(tx, {
      chamadoId: t.chamado_id,
      texto: `Termo de ${p.novo.ano} salvo, válido até ${formatarData(p.novo.validoAte)}.`,
      concluidoPor: p.concluidoPor,
    });
    if (ok) fechados += 1;
  }
  return fechados;
}
