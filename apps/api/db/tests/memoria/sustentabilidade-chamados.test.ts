// Categorias dos chamados do Módulo Sustentabilidade
// (20261116140000_sustentabilidade_chamados): criadas sem confirmação do
// solicitante, a "Entrevista de cliente" renomeada para "Entrevista de
// resíduos" (sem duplicar) e o recolhimento de coletor em Operações.

import { CATEGORIAS_DO_MODULO } from "@arp/shared/sustentabilidade/entrevistas-chamados";
import { beforeAll, describe, expect, it } from "vitest";
import { abrirBanco, type BancoDeTeste } from "../apoio";

let db: BancoDeTeste;

interface Linha {
  setor: string;
  nome: string;
  tipo_padrao: string;
  precisa_confirmacao: boolean;
  prazo_valor: number | null;
}

async function categorias(): Promise<Linha[]> {
  const { rows } = await db.query<Linha>(`
    select s.nome as setor, c.nome, c.tipo_padrao::text, c.precisa_confirmacao, c.prazo_valor
    from os.categorias c join os.setores s on s.id = c.setor_id
    where c.pai_id is null and s.nome in ('Sustentabilidade', 'Operações')
    order by s.nome, c.nome`);
  return rows;
}

beforeAll(async () => {
  db = await abrirBanco();
}, 120_000);

describe("categorias do Sustentabilidade", () => {
  it("cria as do módulo sem confirmação do solicitante, como tarefa", async () => {
    const todas = await categorias();
    for (const c of CATEGORIAS_DO_MODULO) {
      const achadas = todas.filter((l) => l.nome === c.nome);
      expect(achadas, c.nome).toHaveLength(1);
      const [l] = achadas as [Linha];
      expect(l.setor).toBe(c.setor);
      expect(l.precisa_confirmacao).toBe(false);
      expect(l.tipo_padrao).toBe("tarefa");
    }
  });

  it("renomeia a Entrevista de cliente em vez de duplicar", async () => {
    const nomes = (await categorias())
      .filter((l) => l.setor === "Sustentabilidade")
      .map((l) => l.nome);
    expect(nomes).not.toContain("Entrevista de cliente");
    expect(nomes.filter((n) => n === "Entrevista de resíduos")).toHaveLength(1);
  });

  it("recolhimento de coletor em Operações, com prazo de 1 dia útil", async () => {
    const r = (await categorias()).find(
      (l) => l.nome === "Recolhimento de coletor",
    );
    expect(r?.setor).toBe("Operações");
    expect(r?.prazo_valor).toBe(1);
  });

  // "rodar de novo não cria nada a mais" saiu: reaplicava a migration antiga
  // (idempotência dela); o banco novo não tem essa migration.

  it("não mexe nas categorias de Operações que já existiam", async () => {
    const eletrica = (await categorias()).find((l) => l.nome === "Elétrica");
    expect(eletrica?.tipo_padrao).toBe("os");
  });
});
