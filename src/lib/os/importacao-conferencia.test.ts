import { describe, expect, it } from "vitest";
import {
  type ContextoDaConferencia,
  campoDoTipo,
  chaveDoStatus,
  conferir,
  decidirNumeros,
  ORIGEM_LEGADO,
  periodoDaVisita,
  regraDeRateio,
  respostaDoAmbiente,
  statusDaVistoria,
  statusDoRegistro,
  tipoDaVistoria,
  usuarioPeloNome,
} from "./importacao-conferencia";
import { indiceDeArquivos } from "./importacao-leitor";
import {
  type ArquivoDoPacote,
  ESQUEMAS,
  type PacoteImportacao,
  type Registro,
  TIPOS_DE_REGISTRO,
  type TipoDeRegistro,
} from "./importacao-modelo";

const arquivo = (nome: string): ArquivoDoPacote => ({
  nome,
  tamanho: 1,
  ler: async () => new Uint8Array([1]),
});

/** Pacote montado pelos próprios esquemas (como o leitor faz). */
function pacote(
  dados: Partial<Record<TipoDeRegistro, unknown[]>>,
  totais: Partial<Record<TipoDeRegistro, number>> | "contar" = "contar",
  fotos: string[] = [],
): PacoteImportacao {
  const registros = {} as PacoteImportacao["registros"];
  for (const tipo of Object.keys(TIPOS_DE_REGISTRO) as TipoDeRegistro[])
    Object.assign(registros, {
      [tipo]: (dados[tipo] ?? []).map(
        (l) => ESQUEMAS[tipo].parse(l) as Registro<typeof tipo>,
      ),
    });
  const t =
    totais === "contar"
      ? Object.fromEntries(
          Object.entries(dados).map(([k, v]) => [k, (v ?? []).length]),
        )
      : totais;
  return {
    manifesto: { totais: t },
    registros,
    recusadas: [],
    arquivos: fotos.map(arquivo),
  };
}

const contexto = (
  p: PacoteImportacao,
  extra: Partial<ContextoDaConferencia> = {},
): ContextoDaConferencia => ({
  numerosNoModulo: new Map(),
  codigosNoModulo: new Map(),
  usuarios: [{ id: "u-ana", nome: "Ana Lima" }],
  mapeamento: {},
  acharArquivo: indiceDeArquivos(p.arquivos),
  ...extra,
});

const TECNICOS = [
  { id: "1", nome: "Ana Lima", valor_minuto: "0,4485" },
  { id: "2", nome: "Bruno Reis", valor_minuto: "0,40" },
  { id: "3", nome: "Caio Sem Valor" },
];

const OS_10 = {
  numero: 10,
  status: "Finalizado",
  aberta_em: "20/10/2026 08:00",
  sessoes: [
    // 08:00–17:00 com almoço de 1h = 480 min × 2 técnicos.
    {
      data: "20/10/2026",
      inicio: "08:00",
      fim: "17:00",
      almoco_inicio: "12:00",
      almoco_fim: "13:00",
      tecnicos: ["1", "2"],
    },
  ],
  materiais: [{ descricao: "Fita", quantidade: 2, valor_unitario: 7.5 }],
  rateio: { regra: "Por colaborador / hora trabalhada" },
  // 480 × 0,4485 + 480 × 0,40 + 15 = 215,28 + 192 + 15 = 422,28
  legado: {
    valor_total: "422,28",
    valor_rateio: "422,28",
    minutos: 480,
    minuto_homem: 960,
  },
  fotos: [{ arquivo: "fotos/10_antes.jpg", tipo: "antes" }, "10_depois.jpg"],
};

