import type { Passo } from "./tipos";

// Passos que se repetem de tela em tela. Cada tela pode trocar o texto para
// dizer o que aquele filtro, cartão ou tabela tem de próprio. O texto aceita
// <b> para destacar; é conteúdo fixo do sistema, nunca dado de usuário.

export const abertura = (titulo: string, texto: string): Passo => ({
  titulo,
  texto,
});

export const filtros = (
  texto = "Escolha o período e os recortes. A tela recalcula na hora, e o filtro fica no endereço: mande o link e a outra pessoa vê o mesmo recorte. O sistema também lembra o último filtro da próxima vez que você voltar.",
): Passo => ({ alvo: "filtros", titulo: "Filtros", texto });

export const fonte = (
  texto = "Quando os dados foram lidos e de onde vêm. Selo <b>verde</b>: dado real da ferramenta. Selo <b>amarelo</b>: dado de exemplo (fictício), até a integração ser ligada. Abaixo, a linha com os filtros em uso.",
): Passo => ({ alvo: "fonte", titulo: "De onde vêm os números", texto });

export const exportar = (
  texto = "Baixe a tela em Excel ou PDF, já com os filtros em uso escritos no arquivo. Só aparece para quem tem a permissão de exportar.",
): Passo => ({ alvo: "exportar", titulo: "Exportar", texto });

export const cartoes = (
  texto = "Os números principais do período. O selo mostra a situação contra a meta e, abaixo do valor, vem a comparação com o período anterior. O <b>i</b> do título explica o cálculo; clique no cartão para ver a lista que forma o número.",
): Passo => ({ alvo: "cartoes", titulo: "Indicadores", texto });

export const abas = (
  texto = "A tela se divide em abas. Trocar de aba mantém os filtros.",
): Passo => ({ alvo: "abas", titulo: "Abas", texto });

export const secao = (
  texto = "Cada bloco responde a uma pergunta. O ícone <b>i</b> ao lado do título explica o cálculo e a fonte; o alerta indica o que ainda é de exemplo.",
): Passo => ({ alvo: "secao", titulo: "Blocos da tela", texto });

export const dica = (): Passo => ({
  alvo: "dica",
  titulo: "Como é calculado",
  texto:
    "Passe o mouse (ou toque) neste ícone para ver a fórmula e a fonte do número. Vale para qualquer ícone igual no sistema.",
});

export const busca = (
  texto = "Digite parte de um nome, código ou documento para filtrar a lista.",
): Passo => ({ alvo: "busca", titulo: "Busca", texto });

export const tabela = (
  texto = "Os dados linha a linha. Quando a linha abre um detalhe, o cursor vira mãozinha ao passar o mouse.",
): Passo => ({ alvo: "tabela", titulo: "Lista", texto });

/** Primeira visita ao módulo: as telas dele no menu. */
export const menuDoModulo = (texto: string): Passo => ({
  alvo: "menu-modulo",
  titulo: "Telas deste módulo",
  texto,
});

export const buscaDeTelas = (): Passo => ({
  alvo: "busca-telas",
  titulo: "Ir direto para uma tela",
  texto:
    "Digite o nome de qualquer tela e aperte Enter. Atalho: <b>Ctrl K</b>, de qualquer lugar do sistema.",
});

/** Último passo de todo guia: onde reabrir. */
export const encerramento: Passo = {
  alvo: "guia",
  titulo: "Reveja quando quiser",
  texto:
    "Este botão abre o guia da tela em que você estiver. Atalho: tecla <b>?</b>. Quando um guia muda, aparece um ponto verde aqui.",
};
