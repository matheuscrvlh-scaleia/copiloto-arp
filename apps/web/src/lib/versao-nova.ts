// Aba aberta durante um deploy: os arquivos das telas têm o hash do conteúdo
// no nome, e os da versão anterior deixam de existir. O `import()` de uma
// tela que a aba ainda não tinha pedido falha (404). O conserto é recarregar
// a página, que busca o index.html novo; UMA vez só: se falhar de novo logo
// em seguida (arquivo faltando de verdade, rede fora), vale o limite de erro
// normal, com o botão de recarregar.

/** Onde fica a trava (por aba: some quando ela fecha). */
export const TRAVA_DA_RECARGA = "arp.recarga-por-versao";

/**
 * Por quanto tempo a trava vale. Depois disso é outro deploy (a aba ficou
 * aberta por dias) e a recarga automática volta a valer.
 */
const VALIDADE_DA_TRAVA_MS = 5 * 60_000;

// Chrome/Edge, Firefox, Safari e o aviso do próprio Vite (CSS da tela).
const FALHA_DE_MODULO =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** O erro é de um `import()` que não conseguiu baixar o arquivo? */
export function ehFalhaAoCarregarModulo(erro: unknown): boolean {
  return erro instanceof Error && FALHA_DE_MODULO.test(erro.message);
}

/** A recarga já foi pedida nesta carga da página (o navegador está saindo). */
let recarregando = false;

/**
 * Recarrega a página se isso ainda não foi tentado há pouco. true: a página
 * está recarregando (não mostre erro); false: já tentou, siga com o erro.
 */
export function recarregarUmaVez(
  recarregar: () => void = () => window.location.reload(),
): boolean {
  if (recarregando) return true;
  // Sem internet a recarga trocaria a tela pelo erro do navegador.
  if (navigator.onLine === false) return false;
  try {
    const ultima = Number(window.sessionStorage.getItem(TRAVA_DA_RECARGA));
    const agora = Date.now();
    if (ultima > 0 && agora - ultima < VALIDADE_DA_TRAVA_MS) return false;
    window.sessionStorage.setItem(TRAVA_DA_RECARGA, String(agora));
  } catch {
    // Sem onde guardar a trava não há como garantir "uma vez só".
    return false;
  }
  recarregando = true;
  recarregar();
  return true;
}

/**
 * Pede o arquivo de uma tela. Se ele não existe mais (saiu versão nova),
 * recarrega a página uma vez e segura o esqueleto até o navegador sair; na
 * segunda falha o erro segue para o limite de erro.
 */
export async function carregarTela<T>(
  pagina: () => Promise<T>,
  recarregar?: () => void,
): Promise<T> {
  try {
    return await pagina();
  } catch (erro) {
    if (ehFalhaAoCarregarModulo(erro) && recarregarUmaVez(recarregar))
      return new Promise<T>(() => undefined);
    throw erro;
  }
}

/**
 * Liga o aviso do Vite (`vite:preloadError`: todo `import()` do build que
 * falha, de tela ou de biblioteca pedida na hora do uso). Chamado uma vez,
 * em main.tsx. O erro segue o caminho normal se a recarga não couber.
 */
export function ligarRecargaPorVersaoNova(): void {
  window.addEventListener("vite:preloadError", () => {
    recarregarUmaVez();
  });
}
