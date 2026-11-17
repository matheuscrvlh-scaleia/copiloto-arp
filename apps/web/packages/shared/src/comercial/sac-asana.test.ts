import { describe, expect, it } from "vitest";
import type { AsanaTarefa } from "../marketing/fontes";
import { contatoDoSac } from "./sac-asana";

const tarefa = (t: Partial<AsanaTarefa> = {}): AsanaTarefa => ({
  gid: "1",
  name: "Loja Exemplo",
  projects: [],
  memberships: [],
  assignee: null,
  created_at: "2026-03-10T15:00:00.000Z",
  due_on: null,
  start_on: null,
  completed: false,
  completed_at: null,
  tags: [],
  custom_fields: [],
  permalink_url: "https://app.asana.com/0/1/1",
  ...t,
});

describe("SAC do Asana → contato", () => {
  it("usa a data do registro, os campos do projeto e o setor", () => {
    const c = contatoDoSac(
      tarefa({
        custom_fields: [
          { name: "Data do Registro", display_value: "2026-02-01" },
          { name: "Imóvel (LUC)", display_value: "11_113" },
          { name: "Bloco", display_value: "BL 11" },
          { name: "Canal Utilizado", display_value: "WhatsApp" },
          { name: "Setor", display_value: "Operações" },
          {
            name: "Assunto (s) ou Tema (s) Principais",
            display_value: "Vazamento",
          },
        ],
        notes: "Pediu retorno.",
      }),
    );
    expect(c).toMatchObject({
      data: "2026-02-01",
      luc: "11_113",
      bloco: "BL 11",
      canal: "WhatsApp",
      tipo: "Atendimento",
      descricao: "Vazamento\n\nPediu retorno.",
      precisa_outro_setor: true,
      asana_url: "https://app.asana.com/0/1/1",
    });
  });

  it("sem campos: data de criação em Brasília, nome como descrição", () => {
    const c = contatoDoSac(tarefa({ created_at: "2026-03-10T01:00:00.000Z" }));
    expect(c).toMatchObject({
      data: "2026-03-09",
      descricao: "Loja Exemplo",
      canal: "Não informado",
      precisa_outro_setor: false,
    });
  });

  it("reclamação pela data ou classificação; setor Comercial não pede outro", () => {
    const c = contatoDoSac(
      tarefa({
        custom_fields: [
          { name: "Classificação", display_value: "Urgente" },
          { name: "Setorização", display_value: "Comercial" },
        ],
      }),
    );
    expect(c?.tipo).toBe("Reclamação");
    expect(c?.precisa_outro_setor).toBe(false);
  });

  it("tarefa sem nome fica de fora", () => {
    expect(contatoDoSac(tarefa({ name: "  " }))).toBeNull();
  });
});
