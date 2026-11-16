import { abertura } from "./comum";
import type { Guia, Trilha } from "./tipos";

export const GUIAS_CALENDARIO: Record<string, Guia> = {
  "/calendario": {
    versao: 1,
    passos: [
      abertura(
        "Agenda",
        "Eventos, reuniões, obras, tarefas e feriados da empresa num lugar só. Você só vê o que foi compartilhado com você.",
      ),
      {
        alvo: "visao",
        titulo: "Passo 1. Escolha como ver",
        texto:
          "<b>Mês</b> para o panorama, <b>Semana</b> e <b>Dia</b> para o detalhe e <b>Agenda</b> para a lista dos próximos 30 dias. As setas andam o período; <b>Hoje</b> volta para hoje.",
      },
      {
        alvo: "filtros",
        titulo: "Passo 2. Filtre o que aparece",
        texto:
          "Clique num tipo para esconder ou mostrar (o número é quantos há no período). <b>Só os meus</b> deixa o que você criou ou de que é responsável.",
      },
      {
        alvo: "novo",
        titulo: "Passo 3. Marque um item",
        texto:
          "Clique em <b>Novo</b>, ou no <b>+</b> de um dia (ou na parte vazia dele) para já abrir naquela data. Escolha o tipo: os campos mudam com ele (horário, vários dias, local, responsável, repetição).",
      },
      {
        alvo: "novo",
        titulo: "Passo 4. Diga quem vê",
        texto:
          "<b>Todos</b>: quem abre a agenda. <b>Setores, cargos ou pessoas</b>: só quem você escolher. <b>Só eu</b>: privado (você e o responsável). O tipo já sugere um padrão.",
      },
      {
        alvo: "calendario",
        titulo: "Passo 5. Abra um item",
        texto:
          "Clique num item para ver quando, onde, quem é o responsável e quem vê. Quem criou edita e exclui; o responsável marca como <b>feito</b> (tarefas e obras).",
      },
    ],
  },
  "/calendario/configuracoes": {
    versao: 1,
    passos: [
      abertura(
        "Tipos de item",
        "O que pode ser marcado na agenda. Cada tipo tem nome, cor, ícone, os campos que o formulário pede e quem vê por padrão.",
      ),
      {
        alvo: "novo",
        titulo: "Passo 1. Crie um tipo",
        texto:
          "Ex.: Treinamento, Visita técnica, Manutenção. Escolha cor e ícone: é como ele aparece na agenda e na legenda.",
      },
      {
        alvo: "tabela",
        titulo: "Passo 2. Ajuste os campos e o padrão",
        texto:
          "No lápis, marque o que o formulário pede (horário, vários dias, local, responsável, marcar como feito, repetição) e quem vê por padrão. Vale para os próximos itens.",
      },
      {
        alvo: "tabela",
        titulo: "Passo 3. Desative em vez de excluir",
        texto:
          "Tipo com itens não se exclui: desmarque <b>Ativo</b> e ele sai do formulário, mas os itens continuam na agenda.",
      },
    ],
  },
};

export const TRILHA_CALENDARIO: Trilha = {
  id: "agenda-item",
  modulo: "/calendario",
  versao: 1,
  titulo: "Marcar na agenda e escolher quem vê",
  resumo: "Criar um item, compartilhar com setor, cargo ou pessoa e concluir",
  passos: [
    {
      rota: "/calendario",
      titulo: "Marcar na agenda",
      texto:
        "Três passos: <b>criar o item</b>, <b>escolher quem vê</b> e <b>acompanhar até o fim</b>.",
    },
    {
      alvo: "novo",
      titulo: "Crie o item",
      texto:
        "Clique em <b>Novo</b> (ou no <b>+</b> do dia). Escolha o tipo, o título e a data.",
      semAlvo:
        "Para criar itens é preciso a permissão de criar no calendário. Peça ao administrador.",
    },
    {
      alvo: "novo",
      titulo: "Escolha quem vê",
      texto:
        "Em <b>Quem vê</b>, escolha Todos, alguns setores, cargos ou pessoas, ou só você. Quem não estiver na escolha não vê o item, nem pela busca.",
      semAlvo:
        "Cada item escolhe quem vê: todos, setores, cargos, pessoas ou só quem criou.",
    },
    {
      alvo: "calendario",
      titulo: "Acompanhe",
      texto:
        "O item aparece na agenda de quem pode ver. Clique nele para editar ou, nas tarefas e obras, marcar como <b>feito</b>.",
      semAlvo: "Clique num item da agenda para editar ou marcar como feito.",
    },
    {
      rota: "/calendario/configuracoes",
      alvo: "tabela",
      titulo: "Os tipos são configuráveis",
      texto:
        "Quem configura a agenda cria tipos novos e decide os campos e quem vê por padrão.",
      semAlvo:
        "Quem tem a permissão de configurar a agenda cria e ajusta os tipos de item.",
    },
    {
      alvo: "guia",
      titulo: "Pronto",
      texto:
        "Este processo fica no botão <b>Guia</b> de qualquer tela do módulo. O guia de cada tela também está lá.",
    },
  ],
};
