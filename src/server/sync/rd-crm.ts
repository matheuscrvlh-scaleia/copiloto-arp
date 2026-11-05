import "server-only";
import { mensagemSegura } from "@/connectors/http";
import {
  createRdCrmClient,
  type ItemRdCrm,
  renovarRdCrm,
} from "@/connectors/rd-crm";
import {
  type CadastrosRdCrm,
  oportunidadesDoCrm,
} from "@/lib/comercial/rd-crm";
import {
  INTEGRACOES,
  juntarSegredos,
  separarSegredos,
} from "@/lib/integracoes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { cifrar } from "../cofre";
import { credencialEmUso, IntegracaoNaoConfigurada } from "../integracoes";
import { emLotes, executar } from "./execucao";

// Sincronização do RD Station CRM (só leitura): renova o acesso, guarda o
// novo refresh token na hora (o antigo para de valer) e regrava todas as
// oportunidades em comercial.rd_oportunidades. Roda todo dia pelo cron, o que
// também impede o refresh token de vencer (14 dias sem uso).

const SISTEMA = "rd_crm";
const RECURSO = "oportunidades";

export async function sincronizarRdCrm() {
  const def = INTEGRACOES[SISTEMA];
  const c = await credencialEmUso(SISTEMA);
  const p = def.parametros.parse(c.parametros);
  const s = separarSegredos(def, c.segredo);
  if (!s.client_secret || !s.refresh_token)
    throw new IntegracaoNaoConfigurada(
      SISTEMA,
      "falta clicar em Conectar com o RD Station CRM",
    );
  const admin = createAdminClient();

  return executar(admin, SISTEMA, RECURSO, async () => {
    const app = {
      clientId: String(p.client_id),
      clientSecret: s.client_secret as string,
    };
    const tokens = await renovarRdCrm({
      ...app,
      refreshToken: s.refresh_token as string,
    });
    const guardado = await admin
      .schema("integracao")
      .from("credenciais")
      .update({
        segredo_cifrado: cifrar(
          juntarSegredos(def, { ...s, refresh_token: tokens.refresh_token }),
          SISTEMA,
        ),
      })
      .eq("sistema", SISTEMA);
    if (guardado.error)
      throw new Error(
        `o RD renovou o acesso, mas não deu para guardar: conecte de novo (${guardado.error.message})`,
      );

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

    const db = admin.schema("comercial");
    const agora = new Date().toISOString();
    for (const lote of emLotes(linhas, 500)) {
      const r = await db.from("rd_oportunidades").upsert(
        lote.map((l) => ({
          id: l.id,
          dados: l.dados as unknown as Json,
          contatos: l.contatos as unknown as Json,
          atualizado_em: agora,
        })),
      );
      if (r.error) throw r.error;
    }
    // Apagadas no RD: tudo que esta leitura não regravou.
    const antigas = await db
      .from("rd_oportunidades")
      .delete()
      .lt("atualizado_em", agora);
    if (antigas.error) throw antigas.error;

    return {
      registros: linhas.length,
      cursor: { funis: funis.length, oportunidades: linhas.length, avisos },
    };
  });
}
