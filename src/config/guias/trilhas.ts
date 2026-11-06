import { TRILHA_CALENDARIO } from "./calendario";
import type { PassoTrilha, Trilha } from "./tipos";
import { TRILHAS_MODULOS } from "./trilhas-modulos";

// Trilhas: o processo de ponta a ponta, atravessando telas. O guia vai
// sozinho para a tela de cada passo, espera a pessoa abrir o formulário ou
// uma OS e segue; nada é criado sem ela clicar em Enviar. Passo cujo ponto
// não está na tela (lista vazia, sem permissão) aparece no centro, com o
// texto de `semAlvo`, para o processo continuar sendo ensinado.

interface Rotas {
  /** Onde a pessoa abre (tem o botão + Novo / + Nova OS). */
  inicio: string;
  /** A visão do setor: fila sem responsável. */
  setor: string;
  /** A caixa de quem executa. */
  caixa: string;
  quadro: string;
}

function trilhaDeTicket(
  ehOS: boolean,
  r: Rotas,
): Omit<Trilha, "id" | "titulo" | "resumo"> {
  const item = ehOS ? "a OS" : "o chamado";
  const Item = ehOS ? "A OS" : "O chamado";
  const botao = ehOS ? "+ Nova OS" : "+ Novo";
  const passos: PassoTrilha[] = [
    {
      rota: r.inicio,
      titulo: ehOS
        ? "Ordem de serviço do começo ao fim"
        : "Chamado do começo ao fim",
      texto: `Vamos seguir ${item} por todo o caminho: abrir, para onde vai, quem pega, a execução, a conclusão e a confirmação. O guia muda de tela sozinho. <b>Nada é criado</b> sem você clicar em Enviar.`,
    },

    // 1. Abrir
    {
      alvo: "novo",
      ate: "novo-categoria",
      titulo: `Abrir ${item}`,
      texto: `Clique em <b>${botao}</b>. O botão fica em todas as telas de Tickets.`,
      semAlvo: `Sem o botão ${botao}, o seu cargo não abre ${ehOS ? "OS" : "chamados"}: peça a permissão ao administrador.`,
    },
    {
      alvo: "novo-categoria",
      ate: "novo-titulo",
      titulo: "Escolha o serviço",
      texto: `Digite o que precisa (ex.: ${ehOS ? "elétrica, hidráulica, ar-condicionado" : "elétrica, credenciamento, limpeza"}) e clique na categoria. <b>A categoria decide o setor que atende, o prazo e o checklist.</b>`,
      semAlvo: `Clique em <b>${botao}</b> para abrir o formulário e escolher a categoria.`,
    },
    {
      alvo: "novo-titulo",
      titulo: "Descreva",
      texto:
        "Título curto e, na descrição, onde é e o que já foi tentado. Fotos e arquivos ajudam quem vai atender a chegar preparado.",
      semAlvo:
        "Depois de escolher a categoria aparecem título, descrição e fotos: escreva onde é e o que já foi tentado.",
    },
    {
      alvo: "novo-propriedades",
      titulo: "Ajuste se precisar",
      texto: `Prioridade e responsável. <b>Deixe o responsável em branco</b> para ${item} cair na fila do setor. Em Vínculos, ligue ${ehOS ? "o ativo (o custo entra no histórico dele) e a loja" : "a loja ou o ativo"}.`,
      semAlvo:
        "Ao lado ficam prioridade, responsável e os vínculos com loja e ativo.",
    },
    {
      alvo: "novo-enviar",
      titulo: "Para onde vai",
      texto: `Aqui o sistema mostra o destino: <b>a pessoa escolhida</b> ou a <b>Fila do setor</b>. Enviar cria ${item} de verdade. Para só conhecer o processo, clique em <b>Próximo</b>: o formulário fecha sem criar nada.`,
      semAlvo: `No rodapé do formulário aparece “Vai para…”: a pessoa escolhida ou a Fila do setor. Enviar cria ${item}.`,
    },

    // 2. Quem pega
    {
      rota: r.setor,
      alvo: "cartao:Sem responsável",
      titulo: "A fila do setor",
      texto: `Sem responsável, ${item} chega aqui, na visão do setor. Qualquer pessoa do setor pode <b>Assumir</b>; o gestor também pode <b>atribuir</b> direto na lista. Clique no cartão para ver só a fila.`,
      semAlvo: `Sem responsável, ${item} vai para a fila do setor: qualquer pessoa do setor assume, ou o gestor atribui.`,
    },
    {
      alvo: "tabela",
      titulo: "Distribuir e cobrar",
      texto:
        "Na lista do setor o gestor muda responsável, prazo e prioridade sem abrir cada um. Marque vários para mudar todos juntos.",
      semAlvo:
        "Na visão do setor o gestor distribui e cobra: responsável, prazo e prioridade direto na lista.",
    },

    // 3. Execução
    {
      rota: r.caixa,
      alvo: "cartoes",
      titulo: "A caixa de quem executa",
      texto: `Com responsável, ${item} aparece na <b>Minha caixa</b> dele, pelo prazo. O sino avisa quando chega algo novo.`,
      semAlvo: `Com responsável, ${item} aparece na Minha caixa dele, pelo prazo, e o sino avisa.`,
    },
    {
      alvo: "tabela",
      ate: "chamado-acoes",
      titulo: `Abra ${item}`,
      texto: `Clique no título de ${ehOS ? "uma OS" : "um chamado"} da lista para abrir o detalhe ao lado. O guia segue quando ele abrir.`,
      semAlvo: `Quando houver ${ehOS ? "uma OS" : "um chamado"} na lista, clique no título para abrir o detalhe ao lado.`,
    },
    {
      alvo: "chamado-acoes",
      titulo: "Assumir e iniciar",
      texto: `Os botões mostram a próxima ação. <b>Assumir</b>: ${item} passa a ser seu. <b>Iniciar</b>: começou a execução. Se depender de peça ou de terceiro, <b>Colocar em espera</b> (e depois Retomar); se não for com você, <b>Devolver à fila</b>.`,
      semAlvo: `No detalhe, os botões mostram a próxima ação: Assumir, Iniciar, Colocar em espera, Concluir.`,
    },
    ...(ehOS
      ? [
          {
            alvo: "os-cronometro",
            titulo: "Marque o tempo",
            texto:
              "O cronômetro fica preso no topo: <b>Iniciar</b> ao começar, <b>Pausar</b> no almoço ou ao sair, <b>Finalizar</b> ao terminar. Vira o minuto-homem e o custo da OS.",
            semAlvo:
              "Na OS, o cronômetro (Iniciar, Pausar, Finalizar) marca o tempo de cada técnico e vira o custo.",
          } satisfies PassoTrilha,
          {
            alvo: "os-bloco",
            titulo: "Execução, materiais e fotos",
            texto:
              "Local, técnicos, terceirizado (com orçamento ou laudo), materiais e fotos de antes e depois. É o que o gestor vê no custo e no histórico do ativo.",
            semAlvo:
              "No bloco da OS ficam técnicos, terceirizado, materiais e fotos de antes e depois.",
          } satisfies PassoTrilha,
        ]
      : []),
    {
      alvo: "chamado-checklist",
      titulo: "Checklist",
      texto:
        "Marque cada item ao fazer. Item obrigatório pendente impede concluir.",
      semAlvo:
        "Se a categoria tiver checklist, ele aparece no detalhe; item obrigatório pendente impede concluir.",
    },
    {
      alvo: "chamado-conversa",
      titulo: "Converse no próprio chamado",
      texto:
        "Escreva para quem pediu; use <b>@</b> para chamar alguém. <b>Nota interna</b> só a equipe vê. Embaixo, o histórico de cada mudança.",
      semAlvo:
        "No detalhe, a conversa com quem pediu (@ chama alguém; nota interna só a equipe vê) e o histórico de tudo.",
    },

    // 4. Conclusão
    {
      alvo: "chamado-acoes",
      titulo: "Concluir",
      texto: `Terminou? <b>Concluir</b> pede a solução${ehOS ? " e a causa da falha" : ""}. ${Item} fica <b>Concluíd${ehOS ? "a" : "o"}</b>, esperando quem pediu confirmar.${ehOS ? " OS terceirizada: o terceirizado assina pelo link e a ARP valida." : ""}`,
      semAlvo: `Ao terminar, Concluir pede a solução${ehOS ? " e a causa da falha" : ""}; ${item} espera quem pediu confirmar.`,
    },

    // 5. Confirmação
    {
      rota: r.caixa,
      alvo: "cartao:Aguardando minha confirmação",
      titulo: "Quem pediu confirma",
      texto: `${Item} volta para quem abriu, neste cartão. Ele abre, confere e clica em <b>Confirmar</b> (fecha) ou <b>Reabrir</b> (volta para quem atendeu). Sem resposta, o aceite automático fecha depois do prazo.`,
      semAlvo: `${Item} concluíd${ehOS ? "a" : "o"} volta para quem abriu, em “Aguardando minha confirmação”: Confirmar fecha, Reabrir devolve.`,
    },

    // 6. Acompanhar
    {
      rota: r.quadro,
      titulo: "Acompanhe no quadro",
      texto: `As colunas são os status: Aberto, Em andamento, Aguardando, Concluído. <b>Arraste o cartão</b> para andar com ${item}; clique no título para ver o detalhe.`,
    },
    {
      rota: "/os/paineis",
      alvo: "cartoes",
      titulo: "Meça",
      texto:
        "Nos Painéis: em aberto, atrasados, fechados e % no prazo, geral e por setor. Todo número abre a lista que o forma.",
      semAlvo:
        "Nos Painéis ficam em aberto, atrasados, fechados e % no prazo, geral e por setor.",
    },
    {
      alvo: "guia",
      titulo: "Pronto",
      texto:
        "Este processo fica no botão <b>Guia</b> de qualquer tela de Tickets. O guia de cada tela também está lá.",
    },
  ];
  return { modulo: "/os", versao: 1, passos };
}

export const TRILHAS: Trilha[] = [
  {
    id: "os",
    titulo: "Ordem de serviço do começo ao fim",
    resumo: "Abrir, distribuir, executar, concluir e confirmar uma OS",
    ...trilhaDeTicket(true, {
      inicio: "/os/ordens",
      setor: "/os/ordens/meu-setor",
      caixa: "/os/ordens/caixa",
      quadro: "/os/ordens/quadro",
    }),
  },
  {
    id: "chamado",
    titulo: "Chamado do começo ao fim",
    resumo: "Abrir, assumir, resolver e confirmar um chamado",
    ...trilhaDeTicket(false, {
      inicio: "/os",
      setor: "/os/meu-setor",
      caixa: "/os",
      quadro: "/os/quadro",
    }),
  },
  ...TRILHAS_MODULOS,
  TRILHA_CALENDARIO,
];

/** As trilhas do módulo da tela (ex.: /os/... mostra as de Tickets). */
export const trilhasDa = (pathname: string) =>
  TRILHAS.filter(
    (t) => pathname === t.modulo || pathname.startsWith(`${t.modulo}/`),
  );
