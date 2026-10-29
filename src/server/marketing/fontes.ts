import "server-only";
import { cache } from "react";
import { contextoMkt, locatarios, temasEcodigos } from "./base";
import { type DadosAnuncios, gerarAnuncios } from "./exemplo/anuncios";
import { type DadosAsana, gerarAsana } from "./exemplo/asana";
import { type DadosRd, gerarRd } from "./exemplo/rd";
import { type DadosRedes, gerarRedes } from "./exemplo/redes";
import { type DadosReputacao, gerarReputacao } from "./exemplo/reputacao";
import { type DadosSite, gerarSite } from "./exemplo/site";
import { memo } from "./exemplo/sorteio";
import { rdReal } from "./rd";

// Dados das ferramentas. Nesta fase (mockup, spec seção 6) são de exemplo,
// montados nos campos das APIs (lib/marketing/fontes.ts) e iguais para
// todos; na V3 cada função passa a ler o que a sincronização diária gravou,
// com o mesmo formato de saída. As telas conferem a permissão (Protegido)
// antes de chamar; nada daqui vai para o navegador sem passar pela tela.

export const FONTE_EXEMPLO =
  "Dados de exemplo (mockup) nos campos das APIs; a ligação real entra na V3.";

const anunciosDoDia = memo(gerarAnuncios);
const rdDoDia = memo((hoje) => gerarRd(hoje, anunciosDoDia(hoje)));
const siteDoDia = memo((hoje) => gerarSite(hoje, anunciosDoDia(hoje)));
const redesDoDia = memo(gerarRedes);
const asanaDoDia = memo(gerarAsana);
const reputacaoDoDia = memo((chave) => {
  const { hoje, locais, temas } = JSON.parse(chave) as {
    hoje: string;
    locais: Parameters<typeof gerarReputacao>[1];
    temas: string[];
  };
  return gerarReputacao(hoje, locais, temas);
});

async function hoje() {
  return (await contextoMkt()).hoje;
}

/** Meta Ads, Google Ads e TikTok Ads, dia a dia. */
export const dadosAnuncios = cache(
  async (): Promise<DadosAnuncios> => anunciosDoDia(await hoje()),
);

/**
 * RD Station: contatos, conversões e landing pages. Os reais (com lidoEm)
 * depois da primeira sincronização; antes dela, os de exemplo.
 */
export const dadosRd = cache(
  async (): Promise<DadosRd> => (await rdReal()) ?? rdDoDia(await hoje()),
);

/**
 * O RD de exemplo que casa com os anúncios de exemplo (traffic_campaign =
 * nome da campanha): custo por lead e leads por campanha continuam de
 * exemplo até os anúncios serem reais. Leads reais com investimento de
 * exemplo dariam um custo por lead que não existe.
 */
export const dadosRdDosAnuncios = cache(
  async (): Promise<DadosRd> => rdDoDia(await hoje()),
);

/** Google Analytics 4 e Search Console. */
export const dadosSite = cache(
  async (): Promise<DadosSite> => siteDoDia(await hoje()),
);

/** Instagram, Facebook, YouTube e TikTok (contas da ARP). */
export const dadosRedes = cache(
  async (): Promise<DadosRedes> => redesDoDia(await hoje()),
);

/** Asana: projetos e tarefas (time, calendário e ronda). */
export const dadosAsana = cache(
  async (): Promise<DadosAsana> => asanaDoDia(await hoje()),
);

/**
 * Google Perfil da Empresa: a ARP e os locatários ativos de Configurações, com
 * o tema de cada avaliação na lista cadastrada.
 */
export const dadosReputacao = cache(async (): Promise<DadosReputacao> => {
  const [h, lista, { temas }] = await Promise.all([
    hoje(),
    locatarios(),
    temasEcodigos(),
  ]);
  return reputacaoDoDia(
    JSON.stringify({
      hoje: h,
      locais: lista
        .filter((l) => l.ativo)
        .map((l) => ({
          id: l.id,
          nome: l.nome,
          forma_acesso: l.forma_acesso,
          perfil_url: l.perfil_url,
        })),
      temas: temas.filter((t) => t.ativo).map((t) => t.nome),
    }),
  );
});
