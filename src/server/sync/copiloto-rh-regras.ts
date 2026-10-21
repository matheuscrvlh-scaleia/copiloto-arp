import type { Colaborador } from "@/connectors/copiloto-rh/schemas";
import type { Database } from "@/lib/supabase/database.types";

type TipoContrato = Database["rh"]["Enums"]["tipo_contrato"];

/** Colaborador do Centralizador, só as colunas que a regra precisa. */
export interface Existente {
  id: string;
  matricula: number | null;
  copiloto_id: string | null;
  tipo_contrato: TipoContrato | null;
}

/** Linha gravada em rh.colaboradores: os campos que são do Copiloto. */
export interface LinhaCopiloto {
  id: string;
  copiloto_id: string;
  matricula: number | null;
  nome: string;
  nascimento: string | null;
  admissao: string | null;
  desligamento: string | null;
  tipo_contrato: TipoContrato | null;
  situacao_copiloto: string;
  motivo_desligamento_copiloto: string | null;
}

// Valores de contract_type do Copiloto (rótulos da tela de lá: CLT, PJ,
// Sócio, Jovem Aprendiz, Estágio, Temporário, Outro). Temporário e Outro não
// têm equivalente no Centralizador: viram aviso.
const TIPOS: Record<string, TipoContrato> = {
  clt: "clt",
  pj: "pj",
  socio: "pro_labore",
  aprendiz: "aprendiz",
  internship: "estagiario",
};

export function tipoContratoDoCopiloto(
  valor: string | null | undefined,
): TipoContrato | null {
  return valor ? (TIPOS[valor.trim().toLowerCase()] ?? null) : null;
}

/** Matrícula do Copiloto ("00123") → número da folha. */
export function matriculaDoCopiloto(
  code: string | null | undefined,
): number | null {
  const v = (code ?? "").trim();
  return /^\d+$/.test(v) ? Number(v) : null;
}

/**
 * O Copiloto é a fonte de nome, nascimento, tipo de contrato, situação,
 * admissão, desligamento e motivo (especificação, 4.5). Liga pelo
 * copiloto_id ou pela matrícula; quem não existe no Centralizador é criado.
 * Departamento e cargo seguem do ponto e da folha. Avisos só com a
 * matrícula, sem nome nem data.
 */
export function planejarCopiloto(
  copiloto: Colaborador[],
  existentes: Existente[],
  novoId: () => string,
): { linhas: LinhaCopiloto[]; novos: number; avisos: string[] } {
  const porCopiloto = new Map(
    existentes.filter((e) => e.copiloto_id).map((e) => [e.copiloto_id, e]),
  );
  const porMatricula = new Map(
    existentes.filter((e) => e.matricula !== null).map((e) => [e.matricula, e]),
  );
  const matriculasUsadas = new Set(porMatricula.keys());

  const linhas: LinhaCopiloto[] = [];
  const avisos: string[] = [];
  const ligados = new Set<string>();
  let novos = 0;

  for (const c of copiloto) {
    const m = matriculaDoCopiloto(c.code);
    const rotulo = m !== null ? `matrícula ${m}` : `id ${c.id.slice(0, 8)}`;
    let e = porCopiloto.get(c.id);
    if (!e && m !== null) {
      const candidato = porMatricula.get(m);
      // Matrícula já ligada a outra pessoa do Copiloto (antes ou nesta
      // execução) não serve: esta entra como pessoa nova, sem matrícula.
      if (candidato && !candidato.copiloto_id && !ligados.has(candidato.id))
        e = candidato;
    }

    let matricula: number | null;
    if (e) {
      matricula = e.matricula;
    } else {
      novos++;
      matricula = m !== null && !matriculasUsadas.has(m) ? m : null;
      if (m !== null && matricula === null)
        avisos.push(
          `${rotulo}: já usada por outro colaborador; o do Copiloto entrou sem matrícula`,
        );
    }
    if (matricula !== null) matriculasUsadas.add(matricula);
    const id = e?.id ?? novoId();
    ligados.add(id);

    let tipo = tipoContratoDoCopiloto(c.contract_type);
    if (c.contract_type && !tipo) {
      avisos.push(
        `${rotulo}: tipo de contrato "${c.contract_type}" do Copiloto sem equivalente; ficou o anterior`,
      );
      tipo = e?.tipo_contrato ?? null;
    }
    if (!c.contract_type)
      avisos.push(`${rotulo}: sem tipo de contrato no Copiloto`);

    const nascimento = c.personal?.birth_date ?? null;
    if (!nascimento)
      avisos.push(`${rotulo}: sem data de nascimento no Copiloto`);
    const admissao = c.hire_date ?? null;
    if (!admissao)
      avisos.push(
        `${rotulo}: sem data de admissão no Copiloto (fica fora do quadro)`,
      );
    let desligamento = c.termination_date ?? null;
    if (desligamento && admissao && desligamento < admissao) {
      avisos.push(
        `${rotulo}: desligamento antes da admissão no Copiloto; desligamento ignorado`,
      );
      desligamento = null;
    }
    if (c.status === "terminated" && !desligamento)
      avisos.push(`${rotulo}: desligado no Copiloto sem data de desligamento`);

    linhas.push({
      id,
      copiloto_id: c.id,
      matricula,
      nome: c.full_name.trim(),
      nascimento,
      admissao,
      desligamento,
      tipo_contrato: tipo,
      situacao_copiloto: c.status,
      motivo_desligamento_copiloto: c.termination_reason ?? null,
    });
  }

  if (novos > 0)
    avisos.push(
      `${novos} colaborador(es) do Copiloto criado(s) no Centralizador (sem par pela matrícula)`,
    );
  return { linhas, novos, avisos };
}
