import { cnpjValido, cpfValido } from "@/lib/documentos";
import {
  type DadosContrato,
  type Endereco,
  type Fiador,
  GARANTIAS,
  type Garantia,
  type PessoaFisica,
  type Representante,
  type TipoAnexo,
  temConjuge,
} from "./contrato";

// Revisão do contrato (etapa 7): tudo o que falta, etapa por etapa, para o
// contrato poder ser marcado "Pronto para gerar". Cada pendência leva ao
// campo (id do elemento na tela, idCampo). Os obrigatórios de cada garantia
// vêm dos parâmetros (obrigatorios_garantia); o resto é a qualificação que
// o contrato precisa. A etapa Documentos (6) mostra o checklist.

export interface Pendencia {
  etapa: number;
  /** id do campo na tela. */
  campo: string;
  rotulo: string;
}

export interface ContextoRevisao {
  /** { "<garantia>": ["campo", ...] } de comercial.parametros. */
  obrigatorios: Record<string, string[]>;
  /** Tipos de anexo já enviados. */
  anexos: TipoAnexo[];
}

/** id do campo na tela: idCampo("pf", "nome") → "c-pf-nome". */
export const idCampo = (...partes: (string | number)[]) =>
  `c-${partes.join("-")}`;

/** obrigatorios_garantia do banco (jsonb) num formato seguro. */
export function lerObrigatorios(bruto: unknown): Record<string, string[]> {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  return Object.fromEntries(
    Object.entries(bruto as Record<string, unknown>).map(([k, v]) => [
      k,
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [],
    ]),
  );
}

const vazio = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && !v.trim());
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

