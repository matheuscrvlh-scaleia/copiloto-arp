import type { Database, Json } from "@/lib/supabase/database.types";
import type { EntradaOS, Material, Sessao, VigenciaValor } from "./calculos";
import { type Gatilho, type ItemDoModelo, montarAviso } from "./modelos";
import {
  type Calendario,
  calcularPrazo,
  ehDiaUtil,
  prazoDoAceite,
  somarDiasUteis,
} from "./prazo";
import { datasEntre, type Recorrencia } from "./recorrencia";
import type {
  MotivoAguardando,
  Origem,
  Periodo,
  Prioridade,
  RegraRateio,
  StatusChamado,
  TipoChamado,
  TipoVistoria,
  UnidadePrazo,
} from "./rotulos";
import {
  deBrasilia,
  hojeEmBrasilia,
  horaDosMinutos,
  minutosDoDia,
  paraBrasilia,
  somarDias,
} from "./tempo";
import { localEData } from "./vistoria";

// Dados de exemplo fictícios (etapa 1 da spec): o volume de uma operação
// como a da ARP — mais de 200 lojas, os setores do levantamento, centenas de
// chamados e OS com técnicos e custos, ativos com histórico e vistorias.
// Determinístico pela semente: a mesma semente e o mesmo "agora" geram os
// mesmos dados (e os mesmos ids), o que deixa testar e repetir. Nada aqui é
// nome ou dado real: lojas, locatários, técnicos, empresas e telefones são
// combinações de palavras genéricas; e-mails usam o domínio reservado
// .example. Puro: o servidor (src/server/os/exemplo.ts) grava.

type Tabelas = Database["os"]["Tables"];
type Ins<T extends keyof Tabelas> = Tabelas[T]["Insert"];

export interface CategoriaExemplo {
  id: string;
  nome: string;
  setor_id: string;
  pai_id: string | null;
  tipo_padrao: TipoChamado;
  prazo_valor: number | null;
  prazo_unidade: UnidadePrazo;
  precisa_confirmacao: boolean;
  checklist: Json;
}

export interface EntradaExemplo {
  semente: number;
  agora: Date;
  cal: Calendario;
  almoco: { inicio: string; fim: string };
  setores: { id: string; nome: string }[];
  categorias: CategoriaExemplo[];
  ativoCategorias: {
    id: string;
    nome: string;
    vida_util_padrao_anos: number | null;
  }[];
  /** Usuários reais com acesso ao módulo (responsáveis e quem abriu). */
  pessoas: { id: string; nome: string }[];
  agendaTelhadoId: string | null;
  modelos: {
    id: string;
    nome: string;
    gatilho: Gatilho;
    descricao: string | null;
    itens: ItemDoModelo[];
  }[];
  ambientes: string[];
  causasFalha: string[];
  /** Prazo de aceite (dias úteis): quando o fechamento é automático. */
  aceiteDias: number;
  vistoria: {
    locador: string;
    local: string;
    textos: Partial<
      Record<TipoVistoria, { observacao?: string; termo?: string }>
    >;
  };
  /** Número do primeiro laudo (continua a numeração ARPnn da casa). */
  primeiroCodigoVistoria: number;
}

export interface FotoExemplo {
  vistoriaId: string;
  ambienteId: string;
  titulo: string;
  semente: number;
}

export interface DadosExemplo {
  lojas: Ins<"lojas">[];
  tecnicos: Ins<"tecnicos">[];
  tecnico_valores: Ins<"tecnico_valores">[];
  empresas: Ins<"empresas">[];
  profissionais: Ins<"profissionais">[];
  contatos: Ins<"contatos">[];
  ativos: Ins<"ativos">[];
  planos_preventivos: Ins<"planos_preventivos">[];
  vistorias: Ins<"vistorias">[];
  vistoria_ambientes: Ins<"vistoria_ambientes">[];
  chamados: Ins<"chamados">[];
  destinatarios: Ins<"destinatarios">[];
  eventos: Ins<"eventos">[];
  sessoes: Ins<"sessoes">[];
  sessao_tecnicos: Ins<"sessao_tecnicos">[];
  materiais: Ins<"materiais">[];
  material_valores: Ins<"material_valores">[];
  os_custos: Ins<"os_custos">[];
  chamado_profissionais: Ins<"chamado_profissionais">[];
  terceirizado_links: Ins<"terceirizado_links">[];
  agendamentos: Ins<"agendamentos">[];
  disparos: Ins<"disparos">[];
  /** Fotos dos ambientes: o servidor desenha e grava no bucket. */
  fotos: FotoExemplo[];
  /** Entrada do cálculo de cada OS (o servidor grava com calcularOS). */
  calculos: { chamadoId: string; entrada: EntradaOS }[];
}

// ---------------------------------------------------------------------------
// Sorteio determinístico
// ---------------------------------------------------------------------------

const ALFABETO =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** mulberry32: rápido, bom o bastante e igual em qualquer máquina. */
export function sorteio(semente: number) {
  let s = semente >>> 0;
  const aleatorio = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (a: number, b: number) =>
    a + Math.floor(aleatorio() * (b - a + 1));
  const escolher = <T>(lista: readonly T[]): T => {
    if (!lista.length) throw new Error("lista vazia no sorteio");
    return lista[Math.floor(aleatorio() * lista.length)] as T;
  };
  const chance = (p: number) => aleatorio() < p;
  /** Chave sorteada pelo peso ({ a: 3, b: 1 } → "a" 75% das vezes). */
  const pesos = <K extends string>(p: Record<K, number>): K => {
    const itens = Object.entries(p) as [K, number][];
    let r = aleatorio() * itens.reduce((t, [, v]) => t + v, 0);
    for (const [k, v] of itens) {
      r -= v;
      if (r < 0) return k;
    }
    return (itens.at(-1) as [K, number])[0];
  };
  const uuid = () => {
    const h = Array.from({ length: 32 }, () => int(0, 15).toString(16));
    h[12] = "4";
    h[16] = (8 + int(0, 3)).toString(16);
    const j = h.join("");
    return `${j.slice(0, 8)}-${j.slice(8, 12)}-${j.slice(12, 16)}-${j.slice(16, 20)}-${j.slice(20)}`;
  };
  const token = () =>
    Array.from({ length: 43 }, () => ALFABETO[int(0, 63)]).join("");
  /** Fisher-Yates (sort com comparação aleatória não é determinístico). */
  const embaralhar = <T>(lista: readonly T[]): T[] => {
    const l = [...lista];
    for (let i = l.length - 1; i > 0; i--) {
      const j = int(0, i);
      [l[i], l[j]] = [l[j] as T, l[i] as T];
    }
    return l;
  };
  return { aleatorio, int, escolher, chance, pesos, uuid, token, embaralhar };
}

// ---------------------------------------------------------------------------
// Vocabulário fictício
// ---------------------------------------------------------------------------

export const TIPOS_DE_LOJA = [
  "Café",
  "Ótica",
  "Pet",
  "Padaria",
  "Farmácia",
  "Livraria",
  "Papelaria",
  "Barbearia",
  "Salão",
  "Ateliê",
  "Empório",
  "Bazar",
  "Doceria",
  "Sorveteria",
  "Pizzaria",
  "Lanchonete",
  "Cantina",
  "Calçados",
  "Moda",
  "Brinquedos",
  "Eletrônicos",
  "Celulares",
  "Relojoaria",
  "Perfumaria",
  "Cosméticos",
  "Academia",
  "Clínica",
  "Lavanderia",
  "Chaveiro",
  "Floricultura",
  "Hortifruti",
  "Mercearia",
  "Informática",
  "Esportes",
  "Armarinho",
  "Presentes",
] as const;

export const QUALIFICADORES = [
  "Serra",
  "Vista",
  "Amigo",
  "Central",
  "do Vale",
  "Bela",
  "Nova",
  "da Praça",
  "Estrela",
  "Sol",
  "Aurora",
  "Primavera",
  "Horizonte",
  "Mirante",
  "Cascata",
  "Recanto",
  "Jardim",
  "Montanha",
  "Alvorada",
  "Encanto",
  "Ponto Certo",
  "Brisa",
  "Raiz",
  "Fonte",
  "Trilha",
  "Lume",
  "Vila",
  "Bom Dia",
  "Pinhal",
  "Ipê",
] as const;

const PRENOMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elisa",
  "Fábio",
  "Gabriela",
  "Heitor",
  "Isabela",
  "Joel",
  "Karina",
  "Lucas",
  "Marina",
  "Nícolas",
  "Olívia",
  "Paulo",
  "Rafael",
  "Sabrina",
  "Tiago",
  "Valéria",
  "Wesley",
  "Yara",
  "Caio",
  "Débora",
  "Renan",
  "Luana",
];

const SOBRENOMES = [
  "Almeida",
  "Barros",
  "Campos",
  "Dias",
  "Esteves",
  "Freitas",
  "Gomes",
  "Lacerda",
  "Moraes",
  "Nunes",
  "Pacheco",
  "Queiroz",
  "Rezende",
  "Siqueira",
  "Teixeira",
  "Vasconcelos",
  "Xavier",
  "Prado",
  "Rocha",
  "Toledo",
];

