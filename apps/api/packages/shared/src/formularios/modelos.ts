import { type Campo, novoCampo, type TipoCampo } from "./campos";

// Modelos para começar um relatório (como os modelos do Google Forms, Tally
// e Jotform): perguntas prontas, todas editáveis depois. Cada chamada gera
// ids novos, então dois relatórios do mesmo modelo não compartilham ids.

export interface Modelo {
  titulo: string;
  descricao: string;
  mensagem_final: string;
  campos: Campo[];
}

type Pergunta = Partial<Omit<Campo, "condicao">> & {
  tipo: TipoCampo;
  titulo: string;
  /** "Mostrar só se" a pergunta de índice `indice` for um destes valores. */
  se?: { indice: number; valores: string[] };
};

function montar(perguntas: Pergunta[]): Campo[] {
  const campos = perguntas.map(({ se: _, ...p }) => ({
    ...novoCampo(p.tipo),
    ...p,
  }));
  perguntas.forEach((p, i) => {
    const ref = p.se ? campos[p.se.indice] : undefined;
    const alvo = campos[i];
    if (p.se && ref && alvo)
      alvo.condicao = { campo: ref.id, valores: p.se.valores };
  });
  return campos;
}

const OBRIGADO = "Recebemos a sua resposta. Obrigado!";

