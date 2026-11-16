import {
  type CadastrosRdCrm,
  oportunidadesDoCrm,
} from "@arp/shared/comercial/rd-crm";
import {
  INTEGRACOES,
  juntarSegredos,
  separarSegredos,
} from "@arp/shared/integracoes";
import { mensagemSegura } from "@/connectors/http";
import {
  createRdCrmClient,
  type ItemRdCrm,
  renovarRdCrm,
} from "@/connectors/rd-crm";
import { banco } from "@/infra/banco";
import {
  credencialEmUso,
  IntegracaoNaoConfigurada,
  trocarSegredo,
} from "./credenciais.service";
import { emLotes, executar } from "./execucao.service";
import * as repo from "./rd-crm.repository";

// Sincronização do RD Station CRM (só leitura): renova o acesso, guarda o
// novo refresh token na hora (o antigo para de valer) e regrava todas as
// oportunidades em comercial.rd_oportunidades. Roda todo dia pela rotina, o
// que também impede o refresh token de vencer (14 dias sem uso).

const SISTEMA = "rd_crm";
const RECURSO = "oportunidades";

export async function sincronizarRdCrm() {
  const def = INTEGRACOES[SISTEMA];
  const c = await credencialEmUso(SISTEMA);
  const p = def.parametros.parse(c.parametros);
  const s = separarSegredos(def, c.segredo);
  const clientSecret = s.client_secret;
  const refreshToken = s.refresh_token;
  if (!clientSecret || !refreshToken)
    throw new IntegracaoNaoConfigurada(
      SISTEMA,
      "falta clicar em Conectar com o RD Station CRM",
    );

  return executar(SISTEMA, RECURSO, async () => {
    const tokens = await renovarRdCrm({
      clientId: String(p.client_id),
      clientSecret,
      refreshToken,
    });
    try {
      await trocarSegredo(
        SISTEMA,
        juntarSegredos(def, { ...s, refresh_token: tokens.refresh_token }),
      );
    } catch (erro) {
      throw new Error(
        `o RD renovou o acesso, mas não deu para guardar: conecte de novo (${erro instanceof Error ? erro.message : String(erro)})`,
      );
    }

    const api = createRdCrmClient({ accessToken: tokens.access_token });
    const avisos: string[] = [];
    /** Cadastro que falhar só deixa os nomes vazios, com aviso. */
    async function lista<T>(nome: string, ler: () => Promise<T[]>) {
      try {
        return await ler();
      } catch (erro) {
        avisos.push(`${nome}: ${mensagemSegura(erro).slice(0, 120)}`);
        return [];
      }
    }

    const funis = await api.funis();
    const etapas: ItemRdCrm[] = [];
    for (const f of funis)
      etapas.push(
        ...(await lista(`etapas de ${f.name}`, () => api.etapas(f.id))),
      );
    const cadastros: CadastrosRdCrm = {
      funis,
      etapas,
      usuarios: await lista("usuários", api.usuarios),
      fontes: await lista("fontes", api.fontes),
      campanhas: await lista("campanhas", api.campanhas),
      motivos: await lista("motivos de perda", api.motivosDePerda),
      empresas: await lista("empresas", api.empresas),
      campos: await lista("campos personalizados", api.campos),
      contatos: await lista("contatos", api.contatos),
    };
    const linhas = oportunidadesDoCrm(await api.negociacoes(), cadastros);

    const agora = new Date().toISOString();
    // Numa transação só: as antigas saem junto com a regravação.
    await banco.comoServico(async (tx) => {
      for (const lote of emLotes(linhas, 500))
        await repo.gravarOportunidades(
          tx,
          lote.map((l) => ({
            id: l.id,
            dados: JSON.stringify(l.dados),
            contatos: JSON.stringify(l.contatos),
            atualizado_em: agora,
          })),
        );
      await repo.removerAntigas(tx, agora);
    });

    return {
      registros: linhas.length,
      cursor: { funis: funis.length, oportunidades: linhas.length, avisos },
    };
  });
}
