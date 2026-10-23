import { describe, expect, it } from "vitest";
import { calcularOS } from "./calculos";
import {
  type CategoriaExemplo,
  contarExemplo,
  type EntradaExemplo,
  gerarExemplo,
  QUALIFICADORES,
  sorteio,
  TIPOS_DE_LOJA,
} from "./exemplo";
import type { ItemDoModelo } from "./modelos";
import type { TipoChamado } from "./rotulos";
import { AMBIENTES_PADRAO } from "./vistoria";

// Catálogo igual ao da migration de dados iniciais (ids inventados).
const SETORES = [
  "Operações",
  "Comercial",
  "Marketing",
  "Sustentabilidade",
  "Estacionamento",
  "Financeiro",
  "Gestão",
].map((nome, i) => ({ id: `s${i}`, nome }));
const setor = (nome: string) => SETORES.find((s) => s.nome === nome)?.id ?? "";

const cat = (
  nome: string,
  setorNome: string,
  tipo: TipoChamado,
  prazo: number | null,
  pai: string | null = null,
): CategoriaExemplo => ({
  id: `c-${nome}`,
  nome,
  setor_id: setor(setorNome),
  pai_id: pai,
  tipo_padrao: tipo,
  prazo_valor: prazo,
  prazo_unidade: "dias_uteis",
  precisa_confirmacao: tipo !== "tarefa" && tipo !== "aviso",
  checklist:
    nome === "Preventiva"
      ? [{ texto: "Conferir o estado geral", obrigatorio: true }]
      : [],
});

const CATEGORIAS: CategoriaExemplo[] = [
  cat("Elétrica", "Operações", "os", 2),
  cat("Hidráulica", "Operações", "os", 2),
  cat("Estrutura", "Operações", "os", 5),
  cat("Telhado", "Operações", "os", 5),
  cat("Preventiva", "Operações", "os", 5),
  cat("Calha", "Operações", "os", 5, "c-Estrutura"),
  cat("Infiltração", "Operações", "os", 5, "c-Estrutura"),
  cat("Manutenção", "Operações", "solicitacao", 2),
  cat("Acesso ao telhado", "Operações", "solicitacao", 1),
  cat("Enviar projeto", "Operações", "solicitacao", 7),
  cat("Sinalização", "Marketing", "solicitacao", 5),
  cat("Ambiência", "Marketing", "solicitacao", 5),
  cat("Entrevista de cliente", "Sustentabilidade", "tarefa", 10),
  cat("Credenciamento", "Estacionamento", "solicitacao", 3),
  cat("Descredenciamento", "Estacionamento", "solicitacao", 3),
  cat("Entrada de cliente", "Comercial", "aviso", 10),
  cat("Saída de cliente", "Comercial", "aviso", 10),
  cat("Portal do lojista", "Comercial", "tarefa", 2),
  cat("Cliente novo", "Financeiro", "solicitacao", 5),
  cat("Protocolo entre setores", "Gestão", "solicitacao", 5),
];

const item = (
  id: string,
  setorNome: string,
  titulo: string,
  prazo: number,
  extra: Partial<ItemDoModelo> = {},
): ItemDoModelo => ({
  id,
  ordem: Number(id.slice(1)),
  setor_id: setor(setorNome),
  categoria_id: null,
  titulo,
  descricao: null,
  prazo_dias: prazo,
  responsavel_id: null,
  condicao: "sempre",
  acao: "nenhuma",
  ...extra,
});

const agora = new Date("2026-10-23T15:00:00Z");