export const BLOCOS = ["A", "B", "C", "D", "E", "F"] as const;

const EMPRESAS = [
  {
    nome: "Friocerto Refrigeração",
    servicos: "Ar-condicionado e câmaras frias",
  },
  { nome: "Voltagem Instalações", servicos: "Elétrica predial e quadros" },
  { nome: "Aguaviva Hidráulica", servicos: "Bombas, registros e vazamentos" },
  { nome: "Cobertura Firme", servicos: "Telhados, calhas e impermeabilização" },
  { nome: "Portal Seguro Automação", servicos: "Portões, cancelas e câmeras" },
  { nome: "Elevar Manutenção", servicos: "Elevadores e escadas rolantes" },
] as const;

const FABRICANTES = [
  "Alfa Equipamentos",
  "Beta Industrial",
  "Gama Técnica",
  "Delta Sistemas",
  "Ômega Engenharia",
];

const MATERIAIS: [string, string, number][] = [
  ["Disjuntor 20A", "un", 38.9],
  ["Cabo flexível 2,5mm", "m", 3.2],
  ["Lâmpada LED tubular 18W", "un", 21.5],
  ["Reator eletrônico", "un", 64],
  ["Tomada 2P+T", "un", 14.9],
  ["Fita isolante", "un", 7.5],
  ["Registro de gaveta 3/4", "un", 72],
  ["Tubo PVC 25mm", "m", 6.8],
  ["Joelho PVC 25mm", "un", 2.4],
  ["Veda rosca", "un", 5.9],
  ["Silicone", "un", 24],
  ["Telha de fibrocimento", "un", 58],
  ["Calha galvanizada", "m", 45],
  ["Gás refrigerante", "kg", 95],
  ["Filtro de ar", "un", 32],
  ["Correia", "un", 48],
  ["Rolamento", "un", 36],
  ["Óleo lubrificante", "l", 29],
  ["Massa corrida", "kg", 6.5],
  ["Tinta acrílica", "l", 28],
];

/** Peças caras: o que faz um ativo velho chegar ao sinal de troca. */
const PECAS_CARAS: [string, string, number][] = [
  ["Compressor", "un", 2850],
  ["Placa eletrônica", "un", 1240],
  ["Motor elétrico", "un", 1890],
  ["Selo mecânico", "un", 640],
  ["Rotor", "un", 980],
];

const COMENTARIOS = [
  "Fui ao local e confirmei o problema.",
  "Peça pedida ao fornecedor, chega amanhã.",
  "Precisei desligar o circuito por 20 minutos; lojista avisado.",
  "Combinei com o lojista o melhor horário.",
  "Resolvido de forma provisória; volto para o definitivo.",
  "Foto do antes anexada na OS.",
  "Liguei para o terceirizado, vem na parte da tarde.",
  "Pode confirmar se ficou bom?",
];

const MOTIVOS_AGUARDANDO: Record<MotivoAguardando, string[]> = {
  material: ["Aguardando a peça do fornecedor", "Material em cotação"],
  terceirizado: ["Terceirizado agendado", "Aguardando orçamento"],
  lojista: ["Aguardando o lojista liberar a loja", "Lojista vai mandar fotos"],
  aprovacao: ["Orçamento com a gerência", "Aguardando aprovação do valor"],
  outro: ["Aguardando a chuva parar", "Depende de outra obra"],
};

const MOTIVOS_CANCELAMENTO = [
  "Aberto em duplicidade",
  "O lojista resolveu por conta própria",
  "Não é com a administração",
  "Pedido desistido",
];

const AVALIACOES = [
  "Atendimento rápido, obrigado!",
  "Resolveram no mesmo dia.",
  "Demorou um pouco, mas ficou bom.",
  "Equipe educada e cuidadosa.",
  "Precisei cobrar duas vezes.",
];

const TITULOS_OS: Record<string, string[]> = {
  Elétrica: [
    "Disjuntor desarmando",
    "Troca de lâmpadas do corredor",
    "Tomada sem energia",
    "Quadro elétrico aquecendo",
    "Iluminação da fachada apagada",
    "Ar-condicionado não gela",
    "Ar-condicionado pingando",
  ],
  Hidráulica: [
    "Vazamento no banheiro",
    "Bomba fazendo barulho",
    "Registro com vazamento",
    "Entupimento na pia",
    "Caixa d'água transbordando",
    "Pressão baixa na torneira",
  ],
  Estrutura: [
    "Porta de vidro desalinhada",
    "Portão travando",
    "Elevador parado entre andares",
    "Rachadura na parede",
    "Piso solto na circulação",
    "Escada rolante com ruído",
  ],
  Telhado: [
    "Goteira na loja",
    "Telha quebrada",
    "Exaustor sem funcionar",
    "Rufo solto",
  ],
  Calha: ["Calha entupida", "Calha transbordando na chuva"],
  Infiltração: ["Infiltração após chuva", "Mancha de umidade no teto"],
};

/** Que ativo cada categoria de OS costuma atender. */
const ATIVOS_DA_CATEGORIA: Record<string, string[]> = {
  Elétrica: ["Ar-condicionado", "Quadro elétrico", "Iluminação", "Gerador"],
  Hidráulica: ["Bomba", "Registro de água"],
  Estrutura: ["Portão", "Elevador", "Escada rolante"],
  Telhado: ["Exaustor"],
};

const DESCRICOES_AMBIENTE: Record<string, string[]> = {
  Paredes: [
    "Paredes em alvenaria com pintura acrílica branca, sem fissuras aparentes.",
    "Pintura com pequenas marcas de uso próximas à porta.",
  ],
  Teto: [
    "Forro de gesso em bom estado, sem manchas.",
    "Forro com mancha de umidade no canto do fundo.",
  ],
  Piso: [
    "Porcelanato 60x60 em bom estado.",
    "Piso com duas peças trincadas próximas à vitrine.",
  ],
  "Fachada e Acesso": [
    "Porta de vidro temperado com fechadura funcionando.",
    "Vitrine com película descolando.",
  ],
};

const TEXTO_PADRAO_AMBIENTE = [
  "Em bom estado de conservação.",
  "Funcionando normalmente no momento da vistoria.",
  "Sem observações.",
];

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

const iso = (d: Date) => d.toISOString();
const somarMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const menor = (a: Date, b: Date) => (a < b ? a : b);
const maior = (a: Date, b: Date) => (a > b ? a : b);
const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pad = (n: number, d: number) => String(n).padStart(d, "0");
const reais = (v: number) => Math.round(v * 100) / 100;

interface CicloGerado {
  status: StatusChamado;
  resposta: Date | null;
  concluido: Date | null;
  fechado: Date | null;
  fechadoAutomatico: boolean;
  aguardandoDesde: Date | null;
  aguardandoTipo: MotivoAguardando | null;
  cancelado: Date | null;
}

