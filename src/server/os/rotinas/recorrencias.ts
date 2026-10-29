import "server-only";
import {
  dataDaOcorrencia,
  datasACriar,
  lerRecorrencia,
  prazoDaOcorrencia,
} from "@/lib/os/automacao";
import { checklistInicial } from "@/lib/os/chamado";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Json } from "@/lib/supabase/database.types";
import { configDoSistema } from "../automacao";
import { type Alvo, chamado, ordem, osAdmin, tabelaDo } from "../base";
import { criarChamadoSistema } from "../criar";

// Lembretes recorrentes (Repetir): cada série cria a próxima ocorrência
// sozinha, N dias antes da data (parametros.recorrencia_antecedencia_dias).
// Série = serie_id (o id do primeiro chamado, gravado nele também) +
// serie_data. O banco recusa a mesma série na mesma data (unique), então
// rodar duas vezes não cria nada a mais. Parar a série = tirar o Repetir.
// Chamados e OS repetem cada um na sua tabela (a OS gera OS).

const COLUNAS =
  "id, numero, tipo, titulo, descricao, setor_id, categoria_id, prioridade, responsavel_id, aberto_por, pessoal, precisa_confirmacao, destinos_em_ordem, loja_id, ativo_id, checklist, etiquetas, campos, recorrencia, serie_id, serie_data, prazo, criado_em, destinatarios(setor_id, usuario_id, titulo, responsavel_id, ordem)" as const;

type Dono = Pick<Alvo, "tipo">;

export async function rotinaRecorrencias(agora: Date): Promise<number> {
  let criados = 0;
  for (const dono of [chamado(""), ordem("")])
    criados += await recorrenciasDe(dono, agora);
  return criados;
}

async function recorrenciasDe(dono: Dono, agora: Date): Promise<number> {
  const { p, cal } = await configDoSistema();
  const data = await ocorrenciasComRepetir(dono);

  // A ocorrência mais recente de cada série manda (Repetir editado vale
  // dali para a frente).
  type Ocorrencia = (typeof data)[number];
  const series = new Map<string, Ocorrencia>();
  for (const c of data) {
    const chave = c.serie_id ?? c.id;
    const atual = series.get(chave);
    if (!atual || dataDaOcorrencia(c) > dataDaOcorrencia(atual))
      series.set(chave, c);
  }

  const fins = await fimDasSeries(dono, [...series.keys()]);
  const hoje = hojeEmBrasilia(agora);
  let criados = 0;
  for (const [serieId, ultima] of series) {
    const r = lerRecorrencia(ultima.recorrencia);
    if (!r) continue;
    let dataUltima = dataDaOcorrencia(ultima);
    const fim = fins.get(serieId);
    if (fim && fim.data > dataUltima) {
      // A ocorrência mais nova perdeu o Repetir: a série parou ali.
      if (!fim.repete) continue;
      dataUltima = fim.data;
    }
    if (!ultima.serie_id) await marcarPrimeira(dono, ultima.id, dataUltima);

    for (const dia of datasACriar(
      r,
      dataUltima,
      hoje,
      p.recorrencia_antecedencia_dias,
    )) {
      const novo = await criarChamadoSistema(
        {
          tipo: ultima.tipo,
          setorId: ultima.setor_id,
          categoriaId: ultima.categoria_id,
          titulo: ultima.titulo,
          descricao: ultima.descricao,
          origem: "recorrencia",
          abertoPor: ultima.aberto_por,
          autorNome: "Sistema (lembrete recorrente)",
          responsavelId: ultima.responsavel_id,
          prioridade: ultima.prioridade,
          prazo: prazoDaOcorrencia(dia, cal),
          lojaId: ultima.loja_id,
          ativoId: ultima.ativo_id,
          serieId,
          serieData: dia,
          recorrencia: ultima.recorrencia,
          campos: ultima.campos as Record<string, Json>,
          checklist: checklistInicial(ultima.checklist).map((i) => ({
            texto: i.texto,
            obrigatorio: i.obrigatorio,
            feito: false,
          })),
          etiquetas: ultima.etiquetas,
          destinatarios: [...ultima.destinatarios]
            .sort((a, b) => a.ordem - b.ordem)
            .map((d) => ({
              setorId: d.setor_id,
              usuarioId: d.usuario_id,
              titulo: d.titulo,
              responsavelId: d.responsavel_id,
              prazo: prazoDaOcorrencia(dia, cal),
            })),
        },
        agora,
      );
      if (!novo) continue;
      criados++;
      await manterTipoDeTarefa(novo, ultima);
    }
  }
  return criados;
}

