"use server";

import { refresh } from "next/cache";
import type { EstadoAcao } from "@/components/form-acao";
import { separarReais } from "@/lib/sustentabilidade/painel-montagem";
import {
  esquemaDoAno,
  esquemaReabertura,
} from "@/lib/sustentabilidade/painel-parametros";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { podeAgora } from "@/server/auth";
import { contextoSu, su } from "../base";
import { dadosDoPainel } from "../painel";
import { logarSustentabilidade } from "../parametros";

// Fechar e reabrir o ano no Painel (spec 4.9). O spec não diz quem fecha: aqui
// exige "Parâmetros" (a confirmar com a área), e o RLS confere de novo. Fechar
// grava os totais do ano em consolidados (e os reais em consolidado_valores,
// só com "Ver valores"); mudança de lançamento depois disso vira aviso no
// painel, sem mudar o consolidado, até alguém reabrir com motivo.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para fechar ou reabrir o ano. Peça a permissão de Parâmetros ao administrador.",
};

const ROTULOS = { ano: "Ano", motivo: "Motivo" };

export async function fecharAno(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaDoAno.safeParse({ ano: form.get("ano") });
  if (!e.success) return primeiroErro(e.error, ROTULOS);
  const { ano } = e.data;
  if (!(await podeAgora("sustentabilidade.parametros"))) return SEM_PERMISSAO;
  if (!(await podeAgora("sustentabilidade.painel")))
    return {
      erro: "Para fechar o ano é preciso ver o Painel, que calcula os totais. Peça a permissão do Painel ao administrador.",
    };
  const ctx = await contextoSu();
  if (ano > Number(ctx.hoje.slice(0, 4)))
    return { erro: `${ano} ainda não começou. Não há o que fechar.` };

  const db = await su();
  const existente = await db
    .from("consolidados")
    .select("situacao")
    .eq("ano", ano)
    .maybeSingle();
  if (existente.error) return erroDoBanco(existente.error);
  if (existente.data?.situacao === "fechado")
    return {
      erro: `${ano} já está fechado. Para mudar os totais, reabra o ano com o motivo.`,
    };

  // Os totais de hoje, do ano inteiro (12 meses), calculados como no painel.
  const dados = await dadosDoPainel({ ano, ateMes: 12, comparar: false });
  if (dados.operacoesIndisponivel)
    return {
      erro: "Não consegui ler a energia e a água de Operações agora. Tente de novo em alguns minutos: o fechamento não grava totais incompletos.",
    };
  const totais = dados.aoVivo.get(ano) ?? {};
  const { semReais, reais } = separarReais(totais);

  const agora = new Date().toISOString();
  const gravar = existente.data
    ? await db
        .from("consolidados")
        .update({
          totais: semReais,
          situacao: "fechado",
          fechado_por: ctx.usuario.id,
          fechado_em: agora,
          reaberto_por: null,
          reaberto_em: null,
          reaberto_motivo: null,
        })
        .eq("ano", ano)
        .select("ano")
    : await db
        .from("consolidados")
        .insert({ ano, totais: semReais, fechado_por: ctx.usuario.id })
        .select("ano");
  if (gravar.error) return erroDoBanco(gravar.error);
  if (!gravar.data?.length) return SEM_PERMISSAO;

  // Totais em reais: só com "Ver valores" (o RLS também exige).
  const comValores = await podeAgora("sustentabilidade.valores");
  if (comValores) {
    const v = await db
      .from("consolidado_valores")
      .upsert({ ano, totais: reais }, { onConflict: "ano" });
    if (v.error) return erroDoBanco(v.error);
  }

  refresh();
  await logarSustentabilidade(
    "sustentabilidade_ano_fechado",
    `Fechou o ano ${ano} no Painel de Sustentabilidade`,
    { ano },
  );
  return {
    ok: comValores
      ? `${ano} fechado. Os totais ficaram gravados.`
      : `${ano} fechado. Os totais em reais não foram gravados porque você não tem a permissão de ver valores.`,
  };
}

export async function reabrirAno(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaReabertura.safeParse({
    ano: form.get("ano"),
    motivo: form.get("motivo"),
  });
  if (!e.success) return primeiroErro(e.error, ROTULOS);
  const { ano, motivo } = e.data;
  if (!(await podeAgora("sustentabilidade.parametros"))) return SEM_PERMISSAO;
  const ctx = await contextoSu();
  const { data, error } = await (await su())
    .from("consolidados")
    .update({
      situacao: "reaberto",
      reaberto_por: ctx.usuario.id,
      reaberto_em: new Date().toISOString(),
      reaberto_motivo: motivo,
    })
    .eq("ano", ano)
    .eq("situacao", "fechado")
    .select("ano");
  if (error) return erroDoBanco(error);
  if (!data?.length)
    return { erro: `${ano} não está fechado. Atualize a página.` };
  refresh();
  await logarSustentabilidade(
    "sustentabilidade_ano_reaberto",
    `Reabriu o ano ${ano} no Painel de Sustentabilidade`,
    { ano, motivo },
  );
  return {
    ok: `${ano} reaberto. Os totais voltam a seguir os lançamentos até fechar de novo.`,
  };
}
