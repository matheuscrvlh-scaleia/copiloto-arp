import { abertura, busca, cartoes, exportar } from "./comum";
import type { Guia } from "./tipos";

// Um guia para todas as telas do módulo: a lista e as telas de um
// formulário (Perguntas, Link e configurações, Respostas). Cada tela mostra
// só os passos cujos pontos estão nela.

export const GUIAS_FORMULARIOS: Record<string, Guia> = {
  "/formularios": {
    versao: 1,
    passos: [
      abertura(
        "Formulários",
        "Formulários do jeito que você quiser, com link público. O caminho: <b>1.</b> criar e montar as perguntas, <b>2.</b> publicar, <b>3.</b> mandar o link, <b>4.</b> acompanhar as respostas.",
      ),
      {
        alvo: "formularios-novo",
        titulo: "Passo 1. Crie o formulário",
        texto:
          "Abre um rascunho já com a primeira pergunta. Ninguém de fora vê nada até você publicar.",
      },
      cartoes(
        "Quantos estão publicados, em rascunho e encerrados. Clique no cartão para filtrar a lista.",
      ),
      {
        alvo: "secao:Todos os formulários",
        titulo: "Abra um formulário",
        texto:
          "Clique na linha para ver as respostas, editar as perguntas ou pegar o link.",
      },
      busca("Digite parte do título para achar o formulário."),
      {
        alvo: "aba:Perguntas",
        titulo: "Perguntas",
        texto:
          "Título, descrição e as perguntas, na ordem em que aparecem para quem responde.",
      },
      {
        alvo: "formularios-editor",
        titulo: "Passo 2. Monte as perguntas",
        texto:
          "<b>Adicionar pergunta</b> e escolha o tipo: resposta curta, parágrafo, escolha única, caixas de seleção, lista, escala, sim ou não, e-mail, telefone, número, data, CPF/CNPJ ou título de seção. Marque <b>Obrigatória</b> quando precisar. As setas mudam a ordem. No fim, <b>Salvar</b>.",
      },
      {
        alvo: "aba:Link e configurações",
        titulo: "Link e configurações",
        texto:
          "Onde se publica, pega o link e define a mensagem final, a data e o limite de respostas.",
      },
      {
        alvo: "formularios-situacao",
        titulo: "Passo 3. Publique",
        texto:
          "Só o publicado recebe respostas. Dá para editar mesmo publicado; para parar de receber, <b>Encerrar</b>.",
      },
      {
        alvo: "formularios-link",
        titulo: "Passo 4. Mande o link",
        texto:
          "Copie ou mande pelo WhatsApp. Quem recebe responde sem login. <b>Gerar novo link</b> desliga o anterior.",
      },
      {
        alvo: "secao:Todas as respostas",
        titulo: "Passo 5. Acompanhe as respostas",
        texto:
          "Cada resposta numa linha; clique para ver inteira. Abaixo, o resumo de cada pergunta (contagem por opção, média da nota).",
      },
      exportar(
        "Baixe todas as respostas em Excel ou PDF, uma coluna por pergunta.",
      ),
    ],
  },
};
