import type { PassoTrilha, Trilha } from "./tipos";

// Trilhas do Módulo Operações: o trabalho do mês na ordem em que acontece,
// passando pelas telas. Mesmas regras das de Tickets (trilhas.ts): nada é
// gravado sem a pessoa clicar; passo sem o ponto na tela vai ao centro.

const FIM: PassoTrilha = {
  alvo: "guia",
  titulo: "Pronto",
  texto:
    "Este processo fica no botão <b>Guia</b> de qualquer tela de Operações. O guia de cada tela também está lá.",
};

const IMPORTAR = "/operacoes/importacoes";

export const TRILHAS_OPERACOES: Trilha[] = [
  {
    id: "op-agua-mes",
    modulo: "/operacoes",
    versao: 1,
    titulo: "Importar a água do mês",
    resumo:
      "Enviar planilhas e fotos, conferir a prévia, confirmar e resolver os alertas",
    passos: [
      {
        rota: IMPORTAR,
        titulo: "Importar a água do mês",
        texto:
          "O caminho dos arquivos do parceiro: <b>enviar</b> → <b>conferir a prévia</b> → <b>confirmar</b> → <b>conferir as leituras</b> → <b>resolver os alertas</b>. O guia muda de tela sozinho; nada entra sem você confirmar.",
      },
      {
        alvo: "aba:Contas de água por sala",
        ate: "op-agua-arquivos",
        titulo: "Escolha a água por sala",
        texto:
          "Clique em <b>Contas de água por sala</b>. O guia segue quando a área de envio aparecer.",
        semAlvo:
          "Importar a água pede a permissão de importar a água. Peça ao administrador.",
      },
      {
        alvo: "op-agua-arquivos",
        titulo: "Envie os arquivos",
        texto:
          "Arraste as planilhas de todos os blocos (ou os PDFs, se a planilha não vier) e as fotos dos visores, tudo de uma vez, como chegaram.",
        semAlvo: "Escolha o tipo Água para abrir a área de envio.",
      },
      {
        alvo: "op-agua-ler",
        ate: "op-agua-previa",
        titulo: "Mande ler",
        texto:
          "Clique em <b>Ler arquivos</b>. Se a planilha mudou de formato, o sistema pede qual coluna é cada campo e guarda o modelo para o mês seguinte.",
        semAlvo: "Junte os arquivos e clique em Ler arquivos.",
      },
      {
        alvo: "op-agua-previa",
        titulo: "Confira a prévia",
        texto:
          "Mês de referência, linhas lidas e somas contra o resumo de cada arquivo. Verde: bate. Vermelho: falta linha ou o total não fecha; o melhor é pedir o arquivo certo ao parceiro.",
        semAlvo:
          "Depois de ler, a prévia mostra o mês, as linhas e as somas contra o resumo de cada arquivo.",
      },
      {
        alvo: "op-agua-previa-linhas",
        titulo: "Olhe as linhas e as fotos",
        texto:
          "As linhas como vão entrar, com a foto ligada a cada hidrômetro e os avisos.",
        semAlvo:
          "Na prévia, as linhas aparecem com a foto de cada hidrômetro e os avisos.",
      },
      {
        alvo: "op-agua-confirmar",
        titulo: "Confirme",
        texto:
          "Bateu: confirme. Não bateu e precisa seguir: escreva o motivo e confirme assim mesmo; o mês fica marcado <b>incompleto</b> até ser reimportado. Depois, clique em <b>Ver as leituras</b>.",
        semAlvo:
          "Confira a prévia e clique em Confirmar importação. Nada aparece nas telas antes disso.",
      },
      {
        rota: "/operacoes/agua",
        alvo: "op-agua-leituras",
        titulo: "Confira as leituras",
        texto:
          "Uma linha por hidrômetro, agrupada por bloco. O cliente do faturamento fica ao lado do locatário no ENET, para ver se a conta vai para a pessoa certa.",
        semAlvo:
          "Nenhuma leitura neste mês ainda: confirme a importação para as leituras aparecerem aqui.",
      },
      {
        alvo: "cartao:Alertas",
        titulo: "Abra os alertas",
        texto:
          "Clique no cartão para deixar só as leituras com problema: acima do limite, zerada ou menor que a anterior, variação grande, sem foto ou cliente diferente do ENET.",
        semAlvo:
          "O cartão Alertas filtra a lista só com as leituras com problema.",
      },
      {
        alvo: "op-agua-leituras",
        titulo: "Resolva um a um",
        texto:
          "Clique na linha: o hidrômetro mostra as fotos de cada mês. Leitura zerada com relógio novo na foto é troca de hidrômetro; sala errada se corrige lá, em <b>Corrigir sala ou bloco</b>.",
        semAlvo:
          "Abra cada hidrômetro com alerta e confira as fotos de cada mês.",
      },
      {
        alvo: "op-agua-sumidos",
        titulo: "Hidrômetros que sumiram",
        texto:
          "Tinham leitura no mês anterior e não vieram neste. Confirme com o parceiro se foi troca, sala desocupada ou falta no arquivo.",
        semAlvo:
          "Nenhum hidrômetro sumiu: todos os do mês anterior vieram neste.",
      },
      FIM,
    ],
  },
  {
    id: "op-limpeza-mes",
    modulo: "/operacoes",
    versao: 1,
    titulo: "Fechar o rateio da limpeza",
    resumo:
      "Lançar o mês, conferir a memória de cálculo, fechar e enviar ao Financeiro",
    passos: [
      {
        rota: "/operacoes/limpeza",
        titulo: "Fechar o rateio da limpeza",
        texto:
          "O fim do mês da limpeza: <b>lançar</b> → <b>conferir com o contrato e a memória de cálculo</b> → <b>fechar</b> → <b>enviar ao Financeiro</b> → <b>demonstrativo</b> para quem perguntar.",
      },
      {
        alvo: "op-limpeza-novo-mes",
        titulo: "Abra o mês",
        texto:
          "<b>Novo mês</b>, copiando o mês anterior (o mais comum) ou do zero, com os padrões de Parâmetros. Se o mês já existe, escolha-o no seletor ao lado.",
        semAlvo:
          "Lançar o rateio pede a permissão de lançar a limpeza. Peça ao administrador.",
      },
      {
        alvo: "op-limpeza-dados",
        titulo: "Lance os dados",
        texto:
          "Valor base do contrato, funcionários (base, área comum e rateados), o apontamento de minutos da empresa e os extras da área comum.",
        semAlvo:
          "Abra um mês para lançar valor base, funcionários, apontamento e extras.",
      },
      {
        alvo: "op-limpeza-resultado",
        titulo: "Ajuste os minutos",
        texto:
          "Minutos por dia de limpeza e de manutenção de cada local. Participação e valor se refazem a cada tecla.",
        semAlvo:
          "No Resultado por local, ajuste os minutos de cada local enquanto o mês está aberto.",
      },
      {
        alvo: "op-limpeza-salvar",
        titulo: "Salve",
        texto: "Grave o que mudou. Sem salvar, o mês não fecha.",
        semAlvo:
          "Mês fechado: para mudar, alguém com a permissão reabre com um motivo.",
      },
      {
        alvo: "cartao:Conferência com o contrato",
        titulo: "Confira com o contrato",
        texto:
          "Verde: o total do rateio bate com os itens de limpeza do contrato. Vermelho: falta valor ou a conta não fecha; veja a memória de cálculo.",
        semAlvo:
          "A conferência compara o total do rateio com os itens de limpeza do contrato.",
      },
      {
        alvo: "op-limpeza-memoria",
        titulo: "Confira a memória de cálculo",
        texto:
          "Cada passo da conta, com a fórmula e os números. Clique em qualquer valor da tela para ver de onde veio.",
        semAlvo:
          "A memória de cálculo mostra cada passo da conta, com a fórmula e os números.",
      },
      {
        alvo: "op-limpeza-fechar",
        ate: "op-limpeza-enviar",
        titulo: "Feche o mês",
        texto:
          "Trava o mês e registra quem fechou. O guia segue quando o mês estiver fechado.",
        semAlvo:
          "Fechar pede a permissão de fechar o rateio e o mês aberto, salvo e sem pendência.",
      },
      {
        alvo: "op-limpeza-enviar",
        titulo: "Envie ao Financeiro",
        texto:
          "Gera o resultado por bloco em PDF e Excel, guarda nos anexos do mês e avisa quem cuida do faturamento. Fica registrado quem enviou e quando; o prazo é o dia útil de Parâmetros.",
        semAlvo:
          "Com o mês fechado, o botão Enviar ao Financeiro aparece no lugar de Fechar mês.",
      },
      {
        alvo: "op-limpeza-demonstrativo",
        titulo: "Demonstrativo",
        texto:
          "O PDF com a conta do mês, para o locatário que pergunta o valor. O do bloco sai pelo ícone de documento no Resultado por local.",
        semAlvo:
          "O demonstrativo em PDF fica no topo do mês e, por bloco, no Resultado por local.",
      },
      FIM,
    ],
  },
  {
    id: "op-termo-energia",
    modulo: "/operacoes",
    versao: 1,
    titulo: "Emitir o termo de energia",
    resumo:
      "Do aviso no quadro à caixa, ao locatário do ENET e ao termo em PDF e Word",
    passos: [
      {
        rota: "/operacoes/energia",
        titulo: "Emitir o termo de energia",
        texto:
          "Contrato novo no ENET pede termo de autorização: <b>quadro</b> → <b>caixa</b> → <b>locatário do ENET</b> → <b>disjuntor e rota</b> → <b>termo em PDF e Word</b>.",
      },
      {
        alvo: "op-energia-avisos",
        titulo: "Comece pelos avisos",
        texto:
          "O quadro avisa caixa ocupada sem termo e locatário novo vindo do ENET. Clique em <b>Abrir caixa</b> no aviso.",
        semAlvo:
          "Nenhum aviso neste quadro: todas as caixas ocupadas têm termo. Para um termo novo, abra a caixa no desenho.",
      },
      {
        alvo: "op-energia-caixa",
        ate: "op-energia-enet",
        titulo: "Abra a caixa",
        texto:
          "Ou clique na caixa no desenho. O guia segue quando a ficha abrir.",
        semAlvo:
          "Este quadro ainda não tem caixas. Elas vêm da carga do catálogo ou do cadastro de quem edita os quadros.",
      },
      {
        alvo: "op-energia-enet",
        titulo: "Confira o locatário",
        texto:
          "O contrato vigente da sala no ENET aparece junto do ocupante da caixa. Se for outro, clique em <b>Atualizar a partir do ENET</b>: o anterior vai para o histórico.",
        semAlvo: "Abra uma caixa para ver o contrato vigente da sala no ENET.",
      },
      {
        alvo: "op-energia-trocar-locatario",
        titulo: "Sala sem contrato no ENET",
        texto:
          "A troca é à mão: <b>Nova entrada / troca de locatário</b>. Só para quando o ENET não tem o contrato da sala.",
        semAlvo: "Trocar o locatário pede a permissão de editar os quadros.",
      },
      {
        alvo: "secao:Dados da caixa",
        titulo: "Confira disjuntor e rota",
        texto:
          "Disjuntor, medidor, rota e sala vão para o termo. Corrija aqui antes de emitir.",
        semAlvo:
          "Na ficha, os Dados da caixa têm o disjuntor, a rota e a sala que vão para o termo.",
      },
      {
        alvo: "op-energia-emitir-termo",
        titulo: "Emita o termo",
        texto:
          "<b>Emitir termo desta caixa</b> abre o termo preenchido com o nome e o documento do ENET. Confira a prévia e clique em <b>Gerar PDF e Word</b>.",
        semAlvo:
          "Na ficha da caixa, Emitir termo desta caixa abre o termo já preenchido.",
      },
      {
        alvo: "secao:Termos emitidos",
        titulo: "Baixe o termo",
        texto:
          "A emissão fica guardada na caixa, com a versão. Reemitir cria uma versão nova; as anteriores continuam.",
        semAlvo: "Os termos emitidos ficam guardados na ficha da caixa.",
      },
      {
        rota: "/operacoes/energia/termo",
        alvo: "secao:Últimos termos emitidos",
        titulo: "Todos os termos",
        texto:
          "Os últimos termos de todas as caixas, para baixar ou reimprimir. Daqui também se abre o termo pela sala, sem passar pelo desenho.",
        semAlvo:
          "Os últimos termos emitidos de todas as caixas ficam nesta tela.",
      },
      FIM,
    ],
  },
  {
    id: "op-faturas-energia",
    modulo: "/operacoes",
    versao: 1,
    titulo: "Importar as faturas da Energisa",
    resumo:
      "Enviar os PDFs, conferir cada fatura, confirmar e ver contas e créditos",
    passos: [
      {
        rota: IMPORTAR,
        titulo: "Importar as faturas da Energisa",
        texto:
          "As faturas da área comum do mês: <b>enviar os PDFs</b> → <b>conferir cada fatura</b> → <b>confirmar</b> → <b>contas de energia</b> → <b>créditos da energia solar</b>.",
      },
      {
        alvo: "aba:Faturas da Energisa",
        ate: "op-contas-enviar",
        titulo: "Escolha Faturas da Energisa",
        texto: "Clique no tipo. O guia segue quando a área de envio aparecer.",
        semAlvo:
          "Importar faturas pede a permissão das contas de energia. Peça ao administrador.",
      },
      {
        alvo: "op-contas-enviar",
        titulo: "Envie os PDFs",
        texto:
          "Escolha todos os PDFs de uma vez, como vieram da Energisa. Cada um é lido e vira uma prévia.",
        semAlvo: "Escolha o tipo Faturas da Energisa para abrir o envio.",
      },
      {
        alvo: "op-contas-conferencia",
        titulo: "Confira cada fatura",
        texto:
          "Os itens precisam somar o total da fatura. Verde: bate. Vermelho: confira o PDF antes de confirmar.",
        semAlvo: "Cada fatura lida mostra se os itens somam o total impresso.",
      },
      {
        alvo: "op-contas-unidade-nova",
        titulo: "Matrícula nova",
        texto:
          "Fatura de matrícula sem cadastro pede a unidade (apelido e papel na geração solar) antes de confirmar.",
        semAlvo:
          "Todas as matrículas já estão cadastradas em Parâmetros › Energia · contas e solar.",
      },
      {
        alvo: "op-contas-confirmar",
        titulo: "Confirme",
        texto:
          "A fatura entra em Contas de energia e em Energia solar. Repita em cada prévia da lista.",
        semAlvo: "Confirme cada prévia; nada entra antes disso.",
      },
      {
        rota: "/operacoes/energia/contas",
        alvo: "op-contas-tabela",
        titulo: "Contas do mês",
        texto:
          "Uma linha por unidade, com consumo, compensado, saldo de créditos e total. Clique na unidade para ver os itens.",
        semAlvo:
          "Nenhuma fatura neste mês ainda: confirme as prévias para elas aparecerem aqui.",
      },
      {
        rota: "/operacoes/energia/solar",
        alvo: "op-solar-saldos",
        titulo: "Nada pode expirar",
        texto:
          "Saldo de créditos por unidade e o que expira no próximo ciclo. A meta é zero a expirar: se aparecer valor, avise quem cuida das usinas.",
        semAlvo:
          "Os saldos e o que expira no próximo ciclo vêm das faturas importadas.",
      },
      FIM,
    ],
  },
];