export function gerarExemplo(e: EntradaExemplo): DadosExemplo {
  const s = sorteio(e.semente);
  const agora = e.agora;
  const hoje = hojeEmBrasilia(agora);
  const d: DadosExemplo = {
    lojas: [],
    tecnicos: [],
    tecnico_valores: [],
    empresas: [],
    profissionais: [],
    contatos: [],
    ativos: [],
    planos_preventivos: [],
    vistorias: [],
    vistoria_ambientes: [],
    chamados: [],
    destinatarios: [],
    eventos: [],
    sessoes: [],
    sessao_tecnicos: [],
    materiais: [],
    material_valores: [],
    os_custos: [],
    chamado_profissionais: [],
    terceirizado_links: [],
    agendamentos: [],
    disparos: [],
    fotos: [],
    calculos: [],
  };

  // --- Catálogo de quem chama -------------------------------------------
  const primeiroSetor = e.setores[0];
  if (!primeiroSetor) throw new Error("Cadastre os setores antes.");
  const setor = (nome: string) =>
    (e.setores.find((x) => sem(x.nome) === sem(nome)) ?? primeiroSetor).id;
  const categoria = (nome: string) =>
    e.categorias.find((c) => sem(c.nome) === sem(nome)) ?? null;
  const pessoa = () => (e.pessoas.length ? s.escolher(e.pessoas) : null);
  const responsavel = () => (s.chance(0.85) ? (pessoa()?.id ?? null) : null);
  const telefone = () =>
    `(22) 9${pad(s.int(8000, 9999), 4)}-${pad(s.int(0, 9999), 4)}`;
  const nomePessoa = () =>
    `${s.escolher(PRENOMES)} ${s.escolher(SOBRENOMES)} ${s.escolher(SOBRENOMES)}`;
  const operacoes = setor("Operações");

  // --- Lojas (contratos) ------------------------------------------------
  const nomes = new Set<string>();
  const nomeDeLoja = () => {
    for (;;) {
      const n = `${s.escolher(TIPOS_DE_LOJA)} ${s.escolher(QUALIFICADORES)}`;
      if (!nomes.has(n)) {
        nomes.add(n);
        return n;
      }
    }
  };
  const porBloco = new Map<string, number>();
  const novaLuc = (bloco: string) => {
    const n = (porBloco.get(bloco) ?? 100) + s.int(1, 3);
    porBloco.set(bloco, n);
    return `${bloco}${n}`;
  };
  type Loja = Ins<"lojas"> & { id: string; luc: string; nome: string };
  const lojas: Loja[] = [];
  const novaLoja = (p: {
    luc?: string;
    situacao: "vigente" | "encerrado";
    inicio: string;
    fim?: string | null;
  }): Loja => {
    const bloco = p.luc?.[0] ?? s.escolher(BLOCOS);
    const empresa = s.chance(0.45);
    const l: Loja = {
      id: s.uuid(),
      enet_id: null,
      contrato: `CT-${p.inicio.slice(0, 4)}-${pad(lojas.length + 1, 4)}`,
      luc: p.luc ?? novaLuc(bloco),
      nome: nomeDeLoja(),
      locatario: empresa
        ? `${s.escolher(QUALIFICADORES)} ${s.escolher(["Comércio", "Serviços", "Varejo"])} Ltda.`
        : nomePessoa(),
      bloco,
      situacao: p.situacao,
      inicio: p.inicio,
      fim: p.fim ?? null,
      telefone: telefone(),
      tem_vaga: s.chance(0.4),
      exemplo: true,
    };
    lojas.push(l);
    return l;
  };

  // Encerradas primeiro: algumas LUCs voltam com um contrato novo.
  const encerradas: Loja[] = [];
  for (let i = 0; i < 18; i++) {
    // As duas primeiras saíram agora (a rotina de saída acha a primeira); as
    // três seguintes saíram há poucos meses; as outras, há anos.
    const fim =
      i < 2
        ? somarDias(hoje, -s.int(3, 18))
        : i < 5
          ? somarDias(hoje, -s.int(30, 150))
          : somarDias(hoje, -s.int(200, 1400));
    encerradas.push(
      novaLoja({
        situacao: "encerrado",
        inicio: somarDias(fim, -s.int(400, 2500)),
        fim,
      }),
    );
  }
  // Contratos novos: os 4 primeiros já têm o aviso de entrada; os outros a
  // rotina de modelos acha sozinha (mostra a automação funcionando).
  const novas: Loja[] = [];
  for (let i = 0; i < 6; i++) {
    const luc = i < 3 ? encerradas[i + 2]?.luc : undefined;
    novas.push(
      novaLoja({
        luc,
        situacao: "vigente",
        inicio: i < 5 ? somarDias(hoje, -s.int(1, 25)) : somarDias(hoje, 12),
      }),
    );
  }
  // Entradas dos últimos meses (com o aviso de entrada já andando).
  const recentes: Loja[] = [];
  for (let i = 0; i < 10; i++)
    recentes.push(
      novaLoja({
        situacao: "vigente",
        inicio: somarDias(hoje, -s.int(35, 170)),
      }),
    );
  while (lojas.length < 214)
    novaLoja({
      situacao: "vigente",
      inicio: somarDias(hoje, -s.int(200, 3200)),
      // Algumas com a saída marcada nas próximas semanas.
      fim: s.chance(0.03) ? somarDias(hoje, s.int(10, 60)) : null,
    });
  d.lojas = lojas;
  const vigentes = lojas.filter((l) => l.situacao === "vigente");

  // --- Técnicos e valor por minuto --------------------------------------
  const tecnicos: { id: string; desligado: string | null }[] = [];
  const vigencias: VigenciaValor[] = [];
  const usados = new Set<string>();
  for (let i = 0; i < 8; i++) {
    let nome = nomePessoa().split(" ").slice(0, 2).join(" ");
    while (usados.has(nome))
      nome = nomePessoa().split(" ").slice(0, 2).join(" ");
    usados.add(nome);
    const id = s.uuid();
    const desligado = i === 7 ? somarDias(hoje, -s.int(45, 75)) : null;
    tecnicos.push({ id, desligado });
    d.tecnicos.push({
      id,
      nome,
      setor_id: operacoes,
      desligado_em: desligado,
      exemplo: true,
    });
    const valor = Math.round((0.3 + s.aleatorio() * 0.3) * 10_000) / 10_000;
    const desde = somarDias(hoje, -1100);
    vigencias.push({
      tecnico_id: id,
      vigente_desde: desde,
      valor_minuto: valor,
    });
    // Dois tiveram reajuste há 3 meses (a OS antiga não muda).
    if (i < 2)
      vigencias.push({
        tecnico_id: id,
        vigente_desde: somarDias(hoje, -90),
        valor_minuto: Math.round(valor * 1.08 * 10_000) / 10_000,
      });
  }
  d.tecnico_valores = vigencias.map((v) => ({ ...v }));
  const tecnicosEm = (dia: string) =>
    tecnicos.filter((t) => !t.desligado || t.desligado > dia).map((t) => t.id);

  // --- Terceirizados e contatos -----------------------------------------
  const empresas = EMPRESAS.map((x) => {
    const id = s.uuid();
    const dominio = sem(x.nome).replace(/[^a-z]+/g, "");
    d.empresas.push({
      id,
      nome: x.nome,
      servicos: x.servicos,
      contato: nomePessoa(),
      telefone: telefone(),
      email: `contato@${dominio}.example`,
      prazo_retorno_dias: s.int(3, 10),
      exemplo: true,
    });
    const profissionais = [0, 1].map(() => {
      const pid = s.uuid();
      d.profissionais.push({
        id: pid,
        empresa_id: id,
        nome: nomePessoa().split(" ").slice(0, 2).join(" "),
        telefone: telefone(),
        exemplo: true,
      });
      return pid;
    });
    return { id, nome: x.nome, profissionais };
  });
  for (let i = 0; i < 15; i++) {
    const tipo = i % 3;
    d.contatos.push({
      id: s.uuid(),
      nome: nomePessoa(),
      telefone: telefone(),
      empresa:
        tipo === 0
          ? "ARP (colaborador)"
          : tipo === 1
            ? s.escolher(EMPRESAS).nome
            : s.escolher(vigentes).nome,
      observacao: ["Colaborador", "Fornecedor", "Lojista"][tipo] ?? null,
      exemplo: true,
    });
  }

  // --- Ativos -----------------------------------------------------------
  type AtivoGerado = {
    id: string;
    nome: string;
    categoria: string;
    bloco: string;
    lojaId: string | null;
    problema: boolean;
    baixado: boolean;
  };
  const ativos: AtivoGerado[] = [];
  const modelosDeAtivo: [string, number, (i: number) => string][] = [
    [
      "Ar-condicionado",
      40,
      (i) =>
        `Ar-condicionado split ${s.escolher(["12.000", "18.000", "24.000"])} BTU nº ${i + 1}`,
    ],
    ["Bomba", 8, (i) => `Bomba de recalque ${i + 1}`],
    [
      "Portão",
      6,
      (i) =>
        `Portão ${i % 2 ? "de carga" : "do estacionamento"} ${BLOCOS[i] ?? ""}`,
    ],
    ["Elevador", 6, (i) => `Elevador bloco ${BLOCOS[i] ?? ""}`],
    ["Escada rolante", 4, (i) => `Escada rolante ${i + 1}`],
    ["Gerador", 2, (i) => `Gerador ${i ? "reserva" : "principal"}`],
    [
      "Iluminação",
      15,
      (i) => `Iluminação do corredor ${BLOCOS[i % 6]}${i + 1}`,
    ],
    [
      "Quadro elétrico",
      12,
      (i) => `Quadro elétrico geral ${BLOCOS[i % 6]}${i + 1}`,
    ],
    ["Registro de água", 10, (i) => `Registro geral ${BLOCOS[i % 6]}${i + 1}`],
    ["Câmera", 12, (i) => `Câmera ${pad(i + 1, 2)}`],
    ["Exaustor", 5, (i) => `Exaustor da praça de alimentação ${i + 1}`],
  ];
  const custoBase: Record<string, number> = {
    "Ar-condicionado": 4200,
    Bomba: 3800,
    Portão: 9000,
    Elevador: 180000,
    "Escada rolante": 210000,
    Gerador: 95000,
    Iluminação: 2500,
    "Quadro elétrico": 14000,
    "Registro de água": 900,
    Câmera: 1100,
    Exaustor: 6500,
  };
  for (const [nomeCat, quantos, nomeDo] of modelosDeAtivo) {
    const cat = e.ativoCategorias.find((c) => sem(c.nome) === sem(nomeCat));
    if (!cat) continue;
    for (let i = 0; i < quantos; i++) {
      const id = s.uuid();
      const bloco = s.escolher(BLOCOS);
      const naLoja = nomeCat === "Ar-condicionado" && s.chance(0.6);
      const loja = naLoja ? s.escolher(vigentes) : null;
      // Os 3 primeiros de algumas categorias são velhos e dão problema.
      const problema =
        i < 3 && ["Ar-condicionado", "Bomba", "Exaustor"].includes(nomeCat);
      const vida = cat.vida_util_padrao_anos ?? 10;
      const idade = problema
        ? vida + s.aleatorio() * 3
        : s.aleatorio() * vida * 0.9;
      const compra = somarDias(hoje, -Math.round(idade * 365));
      const base = custoBase[nomeCat] ?? 3000;
      const baixado = !problema && i === quantos - 1 && quantos > 8;
      const situacao = baixado
        ? "baixado"
        : problema && i === 0
          ? "em_manutencao"
          : s.chance(0.03)
            ? "parado"
            : "em_uso";
      ativos.push({
        id,
        nome: nomeDo(i),
        categoria: nomeCat,
        bloco: loja?.bloco ?? bloco,
        lojaId: loja?.id ?? null,
        problema,
        baixado,
      });
      d.ativos.push({
        id,
        nome: nomeDo(i),
        categoria_id: cat.id,
        fabricante: s.escolher(FABRICANTES),
        modelo: `${nomeCat.slice(0, 3).toUpperCase()}-${s.int(100, 999)}`,
        numero_serie: `SN${s.int(100000, 999999)}`,
        bloco: loja?.bloco ?? bloco,
        loja_id: loja?.id ?? null,
        area: loja
          ? null
          : s.escolher([
              "Área comum",
              "Casa de máquinas",
              "Estacionamento",
              "Corredor",
            ]),
        ponto: loja ? `Loja ${loja.luc}` : null,
        compra_data: compra,
        compra_valor: reais(base * (0.85 + s.aleatorio() * 0.3)),
        garantia_fim: somarDias(compra, 365 * s.int(1, 3)),
        fornecedor_id: s.chance(0.3) ? s.escolher(empresas).id : null,
        // Uns sem valor de reposição ou vida útil: "cadastro incompleto".
        valor_reposicao: s.chance(0.08)
          ? null
          : reais(base * (1.1 + s.aleatorio() * 0.3)),
        vida_util_anos: s.chance(0.05) ? null : vida,
        situacao,
        baixa_data: baixado ? somarDias(hoje, -s.int(10, 120)) : null,
        baixa_motivo: baixado ? "Substituído por um novo" : null,
        setor_id: operacoes,
        responsavel_id: s.chance(0.5) ? (pessoa()?.id ?? null) : null,
        exemplo: true,
      });
    }
  }
  const ativosDe = (categoriaOs: string) => {
    const tipos = ATIVOS_DA_CATEGORIA[categoriaOs] ?? [];
    return ativos.filter((a) => tipos.includes(a.categoria) && !a.baixado);
  };

  // --- Chamados: a base de todos os tipos -------------------------------
  const ciclo = (
    criado: Date,
    status: StatusChamado,
    fimTrabalho: Date | null,
  ): CicloGerado => {
    const limite = somarMin(agora, -2);
    const resposta =
      status === "aberto"
        ? null
        : menor(somarMin(criado, s.int(15, 360)), limite);
    let concluido: Date | null = null;
    let fechado: Date | null = null;
    let automatico = false;
    if (status === "concluido" || status === "fechado") {
      const base = resposta ?? criado;
      concluido = fimTrabalho
        ? somarMin(fimTrabalho, s.int(5, 90))
        : somarMin(base, s.int(60, 4 * 1440));
      if (status === "concluido")
        // Esperando confirmação: concluído há pouco.
        concluido = maior(
          fimTrabalho ? somarMin(fimTrabalho, 5) : base,
          somarMin(agora, -s.int(60, 40 * 60)),
        );
      concluido = menor(concluido, limite);
    }
    if (status === "fechado" && concluido) {
      automatico = s.chance(0.3);
      const aceite = prazoDoAceite(concluido, e.aceiteDias, e.cal);
      fechado =
        automatico && aceite < limite
          ? aceite
          : menor(somarMin(concluido, s.int(30, 3 * 1440)), limite);
      if (fechado.getTime() !== aceite.getTime()) automatico = false;
    }
    const aguardandoDesde =
      status === "aguardando" && resposta
        ? menor(somarMin(resposta, s.int(60, 2 * 1440)), limite)
        : null;
    return {
      status,
      resposta,
      concluido,
      fechado,
      fechadoAutomatico: automatico,
      aguardandoDesde,
      aguardandoTipo: aguardandoDesde
        ? s.pesos<MotivoAguardando>({
            material: 4,
            terceirizado: 3,
            lojista: 2,
            aprovacao: 2,
            outro: 1,
          })
        : null,
      cancelado:
        status === "cancelado"
          ? menor(somarMin(criado, s.int(60, 5 * 1440)), limite)
          : null,
    };
  };

  const sortearStatus = (criado: Date): StatusChamado => {
    const dias = (agora.getTime() - criado.getTime()) / 86_400_000;
    if (dias > 45)
      return s.pesos<StatusChamado>({
        fechado: 84,
        cancelado: 7,
        em_andamento: 4,
        aguardando: 3,
        aberto: 2,
        concluido: 0,
      });
    if (dias > 10)
      return s.pesos<StatusChamado>({
        fechado: 55,
        cancelado: 5,
        concluido: 8,
        em_andamento: 14,
        aguardando: 10,
        aberto: 8,
      });
    return s.pesos<StatusChamado>({
      aberto: 30,
      em_andamento: 28,
      aguardando: 10,
      concluido: 12,
      fechado: 17,
      cancelado: 3,
    });
  };

  /** Abertura nos últimos `ate` dias, em dia útil e horário comercial. */
  const quando = (ateDias = 180, desdeDias = 0): Date => {
    const dias =
      desdeDias + Math.floor(s.aleatorio() ** 1.5 * (ateDias - desdeDias));
    let dia = somarDias(hoje, -dias);
    while (!ehDiaUtil(dia, e.cal)) dia = somarDias(dia, -1);
    const criado = deBrasilia(dia, horaDosMinutos(s.int(8 * 60, 17 * 60 + 30)));
    return criado > somarMin(agora, -30)
      ? somarMin(agora, -s.int(30, 240))
      : criado;
  };

  interface NovoChamado {
    /** Id já sorteado (OS: as sessões apontam para ele antes). */
    id?: string;
    tipo: TipoChamado;
    setorId: string;
    categoria: CategoriaExemplo | null;
    titulo: string;
    descricao?: string | null;
    criado: Date;
    status?: StatusChamado;
    prioridade?: Prioridade;
    origem?: Origem;
    abertoPor?: string | null;
    responsavel?: string | null;
    solicitante?: { nome: string; telefone: string } | null;
    loja?: Loja | null;
    pessoal?: boolean;
    prazo?: Date | null;
    fimTrabalho?: Date | null;
    campos?: Record<string, Json>;
    extra?: Partial<Ins<"chamados">>;
  }

  const autorDe = (id: string | null | undefined) =>
    id ? { autor_id: id } : { autor_nome: "Sistema" };

  const novoChamado = (n: NovoChamado): { id: string; c: CicloGerado } => {
    const id = n.id ?? s.uuid();
    const status = n.status ?? sortearStatus(n.criado);
    const c = ciclo(n.criado, status, n.fimTrabalho ?? null);
    const prazo =
      n.prazo !== undefined
        ? n.prazo
        : n.categoria?.prazo_valor
          ? calcularPrazo(
              {
                abertura: n.criado,
                valor: n.categoria.prazo_valor,
                unidade: n.categoria.prazo_unidade,
              },
              e.cal,
            )
          : null;
    const resp = n.responsavel === undefined ? responsavel() : n.responsavel;
    const abertoPor =
      n.abertoPor === undefined ? (pessoa()?.id ?? null) : n.abertoPor;
    const precisaConfirmacao =
      n.tipo === "aviso" || n.pessoal
        ? false
        : (n.categoria?.precisa_confirmacao ?? true);
    // Sem confirmação (Aviso, tarefa pessoal) fecha ao concluir: nunca fica
    // "Concluído" parado nem fecha pelo aceite.
    const final =
      c.status === "concluido" && !precisaConfirmacao ? "fechado" : c.status;
    if (!precisaConfirmacao) c.fechadoAutomatico = false;
    const fechado =
      final === "fechado"
        ? precisaConfirmacao
          ? (c.fechado ?? c.concluido)
          : c.concluido
        : null;
    const portal = n.origem === "portal";
    const motivo = c.aguardandoTipo
      ? s.escolher(MOTIVOS_AGUARDANDO[c.aguardandoTipo])
      : null;

    d.chamados.push({
      id,
      tipo: n.tipo,
      titulo: n.titulo,
      descricao: n.descricao ?? null,
      setor_id: n.setorId,
      categoria_id: n.categoria?.id ?? null,
      status: final,
      prioridade:
        n.prioridade ??
        s.pesos<Prioridade>({ baixa: 2, media: 6, alta: 2, urgente: 1 }),
      origem: n.origem ?? "sistema",
      pessoal: n.pessoal ?? false,
      precisa_confirmacao: precisaConfirmacao,
      aberto_por: abertoPor,
      solicitante_nome: n.solicitante?.nome ?? null,
      solicitante_telefone: n.solicitante?.telefone ?? null,
      responsavel_id: resp,
      prazo: prazo ? iso(prazo) : null,
      loja_id: n.loja?.id ?? null,
      campos: (n.campos ?? {}) as Json,
      primeira_resposta_em: c.resposta ? iso(c.resposta) : null,
      iniciado_em: c.resposta ? iso(c.resposta) : null,
      aguardando_desde: c.aguardandoDesde ? iso(c.aguardandoDesde) : null,
      aguardando_tipo: c.aguardandoTipo,
      aguardando_motivo: motivo,
      aguardando_min:
        final === "fechado" && s.chance(0.2) ? s.int(60, 4000) : 0,
      concluido_em: c.concluido ? iso(c.concluido) : null,
      concluido_por: c.concluido ? (resp ?? abertoPor) : null,
      fechado_em: fechado ? iso(fechado) : null,
      fechado_por: fechado && !c.fechadoAutomatico ? (abertoPor ?? resp) : null,
      fechado_automatico: final === "fechado" && c.fechadoAutomatico,
      cancelado_em: c.cancelado ? iso(c.cancelado) : null,
      cancelado_por: c.cancelado ? abertoPor : null,
      motivo_cancelamento: c.cancelado
        ? s.escolher(MOTIVOS_CANCELAMENTO)
        : null,
      reaberto_vezes: final === "fechado" && s.chance(0.03) ? 1 : 0,
      exemplo: true,
      criado_em: iso(n.criado),
      atualizado_em: iso(
        fechado ??
          c.cancelado ??
          c.aguardandoDesde ??
          c.concluido ??
          c.resposta ??
          n.criado,
      ),
      ...n.extra,
    });

    // Linha do tempo coerente com o ciclo.
    const autor = portal
      ? { autor_nome: `Portal – ${n.loja?.nome ?? "loja"}` }
      : autorDe(abertoPor);
    const evento = (
      em: Date,
      tipo: Ins<"eventos">["tipo"],
      texto: string,
      quem: { autor_id?: string; autor_nome?: string },
      dados: Record<string, Json> = {},
    ) =>
      d.eventos.push({
        chamado_id: id,
        em: iso(em),
        tipo,
        texto,
        dados,
        visivel_lojista: portal,
        ...quem,
      });
    evento(
      n.criado,
      "criado",
      `Aberto${portal ? " pelo portal" : ""}.`,
      autor,
      {
        origem: n.origem ?? "sistema",
      },
    );
    const deResp = autorDe(resp);
    if (c.resposta)
      evento(c.resposta, "status", "Em andamento.", deResp, {
        de: "aberto",
        para: "em_andamento",
      });
    if (c.resposta && s.chance(0.3))
      evento(
        menor(somarMin(c.resposta, s.int(10, 600)), somarMin(agora, -1)),
        "comentario",
        s.escolher(COMENTARIOS),
        deResp,
      );
    if (c.aguardandoDesde)
      evento(c.aguardandoDesde, "status", `Aguardando: ${motivo}.`, deResp, {
        de: "em_andamento",
        para: "aguardando",
      });
    if (c.concluido)
      evento(c.concluido, "status", "Concluído.", deResp, {
        de: "em_andamento",
        para: "concluido",
      });
    if (fechado)
      evento(
        fechado,
        c.fechadoAutomatico ? "sistema" : "status",
        c.fechadoAutomatico
          ? "Fechado automaticamente: o prazo de aceite venceu."
          : "Confirmado e fechado.",
        c.fechadoAutomatico ? { autor_nome: "Sistema" } : autorDe(abertoPor),
        { de: "concluido", para: "fechado" },
      );
    if (c.cancelado)
      evento(c.cancelado, "status", "Cancelado.", autorDe(abertoPor), {
        de: "aberto",
        para: "cancelado",
      });
    return { id, c: { ...c, status: final } };
  };

  // --- Ordens de Serviço internas ----------------------------------------
  const proximoDiaUtil = (dia: string, n = 1) => somarDiasUteis(dia, n, e.cal);
  const slots = [450, 480, 510, 540, 600, 780, 840, 900];

  /** Sessões a partir do dia seguinte à primeira resposta (só no passado). */
  const sessoesDaOS = (chamadoId: string, desde: Date, quantas: number) => {
    const sessoes: Sessao[] = [];
    let dia = proximoDiaUtil(paraBrasilia(desde).data);
    let fim: Date | null = null;
    for (let k = 0; k < quantas && dia <= hoje; k++) {
      const ini = s.escolher(slots);
      const dur = Math.round(s.int(30, 300) / 5) * 5;
      const fimMin = Math.min(ini + dur, 18 * 60 + 30);
      const fimEm = deBrasilia(dia, horaDosMinutos(fimMin));
      if (fimEm > somarMin(agora, -5)) break;
      const quantos = Number(s.pesos({ "1": 55, "2": 35, "3": 10 }));
      const escolhidos = s.embaralhar(tecnicosEm(dia)).slice(0, quantos);
      const almoco =
        ini < minutosDoDia(e.almoco.inicio) &&
        fimMin > minutosDoDia(e.almoco.fim);
      const sessao: Sessao = {
        data: dia,
        inicio: horaDosMinutos(ini),
        fim: horaDosMinutos(fimMin),
        almoco_inicio: almoco ? e.almoco.inicio : null,
        almoco_fim: almoco ? e.almoco.fim : null,
        tecnicos: escolhidos,
      };
      const sessaoId = s.uuid();
      sessoes.push({ ...sessao, id: sessaoId });
      d.sessoes.push({
        id: sessaoId,
        chamado_id: chamadoId,
        data: sessao.data,
        inicio: sessao.inicio,
        fim: sessao.fim,
        almoco_inicio: sessao.almoco_inicio,
        almoco_fim: sessao.almoco_fim,
        observacao: k > 0 ? "Continuação" : null,
        criado_em: iso(fimEm),
      });
      for (const t of escolhidos)
        d.sessao_tecnicos.push({ sessao_id: sessaoId, tecnico_id: t });
      fim = fimEm;
      dia = proximoDiaUtil(dia, s.int(1, 2));
    }
    return { sessoes, fim };
  };

  const materiaisDaOS = (chamadoId: string, caros: boolean): Material[] => {
    const lista: Material[] = [];
    const quantos = caros ? s.int(1, 2) : s.chance(0.55) ? s.int(1, 3) : 0;
    for (let i = 0; i < quantos; i++) {
      const [descricao, unidade, preco] = s.escolher(
        caros && i === 0 ? PECAS_CARAS : MATERIAIS,
      );
      const quantidade =
        unidade === "m"
          ? s.int(2, 30)
          : unidade === "un"
            ? s.int(1, 6)
            : s.int(1, 4);
      const id = s.uuid();
      d.materiais.push({
        id,
        chamado_id: chamadoId,
        descricao,
        quantidade,
        unidade,
      });
      // Um ou outro sem preço: a OS fica com o custo incompleto.
      const valor = s.chance(0.04)
        ? null
        : reais(preco * (0.85 + s.aleatorio() * 0.3));
      if (valor !== null)
        d.material_valores.push({ material_id: id, valor_unitario: valor });
      lista.push({ descricao, quantidade, valor_unitario: valor });
    }
    return lista;
  };

  const sortearRateio = (terceirizada: boolean) => {
    if (!s.chance(0.35)) return null;
    const regra = s.pesos<RegraRateio>({
      hora_trabalhada: 45,
      manual: 20,
      percentual: 25,
      terceirizado: terceirizada ? 30 : 0,
    });
    const valor =
      regra === "manual"
        ? reais(s.int(50, 500))
        : regra === "percentual"
          ? s.escolher([25, 30, 40, 50, 60])
          : null;
    return { regra, valor };
  };

  const categoriasOS = [
    "Elétrica",
    "Hidráulica",
    "Estrutura",
    "Telhado",
    "Calha",
    "Infiltração",
  ].flatMap((nome) => {
    const c = categoria(nome);
    return c ? [c] : [];
  });

  const novaOS = (p: {
    categoria: CategoriaExemplo | null;
    titulo: string;
    criado: Date;
    ativo?: AtivoGerado | null;
    loja?: Loja | null;
    caros?: boolean;
    status?: StatusChamado;
    extra?: Partial<Ins<"chamados">>;
    origem?: Origem;
  }) => {
    const id = s.uuid();
    // Sessões primeiro: o ciclo termina depois da última.
    let status = p.status ?? sortearStatus(p.criado);
    const resposta = somarMin(p.criado, s.int(15, 300));
    const precisa = !["aberto", "cancelado"].includes(status);
    const quantas = s.pesos({ "1": 70, "2": 22, "3": 8 });
    const { sessoes, fim } = precisa
      ? sessoesDaOS(id, resposta, Number(quantas))
      : { sessoes: [], fim: null };
    if (["concluido", "fechado"].includes(status) && !fim)
      status = "em_andamento";
    const local = p.loja
      ? `Loja ${p.loja.luc}`
      : (p.ativo?.nome ??
        s.escolher([
          "Corredor",
          "Banheiro público",
          "Estacionamento",
          "Praça de alimentação",
        ]));
    const r = sortearRateio(false);
    const materiais = materiaisDaOS(id, p.caros ?? false);
    const ativo = p.ativo ?? null;
    const feita = status === "concluido" || status === "fechado";
    const corretiva = !p.extra?.plano_id;
    novoChamado({
      id,
      tipo: "os",
      setorId: operacoes,
      categoria: p.categoria,
      titulo: p.titulo,
      descricao: `${p.titulo}. ${local}.`,
      criado: p.criado,
      status,
      origem: p.origem ?? (p.extra?.plano_id ? "preventiva" : "sistema"),
      loja: p.loja ?? null,
      fimTrabalho: fim,
      extra: {
        execucao: "interna",
        local,
        bloco: p.loja?.bloco ?? ativo?.bloco ?? s.escolher(BLOCOS),
        ativo_id: ativo?.id ?? null,
        ativo_parado: !!ativo && status === "aguardando" && s.chance(0.4),
        rateio: !!r,
        solucao: feita ? "Serviço executado e testado." : null,
        causa_falha:
          feita && corretiva && e.causasFalha.length
            ? s.escolher(e.causasFalha)
            : null,
        ...p.extra,
      },
    });
    d.os_custos.push({
      chamado_id: id,
      rateio_regra: r?.regra ?? null,
      rateio_valor: r?.valor ?? null,
    });
    d.calculos.push({
      chamadoId: id,
      entrada: {
        sessoes,
        vigencias,
        materiais,
        terceirizado: null,
        rateio: r
          ? r.regra === "manual"
            ? { regra: "manual", valor: r.valor }
            : r.regra === "percentual"
              ? { regra: "percentual", percentual: r.valor }
              : { regra: r.regra }
          : null,
      },
    });
    return id;
  };

  // Corretivas do dia a dia.
  for (let i = 0; i < 450; i++) {
    const cat = s.escolher(categoriasOS);
    const raiz =
      e.categorias.find((c) => c.id === cat.pai_id)?.nome ?? cat.nome;
    const candidatos = ativosDe(raiz);
    const ativo =
      candidatos.length && s.chance(0.55) ? s.escolher(candidatos) : null;
    const loja = ativo?.lojaId
      ? (lojas.find((l) => l.id === ativo.lojaId) ?? null)
      : s.chance(0.45)
        ? s.escolher(vigentes)
        : null;
    novaOS({
      categoria: cat,
      titulo: s.escolher(
        TITULOS_OS[cat.nome] ?? TITULOS_OS.Elétrica ?? ["Reparo"],
      ),
      criado: quando(),
      ativo,
      loja,
    });
  }

  // Ativos-problema: corretivas seguidas e peças caras (sinal de troca).
  const eletrica = categoria("Elétrica");
  const hidraulica = categoria("Hidráulica");
  const telhado = categoria("Telhado");
  for (const a of ativos.filter((x) => x.problema)) {
    const cat =
      a.categoria === "Bomba"
        ? hidraulica
        : a.categoria === "Exaustor"
          ? telhado
          : eletrica;
    for (let k = 0; k < s.int(5, 7); k++)
      novaOS({
        categoria: cat,
        titulo: `${a.nome}: ${s.escolher(["parou de novo", "ruído forte", "não liga", "vazando"])}`,
        criado: quando(170, 5),
        ativo: a,
        loja: a.lojaId ? (lojas.find((l) => l.id === a.lojaId) ?? null) : null,
        caros: k % 2 === 0,
        status: k === 0 ? undefined : "fechado",
      });
  }

  // --- Planos preventivos e as OS que eles já geraram ----------------------
  const preventiva = categoria("Preventiva");
  const vivos = (cat: string, n: number) =>
    ativos.filter((a) => !a.baixado && a.categoria === cat).slice(0, n);
  const comPlano = [
    ...vivos("Ar-condicionado", 12),
    ...vivos("Bomba", 8),
    ...vivos("Gerador", 2),
    ...vivos("Elevador", 6),
  ];
  for (const a of comPlano) {
    const meses =
      a.categoria === "Ar-condicionado"
        ? s.escolher([1, 3])
        : s.escolher([1, 6]);
    const proxima = somarDias(hoje, s.int(-12, 50));
    const planoId = s.uuid();
    d.planos_preventivos.push({
      id: planoId,
      ativo_id: a.id,
      titulo: `Preventiva – ${a.nome}`,
      descricao: "Limpeza, inspeção e teste de funcionamento.",
      frequencia_meses: meses,
      proxima_data: proxima,
      setor_id: operacoes,
      categoria_id: preventiva?.id ?? null,
      responsavel_id: s.chance(0.5) ? (pessoa()?.id ?? null) : null,
      checklist: preventiva?.checklist ?? [],
      exemplo: true,
    });
    // As ocorrências passadas (uma por data do plano).
    for (let k = 1; k <= Math.min(3, Math.floor(6 / meses)); k++) {
      const data = somarDias(proxima, -30 * meses * k);
      if (data >= hoje || data < somarDias(hoje, -175)) continue;
      const criado = deBrasilia(data, "08:00");
      const feito = s.chance(0.85);
      novaOS({
        categoria: preventiva,
        titulo: `Preventiva – ${a.nome}`,
        criado,
        ativo: a,
        loja: a.lojaId ? (lojas.find((l) => l.id === a.lojaId) ?? null) : null,
        status: feito ? "fechado" : undefined,
        origem: "preventiva",
        extra: {
          plano_id: planoId,
          plano_data: data,
          checklist: (Array.isArray(preventiva?.checklist)
            ? (preventiva.checklist as Record<string, Json>[])
            : []
          ).map((item) => ({ ...item, feito })),
        },
      });
    }
  }

  // --- OS terceirizadas ---------------------------------------------------
  const periodos: Periodo[] = ["manha", "tarde", "noite"];
  for (let i = 0; i < 110; i++) {
    const id = s.uuid();
    const cat = s.escolher(categoriasOS);
    const emp = s.escolher(empresas);
    const criado = quando();
    const status = sortearStatus(criado);
    const loja = s.chance(0.5) ? s.escolher(vigentes) : null;
    const resposta = somarMin(criado, s.int(30, 300));
    const visita = menor(
      deBrasilia(
        proximoDiaUtil(paraBrasilia(resposta).data, s.int(1, 4)),
        "09:00",
      ),
      somarMin(agora, -60),
    );
    const terminou = ["concluido", "fechado"].includes(status) ? visita : null;
    const valor = reais(s.int(18, 480) * 10);
    const r = sortearRateio(true);
    const local = loja ? `Loja ${loja.luc}` : "Área comum";
    novoChamado({
      id,
      tipo: "os",
      setorId: operacoes,
      categoria: cat,
      titulo: s.escolher(TITULOS_OS[cat.nome] ?? ["Reparo"]),
      criado,
      status,
      loja,
      fimTrabalho: terminou ? somarMin(terminou, 150) : null,
      extra: {
        execucao: "terceirizada",
        empresa_id: emp.id,
        local,
        bloco: loja?.bloco ?? s.escolher(BLOCOS),
        visita_data: status === "aberto" ? null : paraBrasilia(visita).data,
        visita_periodo: status === "aberto" ? null : s.escolher(periodos),
        prazo_terceirizado: iso(somarMin(resposta, 7 * 1440)),
        solucao: terminou
          ? "Serviço feito pelo terceirizado e conferido."
          : null,
        rateio: !!r,
      },
    });
    const profs = emp.profissionais.slice(0, s.int(1, 2));
    for (const p of profs)
      d.chamado_profissionais.push({ chamado_id: id, profissional_id: p });
    d.os_custos.push({
      chamado_id: id,
      valor_terceirizado: terminou ? valor : null,
      orcamento_numero: terminou ? `ORC-${s.int(1000, 9999)}` : null,
      rateio_regra: r?.regra ?? null,
      rateio_valor: r?.valor ?? null,
    });
    d.calculos.push({
      chamadoId: id,
      entrada: {
        sessoes: [],
        vigencias,
        terceirizado: terminou ? valor : null,
        rateio: r
          ? r.regra === "manual"
            ? { regra: "manual", valor: r.valor }
            : r.regra === "percentual"
              ? { regra: "percentual", percentual: r.valor }
              : { regra: r.regra }
          : null,
      },
    });
    if (status === "cancelado") continue;
    const aceito = status !== "aberto" || s.chance(0.5);
    d.terceirizado_links.push({
      chamado_id: id,
      token: s.token(),
      empresa_id: emp.id,
      criado_em: iso(resposta),
      aceito_em: aceito ? iso(somarMin(resposta, s.int(20, 240))) : null,
      chegada_em: terminou ? iso(terminou) : null,
      saida_em: terminou ? iso(somarMin(terminou, 150)) : null,
      solucao: terminou ? "Troca da peça e teste com o lojista." : null,
      valor_informado: terminou ? valor : null,
      terminado_em: terminou ? iso(somarMin(terminou, 150)) : null,
      ultimo_acesso_em: aceito ? iso(somarMin(resposta, s.int(20, 300))) : null,
    });
  }

  // --- Solicitações -------------------------------------------------------
  const avaliar = (id: string) => {
    const ch = d.chamados.find((c) => c.id === id);
    if (!ch?.fechado_em || !s.chance(0.65)) return;
    ch.avaliacao = Number(
      s.pesos({ "5": 50, "4": 30, "3": 12, "2": 5, "1": 3 }),
    );
    ch.avaliacao_comentario = s.chance(0.4) ? s.escolher(AVALIACOES) : null;
    ch.avaliado_em = iso(
      menor(somarMin(new Date(ch.fechado_em), s.int(10, 1440)), agora),
    );
  };
  const solicitacoes: [string, number, string[], boolean][] = [
    [
      "Manutenção",
      45,
      [
        "Lâmpada queimada na vitrine",
        "Porta da loja emperrando",
        "Ar-condicionado com cheiro",
        "Vazamento no teto da loja",
        "Tomada da vitrine sem energia",
      ],
      true,
    ],
    [
      "Enviar projeto",
      12,
      ["Projeto de layout", "Projeto elétrico da reforma"],
      true,
    ],
    [
      "Sinalização",
      15,
      ["Placa de fachada nova", "Sinalização do corredor"],
      false,
    ],
    [
      "Ambiência",
      8,
      ["Decoração de fim de ano", "Vaso de planta no corredor"],
      false,
    ],
    ["Credenciamento", 15, ["Credenciar veículo do lojista"], false],
    ["Descredenciamento", 6, ["Descredenciar veículo"], false],
    ["Cliente novo", 10, ["Cadastro financeiro do cliente novo"], false],
    [
      "Protocolo entre setores",
      15,
      [
        "Documento para assinatura",
        "Entrega de chaves",
        "Contrato para arquivo",
      ],
      false,
    ],
  ];
  for (const [nomeCat, quantos, titulos, portal] of solicitacoes) {
    const cat = categoria(nomeCat);
    if (!cat) continue;
    for (let i = 0; i < quantos; i++) {
      const loja = s.escolher(vigentes);
      const viaPortal = portal && s.chance(0.7);
      const campos: Record<string, Json> =
        nomeCat === "Credenciamento"
          ? {
              placa: `${String.fromCharCode(65 + s.int(0, 25))}${String.fromCharCode(65 + s.int(0, 25))}${String.fromCharCode(65 + s.int(0, 25))}${s.int(1, 9)}${String.fromCharCode(65 + s.int(0, 9))}${pad(s.int(0, 99), 2)}`,
              vagas: s.int(1, 3),
            }
          : nomeCat === "Enviar projeto"
            ? { tipo_projeto: s.escolher(["Layout", "Elétrico", "Hidráulico"]) }
            : {};
      const { id } = novoChamado({
        tipo: cat.tipo_padrao,
        setorId: cat.setor_id,
        categoria: cat,
        titulo: `${s.escolher(titulos)} – ${loja.nome}`,
        criado: quando(),
        origem: viaPortal ? "portal" : "sistema",
        abertoPor: viaPortal ? null : undefined,
        solicitante: viaPortal
          ? {
              nome: loja.locatario ?? nomePessoa(),
              telefone: loja.telefone ?? telefone(),
            }
          : null,
        loja,
        campos,
      });
      if (viaPortal) avaliar(id);
    }
  }

  // Acesso ao telhado com horário na agenda (no máximo 2 por dia).
  const telhadoCat = categoria("Acesso ao telhado");
  if (telhadoCat && e.agendaTelhadoId) {
    const porDia = new Map<string, Set<number>>();
    for (let i = 0; i < 35; i++) {
      let dia = somarDias(hoje, s.int(-60, 20));
      while (!ehDiaUtil(dia, e.cal)) dia = somarDias(dia, 1);
      const ocupados = porDia.get(dia) ?? new Set<number>();
      if (ocupados.size >= 2) continue;
      const hora = s.escolher([7, 8, 9, 10].filter((h) => !ocupados.has(h)));
      ocupados.add(hora);
      porDia.set(dia, ocupados);
      const inicio = deBrasilia(dia, `${pad(hora, 2)}:00`);
      const passado = inicio < agora;
      const loja = s.escolher(vigentes);
      const criado = maior(
        somarMin(inicio, -s.int(2, 10) * 1440),
        deBrasilia(somarDias(hoje, -175), "09:00"),
      );
      const { id } = novoChamado({
        tipo: "solicitacao",
        setorId: telhadoCat.setor_id,
        categoria: telhadoCat,
        titulo: `Acesso ao telhado – ${loja.nome}`,
        criado: menor(criado, somarMin(agora, -60)),
        status: passado ? "fechado" : "em_andamento",
        origem: "portal",
        abertoPor: null,
        solicitante: {
          nome: loja.locatario ?? nomePessoa(),
          telefone: loja.telefone ?? telefone(),
        },
        loja,
      });
      d.agendamentos.push({
        agenda_id: e.agendaTelhadoId,
        chamado_id: id,
        loja_id: loja.id,
        inicio: iso(inicio),
        fim: iso(somarMin(inicio, 60)),
        status: passado
          ? s.chance(0.88)
            ? "realizado"
            : "cancelado"
          : i % 9 === 0
            ? "remarcar"
            : "marcado",
        observacao: s.chance(0.3) ? "Instalação de antena" : null,
        exemplo: true,
      });
    }
  }

  // --- Tarefas ------------------------------------------------------------
  const entrevista = categoria("Entrevista de cliente");
  const portalCat = categoria("Portal do lojista");
  for (let i = 0; i < 35 && entrevista; i++) {
    const loja = s.escolher(recentes.concat(vigentes.slice(0, 40)));
    novoChamado({
      tipo: "tarefa",
      setorId: entrevista.setor_id,
      categoria: entrevista,
      titulo: `Entrevista com o cliente – ${loja.nome}`,
      criado: quando(),
      loja,
    });
  }
  for (let i = 0; i < 30 && portalCat; i++) {
    const loja = s.escolher(vigentes);
    novoChamado({
      tipo: "tarefa",
      setorId: portalCat.setor_id,
      categoria: portalCat,
      titulo: `Enviar o link do portal – ${loja.nome}`,
      criado: quando(),
      loja,
    });
  }
  const pessoais = [
    "Ligar para o fornecedor de lâmpadas",
    "Conferir a nota do material",
    "Separar as chaves da loja",
    "Revisar a escala do fim de semana",
    "Responder o e-mail do condomínio",
  ];
  for (let i = 0; i < 60; i++) {
    const quem = pessoa()?.id ?? null;
    novoChamado({
      tipo: "tarefa",
      setorId: s.escolher(e.setores).id,
      categoria: null,
      titulo: s.escolher(pessoais),
      criado: quando(60),
      pessoal: true,
      abertoPor: quem,
      responsavel: quem,
      prazo: null,
    });
  }

  // Lembretes recorrentes: séries com as ocorrências passadas e a próxima.
  // Toda ocorrência guarda o Repetir; parar a série tira de todas.
  const lembretes: [string, Recorrencia, string][] = [
    [
      "Conferir os extintores",
      { frequencia: "mensal", dia_mes: 10 },
      "Operações",
    ],
    [
      "Leitura dos medidores",
      { frequencia: "semanal", dias_semana: [1] },
      "Operações",
    ],
    [
      "Relatório de ocupação",
      { frequencia: "mensal", dia_mes: 5 },
      "Comercial",
    ],
    [
      "Limpeza das calhas",
      { frequencia: "cada_n_meses", intervalo: 3, dia_mes: 15 },
      "Operações",
    ],
    [
      "Conferir as câmeras",
      { frequencia: "semanal", dias_semana: [3] },
      "Operações",
    ],
  ];
  for (const [titulo, r, nomeSetor] of lembretes) {
    const passo = r.frequencia === "semanal" ? 7 : 31 * (r.intervalo ?? 1);
    const todas = datasEntre(
      r,
      somarDias(hoje, -passo * 4),
      somarDias(hoje, passo + 7),
    );
    const proxima = todas.findIndex((x) => x >= hoje);
    const datas = todas.slice(Math.max(0, proxima - 3), proxima + 1);
    const serieId = s.uuid();
    const quem = pessoa()?.id ?? null;
    const recorrencia: Json = {
      frequencia: r.frequencia,
      intervalo: r.intervalo,
      dias_semana: r.dias_semana,
      dia_mes: r.dia_mes,
    };
    datas.forEach((data, k) => {
      const criado = maior(
        deBrasilia(somarDias(data, -3), "07:00"),
        deBrasilia(somarDias(hoje, -170), "07:00"),
      );
      novoChamado({
        id: k === 0 ? serieId : undefined,
        tipo: "tarefa",
        setorId: setor(nomeSetor),
        categoria: null,
        titulo,
        criado: menor(criado, somarMin(agora, -60)),
        status: data < hoje ? "fechado" : "aberto",
        origem: k === 0 ? "sistema" : "recorrencia",
        abertoPor: quem,
        responsavel: quem,
        prazo: deBrasilia(data, e.cal.expedienteFim),
        extra: { serie_id: serieId, serie_data: data, recorrencia },
      });
    });
  }

  // --- Avisos de entrada e saída (modelos) --------------------------------
  const entradaModelo = e.modelos.find((m) => m.gatilho === "entrada");
  const saidaModelo = e.modelos.find((m) => m.gatilho === "saida");
  const avisoCat = categoria("Entrada de cliente");
  const saidaCat = categoria("Saída de cliente");
  const comercial = setor("Comercial");
  const aviso = (
    modelo: NonNullable<typeof entradaModelo>,
    loja: Loja,
    cat: CategoriaExemplo | null,
  ) => {
    const contrato = {
      id: loja.id,
      nome: loja.nome,
      luc: loja.luc,
      situacao:
        loja.situacao === "encerrado"
          ? ("encerrado" as const)
          : ("vigente" as const),
      inicio: loja.inicio ?? null,
      fim: loja.fim ?? null,
      tem_vaga: loja.tem_vaga ?? null,
      atualizado_em: iso(agora),
    };
    const base = modelo.gatilho === "saida" ? loja.fim : loja.inicio;
    if (!base) return;
    const criado = menor(deBrasilia(base, "09:00"), somarMin(agora, -90));
    const montado = montarAviso(
      modelo,
      modelo.itens,
      contrato,
      paraBrasilia(criado).data,
      e.cal,
    );
    const idade = (agora.getTime() - criado.getTime()) / 86_400_000;
    const destinos = montado.destinos.map((dest, ordem) => {
      const concluiu =
        dest.prazo < agora
          ? s.chance(0.85)
          : s.chance(Math.min(0.8, idade / 40));
      const em = concluiu
        ? menor(
            somarMin(
              criado,
              s.int(60, Math.max(120, Math.round(idade * 1440 * 0.8))),
            ),
            somarMin(agora, -5),
          )
        : null;
      const status: Ins<"destinatarios">["status"] = concluiu
        ? "concluido"
        : s.chance(0.3)
          ? "em_andamento"
          : "aberto";
      return { dest, ordem, status, em };
    });
    const todos = destinos.every((x) => x.status === "concluido");
    const algum = destinos.some((x) => x.status !== "aberto");
    const ultimo = destinos.reduce<Date | null>(
      (m, x) => (x.em && (!m || x.em > m) ? x.em : m),
      null,
    );
    const { id } = novoChamado({
      tipo: "aviso",
      setorId: cat?.setor_id ?? comercial,
      categoria: cat,
      titulo: montado.titulo,
      descricao: montado.descricao,
      criado,
      status: todos ? "fechado" : algum ? "em_andamento" : "aberto",
      origem: "modelo",
      abertoPor: null,
      responsavel: null,
      loja,
      prazo: montado.prazo,
      fimTrabalho: ultimo,
    });
    for (const x of destinos)
      d.destinatarios.push({
        chamado_id: id,
        setor_id: x.dest.setorId,
        titulo: x.dest.titulo,
        prazo: iso(x.dest.prazo),
        responsavel_id: x.dest.responsavelId,
        status: x.status,
        concluido_em: x.em ? iso(x.em) : null,
        concluido_por: x.em ? (pessoa()?.id ?? null) : null,
        ordem: x.ordem,
      });
    d.disparos.push({
      modelo_id: modelo.id,
      loja_id: loja.id,
      chamado_id: id,
      automatico: true,
      em: iso(criado),
    });
  };
  if (entradaModelo)
    for (const loja of [...novas.slice(0, 4), ...recentes])
      aviso(entradaModelo, loja, avisoCat);
  if (saidaModelo)
    for (const loja of encerradas.slice(1, 5))
      aviso(saidaModelo, loja, saidaCat);

  // --- Vistorias ----------------------------------------------------------
  const tipos: TipoVistoria[] = [
    ...Array<TipoVistoria>(12).fill("entrada"),
    ...Array<TipoVistoria>(6).fill("saida"),
    ...Array<TipoVistoria>(5).fill("preventiva"),
    ...Array<TipoVistoria>(2).fill("extraordinaria"),
  ];
  const entradasPorLoja = new Map<string, string>();
  tipos.forEach((tipo, i) => {
    const loja =
      tipo === "entrada"
        ? (recentes[i] ?? novas[i - 10] ?? s.escolher(vigentes))
        : tipo === "saida"
          ? (encerradas[i - 12] ?? s.escolher(encerradas))
          : s.escolher(vigentes);
    const dataBase =
      tipo === "entrada"
        ? (loja.inicio ?? hoje)
        : tipo === "saida"
          ? (loja.fim ?? hoje)
          : somarDias(hoje, -s.int(5, 170));
    const limite = somarDias(hoje, -178);
    const data = dataBase > hoje ? hoje : dataBase < limite ? limite : dataBase;
    const status =
      i % 8 === 7 ? "andamento" : i === 20 ? "cancelado" : "finalizado";
    const vistoriador = pessoa();
    const textos = e.vistoria.textos[tipo] ?? {};
    const id = s.uuid();
    if (tipo === "entrada") entradasPorLoja.set(loja.id, id);
    d.vistorias.push({
      id,
      codigo: `ARP${pad(e.primeiroCodigoVistoria + i, 2)}`,
      tipo,
      status,
      rascunho: status === "andamento",
      data,
      hora: `${pad(s.int(8, 16), 2)}:${s.escolher(["00", "30"])}`,
      vistoriador_id: vistoriador?.id ?? null,
      vistoriador_nome: vistoriador?.nome ?? "Vistoriador de exemplo",
      locador: e.vistoria.locador,
      loja_id: loja.id,
      locatario: loja.locatario ?? loja.nome,
      bloco: loja.bloco ?? "A",
      unidade: `Loja ${loja.luc}`,
      campo_tipo:
        tipo === "entrada" || tipo === "saida"
          ? s.escolher(["sim", "nao"])
          : null,
      observacao: textos.observacao ?? "",
      termo: textos.termo ?? "",
      local_data: localEData(e.vistoria.local, data),
      entrada_id:
        tipo === "saida" ? (entradasPorLoja.get(loja.id) ?? null) : null,
      comparar_no_laudo: false,
      exemplo: true,
      criado_por: vistoriador?.id ?? null,
      criado_em: iso(deBrasilia(data, "08:00")),
    });
    e.ambientes.forEach((titulo, ordem) => {
      const ambienteId = s.uuid();
      const pendente = status === "andamento" && ordem > e.ambientes.length / 2;
      const problema = !pendente && s.chance(0.12);
      const naoSeAplica = !pendente && !problema && s.chance(0.08);
      const textosDoAmbiente =
        Object.entries(DESCRICOES_AMBIENTE).find(([k]) =>
          titulo.startsWith(k),
        )?.[1] ?? TEXTO_PADRAO_AMBIENTE;
      d.vistoria_ambientes.push({
        id: ambienteId,
        vistoria_id: id,
        ordem,
        titulo,
        resposta: pendente
          ? "pendente"
          : naoSeAplica
            ? "nao_se_aplica"
            : "respondido",
        descricao:
          pendente || naoSeAplica
            ? null
            : problema
              ? `${s.escolher(textosDoAmbiente)} Ponto de atenção registrado em foto.`
              : s.escolher(textosDoAmbiente),
        problema,
      });
      if (!pendente && !naoSeAplica && (problema || ordem < 2))
        d.fotos.push({
          vistoriaId: id,
          ambienteId,
          titulo,
          semente: s.int(1, 1_000_000),
        });
      // Problema da vistoria que virou OS.
      if (problema && status === "finalizado" && s.chance(0.5))
        novaOS({
          categoria: categoria("Estrutura"),
          titulo: `Reparo apontado na vistoria: ${titulo}`,
          criado: maior(
            deBrasilia(data, "15:00"),
            deBrasilia(somarDias(hoje, -178), "09:00"),
          ),
          loja,
          origem: "vistoria",
          extra: { vistoria_id: id, ambiente_id: ambienteId },
        });
    });
  });

  // Números crescem com a data de abertura (o banco numera na ordem).
  d.chamados.sort((a, b) =>
    String(a.criado_em).localeCompare(String(b.criado_em)),
  );
  return d;
}

/** Quantos de cada tipo (para a tela e o registro no histórico). */
export function contarExemplo(d: DadosExemplo): Record<string, number> {
  const os = d.chamados.filter((c) => c.tipo === "os").length;
  return {
    lojas: d.lojas.length,
    chamados: d.chamados.length,
    os,
    tecnicos: d.tecnicos.length,
    ativos: d.ativos.length,
    planos: d.planos_preventivos.length,
    vistorias: d.vistorias.length,
    fotos: d.fotos.length,
    agendamentos: d.agendamentos.length,
  };
}
