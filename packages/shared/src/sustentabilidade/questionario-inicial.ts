import {
  type CampoAutomatico,
  type DefinicaoFormulario,
  type MostrarSe,
  type Opcao,
  type Pergunta,
  type Secao,
  UNIDADES_PADRAO,
} from "./formulario/tipos";

// Questionário da entrevista de resíduos: o Forms "Questionário RSU" (spec
// 4.4 e mockup). Ids ESTÁVEIS (q1…q46, q18b, q25b; opções qN_algo; seções
// A–F): respostas, importação do Forms e indicadores apontam para eles.
//
// Versão 1 = o Forms: 46 perguntas numeradas + 18b ("Separa os resíduos?",
// que no Forms vinha junto da 18 e decide entre E1 e E2). Versão 2 = versão 1
// + 25b ("Quantidade diária de resíduo não reciclável"), criada sem respostas
// (spec seção 8).

type Extra = Partial<Omit<Pergunta, "id" | "numero" | "texto" | "tipo">>;

function pergunta(
  numero: string,
  texto: string,
  tipo: Pergunta["tipo"],
  extra: Extra = {},
): Pergunta {
  return {
    id: `q${numero}`,
    numero,
    texto,
    ajuda: "",
    tipo,
    obrigatoria: false,
    opcoes: [],
    unidades: tipo === "numero_unidade" ? [...UNIDADES_PADRAO] : [],
    mostrar_se: null,
    fonte_indicador: false,
    ativa: true,
    travada: false,
    auto: null,
    ...extra,
  };
}

function auto(numero: string, texto: string, campo: CampoAutomatico) {
  return pergunta(numero, texto, "auto", { travada: true, auto: campo });
}

function opcoes(numero: string, pares: [string, string][]): Opcao[] {
  return pares.map(([sufixo, texto]) => ({
    id: `q${numero}_${sufixo}`,
    texto,
    ativa: true,
  }));
}

const se = (numero: string, opcao: string): MostrarSe => ({
  pergunta_id: `q${numero}`,
  valor: `q${numero}_${opcao}`,
});

const SIM_NAO: [string, string][] = [
  ["sim", "Sim"],
  ["nao", "Não"],
];

const TIPOS_DE_RESIDUO: [string, string][] = [
  ["organico", "Orgânico (restos de comida)"],
  ["plastico", "Plástico"],
  ["papel", "Papel/papelão"],
  ["vidro", "Vidro"],
  ["metal", "Metal"],
  ["nao_reciclavel", "Não reciclado (lixo de banheiro)"],
];

const SEM_SEPARACAO = () => se("18b", "nao");
const COM_SEPARACAO = () => se("18b", "sim");
const RSS = () => se("23", "rss");
const RI = () => se("23", "ri");
const RCC = () => se("23", "rcc");
const OLEO = () => se("23", "oleo");
const GORDURA = () => se("23", "caixa_gordura");

const ind = { fonte_indicador: true };

/** 25b: criada na versão 2. */
const q25b = () =>
  pergunta(
    "25b",
    "Quantidade diária de resíduo não reciclável",
    "numero_unidade",
    { mostrar_se: COM_SEPARACAO() },
  );