/**
 * Todas as ocorrências que ainda repetem. Em páginas: o PostgREST devolve no
 * máximo 1000 linhas por consulta, e toda ocorrência guarda o Repetir (com
 * um ano de séries semanais já passa disso).
 */
async function ocorrenciasComRepetir(dono: Dono) {
  const POR_PAGINA = 1000;
  const todas = [];
  for (let de = 0; ; de += POR_PAGINA) {
    const { data, error } = await osAdmin()
      .from(tabelaDo(dono))
      .select(COLUNAS)
      .not("recorrencia", "is", null)
      .order("id")
      .range(de, de + POR_PAGINA - 1);
    if (error) throw new Error(`Séries: ${error.message}`);
    todas.push(...(data ?? []));
    if ((data ?? []).length < POR_PAGINA) return todas;
  }
}

/**
 * A data mais nova de cada série, contando as ocorrências sem Repetir.
 */
async function fimDasSeries(
  dono: Dono,
  ids: string[],
): Promise<Map<string, { data: string; repete: boolean }>> {
  const fins = new Map<string, { data: string; repete: boolean }>();
  // 100 séries por vez (a URL tem limite) e em páginas: cada série traz
  // todas as ocorrências, e o PostgREST para nas 1000 linhas.
  for (let i = 0; i < ids.length; i += 100) {
    for (let de = 0; ; de += 1000) {
      const { data, error } = await osAdmin()
        .from(tabelaDo(dono))
        .select("serie_id, serie_data, recorrencia")
        .in("serie_id", ids.slice(i, i + 100))
        .not("serie_data", "is", null)
        .order("id")
        .range(de, de + 999);
      if (error) throw new Error(`Fim das séries: ${error.message}`);
      for (const c of data ?? []) {
        if (!c.serie_id || !c.serie_data) continue;
        const atual = fins.get(c.serie_id);
        if (!atual || c.serie_data > atual.data)
          fins.set(c.serie_id, {
            data: c.serie_data,
            repete: c.recorrencia !== null,
          });
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  return fins;
}

/** O primeiro chamado da série passa a ter a série gravada nele também. */
async function marcarPrimeira(
  dono: Dono,
  id: string,
  data: string,
): Promise<void> {
  const { error } = await osAdmin()
    .from(tabelaDo(dono))
    .update({ serie_id: id, serie_data: data })
    .eq("id", id)
    .is("serie_id", null);
  if (error) throw new Error(`Marcar a série ${id}: ${error.message}`);
}

/**
 * A criação pelo sistema tira a confirmação da categoria; a ocorrência
 * repete o que a anterior tinha (tarefa pessoal, sem confirmação, destinos
 * em ordem).
 */
async function manterTipoDeTarefa(
  { id, tipo }: Alvo,
  ultima: {
    pessoal: boolean;
    precisa_confirmacao: boolean;
    destinos_em_ordem: boolean;
  },
): Promise<void> {
  const { error } = await osAdmin()
    .from(tabelaDo({ tipo }))
    .update({
      pessoal: ultima.pessoal,
      precisa_confirmacao: ultima.precisa_confirmacao,
      destinos_em_ordem: ultima.destinos_em_ordem,
    })
    .eq("id", id);
  if (error) console.error("ocorrência da série", id, error);
}