const entrada = (semente = 2026): EntradaExemplo => ({
  semente,
  agora,
  cal: {
    feriados: new Set(["2026-10-12", "2026-11-02"]),
    diasUteis: [1, 2, 3, 4, 5],
    expedienteFim: "18:00",
  },
  almoco: { inicio: "12:00", fim: "13:00" },
  setores: SETORES,
  categorias: CATEGORIAS,
  ativoCategorias: [
    "Ar-condicionado",
    "Bomba",
    "Portão",
    "Elevador",
    "Escada rolante",
    "Gerador",
    "Iluminação",
    "Quadro elétrico",
    "Registro de água",
    "Câmera",
    "Exaustor",
  ].map((nome, i) => ({ id: `ac${i}`, nome, vida_util_padrao_anos: 10 })),
  pessoas: [
    { id: "u1", nome: "Pessoa Um" },
    { id: "u2", nome: "Pessoa Dois" },
    { id: "u3", nome: "Pessoa Três" },
  ],
  agendaTelhadoId: "agenda-telhado",
  modelos: [
    {
      id: "m-entrada",
      nome: "Entrada de cliente",
      gatilho: "entrada",
      descricao: null,
      itens: [
        item("i1", "Operações", "Vistoria de entrada", 0, {
          acao: "vistoria_entrada",
        }),
        item("i2", "Estacionamento", "Credenciamento", 3, {
          condicao: "tem_vaga",
        }),
        item("i3", "Sustentabilidade", "Entrevista", 30),
        item("i4", "Comercial", "Link do portal", 1),
      ],
    },
    {
      id: "m-saida",
      nome: "Saída de cliente",
      gatilho: "saida",
      descricao: null,
      itens: [item("i1", "Operações", "Vistoria de saída", 0)],
    },
  ],
  ambientes: AMBIENTES_PADRAO,
  causasFalha: ["Desgaste natural", "Mau uso"],
  aceiteDias: 3,
  vistoria: {
    locador: "LOCADORA DE EXEMPLO",
    local: "Cidade - UF",
    textos: { entrada: { observacao: "Obs.", termo: "Termo." } },
  },
  primeiroCodigoVistoria: 1,
});

const dados = gerarExemplo(entrada());