class Lista {
  readonly itens: Pendencia[] = [];
  constructor(private etapa: number) {}
  se(falta: boolean, campo: string, rotulo: string) {
    if (falta) this.itens.push({ etapa: this.etapa, campo, rotulo });
  }
  texto(v: unknown, campo: string, rotulo: string) {
    this.se(vazio(v), campo, rotulo);
  }
  endereco(e: Endereco, pre: string, de: string, completo = true) {
    if (completo) this.se(e.cep.length !== 8, idCampo(pre, "cep"), `CEP ${de}`);
    this.texto(e.logradouro, idCampo(pre, "logradouro"), `logradouro ${de}`);
    this.texto(e.numero, idCampo(pre, "numero"), `número ${de}`);
    if (completo) this.texto(e.bairro, idCampo(pre, "bairro"), `bairro ${de}`);
    this.texto(e.cidade, idCampo(pre, "cidade"), `cidade ${de}`);
    this.texto(e.uf, idCampo(pre, "uf"), `UF ${de}`);
  }
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

function imovel(d: DadosContrato): Pendencia[] {
  const l = new Lista(1);
  const i = d.imovel;
  l.se(!i.lucs.length, idCampo("imovel", "lucs"), "LUC");
  l.texto(
    i.empreendimento,
    idCampo("imovel", "empreendimento"),
    "empreendimento",
  );
  l.texto(i.bloco, idCampo("imovel", "bloco"), "bloco");
  l.texto(i.pavimento, idCampo("imovel", "pavimento"), "pavimento");
  l.texto(i.unidade, idCampo("imovel", "unidade"), "unidade / loja");
  l.se(!i.area, idCampo("imovel", "area"), "área / ABL");
  l.endereco(i.endereco, "imovel-end", "do imóvel");
  return l.itens;
}

function pessoaFisica(
  l: Lista,
  p: PessoaFisica,
  pre: string,
  de: string,
): void {
  l.texto(p.nome, idCampo(pre, "nome"), `nome ${de}`);
  l.se(!cpfValido(p.cpf), idCampo(pre, "cpf"), `CPF ${de}`);
  l.texto(p.doc_tipo, idCampo(pre, "doc_tipo"), `tipo do documento ${de}`);
  l.texto(p.doc_numero, idCampo(pre, "doc_numero"), `documento ${de}`);
  l.texto(p.orgao, idCampo(pre, "orgao"), `órgão expedidor ${de}`);
  l.texto(p.orgao_uf, idCampo(pre, "orgao_uf"), `UF do órgão ${de}`);
  l.texto(p.expedicao, idCampo(pre, "expedicao"), `data de expedição ${de}`);
  l.texto(p.nascimento, idCampo(pre, "nascimento"), `data de nascimento ${de}`);
  l.texto(
    p.nacionalidade,
    idCampo(pre, "nacionalidade"),
    `nacionalidade ${de}`,
  );
  l.texto(p.estado_civil, idCampo(pre, "estado_civil"), `estado civil ${de}`);
  l.se(!emailOk(p.email), idCampo(pre, "email"), `e-mail ${de}`);
  l.texto(p.telefone, idCampo(pre, "telefone"), `telefone ${de}`);
  l.endereco(p.endereco, `${pre}-end`, de);
}

function conjuge(
  l: Lista,
  c: DadosContrato["partes"]["conjuge"],
  pre: string,
  de: string,
): void {
  l.texto(c.nome, idCampo(pre, "nome"), `nome do cônjuge ${de}`);
  l.se(!cpfValido(c.cpf), idCampo(pre, "cpf"), `CPF do cônjuge ${de}`);
  l.texto(
    c.doc_numero,
    idCampo(pre, "doc_numero"),
    `documento do cônjuge ${de}`,
  );
  l.texto(
    c.nacionalidade,
    idCampo(pre, "nacionalidade"),
    `nacionalidade do cônjuge ${de}`,
  );
}

function representante(l: Lista, r: Representante, pre: string, de: string) {
  l.texto(r.nome, idCampo(pre, "nome"), `nome ${de}`);
  l.se(!cpfValido(r.cpf), idCampo(pre, "cpf"), `CPF ${de}`);
  l.texto(r.rg, idCampo(pre, "rg"), `RG ${de}`);
  l.texto(r.orgao, idCampo(pre, "orgao"), `órgão expedidor ${de}`);
  l.texto(r.rg_uf, idCampo(pre, "rg_uf"), `UF do RG ${de}`);
  l.texto(r.cargo, idCampo(pre, "cargo"), `cargo ${de}`);
  l.texto(
    r.nacionalidade,
    idCampo(pre, "nacionalidade"),
    `nacionalidade ${de}`,
  );
  l.texto(r.estado_civil, idCampo(pre, "estado_civil"), `estado civil ${de}`);
  l.texto(r.profissao, idCampo(pre, "profissao"), `profissão ${de}`);
  l.endereco(r.endereco, `${pre}-end`, de, false);
}

function partes(d: DadosContrato): Pendencia[] {
  const l = new Lista(2);
  const p = d.partes;
  l.texto(p.tipo, idCampo("partes", "tipo"), "tipo de parte (PF ou PJ)");
  if (p.tipo === "pf") {
    pessoaFisica(l, p.pf, "pf", "do locatário");
    if (temConjuge(p.pf.estado_civil))
      conjuge(l, p.conjuge, "cj", "do locatário");
  }
  if (p.tipo === "pj") {
    const j = p.pj;
    l.texto(j.razao_social, idCampo("pj", "razao_social"), "razão social");
    l.se(!cnpjValido(j.cnpj), idCampo("pj", "cnpj"), "CNPJ");
    l.texto(j.natureza, idCampo("pj", "natureza"), "natureza jurídica");
    l.se(
      !j.ie_isento && vazio(j.ie),
      idCampo("pj", "ie"),
      "inscrição estadual (ou isento)",
    );
    l.se(
      !j.im_nao_tem && vazio(j.im),
      idCampo("pj", "im"),
      "inscrição municipal (ou não tem)",
    );
    l.texto(j.cnae, idCampo("pj", "cnae"), "CNAE principal");
    l.texto(j.ramo, idCampo("pj", "ramo"), "ramo de atuação");
    l.se(!emailOk(j.email), idCampo("pj", "email"), "e-mail da empresa");
    l.texto(j.telefone, idCampo("pj", "telefone"), "telefone da empresa");
    l.endereco(j.endereco, "pj-end", "da empresa");
    l.se(
      !p.representantes.length,
      idCampo("rep", "adicionar"),
      "representante legal",
    );
    p.representantes.forEach((r, i) => {
      representante(l, r, `rep-${i}`, `do representante ${i + 1}`);
    });
  }
  l.texto(
    p.destinacao.atividades,
    idCampo("dest", "atividades"),
    "atividades do estabelecimento (destinação)",
  );
  return l.itens;
}

function condicoes(d: DadosContrato): Pendencia[] {
  const l = new Lista(3);
  const c = d.condicoes;
  l.se(!c.prazo, idCampo("cond", "prazo"), "prazo");
  l.se(
    c.inicio === "data_fixa" && !c.data_inicio,
    idCampo("cond", "data_inicio"),
    "data de início da vigência",
  );
  if (c.forma === "fixo")
    l.se(!c.aluguel, idCampo("cond", "aluguel"), "aluguel vigente");
  else {
    l.se(
      !c.faixas.length,
      idCampo("cond", "faixa-adicionar"),
      "faixa do aluguel percentual",
    );
    c.faixas.forEach((f, i) => {
      l.se(
        !f.a_partir_mes,
        idCampo("cond", "faixa", i, "mes"),
        `mês da faixa ${i + 1}`,
      );
      l.se(
        !f.percentual,
        idCampo("cond", "faixa", i, "percentual"),
        `percentual da faixa ${i + 1}`,
      );
      l.se(
        !f.minimo,
        idCampo("cond", "faixa", i, "minimo"),
        `aluguel mínimo da faixa ${i + 1}`,
      );
    });
  }
  if (c.tipo_prazo === "meses")
    l.se(
      !c.dia_vencimento,
      idCampo("cond", "dia_vencimento"),
      "dia de vencimento",
    );
  l.se(
    c.rateio === "fracao" && !c.fracao_pct,
    idCampo("cond", "fracao_pct"),
    "fração ideal do rateio (%)",
  );
  l.se(
    c.devido_a_partir === "fim_carencia" &&
      !c.carencias_descontos.some((x) => x.tipo === "carencia"),
    idCampo("cond", "devido_a_partir"),
    "carência (o aluguel é devido a partir do fim da carência)",
  );
  c.carencias_descontos.forEach((x, i) => {
    const n = `da condição ${i + 1}`;
    l.se(!x.inicio, idCampo("cond", "linha", i, "inicio"), `data inicial ${n}`);
    l.se(!x.fim, idCampo("cond", "linha", i, "fim"), `data final ${n}`);
    l.se(
      Boolean(x.inicio && x.fim && x.fim < x.inicio),
      idCampo("cond", "linha", i, "fim"),
      `data final antes da inicial ${n}`,
    );
    l.se(
      x.tipo !== "carencia" && !x.valor,
      idCampo("cond", "linha", i, "valor"),
      `valor ${n}`,
    );
  });
  if (c.multa === "padrao")
    l.se(
      c.multa_alugueis === null,
      idCampo("cond", "multa"),
      "multa rescisória",
    );
  else {
    l.se(
      !c.multa_faixas.length,
      idCampo("cond", "multa-adicionar"),
      "faixa da multa escalonada",
    );
    c.multa_faixas.forEach((f, i) => {
      l.se(
        !f.a_partir_mes,
        idCampo("cond", "multa", i, "mes"),
        `mês da faixa ${i + 1} da multa`,
      );
      l.se(
        !f.percentual,
        idCampo("cond", "multa", i, "percentual"),
        `percentual da faixa ${i + 1} da multa`,
      );
    });
  }
  return l.itens;
}

/** Rótulo de cada campo das garantias (as chaves dos parâmetros). */
const ROTULOS_GARANTIA: Record<string, string> = {
  quantidade: "quantidade",
  fiadores: "fiadores completos",
  instituicao: "instituição",
  valor: "valor da garantia",
  proposta: "nº da proposta",
  comprovante: "comprovante",
  seguradora: "seguradora",
  susep_seguradora: "SUSEP da seguradora",
  corretora: "corretora",
  susep_corretora: "SUSEP da corretora",
  apolice: "nº da apólice",
  vigencia_inicio: "início da vigência",
  vigencia_fim: "fim da vigência",
  documento_apolice: "documento da apólice",
  aluguel_base: "aluguel base",
  data_deposito: "data de depósito",
};

/** Anexo que cada garantia pede como "comprovante" ou documento. */
export const ANEXO_DA_GARANTIA: Partial<Record<Garantia, TipoAnexo>> = {
  capitalizacao: "comprovante_capitalizacao",
  seguro_fianca: "apolice",
  caucao: "comprovante_caucao",
};

function fiador(l: Lista, f: Fiador, i: number) {
  const de = `do fiador ${i + 1}`;
  const pre = `fiador-${i}`;
  if (f.tipo === "pf") {
    pessoaFisica(l, f.pf, `${pre}-pf`, de);
    if (temConjuge(f.pf.estado_civil)) {
      l.texto(f.regime, idCampo(pre, "regime"), `regime de bens ${de}`);
      conjuge(l, f.conjuge, `${pre}-cj`, de);
    }
    return;
  }
  l.texto(
    f.pj.razao_social,
    idCampo(pre, "pj", "razao_social"),
    `razão social ${de}`,
  );
  l.se(!cnpjValido(f.pj.cnpj), idCampo(pre, "pj", "cnpj"), `CNPJ ${de}`);
  l.endereco(f.pj.endereco, `${pre}-pj-end`, de);
  l.se(
    !f.pj.socias.length,
    idCampo(pre, "socia", "adicionar"),
    `sócia que representa ${de}`,
  );
  f.pj.socias.forEach((s, j) => {
    l.texto(
      s.nome,
      idCampo(pre, "socia", j, "nome"),
      `nome da sócia ${j + 1} ${de}`,
    );
    l.se(
      !cpfValido(s.cpf),
      idCampo(pre, "socia", j, "cpf"),
      `CPF da sócia ${j + 1} ${de}`,
    );
  });
}

function garantia(d: DadosContrato, ctx: ContextoRevisao): Pendencia[] {
  const l = new Lista(4);
  const g = d.garantia;
  if (!g.tipo) {
    l.se(true, idCampo("gar", "tipo"), "garantia");
    return l.itens;
  }
  const campos = (g as unknown as Record<string, Record<string, unknown>>)[
    g.tipo
  ];
  for (const chave of ctx.obrigatorios[g.tipo] ?? []) {
    const rotulo = `${ROTULOS_GARANTIA[chave] ?? chave} (${GARANTIAS[g.tipo].toLowerCase()})`;
    const campo = idCampo("gar", g.tipo, chave);
    if (chave === "fiadores") {
      g.fiador.fiadores.forEach((f, i) => {
        fiador(l, f, i);
      });
      l.se(
        !g.fiador.fiadores.length,
        idCampo("gar", "fiador", "quantidade"),
        rotulo,
      );
    } else if (chave === "comprovante" || chave === "documento_apolice") {
      const anexo = ANEXO_DA_GARANTIA[g.tipo];
      l.se(Boolean(anexo && !ctx.anexos.includes(anexo)), campo, rotulo);
    } else if (campos && chave in campos) {
      const v = campos[chave];
      l.se(vazio(v) || v === 0, campo, rotulo);
    }
  }
  if (g.tipo === "seguro_fianca") {
    const s = g.seguro_fianca;
    l.se(
      Boolean(
        s.vigencia_inicio &&
          s.vigencia_fim &&
          s.vigencia_fim < s.vigencia_inicio,
      ),
      idCampo("gar", "seguro_fianca", "vigencia_fim"),
      "fim da vigência antes do início (seguro-fiança)",
    );
  }
  return l.itens;
}

function entrega(d: DadosContrato): Pendencia[] {
  const l = new Lista(5);
  const e = d.entrega;
  l.texto(e.tipo_imovel, idCampo("ent", "tipo_imovel"), "tipo de imóvel");
  l.texto(e.padrao, idCampo("ent", "padrao"), "padrão de entrega");
  l.se(
    e.prazo_implantacao === null,
    idCampo("ent", "prazo_implantacao"),
    "prazo de implantação",
  );
  l.texto(e.nc004, idCampo("ent", "nc004"), "versão da NC004");
  l.se(
    e.status === "concluida" && !e.data_termo,
    idCampo("ent", "data_termo"),
    "data do termo de entrada",
  );
  l.se(
    Object.values(e.fisica).every(vazio),
    idCampo("ent", "fisica", "paredes"),
    "condição física (ao menos um item)",
  );
  return l.itens;
}

/** Tudo o que falta, na ordem das etapas. Vazio = pode marcar "Pronto". */
export function pendencias(
  d: DadosContrato,
  ctx: ContextoRevisao,
): Pendencia[] {
  return [
    ...imovel(d),
    ...partes(d),
    ...condicoes(d),
    ...garantia(d, ctx),
    ...entrega(d),
  ];
}

/** Pendências contadas por etapa (1 a 8). */
export function porEtapa(lista: Pendencia[]): Record<number, Pendencia[]> {
  const out: Record<number, Pendencia[]> = {};
  for (const p of lista) {
    if (!out[p.etapa]) out[p.etapa] = [];
    out[p.etapa]?.push(p);
  }
  return out;
}

/** "Geração bloqueada — faltam: aluguel vigente, nº da apólice…" */
export function resumoDasPendencias(lista: Pendencia[], max = 6): string {
  const nomes = lista.slice(0, max).map((p) => p.rotulo);
  const mais = lista.length - nomes.length;
  return `${nomes.join(", ")}${mais > 0 ? ` e mais ${mais}` : ""}`;
}

// ---------------------------------------------------------------------------
// Checklist da etapa Documentos
// ---------------------------------------------------------------------------

export type StatusItem = "ok" | "validar" | "obrigatorio" | "vencido";

export const ROTULO_STATUS: Record<StatusItem, string> = {
  ok: "OK",
  validar: "A validar",
  obrigatorio: "Obrigatório",
  vencido: "Vencido",
};

export interface ItemChecklist {
  chave: string;
  rotulo: string;
  status: StatusItem;
  detalhe?: string;
  /** Etapa que resolve a pendência. */
  etapa?: number;
}

export interface KitDoContrato {
  nome: string;
  versao: string;
  validade: string | null;
}

export function checklist(
  d: DadosContrato,
  ctx: ContextoRevisao & { kit: KitDoContrato[]; hoje: string },
): ItemChecklist[] {
  const pend = porEtapa(pendencias(d, ctx));
  const tem = (t: TipoAnexo) => ctx.anexos.includes(t);
  const g = d.garantia.tipo;
  const anexoGarantia = g ? ANEXO_DA_GARANTIA[g] : undefined;
  const exigeAnexo =
    g &&
    (ctx.obrigatorios[g] ?? []).some(
      (c) => c === "comprovante" || c === "documento_apolice",
    );
  const itens: ItemChecklist[] = [
    {
      chave: "partes",
      rotulo: "Qualificação das partes",
      status: pend[2]?.length ? "obrigatorio" : "ok",
      detalhe: pend[2]?.length
        ? `${pend[2].length} campo(s) a completar na etapa Partes`
        : "Dados da etapa Partes",
      etapa: 2,
    },
    {
      chave: "planta",
      rotulo: "Planta do imóvel (Anexo I — Planta de localização)",
      status: tem("planta") ? "ok" : "validar",
      detalhe: tem("planta") ? "Anexada" : "Anexe a planta abaixo",
    },
    {
      chave: "vistoria",
      rotulo: "Termo ou laudo de vistoria de entrada",
      status: tem("vistoria") || d.entrega.vistoria ? "ok" : "validar",
      detalhe: d.entrega.vistoria
        ? `Vistoria ${d.entrega.vistoria.codigo} do Tickets`
        : tem("vistoria")
          ? "Anexado"
          : "Puxe da vistoria (etapa 5) ou anexe o termo",
      etapa: 5,
    },
  ];
  if (g && g !== "sem_garantia") {
    const rot =
      g === "seguro_fianca"
        ? "Apólice de seguro-fiança"
        : `Documento da garantia (${GARANTIAS[g].toLowerCase()})`;
    const ok = anexoGarantia ? tem(anexoGarantia) : true;
    itens.push({
      chave: "garantia",
      rotulo: rot,
      status: ok
        ? pend[4]?.length
          ? "validar"
          : "ok"
        : exigeAnexo
          ? "obrigatorio"
          : "validar",
      detalhe: ok
        ? g === "fiador"
          ? "Qualificação dos fiadores na etapa Garantia"
          : "Anexado"
        : "Anexe na etapa Garantia",
      etapa: 4,
    });
  }
  for (const k of ctx.kit) {
    const vencido = Boolean(k.validade && k.validade < ctx.hoje);
    itens.push({
      chave: `kit-${k.nome}`,
      rotulo: `${k.nome} (kit)`,
      status: vencido ? "vencido" : "ok",
      detalhe: vencido
        ? `Versão ${k.versao} vencida: suba a nova no Kit de entrega`
        : `Versão ${k.versao}`,
    });
  }
  if ((d.condicoes.vagas ?? 0) > 0)
    itens.push({
      chave: "credencial",
      rotulo: "Termo de entrega e uso de credencial (vaga)",
      status: tem("credencial") ? "ok" : "validar",
      detalhe: tem("credencial") ? "Anexado" : "Anexe o termo assinado",
    });
  return itens;
}
