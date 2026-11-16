/**
 * Envia o arquivo, do navegador, para o link assinado que a API preparou
 * (infra/arquivos): PUT com o arquivo no corpo. true se chegou.
 *
 * O `fetch` em si mora em lib/api.ts (único ponto de rede da tela).
 */
export { enviarParaLink } from "./api";