function secoes(com25b: boolean): Secao[] {
  const secao = (id: string, nome: string, perguntas: Pergunta[]): Secao => ({
    id,
    nome,
    ativa: true,
    perguntas,
  });
  return [
    secao("A", "Identificação", [
      auto("1", "Nome da empresa", "empresa"),
      auto("2", "Código do sistema (LUC)", "luc"),
      pergunta("3", "Setor econômico", "varias", {
        ...ind,
        ajuda: "Define o prazo para refazer a entrevista.",
        opcoes: opcoes("3", [
          ["saude", "Saúde"],
          ["industrial", "Industrial/Confecção"],
          ["gastronomico", "Gastronômico"],
          ["lojas", "Lojas e serviços gerais"],
          ["educacao_basica", "Educação básica"],
          ["educacao_profissionalizante", "Educação profissionalizante"],
          ["academia", "Academia"],
        ]),
      }),
      auto("4", "Situação", "situacao"),
      auto("5", "Data da entrevista", "data"),
    ]),
    secao("B", "Entrevistado e estabelecimento", [
      pergunta("6", "Nome completo e cargo do respondente", "texto", {
        obrigatoria: true,
      }),
      pergunta("7", "Grau de conhecimento sobre gestão de resíduos", "uma", {
        ...ind,
        obrigatoria: true,
        ajuda: "A entrevistadora avalia pela conversa.",
        opcoes: opcoes("7", [
          ["muito", "10 a 9 - muito conhecimento"],
          ["mediano", "8 a 6 - conhecimento mediano"],
          ["pouco", "5 a 3 - pouco conhecimento"],
          ["nenhum", "3 a 0 - sem conhecimento algum"],
        ]),
      }),
      pergunta("8", "Número de pessoas fixas (funcionários)", "numero"),
      pergunta("9", "Número de visitantes por dia (média)", "numero"),
      pergunta(
        "10",
        "Existem banheiros internos? Quantos sanitários?",
        "sim_nao_quantidade",
        { ajuda: "Se sim, informe a quantidade." },
      ),
      pergunta(
        "11",
        "Existe copa, refeitório ou venda de alimentos?",
        "sim_nao_descricao",
        { ajuda: "Se sim, descreva quantidade, tamanho e funcionamento." },
      ),
    ]),
    secao("C", "SustentArp", [
      pergunta("12", "Você conhece o SustentArp?", "uma", {
        ...ind,
        opcoes: opcoes("12", [
          ["sim", "Sim"],
          ["pouco", "Pouco"],
          ["nao", "Não"],
        ]),
      }),
      pergunta(
        "13",
        "Sua empresa contribui para o Clube do SustentArp?",
        "uma",
        {
          ...ind,
          ajuda: "Se não, apresentar o clube.",
          opcoes: opcoes("13", [
            ["sim", "Sim"],
            ["ainda_nao", "Ainda não"],
            ["nao", "Não"],
          ]),
        },
      ),
      pergunta(
        "14",
        "Tem alguma sugestão para o Programa SustentArp?",
        "texto_longo",
      ),
      pergunta("15", "Comentários e observações gerais", "texto_longo"),
    ]),
    secao("D", "PGRS", [
      pergunta("16", "A empresa possui PGRS?", "uma", {
        ...ind,
        obrigatoria: true,
        ajuda: "PGRS é o Plano de Gerenciamento de Resíduos Sólidos.",
        opcoes: opcoes("16", SIM_NAO),
      }),
      pergunta("17", "Em que data o PGRS foi elaborado?", "data", {
        mostrar_se: se("16", "sim"),
      }),
    ]),
    secao("E", "Resíduos", [
      pergunta(
        "18",
        "Quais tipos de resíduos são gerados e como são acondicionados?",
        "texto_longo",
      ),
      pergunta("18b", "O estabelecimento separa os resíduos?", "uma", {
        ...ind,
        obrigatoria: true,
        ajuda: "Define quais perguntas aparecem a seguir.",
        opcoes: opcoes("18b", SIM_NAO),
      }),
      // E1. Sem separação
      pergunta("19", "Quantidade diária de lixo gerado", "numero_unidade", {
        mostrar_se: SEM_SEPARACAO(),
      }),
      pergunta("20", "Estimativa de geração por tipo de resíduo", "grade", {
        ...ind,
        mostrar_se: SEM_SEPARACAO(),
        opcoes: opcoes("20", TIPOS_DE_RESIDUO),
      }),
      pergunta("21", "Com que frequência o lixo é retirado?", "texto", {
        mostrar_se: SEM_SEPARACAO(),
        ajuda: "Ex.: diariamente, dia sim e dia não, 2 vezes por semana.",
      }),
      pergunta("22", "Coletor usado com mais frequência", "uma", {
        ...ind,
        mostrar_se: SEM_SEPARACAO(),
        opcoes: opcoes("22", [
          ["pev_cacula", "PEV Caçula"],
          ["pev_pontal", "PEV Pontal"],
          ["pev_sustentarp", "PEV SustentArp"],
          ["bloco3", "Coletores internos - bloco 3"],
          ["bloco5", "Coletores internos - bloco 5"],
          ["bloco9", "Coletores internos - bloco 9"],
          ["bloco10", "Coletores internos - bloco 10"],
          ["ruas", "Coletores pequenos das ruas internas"],
        ]),
      }),
      // E2. Com separação
      pergunta("24", "Como o resíduo é separado?", "texto_longo", {
        mostrar_se: COM_SEPARACAO(),
        ajuda: "Por origem e/ou por composição.",
      }),
      pergunta(
        "25",
        "Quantidade diária de resíduo reciclável",
        "numero_unidade",
        {
          mostrar_se: COM_SEPARACAO(),
        },
      ),
      ...(com25b ? [q25b()] : []),
      pergunta("26", "Estimativa de geração por tipo de resíduo", "grade", {
        ...ind,
        mostrar_se: COM_SEPARACAO(),
        opcoes: opcoes("26", TIPOS_DE_RESIDUO),
      }),
      pergunta("27", "Com que frequência o lixo é retirado?", "texto", {
        mostrar_se: COM_SEPARACAO(),
      }),
      pergunta("28", "Coletores usados com mais frequência", "varias", {
        ...ind,
        mostrar_se: COM_SEPARACAO(),
        opcoes: opcoes("28", [
          ["pev_cacula_azul", "PEV Caçula (azul)"],
          ["pev_pontal_azul", "PEV Pontal (azul)"],
          ["pev_sustentarp_azul", "PEV SustentArp (azul)"],
          ["pev_cacula_preto", "PEV Caçula (preto)"],
          ["pev_pontal_preto", "PEV Pontal (preto)"],
          ["pev_sustentarp_preto", "PEV SustentArp (preto)"],
          [
            "especiais",
            "Coletores especiais SustentArp (cápsulas de café e outros)",
          ],
          ["bloco3_reciclavel", "Coletores internos - bloco 3 (reciclável)"],
          [
            "bloco3_nao_reciclavel",
            "Coletores internos - bloco 3 (não reciclável)",
          ],
          ["bloco5_reciclavel", "Coletores internos - bloco 5 (reciclável)"],
          [
            "bloco5_nao_reciclavel",
            "Coletores internos - bloco 5 (não reciclável)",
          ],
          ["bloco9_reciclavel", "Coletores internos - bloco 9 (reciclável)"],
          [
            "bloco9_nao_reciclavel",
            "Coletores internos - bloco 9 (não reciclável)",
          ],
          ["bloco10_reciclavel", "Coletores internos - bloco 10 (reciclável)"],
          [
            "bloco10_nao_reciclavel",
            "Coletores internos - bloco 10 (não reciclável)",
          ],
          ["ruas", "Coletores pequenos das ruas internas"],
        ]),
      }),
      pergunta(
        "29",
        "Algum resíduo não vai para os coletores internos da ARP? Qual e como é destinado?",
        "texto_longo",
        { mostrar_se: COM_SEPARACAO() },
      ),
      pergunta(
        "30",
        "Carências ou problemas para fazer a coleta seletiva",
        "texto_longo",
        { mostrar_se: COM_SEPARACAO() },
      ),
      pergunta("31", "Comentários e observações gerais", "texto_longo", {
        mostrar_se: COM_SEPARACAO(),
      }),
      // E3. Resíduos especiais
      pergunta(
        "23",
        "Além do lixo comum, gera algum destes resíduos?",
        "varias",
        {
          ...ind,
          ajuda: "Cada opção marcada abre as perguntas específicas.",
          opcoes: opcoes("23", [
            ["rss", "RSS (saúde)"],
            ["ri", "RI (industrial)"],
            ["rcc", "RCC (construção)"],
            ["oleo", "Óleo de cozinha usado"],
            ["caixa_gordura", "Caixa de gordura"],
            ["nenhum", "Nenhum"],
          ]),
        },
      ),
    ]),
    secao("F", "Resíduos especiais", [
      pergunta("32", "RSS: quantidade diária gerada", "numero_unidade", {
        mostrar_se: RSS(),
      }),
      pergunta("33", "RSS: onde é feito o armazenamento temporário?", "texto", {
        mostrar_se: RSS(),
      }),
      pergunta("34", "RSS: empresa responsável pela coleta", "texto", {
        mostrar_se: RSS(),
      }),
      pergunta("35", "RI: quantidade diária gerada", "numero_unidade", {
        mostrar_se: RI(),
      }),
      pergunta("36", "RI: composição", "texto", { mostrar_se: RI() }),
      pergunta("37", "RI: armazenamento temporário", "texto", {
        mostrar_se: RI(),
      }),
      pergunta("38", "RI: empresa responsável pela coleta", "texto", {
        mostrar_se: RI(),
      }),
      pergunta("39", "RCC: geração contínua ou eventual?", "uma", {
        mostrar_se: RCC(),
        opcoes: opcoes("39", [
          ["continua", "Contínua"],
          ["eventual", "Eventual"],
        ]),
      }),
      pergunta("40", "RCC: quantidade gerada", "numero_unidade", {
        mostrar_se: RCC(),
      }),
      pergunta("41", "RCC: armazenamento temporário", "texto", {
        mostrar_se: RCC(),
      }),
      pergunta("42", "RCC: empresa responsável pela coleta", "texto", {
        mostrar_se: RCC(),
      }),
      pergunta(
        "43",
        "Óleo: litros gerados por dia ou semana",
        "numero_unidade",
        {
          mostrar_se: OLEO(),
        },
      ),
      pergunta("44", "Óleo: armazenamento temporário", "texto", {
        mostrar_se: OLEO(),
      }),
      pergunta("45", "Óleo: empresa responsável pela coleta", "texto", {
        mostrar_se: OLEO(),
      }),
      pergunta("46", "Caixa de gordura: empresa usada e frequência", "texto", {
        mostrar_se: GORDURA(),
        ajuda:
          "O resíduo da caixa de gordura não pode ir para os coletores da ARP.",
      }),
    ]),
  ];
}

/** Perguntas criadas na versão 2 (não existem na 1). */
export const QUESTIONARIO_V2_EXTRA = ["q25b"] as const;

/** Versão 1: o Forms "Questionário RSU" (46 perguntas + 18b). */
export function questionarioV1(): DefinicaoFormulario {
  return { secoes: secoes(false) };
}

/** Versão 2: a 1 + 25b. É a publicada na entrada do módulo. */
export function questionarioV2(): DefinicaoFormulario {
  return { secoes: secoes(true) };
}