describe("sorteio", () => {
  it("é determinístico pela semente", () => {
    const a = sorteio(7);
    const b = sorteio(7);
    expect([a.int(0, 1000), a.uuid(), a.token()]).toEqual([
      b.int(0, 1000),
      b.uuid(),
      b.token(),
    ]);
    expect(sorteio(8).int(0, 1e9)).not.toBe(sorteio(7).int(0, 1e9));
  });

  it("gera uuid v4 e token de 43 caracteres", () => {
    const s = sorteio(1);
    expect(s.uuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(s.token()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("dados de exemplo", () => {
  it("mesma semente, mesmos dados", () => {
    expect(gerarExemplo(entrada())).toEqual(dados);
    expect(gerarExemplo(entrada(99)).lojas[0]?.nome).not.toBe(
      dados.lojas[0]?.nome,
    );
  });

  it("no volume de uma operação real", () => {
    const n = contarExemplo(dados);
    expect(n.lojas).toBeGreaterThan(200);
    expect(n.chamados).toBeGreaterThanOrEqual(550);
    expect(n.os).toBeGreaterThanOrEqual(320);
    expect(n.ativos).toBeGreaterThanOrEqual(115);
    expect(n.vistorias).toBe(25);
    expect(n.planos).toBeGreaterThanOrEqual(25);
    expect(n.fotos).toBeGreaterThan(25);
    // Todos os setores têm chamados.
    const setores = new Set(dados.chamados.map((c) => c.setor_id));
    for (const s of SETORES) expect(setores.has(s.id)).toBe(true);
    // Todos os status aparecem.
    const status = new Set(dados.chamados.map((c) => c.status));
    expect([...status].sort()).toEqual(
      [
        "aberto",
        "aguardando",
        "cancelado",
        "concluido",
        "em_andamento",
        "fechado",
      ].sort(),
    );
  });

  it("tudo marcado como exemplo e com ids únicos", () => {
    const listas = [
      dados.lojas,
      dados.chamados,
      dados.tecnicos,
      dados.empresas,
      dados.profissionais,
      dados.contatos,
      dados.ativos,
      dados.planos_preventivos,
      dados.vistorias,
      dados.agendamentos,
    ];
    for (const l of listas)
      for (const r of l)
        expect((r as { exemplo?: boolean }).exemplo).toBe(true);
    const ids = dados.chamados.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const lucs = dados.lojas.filter((l) => l.situacao === "vigente");
    expect(new Set(lucs.map((l) => l.luc)).size).toBe(lucs.length);
  });

  it("nomes de lojas inventados e dados de contato fictícios", () => {
    for (const l of dados.lojas) {
      const [tipo] = TIPOS_DE_LOJA.filter((t) => l.nome.startsWith(t));
      expect(tipo).toBeDefined();
      const resto = l.nome.slice((tipo ?? "").length + 1);
      expect(QUALIFICADORES).toContain(resto);
      expect(l.telefone).toMatch(/^\(22\) 9\d{4}-\d{4}$/);
      expect(l.cnpj ?? null).toBeNull();
    }
    for (const e of dados.empresas) expect(e.email).toMatch(/\.example$/);
  });

  it("datas do ciclo coerentes e nunca no futuro", () => {
    const ate = agora.getTime();
    const t = (v: string | null | undefined) =>
      v ? new Date(v).getTime() : null;
    for (const c of dados.chamados) {
      const criado = t(c.criado_em) ?? 0;
      expect(criado).toBeLessThanOrEqual(ate);
      for (const campo of [
        c.primeira_resposta_em,
        c.concluido_em,
        c.fechado_em,
        c.cancelado_em,
        c.aguardando_desde,
      ]) {
        const v = t(campo);
        if (v === null) continue;
        expect(v).toBeGreaterThanOrEqual(criado);
        expect(v).toBeLessThanOrEqual(ate);
      }
      const concluido = t(c.concluido_em);
      const fechado = t(c.fechado_em);
      if (fechado !== null && concluido !== null)
        expect(fechado).toBeGreaterThanOrEqual(concluido);
      if (c.status === "fechado") expect(c.fechado_em).toBeTruthy();
      if (c.status === "concluido") expect(c.fechado_em ?? null).toBeNull();
      if (c.status === "aguardando") expect(c.aguardando_tipo).toBeTruthy();
      if (c.status === "cancelado") expect(c.motivo_cancelamento).toBeTruthy();
      if (c.tipo !== "os") expect(c.execucao ?? null).toBeNull();
    }
    for (const e of dados.eventos)
      expect(new Date(e.em ?? 0).getTime()).toBeLessThanOrEqual(ate);
  });

  it("concluído esperando confirmação só quando precisa de confirmação", () => {
    for (const c of dados.chamados.filter((x) => x.status === "concluido"))
      expect(c.precisa_confirmacao).toBe(true);
  });

  it("série e plano nunca repetem a mesma data", () => {
    const series = dados.chamados
      .filter((c) => c.serie_id)
      .map((c) => `${c.serie_id}|${c.serie_data}`);
    expect(series.length).toBeGreaterThan(10);
    expect(new Set(series).size).toBe(series.length);
    const planos = dados.chamados
      .filter((c) => c.plano_id)
      .map((c) => `${c.plano_id}|${c.plano_data}`);
    expect(planos.length).toBeGreaterThan(20);
    expect(new Set(planos).size).toBe(planos.length);
  });

  it("agenda do telhado respeita o limite de 2 por dia", () => {
    const porDia = new Map<string, number>();
    for (const a of dados.agendamentos) {
      const dia = a.inicio.slice(0, 10);
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }
    for (const n of porDia.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it("OS com técnicos, sessões no passado e custo calculável", () => {
    const sessoes = new Set(dados.sessoes.map((s) => s.chamado_id));
    expect(sessoes.size).toBeGreaterThan(200);
    const comVarios = dados.calculos.filter((c) =>
      c.entrada.sessoes.some((s) => s.tecnicos.length > 1),
    );
    expect(comVarios.length).toBeGreaterThan(50);
    const continuacao = dados.calculos.filter(
      (c) => c.entrada.sessoes.length > 1,
    );
    expect(continuacao.length).toBeGreaterThan(20);
    const almoco = dados.sessoes.filter((s) => s.almoco_inicio);
    expect(almoco.length).toBeGreaterThan(10);
    const regras = new Set(dados.os_custos.map((c) => c.rateio_regra));
    for (const r of ["hora_trabalhada", "manual", "percentual", "terceirizado"])
      expect(regras.has(r as never)).toBe(true);
    let total = 0;
    for (const c of dados.calculos) {
      const r = calcularOS(c.entrada);
      expect(r.total).toBeGreaterThanOrEqual(0);
      total += r.total;
    }
    expect(total).toBeGreaterThan(10_000);
  });

  it("ativos com cadastro incompleto e candidatos à troca", () => {
    expect(dados.ativos.some((a) => a.valor_reposicao === null)).toBe(true);
    expect(dados.ativos.some((a) => a.situacao === "baixado")).toBe(true);
    const porAtivo = new Map<string, number>();
    for (const c of dados.chamados)
      if (c.ativo_id)
        porAtivo.set(c.ativo_id, (porAtivo.get(c.ativo_id) ?? 0) + 1);
    expect(Math.max(...porAtivo.values())).toBeGreaterThanOrEqual(5);
  });

  it("avisos de entrada com um destino por setor e o disparo gravado", () => {
    const avisos = dados.chamados.filter((c) => c.tipo === "aviso");
    expect(avisos.length).toBeGreaterThan(10);
    for (const a of avisos) {
      const destinos = dados.destinatarios.filter((x) => x.chamado_id === a.id);
      expect(destinos.length).toBeGreaterThan(0);
      const todos = destinos.every((x) => x.status === "concluido");
      expect(a.status === "fechado").toBe(todos);
    }
    const disparos = dados.disparos.map((x) => `${x.modelo_id}|${x.loja_id}`);
    expect(new Set(disparos).size).toBe(disparos.length);
  });

  it("vistorias com código em sequência e todos os ambientes", () => {
    expect(dados.vistorias.map((v) => v.codigo).slice(0, 3)).toEqual([
      "ARP01",
      "ARP02",
      "ARP03",
    ]);
    for (const v of dados.vistorias)
      expect(
        dados.vistoria_ambientes.filter((a) => a.vistoria_id === v.id).length,
      ).toBe(AMBIENTES_PADRAO.length);
  });

  it("usa as pessoas do módulo como responsáveis", () => {
    const resp = new Set(dados.chamados.map((c) => c.responsavel_id));
    expect(resp.has("u1") && resp.has("u2") && resp.has("u3")).toBe(true);
  });
});

describe("qualquer semente", () => {
  it("mantém as regras do banco", () => {
    for (const semente of [1, 7, 12345, 29_000_000]) {
      const d = gerarExemplo(entrada(semente));
      const ate = agora.getTime();
      expect(d.lojas.length).toBeGreaterThan(200);
      const ids = d.chamados.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      const vigentes = d.lojas.filter((l) => l.situacao === "vigente");
      expect(new Set(vigentes.map((l) => l.luc)).size).toBe(vigentes.length);
      for (const c of d.chamados) {
        expect(new Date(c.criado_em ?? 0).getTime()).toBeLessThanOrEqual(ate);
        if (c.status === "aguardando") expect(c.aguardando_tipo).toBeTruthy();
        if (c.status === "cancelado")
          expect(c.motivo_cancelamento).toBeTruthy();
      }
      const series = d.chamados
        .filter((c) => c.serie_id)
        .map((c) => `${c.serie_id}|${c.serie_data}`);
      expect(new Set(series).size).toBe(series.length);
      const planos = d.chamados
        .filter((c) => c.plano_id)
        .map((c) => `${c.plano_id}|${c.plano_data}`);
      expect(new Set(planos).size).toBe(planos.length);
      for (const s of d.sessoes) {
        expect((s.almoco_inicio ?? null) === null).toBe(
          (s.almoco_fim ?? null) === null,
        );
        expect(new Date(`${s.data}T${s.fim}:00-03:00`).getTime()).toBeLessThan(
          ate,
        );
      }
      const codigos = d.vistorias.map((v) => v.codigo);
      expect(new Set(codigos).size).toBe(codigos.length);
    }
  });
});
