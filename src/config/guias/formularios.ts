import { abertura, busca, cartoes, exportar } from "./comum";
import type { Guia } from "./tipos";

// Um guia para todas as telas do módulo Relatórios (antigo Formulários): a
// lista e as telas de um relatório (Respostas, Perguntas, Link e
// configurações). Cada tela mostra só os passos cujos pontos estão nela.

export const GUIAS_FORMULARIOS: Record<string, Guia> = {
  "/relatorios": {
    versao: 3,
    passos: [
      abertura(
        "Relatórios",
        "Relatórios do jeito que você quiser, com link público e QR code. O caminho: <b>1.</b> criar (em branco ou de um modelo), <b>2.</b> montar as perguntas, <b>3.</b> publicar, <b>4.</b> mandar o link, <b>5.</b> acompanhar e perguntar sobre as respostas.",
      ),
      {
        alvo: "formularios-novo",
        titulo: "Passo 1. Crie o relatório",
        texto:
          "<b>Novo relatório</b> mostra os modelos: em branco, visita técnica, checklist de vistoria, pesquisa de satisfação, inscrição e avaliação de fornecedor. O modelo só adianta as perguntas; tudo é editável. Ninguém de fora vê nada até você publicar.",
      },
      cartoes(
        "Quantos estão publicados, em rascunho e encerrados. Clique no cartão para filtrar a lista.",
      ),
      {
        alvo: "secao:Todos os relatórios",
        titulo: "Abra um relatório",
        texto:
          "Clique na linha para ver as respostas, editar as perguntas ou pegar o link.",
      },
      busca("Digite parte do título para achar o relatório."),
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
          "<b>Adicionar pergunta</b> põe no fim; o <b>+</b> de cada pergunta insere logo abaixo dela. Tipos: resposta curta, parágrafo, escolha única, caixas de seleção, lista, escala, sim ou não, e-mail, telefone, número, data, CPF/CNPJ, envio de arquivo e título de seção. Nas escolhas, <b>Incluir “Outro”</b> deixa a pessoa escrever. <b>Mostrar só se…</b> esconde a pergunta (ou a seção) conforme uma resposta anterior. No fim, <b>Salvar</b>.",
      },
      {
        alvo: "aba:Link e configurações",
        titulo: "Link e configurações",
        texto:
          "Onde se publica, pega o link e o QR code e define a aparência, a mensagem final, a data e o limite de respostas.",
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
          "Copie, mande pelo WhatsApp ou baixe o <b>QR code</b> para imprimir. Quem recebe responde sem login. <b>Gerar novo link</b> desliga o anterior (e o QR antigo).",
      },
      {
        alvo: "secao:Aparência",
        titulo: "Aparência",
        texto:
          "Cor de destaque do link, <b>uma seção por página</b> com barra de progresso (bom no celular) e, se quiser, um endereço para onde levar a pessoa depois do envio.",
      },
      {
        alvo: "formularios-chat",
        titulo: "Passo 5. Pergunte às respostas",
        texto:
          "Escreva a pergunta ou clique numa sugestão: “quantas pessoas responderam?”, “quantos marcaram Alta em Urgência?”, “qual a média da nota?”, “quantas respostas nesta semana?”. A conta é feita aqui, com as respostas do relatório; nada sai do sistema.",
      },
      {
        alvo: "secao:Respostas por dia",
        titulo: "Respostas por dia",
        texto:
          "Quantas respostas chegaram em cada um dos últimos 30 dias. Passe o mouse na barra para ver o dia.",
      },
      {
        alvo: "secao:Todas as respostas",
        titulo: "Todas as respostas",
        texto:
          "Cada resposta numa linha; clique para ver inteira. Acima, o resumo de cada pergunta (contagem por opção, inclusive “Outro”, e média da nota).",
      },
      exportar(
        "Baixe todas as respostas em Excel ou PDF, uma coluna por pergunta.",
      ),
    ],
  },
};