export const MODELOS = {
  branco: {
    rotulo: "Em branco",
    resumo: "Comece do zero, só com o nome.",
    criar: (): Modelo => ({
      titulo: "Relatório sem título",
      descricao: "",
      mensagem_final: OBRIGADO,
      campos: montar([
        { tipo: "texto", titulo: "Nome completo", obrigatorio: true },
      ]),
    }),
  },
  visita: {
    rotulo: "Visita técnica",
    resumo: "Local, o que foi encontrado, urgência e fotos.",
    criar: (): Modelo => ({
      titulo: "Relatório de visita técnica",
      descricao:
        "Preencha ao fim de cada visita. As fotos ajudam quem vai resolver.",
      mensagem_final: "Relatório recebido. Obrigado!",
      campos: montar([
        { tipo: "texto", titulo: "Responsável pela visita", obrigatorio: true },
        { tipo: "data", titulo: "Data da visita", obrigatorio: true },
        {
          tipo: "texto",
          titulo: "Local (bloco, sala ou área)",
          obrigatorio: true,
        },
        {
          tipo: "unica",
          titulo: "Motivo da visita",
          opcoes: [
            "Preventiva",
            "Corretiva",
            "Inspeção",
            "Atendimento a chamado",
          ],
          outro: true,
          obrigatorio: true,
        },
        {
          tipo: "paragrafo",
          titulo: "O que foi encontrado",
          obrigatorio: true,
        },
        {
          tipo: "sim_nao",
          titulo: "Precisa de providência?",
          obrigatorio: true,
        },
        {
          tipo: "unica",
          titulo: "Urgência",
          opcoes: ["Baixa", "Média", "Alta"],
          obrigatorio: true,
          se: { indice: 5, valores: ["sim"] },
        },
        {
          tipo: "paragrafo",
          titulo: "Providência sugerida",
          se: { indice: 5, valores: ["sim"] },
        },
        { tipo: "arquivo", titulo: "Fotos", maxArquivos: 5 },
      ]),
    }),
  },
  vistoria: {
    rotulo: "Checklist de vistoria",
    resumo: "Itens de sim ou não por área e nota geral.",
    criar: (): Modelo => ({
      titulo: "Checklist de vistoria",
      descricao: "Marque cada item conforme o que viu no local.",
      mensagem_final: "Vistoria registrada. Obrigado!",
      campos: montar([
        { tipo: "texto", titulo: "Vistoriador", obrigatorio: true },
        { tipo: "data", titulo: "Data", obrigatorio: true },
        { tipo: "texto", titulo: "Local vistoriado", obrigatorio: true },
        { tipo: "secao", titulo: "Estrutura" },
        {
          tipo: "sim_nao",
          titulo: "Paredes e teto sem infiltração?",
          obrigatorio: true,
        },
        {
          tipo: "sim_nao",
          titulo: "Portas e fechaduras funcionando?",
          obrigatorio: true,
        },
        {
          tipo: "sim_nao",
          titulo: "Iluminação funcionando?",
          obrigatorio: true,
        },
        { tipo: "secao", titulo: "Limpeza e segurança" },
        {
          tipo: "sim_nao",
          titulo: "Área limpa e desobstruída?",
          obrigatorio: true,
        },
        {
          tipo: "sim_nao",
          titulo: "Extintores no lugar e na validade?",
          obrigatorio: true,
        },
        { tipo: "secao", titulo: "Conclusão" },
        {
          tipo: "escala",
          titulo: "Nota geral do local",
          escalaMin: 1,
          escalaMax: 5,
          rotuloMin: "Ruim",
          rotuloMax: "Ótimo",
          obrigatorio: true,
        },
        { tipo: "paragrafo", titulo: "Observações" },
        { tipo: "arquivo", titulo: "Fotos", maxArquivos: 10 },
      ]),
    }),
  },
  satisfacao: {
    rotulo: "Pesquisa de satisfação",
    resumo: "Nota de 0 a 10, atendimento e comentário.",
    criar: (): Modelo => ({
      titulo: "Pesquisa de satisfação",
      descricao: "Leva menos de 2 minutos. Sua opinião ajuda a melhorar.",
      mensagem_final: "Obrigado pela sua opinião!",
      campos: montar([
        {
          tipo: "escala",
          titulo: "De 0 a 10, quanto você recomendaria a ARP a um amigo?",
          escalaMin: 0,
          escalaMax: 10,
          rotuloMin: "Nada provável",
          rotuloMax: "Muito provável",
          obrigatorio: true,
        },
        {
          tipo: "escala",
          titulo: "Como foi o atendimento?",
          escalaMin: 1,
          escalaMax: 5,
          rotuloMin: "Muito ruim",
          rotuloMax: "Excelente",
          obrigatorio: true,
        },
        {
          tipo: "multipla",
          titulo: "O que mais pesou na sua nota?",
          opcoes: ["Atendimento", "Limpeza", "Segurança", "Estrutura", "Preço"],
          outro: true,
        },
        { tipo: "paragrafo", titulo: "Quer deixar um comentário?" },
        { tipo: "email", titulo: "E-mail (se quiser retorno)" },
      ]),
    }),
  },
  inscricao: {
    rotulo: "Inscrição em evento",
    resumo: "Dados de contato, como soube e restrições.",
    criar: (): Modelo => ({
      titulo: "Inscrição",
      descricao: "Garanta a sua vaga preenchendo os dados abaixo.",
      mensagem_final: "Inscrição confirmada. Até lá!",
      campos: montar([
        { tipo: "texto", titulo: "Nome completo", obrigatorio: true },
        { tipo: "email", titulo: "E-mail", obrigatorio: true },
        { tipo: "telefone", titulo: "Telefone (WhatsApp)", obrigatorio: true },
        { tipo: "texto", titulo: "Empresa ou loja" },
        {
          tipo: "unica",
          titulo: "Como ficou sabendo?",
          opcoes: ["Instagram", "WhatsApp", "Indicação", "E-mail"],
          outro: true,
        },
        { tipo: "sim_nao", titulo: "Tem alguma restrição alimentar?" },
        {
          tipo: "texto",
          titulo: "Qual restrição?",
          obrigatorio: true,
          se: { indice: 5, valores: ["sim"] },
        },
      ]),
    }),
  },
  fornecedor: {
    rotulo: "Avaliação de fornecedor",
    resumo: "Prazo, qualidade e se contrataria de novo.",
    criar: (): Modelo => ({
      titulo: "Avaliação de fornecedor",
      descricao: "Avalie o serviço ao fim de cada contrato ou entrega.",
      mensagem_final: "Avaliação registrada. Obrigado!",
      campos: montar([
        { tipo: "texto", titulo: "Fornecedor", obrigatorio: true },
        { tipo: "documento", titulo: "CNPJ do fornecedor" },
        { tipo: "texto", titulo: "Serviço ou produto", obrigatorio: true },
        { tipo: "sim_nao", titulo: "Cumpriu o prazo?", obrigatorio: true },
        {
          tipo: "escala",
          titulo: "Qualidade da entrega",
          escalaMin: 1,
          escalaMax: 5,
          rotuloMin: "Ruim",
          rotuloMax: "Ótima",
          obrigatorio: true,
        },
        { tipo: "sim_nao", titulo: "Contrataria de novo?", obrigatorio: true },
        { tipo: "paragrafo", titulo: "Observações" },
      ]),
    }),
  },
} as const satisfies Record<
  string,
  { rotulo: string; resumo: string; criar: () => Modelo }
>;

export type NomeDoModelo = keyof typeof MODELOS;
export const NOMES_DOS_MODELOS = Object.keys(MODELOS) as NomeDoModelo[];