describe("correspondências", () => {
  it("status pela tabela ou pela escolha da prévia", () => {
    expect(statusDoRegistro("os", "Em Análise", {})).toEqual({
      status: "em_andamento",
    });
    expect(statusDoRegistro("os", "Em revisão", {})).toBeNull();
    expect(
      statusDoRegistro("os", "Em revisão", {
        [chaveDoStatus("os", "Em revisão")]: "aguardando",
      }),
    ).toEqual({ status: "aguardando", aguardando_tipo: "outro" });
    expect(statusDoRegistro("tarefa", "Convertida em O.S", {})).toEqual({
      status: "fechado",
      convertida_em_os: true,
    });
    expect(
      statusDaVistoria("Rascunho", { "vistoria:Rascunho": "andamento" }),
    ).toBe("andamento");
    expect(
      statusDaVistoria("Rascunho", { "vistoria:Rascunho": "x" }),
    ).toBeNull();
  });

  it("rateio, período, tipo de vistoria, resposta e campo do tipo", () => {
    expect(regraDeRateio("Por colaborador / hora trabalhada")).toBe(
      "hora_trabalhada",
    );
    expect(regraDeRateio("Divisão manual")).toBe("manual");
    expect(regraDeRateio("Porcentagem do valor da O.S.")).toBe("percentual");
    expect(regraDeRateio("Terceirizado")).toBe("terceirizado");
    expect(regraDeRateio("Outra")).toBeNull();
    expect(periodoDaVisita("Manhã")).toBe("manha");
    expect(periodoDaVisita(undefined)).toBeNull();
    expect(tipoDaVistoria("Vistoria de Saída")).toBe("saida");
    expect(tipoDaVistoria("Outra")).toBeNull();
    expect(respostaDoAmbiente("Não se aplica")).toBe("nao_se_aplica");
    expect(respostaDoAmbiente("")).toBe("respondido");
    expect(campoDoTipo("Sim")).toBe("sim");
    expect(campoDoTipo("Não se aplica")).toBe("nao_se_aplica");
  });

  it("usuário pelo nome, só quando é um só", () => {
    const u = [
      { id: "a", nome: "José Silva" },
      { id: "b", nome: "Maria" },
      { id: "c", nome: "maria" },
    ];
    expect(usuarioPeloNome("JOSE SILVA", u)).toBe("a");
    expect(usuarioPeloNome("Maria", u)).toBeNull();
    expect(usuarioPeloNome(undefined, u)).toBeNull();
  });
});

