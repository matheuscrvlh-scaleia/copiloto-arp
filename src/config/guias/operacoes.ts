import {
  abas,
  abertura,
  cartoes,
  exportar,
  filtros,
  fonte,
  menuDoModulo,
} from "./comum";
import type { Alvo, AlvoPorTitulo, Guia, Passo } from "./tipos";

// Guias do Módulo Operações: o roteiro do trabalho em cada tela. Subtelas
// sem guia próprio (a obra, o hidrômetro, a fatura, o relatório) usam o da
// tela-mãe; os passos delas ("Na obra: …") só aparecem quando o ponto está
// na tela, então cada guia serve às duas.

const p = (alvo: Alvo | AlvoPorTitulo, titulo: string, texto: string) =>
  ({ alvo, titulo, texto }) satisfies Passo;

export const GUIAS_OPERACOES: Record<string, Guia> = {
  "/operacoes": {
    versao: 1,
    passos: [
      abertura(
        "Painel de Operações",
        "O resumo do mês de água, energia, rateio da limpeza e obras. Cada número vem de uma tela do módulo: clique nele para abrir a tela de origem. Só aparecem as áreas que você pode ver; valores em reais, só com a permissão.",
      ),
      fonte(
        "<b>Passo 1.</b> De quando são os dados. Selo <b>amarelo</b>: ainda é dado de exemplo, até o primeiro arquivo real ser importado em Operações › Importações.",
      ),
      cartoes(
        "<b>Passo 2.</b> Os pontos de atenção do mês. A meta da maioria é zero (leituras com alerta, caixas sem termo, obras com prazo vencido). Clique no cartão para abrir a tela de origem.",
      ),
      p(
        "cartao:Água · leituras com alerta",
        "Passo 3. Água com alerta",
        "Leituras acima do limite, zeradas ou com variação grande, e meses que entraram incompletos. Clique para abrir as Leituras do mês e conferir uma a uma.",
      ),
      p(
        "cartao:Energia · locatários sem termo",
        "Passo 4. Caixas sem termo",
        "Caixas ocupadas cujo locatário atual no ENET ainda não tem termo de autorização. Clique para abrir os quadros e emitir o termo.",
      ),
      p(
        "secao:Água · consumo por bloco (m³)",
        "Passo 5. Consumo por bloco",
        "O mês contra o anterior, bloco a bloco. Um bloco que salta de um mês para o outro é o primeiro a olhar.",
      ),
      p(
        "secao:Energia · ocupação das caixas",
        "Passo 6. Ocupação das caixas",
        "Caixas ocupadas sobre o total, por bloco, para saber onde ainda há medidor livre.",
      ),
      p(
        "secao:Energia · contas da área comum",
        "Passo 7. Contas e créditos",
        "Total das faturas da área comum, quanto a geração solar compensou e o saldo de créditos. Crédito a expirar no próximo ciclo deve ser zero.",
      ),
      p(
        "secao:Rateio da limpeza",
        "Passo 8. O rateio do mês",
        "O total, se bate com o contrato e se já foi enviado ao Financeiro, com o prazo do envio (dia útil definido em Parâmetros).",
      ),
      p(
        "secao:Obras · previsto × realizado",
        "Passo 9. Desembolso das obras",
        "Orçamento, previsto até o mês, realizado e saldo. Desvio fora do limite de Parâmetros fica em alerta.",
      ),
      p(
        "secao:Obras · avanço físico",
        "Passo 10. Avanço das obras",
        "Do Diário de Obra: avanço físico contra o prazo consumido. Avanço abaixo do prazo é atraso; abra a obra no Diário para ler as ocorrências.",
      ),
      p(
        "op-painel-chamados",
        "Chamados e OS",
        "Chamados, OS, minuto-homem e ativos continuam no painel do módulo de Chamados. Este botão leva até lá.",
      ),
      menuDoModulo(
        "<b>Água</b>, <b>Energia</b> (quadros, contas e solar), <b>Rateio da limpeza</b>, <b>Obras</b> e <b>Diário de Obra</b> são as telas do dia a dia. <b>Importações</b> recebe os arquivos do mês; <b>Parâmetros</b> guarda limites e prazos.",
      ),
    ],
  },

  // -------------------------------------------------------------------------
  // Água
  // -------------------------------------------------------------------------
  "/operacoes/agua": {
    versao: 1,
    passos: [
      abertura(
        "Água · leituras do mês",
        "O faturamento individualizado da água: uma linha por hidrômetro, com consumo, valor, foto do visor e alertas. Tudo vem da planilha mensal do parceiro; sem importação, a tela fica vazia.",
      ),
      filtros(
        "<b>Passo 1.</b> Escolha o mês e, se quiser, o bloco, o tipo de faturamento ou um alerta. O filtro fica no endereço: mande o link e a outra pessoa vê o mesmo recorte.",
      ),
      p(
        "op-agua-importar-botao",
        "Passo 2. Importe o mês",
        "Quando chegarem os arquivos do parceiro, clique aqui e envie as planilhas de todos os blocos e as fotos de uma vez. Nada entra antes de você conferir a prévia.",
      ),
      p(
        "op-agua-incompleto",
        "Mês incompleto",
        "O mês foi confirmado sem bater com o resumo do arquivo. Peça o arquivo certo ao parceiro e use <b>Reimportar</b>: o aviso some quando os totais baterem.",
      ),
      cartoes(
        "<b>Passo 3.</b> Hidrômetros lidos, consumo, valor faturado (só com a permissão de valores) e alertas. Os totais são a soma das linhas, então batem com a lista abaixo.",
      ),
      p(
        "cartao:Alertas",
        "Passo 4. Vá direto aos alertas",
        "Clique para deixar só as leituras com problema: acima do limite, leitura regressiva (zerada ou menor que a anterior), consumo zero, variação grande, sem foto, sala sem locatário ou cliente diferente do ENET. Clique de novo para tirar o filtro.",
      ),
      p(
        "op-agua-sumidos",
        "Hidrômetros que sumiram",
        "Tinham leitura no mês anterior e não vieram neste. Abra cada um e confirme com o parceiro se foi troca, sala desocupada ou falta no arquivo.",
      ),
      p(
        "op-agua-leituras",
        "Passo 5. Confira linha a linha",
        "Agrupada por bloco, com subtotal e total. O cliente do faturamento fica ao lado do locatário no ENET, para ver se a conta vai para a pessoa certa. A foto amplia ao clicar; a linha abre o hidrômetro.",
      ),
      p(
        "aba:Hidrômetros",
        "Passo 6. As outras visões",
        "<b>Hidrômetros</b>: um cartão por medidor. <b>Extrato</b>: o histórico de uma sala ou cliente, para mostrar ao locatário. <b>Galeria de fotos</b>: todas as fotos do mês, para auditar.",
      ),
      p(
        "secao:Consumo por mês",
        "No hidrômetro: o histórico",
        "Consumo mês a mês e, abaixo, cada leitura com a foto do visor. Leitura zerada com relógio novo na foto é troca de hidrômetro.",
      ),
      p(
        "op-agua-vinculo",
        "No hidrômetro: corrigir sala ou bloco",
        "Se o hidrômetro passou a medir outra sala, corrija a partir do mês certo, com o motivo. O arquivo importado não muda; as telas passam a mostrar o vínculo corrigido.",
      ),
      p(
        "op-agua-imprimir",
        "No hidrômetro: imprimir o extrato",
        "Gera o PDF com o histórico e as fotos de cada mês, para mandar ao locatário que contestou a conta.",
      ),
      exportar(
        "Baixe as leituras em Excel ou PDF, com os filtros escritos no arquivo. Só para quem tem a permissão de exportar.",
      ),
    ],
  },
  "/operacoes/agua/importar": {
    versao: 1,
    passos: [
      abertura(
        "Importar o faturamento da água",
        "Três passos: <b>enviar</b> os arquivos como chegaram, <b>conferir a prévia</b> e <b>confirmar</b>. Nada aparece nas telas antes da confirmação. Abra este guia de novo na prévia para ver o que conferir.",
      ),
      p(
        "op-agua-arquivos",
        "Passo 1. Junte os arquivos",
        "Arraste as planilhas de todos os blocos do mês (ou os PDFs, se a planilha não vier) e a pasta de fotos dos visores, tudo de uma vez. Não precisa abrir nem arrumar os arquivos.",
      ),
      p(
        "op-agua-ler",
        "Passo 2. Mande ler",
        "O sistema lê cada arquivo, acha o mês de referência e confere com o resumo que vem no próprio arquivo. Arquivo já importado é recusado.",
      ),
      p(
        "op-agua-colunas",
        "Se pedir as colunas",
        "A planilha mudou de formato: diga qual coluna é cada campo e guarde o modelo. No mês seguinte a leitura sai sozinha.",
      ),
      p(
        "op-agua-previa",
        "Passo 3. Confira a prévia",
        "Mês de referência, linhas lidas e somas contra o resumo de cada arquivo. Verde: bate. Vermelho: falta linha ou o total não fecha.",
      ),
      p(
        "op-agua-previa-linhas",
        "Passo 4. Olhe as linhas",
        "As linhas como vão entrar, com a foto ligada a cada hidrômetro e os avisos de cada uma.",
      ),
      p(
        "op-agua-confirmar",
        "Passo 5. Confirme",
        "Se bate, confirme. Se não bate, o melhor é pedir o arquivo certo ao parceiro; quem precisa seguir confirma assim mesmo, escrevendo o motivo, e o mês fica marcado <b>incompleto</b> até ser reimportado.",
      ),
      p(
        "op-agua-descartar",
        "Ou descarte",
        "Apaga a prévia sem tocar nos dados. Use quando enviou o arquivo errado.",
      ),
    ],
  },
  "/operacoes/agua/hidrometros": {
    versao: 1,
    passos: [
      abertura(
        "Hidrômetros",
        "Um cartão por hidrômetro, como os medidores virtuais: leitura do visor, consumo do mês e a foto. Os cartões aparecem depois da primeira importação da água.",
      ),
      filtros(
        "<b>Passo 1.</b> Escolha o mês e o bloco, ou busque pela sala, pelo cliente ou pelo número do hidrômetro.",
      ),
      fonte(
        "<b>Passo 2.</b> De quando é a importação e quem importou. Selo amarelo: leituras de exemplo, até o primeiro arquivo do parceiro.",
      ),
      p(
        "op-agua-hidrometros",
        "Passo 3. Compare foto e número",
        "A leitura do arquivo fica junto da foto do visor. Clique na foto para ampliar e ver se o número bate.",
      ),
      p(
        "op-agua-hidrometros",
        "Passo 4. Abra o histórico",
        "Clique no cartão para ver o hidrômetro mês a mês, corrigir a sala ou o bloco e imprimir o extrato.",
      ),
      p(
        "aba:Extrato",
        "Passo 5. Extrato de uma sala",
        "Para uma contestação, o Extrato junta todos os hidrômetros de uma sala ou cliente, com as trocas.",
      ),
      p(
        "aba:Leituras do mês",
        "Passo 6. De volta aos alertas",
        "A lista com os alertas e os totais por bloco fica em Leituras do mês.",
      ),
    ],
  },
  "/operacoes/agua/extrato": {
    versao: 1,
    passos: [
      abertura(
        "Extrato de consumo",
        "O histórico mês a mês de uma sala, de um cliente ou de um hidrômetro, para mostrar ao locatário ou resolver uma contestação. Inclui as trocas de hidrômetro da sala.",
      ),
      filtros(
        "<b>Passo 1.</b> Escolha o bloco e escreva a sala, o nome do cliente ou o número do hidrômetro. Ajuste o período em <b>De</b> e <b>Até</b>.",
      ),
      fonte(
        "<b>Passo 2.</b> De quando são os dados e os filtros em uso, que também saem escritos no extrato impresso.",
      ),
      p(
        "op-agua-grafico",
        "Passo 3. Veja a curva",
        "O consumo em m³ mês a mês. Um pico ou um mês zerado costuma ser o motivo da contestação.",
      ),
      p(
        "op-agua-extrato-tabela",
        "Passo 4. Confira mês a mês",
        "Datas, leitura anterior e atual, consumo, faturado, valor e tipo de faturamento. Mais de um hidrômetro na mesma sala indica troca.",
      ),
      p(
        "secao:Fotos do visor",
        "Passo 5. As provas",
        "A foto do visor de cada mês: é o que comprova a leitura.",
      ),
      p(
        "op-agua-imprimir",
        "Passo 6. Imprima e envie",
        "Gera o PDF do extrato com as fotos de cada mês, pronto para mandar ao locatário.",
      ),
      exportar(
        "Ou baixe a tabela em Excel ou PDF, com os filtros escritos no arquivo.",
      ),
    ],
  },
  "/operacoes/agua/galeria": {
    versao: 1,
    passos: [
      abertura(
        "Galeria de fotos",
        "Todas as fotos dos visores do mês, para auditar as leituras. As fotos chegam com a importação da água; sem importação, a galeria fica vazia.",
      ),
      filtros("<b>Passo 1.</b> Escolha o mês e o bloco."),
      fonte(
        "<b>Passo 2.</b> De quando é a importação. Selo amarelo: fotos de exemplo, até o primeiro arquivo do parceiro.",
      ),
      p(
        "secao:Fotos dos visores",
        "Passo 3. Quantas fotos vieram",
        "O título conta as fotos e as leituras. Leitura sem foto vira o alerta <b>Sem foto</b> nas Leituras do mês: peça a foto ao parceiro.",
      ),
      p(
        "op-agua-galeria",
        "Passo 4. Audite",
        "Clique na foto para ampliar e compare com a leitura escrita embaixo.",
      ),
      p(
        "op-agua-galeria",
        "Passo 5. Leitura estranha",
        "Se a foto mostra outro número ou um relógio novo, abra o hidrômetro: troca de hidrômetro explica uma leitura zerada.",
      ),
      p(
        "aba:Leituras do mês",
        "Passo 6. De volta aos alertas",
        "Confirmada a dúvida, volte às Leituras do mês para seguir com os outros alertas.",
      ),
    ],
  },

  // -------------------------------------------------------------------------
  // Energia
  // -------------------------------------------------------------------------
  "/operacoes/energia": {
    versao: 1,
    passos: [
      abertura(
        "Quadros de medidores",
        "Cada sala de medidores desenhada como o painel real: a caixa com o número do giz, a rota da Energisa, a sala, o locatário do ENET, o disjuntor e o termo de autorização. Os quadros vêm da carga do catálogo de energia ou do cadastro aqui.",
      ),
      p(
        "op-energia-filtros",
        "Passo 1. Escolha o quadro",
        "O bloco troca o quadro. Status e busca (sala, ocupante ou número) apagam no desenho o que fica de fora, sem tirar nada do lugar.",
      ),
      cartoes(
        "<b>Passo 2.</b> Caixas, ocupadas, reservadas e livres. Clique num cartão para destacar só aquele status.",
      ),
      p(
        "op-energia-avisos",
        "Passo 3. Resolva os avisos",
        "Caixa ocupada sem termo, locatário novo vindo do ENET e caixa que mostra outro locatário que o ENET. Cada aviso tem <b>Abrir caixa</b>. A meta é nenhum aviso.",
      ),
      p(
        "op-energia-grade",
        "Passo 4. O desenho",
        "Lado esquerdo, barramento e lado direito, como na parede. Cor, ícone e texto dizem o status. Pelo teclado: setas andam entre as caixas e Enter abre.",
      ),
      p(
        "op-energia-caixa",
        "Passo 5. Abra a caixa",
        "Clique numa caixa: a ficha abre ao lado, sem sair do quadro.",
      ),
      p(
        "op-energia-enet",
        "Na ficha: confira o ENET",
        "O contrato vigente da sala no ENET aparece junto do ocupante da caixa. Se for outro, <b>Atualizar a partir do ENET</b> traz o locatário novo; o anterior vai para o histórico.",
      ),
      p(
        "op-energia-trocar-locatario",
        "Na ficha: troca à mão",
        "Para sala sem contrato no ENET. <b>Liberar caixa</b> é quando o locatário saiu e ninguém entrou.",
      ),
      p(
        "op-energia-emitir-termo",
        "Na ficha: emita o termo",
        "Sai preenchido com quadro, caixa, disjuntor, rota e o nome e documento do ENET. Confira, ajuste se precisar e gere o PDF e o Word.",
      ),
      p(
        "aba:Lista de caixas",
        "Passo 6. A lista",
        "As caixas em tabela, de um quadro ou de todos, com as salas sem caixa e o resumo por bloco. É a visão que vai para o Excel.",
      ),
      p(
        "op-energia-fotos",
        "Passo 7. Conferir em campo",
        "<b>Ver foto real da sala</b> mostra o painel de verdade; <b>Imprimir mapa</b>, ao lado, leva o desenho no papel.",
      ),
      p(
        "op-energia-nova-caixa",
        "Cadastro",
        "Quem edita os quadros cadastra caixas e quadros novos. O ocupante não se digita aqui: entra pela troca de locatário, que guarda o histórico.",
      ),
    ],
  },
  "/operacoes/energia/caixa": {
    versao: 1,
    passos: [
      abertura(
        "Ficha da caixa",
        "A caixa em página inteira, para mandar o link ou abrir no celular em campo: locatário, cadastro, termos de autorização e histórico.",
      ),
      p(
        "secao:Locatário",
        "Passo 1. Quem ocupa",
        "Ocupante, documento, desde quando, contrato e de onde veio (ENET ou troca à mão).",
      ),
      p(
        "op-energia-enet",
        "Passo 2. Confira com o ENET",
        "Se o ENET mostra outro locatário na sala, <b>Atualizar a partir do ENET</b> traz o novo. O anterior vai para o histórico com a data de saída.",
      ),
      p(
        "op-energia-trocar-locatario",
        "Passo 3. Troque ou libere",
        "Sala sem contrato no ENET: a troca é à mão. <b>Liberar caixa</b> quando o locatário saiu e ninguém entrou.",
      ),
      p(
        "secao:Dados da caixa",
        "Passo 4. Confira o cadastro",
        "Disjuntor, medidor, rota e sala vão para o termo. Corrija aqui antes de emitir.",
      ),
      p(
        "op-energia-emitir-termo",
        "Passo 5. Emita o termo",
        "Abre o termo preenchido, com a prévia do texto ao lado. Ajuste o que precisar e clique em <b>Gerar PDF e Word</b>.",
      ),
      p(
        "secao:Termos emitidos",
        "Passo 6. Termos guardados",
        "Cada emissão fica aqui, para baixar de novo. Reemitir cria uma versão nova; as anteriores continuam.",
      ),
      p(
        "secao:Histórico de ocupantes",
        "Histórico",
        "Quem já ocupou a caixa, com entrada e saída. Só aparece para quem tem a permissão e nunca sai no termo.",
      ),
    ],
  },
  "/operacoes/energia/termo": {
    versao: 1,
    passos: [
      abertura(
        "Termo de autorização de energia",
        "Autoriza o locatário a pedir à Energisa a instalação e a ligação do medidor da sala. Sai em PDF e Word, no papel timbrado, e cada emissão fica guardada na caixa. Depende dos quadros cadastrados com a sala ligada à caixa.",
      ),
      p(
        "op-energia-unidade",
        "Passo 1. Escolha a sala",
        "Escolher a unidade abre a ficha da caixa com o termo já preenchido: bloco, pavimento, armário, projeto, disjuntor e rota de uma vez.",
      ),
      abertura(
        "Passo 2. Confira na caixa",
        "Na ficha, veja se o locatário é o do ENET e se disjuntor e rota estão certos. Se o ENET mostra outro locatário, atualize antes de emitir.",
      ),
      abertura(
        "Passo 3. Gere o PDF e o Word",
        "No termo, ajuste a data e o que precisar, confira a prévia ao lado e clique em <b>Gerar PDF e Word</b>.",
      ),
      p(
        "secao:Últimos termos emitidos",
        "Passo 4. Baixe ou reimprima",
        "Os termos mais recentes de todas as caixas. Reemitir cria uma nova versão; as anteriores continuam aqui e na caixa.",
      ),
    ],
  },
  "/operacoes/energia/contas": {
    versao: 2,
    passos: [
      abertura(
        "Contas de energia",
        "As faturas da Energisa das unidades em nome da ARP (área comum): consumo, gasto e quanto a energia solar compensou. Tudo vem da importação dos PDFs das faturas; sem importação, a tela fica vazia.",
      ),
      p(
        "op-contas-importar",
        "Passo 1. Importe as faturas",
        "Quando chegarem os PDFs da Energisa, clique aqui e envie todos de uma vez. Cada fatura vira uma prévia para conferir antes de entrar.",
      ),
      p(
        "op-contas-filtros",
        "Passo 2. Escolha o mês e a unidade",
        "Abre no mês mais recente com fatura e em todas as unidades. Os filtros vão no link: quem abrir vê o mesmo recorte. <b>Limpar</b> volta ao padrão.",
      ),
      fonte(
        "<b>Passo 3.</b> De quando são os dados e o mês e a unidade em uso. Selo amarelo: faturas de exemplo.",
      ),
      cartoes(
        "<b>Passo 4.</b> Total do mês, consumo em kWh, energia compensada pela geração solar e o valor compensado.",
      ),
      p(
        "op-contas-tabela",
        "Passo 5. Fatura a fatura",
        "Uma linha por unidade: consumo, compensado, saldo de créditos, bandeira, iluminação pública, tributos, total e vencimento. Clique na unidade para ver os itens; <b>PDF</b> abre o original.",
      ),
      p(
        "op-contas-grafico",
        "Passo 6. Doze meses",
        "O consumo de cada unidade nos 12 meses até o mês escolhido. Um salto fora do padrão pede olhar a fatura.",
      ),
      p(
        "op-contas-detalhe-dados",
        "Na fatura: os dados",
        "Matrícula, referência, leitura, vencimento e totais, como impressos na fatura.",
      ),
      p(
        "op-contas-detalhe-itens",
        "Na fatura: os itens",
        "Cada item com quantidade, tarifa e tributos. Confira contra o PDF original quando o total parecer estranho.",
      ),
      exportar(),
    ],
  },
  "/operacoes/energia/solar": {
    versao: 2,
    passos: [
      abertura(
        "Energia solar",
        "Só consulta: quanto foi gerado, quanto foi compensado nas contas e quanto sobra de crédito. Os números vêm das faturas da Energisa importadas; o cadastro das usinas é da Sustentabilidade.",
      ),
      p(
        "op-solar-filtros",
        "Passo 1. Escolha o mês e a unidade",
        "Abre no mês mais recente com fatura e em todas as unidades. Escolha uma unidade para ver só o crédito dela.",
      ),
      fonte(
        "<b>Passo 2.</b> De quando são os dados e o mês escolhido. Sem fonte de geração cadastrada em Parâmetros, a tela mostra só a compensação.",
      ),
      cartoes(
        "<b>Passo 3.</b> Geração do mês, compensado nas contas, valor compensado e saldo de créditos.",
      ),
      p(
        "op-solar-grafico",
        "Passo 4. Geração × compensação",
        "Os 12 meses até o mês escolhido. Compensação muito abaixo da geração quer dizer crédito acumulando.",
      ),
      p(
        "op-solar-creditos",
        "Passo 5. Onde o crédito foi usado",
        "Por unidade, a origem do crédito e o mês em que foi gerado.",
      ),
      p(
        "op-solar-saldos",
        "Passo 6. Nada pode expirar",
        "Saldo acumulado por unidade e o que expira no próximo ciclo, como impresso na fatura. A meta é zero a expirar: se aparecer valor, avise quem cuida das usinas.",
      ),
      exportar(),
    ],
  },

  // -------------------------------------------------------------------------
  // Rateio da limpeza
  // -------------------------------------------------------------------------
  "/operacoes/limpeza": {
    versao: 1,
    passos: [
      abertura(
        "Rateio da limpeza",
        "O custo da limpeza contratada dividido entre a área comum e os blocos, igual à planilha, com a memória de cálculo de cada valor. O mês é lançado aqui (os antigos vêm da planilha, em Importações) e, fechado, segue para o Financeiro.",
      ),
      p(
        "op-limpeza-novo-mes",
        "Passo 1. Abra o mês",
        "<b>Novo mês</b> começa copiando o mês anterior (o mais comum) ou do zero, com os padrões de Parâmetros. Para ver outro mês, troque no seletor ao lado.",
      ),
      p(
        "op-limpeza-situacao",
        "Passo 2. Veja a situação",
        "Aberto ou fechado, se já foi enviado ao Financeiro e o prazo do envio (dia útil definido em Parâmetros).",
      ),
      p(
        "op-limpeza-dados",
        "Passo 3. Lance os dados",
        "Valor base do contrato, funcionários da base, da área comum e rateados, o apontamento de minutos da empresa e os extras da área comum.",
      ),
      p(
        "op-limpeza-resultado",
        "Passo 4. Ajuste os minutos",
        "Minutos por dia de limpeza e de manutenção de cada local. Participação e valor se refazem a cada tecla. O ícone de documento baixa o demonstrativo do bloco.",
      ),
      p(
        "op-limpeza-salvar",
        "Passo 5. Salve",
        "Grava o que mudou. Sem salvar, o mês não fecha.",
      ),
      p(
        "cartao:Conferência com o contrato",
        "Passo 6. Confira com o contrato",
        "Verde: o total do rateio bate com os itens de limpeza do contrato (marcados em Composição do contrato). Vermelho: falta valor ou a conta não fecha.",
      ),
      p(
        "op-limpeza-memoria",
        "Passo 7. A memória de cálculo",
        "Cada passo da conta, com a fórmula e os números do mês. Clique em qualquer valor da tela para ver de onde veio. É o que sai no demonstrativo.",
      ),
      p(
        "op-limpeza-fechar",
        "Passo 8. Feche o mês",
        "Trava o mês e registra quem fechou. Só libera com tudo salvo e sem pendência na conta.",
      ),
      p(
        "op-limpeza-enviar",
        "Passo 9. Envie ao Financeiro",
        "Gera o resultado por bloco em PDF e Excel, guarda nos anexos do mês e avisa quem cuida do faturamento. Fica registrado quem enviou e quando.",
      ),
      p(
        "op-limpeza-demonstrativo",
        "Passo 10. Demonstrativo",
        "O PDF com a conta do mês, para responder ao locatário que pergunta o valor.",
      ),
      p(
        "op-limpeza-reabrir",
        "Precisa mudar?",
        "Reabrir pede um motivo e desfaz o envio ao Financeiro, se houve.",
      ),
      p(
        "op-limpeza-anexos",
        "Anexos do mês",
        "Anexe a medição ou nota da empresa e o apontamento de minutos: ficam junto do mês, com os envios ao Financeiro.",
      ),
      p(
        "op-limpeza-historico",
        "Histórico dos meses",
        "Cada mês como foi calculado, com a situação, a conferência e o envio. Mês importado sem minutos entra aberto e incompleto, para lançar o que falta.",
      ),
    ],
  },

  // -------------------------------------------------------------------------
  // Obras
  // -------------------------------------------------------------------------
  "/operacoes/obras": {
    versao: 1,
    passos: [
      abertura(
        "Obras · previsto e realizado",
        "O desembolso de cada obra: o previsto na planilha de orçamento contra o realizado lançado, mês a mês. A obra entra pela importação da planilha de orçamento; avanço físico e relatórios ficam no Diário de Obra.",
      ),
      p(
        "op-obras-importar-botao",
        "Passo 1. Importe o orçamento",
        "Envie a planilha de estimativa de custo e desembolso como veio. Cada planilha nova da mesma obra vira uma revisão (R00, R01…); a anterior fica guardada.",
      ),
      filtros(
        "<b>Passo 2.</b> Escolha a situação e o mês de referência: o ritmo é medido até ele.",
      ),
      cartoes(
        "<b>Passo 3.</b> Orçado nas revisões vigentes, realizado acumulado e quantas obras estão fora do ritmo ou com estouro. Clique num cartão para filtrar.",
      ),
      p(
        "op-obras-cartao",
        "Passo 4. Abra a obra",
        "Revisão vigente, orçado, realizado, % executado e o ritmo (realizado ÷ previsto até o mês). Fora do limite de Parâmetros, fica em alerta. Clique para abrir.",
      ),
      p(
        "op-obras-curva",
        "Na obra: a curva",
        "Previsto da revisão e realizado lançado, acumulados mês a mês. Realizado abaixo da linha é desembolso atrasado; acima, adiantado ou estouro.",
      ),
      p(
        "op-obras-ritmo",
        "Na obra: o ritmo",
        "Realizado contra previsto até o mês de referência, com o limite de desvio de Parâmetros.",
      ),
      p(
        "op-obras-por-etapa",
        "Na obra: por etapa",
        "Previsto contra realizado de cada etapa. Estouro é o realizado acima do previsto além da tolerância de Parâmetros.",
      ),
      p(
        "aba:Mês a mês",
        "Na obra: mês a mês",
        "Uma linha por etapa e uma coluna por mês, com previsto, realizado e totais. Use o período nos filtros para encurtar.",
      ),
      p(
        "op-obras-lancar",
        "Na obra: lance o realizado",
        "<b>Lançar realizado</b> com a etapa, o mês, o valor pago e a nota ou medição anexa. O que veio da planilha só aparece: sai desfazendo a importação.",
      ),
      p(
        "op-obras-comparacao",
        "Na obra: revisões",
        "Duas revisões lado a lado, etapa por etapa, com a diferença. Desfazer a importação em Operações › Importações volta à revisão anterior.",
      ),
      p(
        "op-obras-editar",
        "Na obra: ligue ao Diário",
        "Em <b>Dados da obra</b>, escolha a obra correspondente no Diário de Obra: o painel junta desembolso e avanço físico da mesma obra.",
      ),
    ],
  },

  // -------------------------------------------------------------------------
  // Diário de Obra
  // -------------------------------------------------------------------------
  "/operacoes/diario": {
    versao: 1,
    passos: [
      abertura(
        "Diário de Obra",
        "Obras, prazos, avanço físico e relatórios lançados no aplicativo Diário de Obra. Só consulta: tudo é lançado e aprovado no aplicativo e chega aqui sozinho. Sem o token da API em Administração › Integrações, a tela fica vazia.",
      ),
      p(
        "op-diario-atualizar",
        "Passo 1. De quando são os dados",
        "A última consulta que deu certo. A consulta é automática, no intervalo de Parâmetros; <b>Atualizar agora</b> busca na hora.",
      ),
      filtros(
        "<b>Passo 2.</b> Filtre por status da obra, grupo e responsável.",
      ),
      cartoes(
        "<b>Passo 3.</b> Obras em andamento, prazo vencido, avanço físico médio e relatórios a aprovar no aplicativo. A meta é nenhuma obra com prazo vencido.",
      ),
      p(
        "op-diario-obras",
        "Passo 4. Obra a obra",
        "Prazo, decorrido, avanço físico, prazo consumido, desvio e dias sem relatório. Clique para abrir a obra.",
      ),
      p(
        "op-diario-avanco-prazo",
        "Passo 5. Avanço × prazo",
        "Duas barras por obra, na mesma escala. Avanço físico abaixo do prazo consumido é atraso.",
      ),
      p(
        "op-diario-alertas",
        "Passo 6. Alertas",
        "Prazo vencido, desvio abaixo do limite de Parâmetros, dia sem relatório e obra paralisada. Abra a obra para entender o motivo.",
      ),
      p(
        "op-diario-cronograma",
        "Na obra: o cronograma",
        "Etapas e tarefas com o percentual do último relatório. Clique numa tarefa para ver como ela evoluiu.",
      ),
      p(
        "aba:Ocorrências",
        "Na obra: entenda o atraso",
        "As ocorrências dos relatórios do período, com os tipos marcados, a tarefa e as fotos. É onde aparece o motivo de uma obra atrasada.",
      ),
      p(
        "op-diario-efetivo",
        "Na obra: efetivo e clima",
        "Quantas pessoas trabalharam em cada dia de relatório e como estava o tempo.",
      ),
      p(
        "op-diario-galeria",
        "Na obra: fotos",
        "As fotos dos relatórios do período. Abrem do aplicativo, numa aba nova.",
      ),
      p(
        "op-diario-tarefa-grafico",
        "Na tarefa",
        "O percentual ao longo dos relatórios em que a tarefa aparece. Percentual parado por dias seguidos é sinal de problema.",
      ),
    ],
  },
  "/operacoes/diario/relatorios": {
    versao: 1,
    passos: [
      abertura(
        "Relatórios do Diário de Obra",
        "Os relatórios diários lançados no aplicativo, com os mesmos filtros da API. Só consulta: aprovar e corrigir é no aplicativo.",
      ),
      filtros(
        "<b>Passo 1.</b> Período, obra, status, modelo e autor do relatório.",
      ),
      cartoes(
        "<b>Passo 2.</b> Relatórios no período e quantos estão preenchendo, a revisar e aprovados. Preenchendo e Revisar esperam aprovação no aplicativo.",
      ),
      p(
        "op-diario-relatorios",
        "Passo 3. A lista",
        "Do mais novo para o mais antigo, com efetivo, clima, ocorrências e fotos. Clique no número para abrir o relatório completo.",
      ),
      p(
        "secao:Relatórios por obra",
        "Passo 4. Quem está lançando",
        "Relatórios por obra e, ao lado, por autor. Obra sem relatório em dia que conta vira alerta no painel.",
      ),
      p(
        "op-diario-relatorio",
        "No relatório: o dia",
        "Horário, clima, mão de obra, equipamentos, atividades, ocorrências, material, comentários e fotos, como lançados no aplicativo.",
      ),
      p(
        "op-diario-pdf",
        "No relatório: PDF",
        "O PDF gerado pelo aplicativo, para mandar ao cliente da obra.",
      ),
      p(
        "op-diario-atualizar",
        "Atualizar",
        "Relatório lançado agora no aplicativo? <b>Atualizar agora</b> busca sem esperar a consulta automática.",
      ),
      exportar(),
    ],
  },

  // -------------------------------------------------------------------------
  // Importações e Parâmetros
  // -------------------------------------------------------------------------
  "/operacoes/importacoes": {
    versao: 1,
    passos: [
      abertura(
        "Importações",
        "Toda entrada de arquivo do módulo passa por aqui: água, faturas da Energisa, orçamento de obra e o histórico do rateio da limpeza. Sempre os mesmos três passos, sem editar o arquivo.",
      ),
      p(
        "op-importacoes-etapas",
        "Passo 1. Os três passos",
        "<b>Enviar</b> os arquivos como chegaram, <b>conferir a prévia</b> (o que foi lido e os avisos) e <b>confirmar</b>. Antes de confirmar, nada aparece nas telas.",
      ),
      p(
        "op-importacoes-nova",
        "Passo 2. Nova importação",
        "Escolha o tipo e envie. Só aparecem os tipos que você tem permissão de importar.",
      ),
      p(
        "op-importacoes-filtros",
        "Passo 3. Ache uma importação",
        "Filtre por tipo e situação.",
      ),
      p(
        "op-importacoes-historico",
        "Passo 4. O histórico",
        "Quando, tipo, mês de referência, arquivos, resultado (bate ou não com o resumo do arquivo), avisos e quem importou. O olho abre o detalhe.",
      ),
      p(
        "op-importacoes-desfazer",
        "Passo 5. Desfazer",
        "Importou o arquivo errado? <b>Desfazer</b> tira os dados daquele arquivo das telas (na obra, volta à revisão anterior). Prévia não confirmada: <b>Descartar prévia</b>.",
      ),
      p(
        "secao:Conciliação em reais",
        "No detalhe: a conciliação",
        "Soma das linhas lidas contra o resumo do arquivo, bloco a bloco. A diferença mostra onde está o problema.",
      ),
      p(
        "secao:Avisos das conferências",
        "No detalhe: os avisos",
        "Erros impedem confirmar sem motivo; avisos e informações só pedem conferência.",
      ),
      p(
        "secao:Arquivos enviados",
        "No detalhe: os arquivos",
        "Os arquivos como foram recebidos, para baixar de novo. O link vale 10 minutos.",
      ),
    ],
  },
  "/operacoes/importacoes/nova": {
    versao: 1,
    passos: [
      abertura(
        "Nova importação",
        "Escolha o tipo e envie os arquivos como recebeu. Nada entra nos dados antes de você conferir a prévia e confirmar. Abra este guia de novo na prévia para ver o que conferir.",
      ),
      p(
        "op-importacoes-tipo",
        "Passo 1. Escolha o tipo",
        "<b>Água</b>: planilhas (ou PDFs) dos blocos e fotos dos visores. <b>Faturas da Energisa</b>: os PDFs da área comum. <b>Orçamento de obra</b>: a planilha de custo e desembolso. <b>Rateio da limpeza</b>: a planilha antiga, uma aba por mês.",
      ),
      p(
        "op-agua-arquivos",
        "Passo 2. Envie",
        "Arraste todas as planilhas do mês e as fotos dos visores de uma vez e clique em <b>Ler arquivos</b>.",
      ),
      p(
        "op-contas-enviar",
        "Passo 2. Envie",
        "Escolha os PDFs das faturas, todos de uma vez. Cada PDF vira uma prévia.",
      ),
      p(
        "op-obras-importar",
        "Passo 2. Envie",
        "Escolha a planilha e a obra (ou deixe identificar pela planilha). Se o mês do cabeçalho estiver fora de ordem, o sistema pede o mês certo.",
      ),
      p(
        "op-limpeza-importar",
        "Passo 2. Envie",
        "Envie a planilha do rateio como veio. Cada aba é lida e a conta é refeita para comparar com a da planilha.",
      ),
      p(
        "op-agua-previa",
        "Passo 3. Confira a prévia",
        "Linhas e somas contra o resumo de cada arquivo. Verde: bate. Vermelho: peça o arquivo certo ao parceiro.",
      ),
      p(
        "op-contas-conferencia",
        "Passo 3. Confira a fatura",
        "Os itens precisam somar o total da fatura. Matrícula sem cadastro pede a unidade logo abaixo antes de confirmar.",
      ),
      p(
        "op-agua-confirmar",
        "Passo 4. Confirme",
        "Bateu: confirme. Não bateu: confirme só com o motivo, e o mês fica marcado incompleto até ser reimportado.",
      ),
      p(
        "op-contas-confirmar",
        "Passo 4. Confirme",
        "A fatura entra em Contas de energia e em Energia solar. Faça o mesmo em cada prévia da lista.",
      ),
      p(
        "op-obras-confirmar",
        "Passo 4. Confirme",
        "O orçamento vira a revisão vigente da obra; a anterior continua guardada.",
      ),
      p(
        "op-limpeza-importar-confirmar",
        "Passo 4. Confirme",
        "Os meses completos entram fechados, como foram calculados; os com erro ou sem minutos entram abertos e incompletos, para lançar o que falta.",
      ),
    ],
  },
  "/operacoes/parametros": {
    versao: 2,
    passos: [
      abertura(
        "Parâmetros de Operações",
        "Tudo o que pode mudar sem programação: limites dos alertas, listas do cadastro, dados do termo, contrato da limpeza e consulta ao Diário de Obra. Toda alteração fica registrada com quem, quando, o antes e o depois.",
      ),
      abas(
        "<b>Passo 1.</b> Escolha o grupo. <b>Água</b>: limites dos alertas e modelo da planilha. <b>Energia · termo</b>: dados da ARP e textos do termo. <b>Energia · quadros</b>: listas da caixa. <b>Energia · contas e solar</b>: alerta das faturas e unidades. <b>Limpeza</b>: contrato, funcionários, extras e prazo do envio. <b>Obras</b>: consulta ao Diário e limites de desvio.",
      ),
      p(
        "op-parametros-agua",
        "Passo 2. Altere e salve",
        "Limite de consumo, variação contra a média, blocos e o modelo de colunas da planilha do parceiro. Mude o valor e clique em <b>Salvar</b>: vale dali em diante nas telas e nos alertas. Fora dos limites, a tela diz o que corrigir.",
      ),
      p(
        "op-parametros-termo",
        "Passo 2. Altere e salve",
        "Razão social, CNPJ, endereço e os textos do termo de energia. Mude o valor e clique em <b>Salvar</b>: vale dali em diante nas telas e nos alertas. Fora dos limites, a tela diz o que corrigir.",
      ),
      p(
        "op-parametros-quadros",
        "Passo 2. Altere e salve",
        "Listas de disjuntores, ligações e situações do medidor usadas no cadastro da caixa. Mude o valor e clique em <b>Salvar</b>: vale dali em diante nas telas e nos alertas. Fora dos limites, a tela diz o que corrigir.",
      ),
      p(
        "op-parametros-contas",
        "Passo 2. Altere e salve",
        "Percentual de alerta das faturas e a fonte da geração solar. Mude o valor e clique em <b>Salvar</b>: vale dali em diante nas telas e nos alertas. Fora dos limites, a tela diz o que corrigir.",
      ),
      p(
        "op-parametros-limpeza",
        "Passo 2. Altere e salve",
        "Empresa, funcionários da base, área comum e rateados, blocos, extras padrão e o dia útil limite do envio ao Financeiro. Mude o valor e clique em <b>Salvar</b>: vale dali em diante nas telas e nos alertas. Fora dos limites, a tela diz o que corrigir.",
      ),
      p(
        "op-parametros-obras",
        "Passo 2. Altere e salve",
        "Limites de desvio do orçamento e do avanço físico, dias que contam para o relatório e o intervalo da consulta ao Diário de Obra. Mude o valor e clique em <b>Salvar</b>: vale dali em diante nas telas e nos alertas. Fora dos limites, a tela diz o que corrigir.",
      ),
      p(
        "secao:Últimas alterações deste grupo",
        "Passo 3. Confira o que mudou",
        "Quem alterou, quando, o antes e o depois, só deste grupo.",
      ),
      p(
        "op-parametros-unidades",
        "Unidades consumidoras",
        "Matrícula da Energisa, endereço, apelido e o papel na geração solar. Fatura de matrícula sem cadastro não é confirmada.",
      ),
      p(
        "op-parametros-token-diario",
        "Token do Diário de Obra",
        "Fica em Administração › Integrações, guardado cifrado. Sem ele, as telas do Diário de Obra ficam vazias.",
      ),
      p(
        "aba:Histórico",
        "Passo 4. Histórico completo",
        "Todas as alterações de todos os grupos, da mais nova para a mais antiga.",
      ),
      p(
        "op-parametros-remover-exemplos",
        "Passo 5. Quando os dados reais entrarem",
        "Remove os dados fictícios de exemplo de todas as telas. As obras de exemplo do Diário de Obra saem sozinhas na primeira consulta real.",
      ),
    ],
  },
};