describe("prévia", () => {
  it("tudo certo: totais batem, custo confere e pode confirmar", () => {
    const p = pacote({ tecnicos: TECNICOS, os_internas: [OS_10] }, "contar", [
      "fotos/10_antes.jpg",
      "fotos/10_depois.jpg",
    ]);
    const previa = conferir(p, contexto(p));
    expect(previa.contagens.every((c) => c.bate)).toBe(true);
    expect(previa.custosConferidos).toBe(1);
    expect(previa.diferencasDeCusto).toEqual([]);
    expect(previa.fotos).toBe(2);
    expect(previa.fotosFaltando).toEqual([]);
    expect(previa.tecnicosSemValor).toEqual(["Caio Sem Valor"]);
    expect(previa.tecnicosLigados).toEqual([
      { nome: "Ana Lima", usuarioId: "u-ana" },
    ]);
    expect(previa.status).toEqual([
      {
        tipo: "os",
        antigo: "Finalizado",
        novo: "Fechado",
        quantidade: 1,
        daTabela: true,
      },
    ]);
    expect(previa.problemas.filter((x) => x.bloqueia)).toEqual([]);
    expect(previa.podeConfirmar).toBe(true);
  });

  it("total diferente do sistema atual bloqueia", () => {
    const p = pacote({ tecnicos: TECNICOS }, { tecnicos: 4 });
    const previa = conferir(p, contexto(p));
    expect(previa.contagens[0]).toMatchObject({
      lidos: 3,
      sistemaAtual: 4,
      bate: false,
    });
    expect(previa.podeConfirmar).toBe(false);
    const semTotal = pacote({ tecnicos: TECNICOS }, {});
    expect(conferir(semTotal, contexto(semTotal)).podeConfirmar).toBe(false);
  });

  it("status fora da tabela bloqueia até escolher", () => {
    const os = { ...OS_10, status: "Em revisão", legado: undefined };
    const p = pacote({ tecnicos: TECNICOS, os_internas: [os] }, "contar", [
      "fotos/10_antes.jpg",
      "10_depois.jpg",
    ]);
    const antes = conferir(p, contexto(p));
    expect(antes.status[0]?.novo).toBeNull();
    expect(antes.podeConfirmar).toBe(false);
    const depois = conferir(
      p,
      contexto(p, { mapeamento: { "os:Em revisão": "em_andamento" } }),
    );
    expect(depois.status[0]).toMatchObject({
      novo: "Em andamento",
      daTabela: false,
    });
    expect(depois.podeConfirmar).toBe(true);
  });

  it("custo diferente e foto faltando aparecem, mas não bloqueiam", () => {
    const os = {
      ...OS_10,
      legado: { valor_total: "430,00", minutos: 480, minuto_homem: 900 },
    };
    const p = pacote({ tecnicos: TECNICOS, os_internas: [os] });
    const previa = conferir(p, contexto(p));
    expect(previa.diferencasDeCusto).toEqual([
      {
        numero: 10,
        tipo: "os_internas",
        campos: [
          { campo: "Custo total", antigo: 430, novo: 422.28 },
          { campo: "Minuto-homem", antigo: 900, novo: 960 },
        ],
      },
    ]);
    expect(previa.fotosFaltando.map((f) => f.arquivo)).toEqual([
      "fotos/10_antes.jpg",
      "10_depois.jpg",
    ]);
    expect(previa.podeConfirmar).toBe(true);
  });

  it("sessão com técnico desconhecido e número repetido bloqueiam", () => {
    const os = {
      ...OS_10,
      sessoes: [
        { data: "20/10/2026", inicio: "08:00", fim: "09:00", tecnicos: ["9"] },
      ],
    };
    const p = pacote({ tecnicos: TECNICOS, os_internas: [os, os] });
    const previa = conferir(p, contexto(p));
    const textos = previa.problemas
      .filter((x) => x.bloqueia)
      .map((x) => x.texto);
    expect(textos.some((t) => t.includes("técnicos que não estão"))).toBe(true);
    expect(textos.some((t) => t.includes("mais de uma vez"))).toBe(true);
  });

  it("vistoria com código já usado no módulo bloqueia; reimportada não", () => {
    const v = {
      codigo: "arp07",
      tipo: "Entrada",
      status: "Finalizado",
      data: "01/10/2026",
      vistoriador: "Ana",
      locatario: "Loja Exemplo",
      bloco: "A",
      unidade: "Loja 12",
      ambientes: [],
    };
    const p = pacote({ vistorias: [v] });
    const novo = conferir(
      p,
      contexto(p, {
        codigosNoModulo: new Map([["ARP07", { legado_id: null }]]),
      }),
    );
    expect(novo.podeConfirmar).toBe(false);
    const reimportada = conferir(
      p,
      contexto(p, {
        codigosNoModulo: new Map([["ARP07", { legado_id: "ARP07" }]]),
      }),
    );
    expect(reimportada.podeConfirmar).toBe(true);
  });
});

describe("números de OS", () => {
  it("mantém, atualiza o importado antes ou entra com número novo", () => {
    const p = pacote({
      os_internas: [
        { ...OS_10, numero: 1 },
        { ...OS_10, numero: 2 },
        { ...OS_10, numero: 3 },
      ],
      os_terceirizadas: [
        { numero: 3, status: "Aberto", aberta_em: "2026-10-01" },
      ],
    });
    const d = decidirNumeros(
      p,
      new Map([
        [1, { legado_origem: ORIGEM_LEGADO.os_internas, legado_id: "1" }],
        [2, { legado_origem: null, legado_id: null }],
      ]),
    );
    expect(Object.fromEntries(d)).toEqual({
      "os_internas:1": "atualizar",
      "os_internas:2": "numero_novo",
      "os_internas:3": "manter",
      "os_terceirizadas:3": "numero_novo",
    });
  });
});
