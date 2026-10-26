import "server-only";
import { randomUUID } from "node:crypto";
import { calcularOS } from "@/lib/os/calculos";
import {
  campoDoTipo,
  conferir,
  decidirNumeros,
  entradaDoCalculo,
  ORIGEM_LEGADO,
  periodoDaVisita,
  regraDeRateio,
  respostaDoAmbiente,
  statusDaVistoria,
  statusDoRegistro,
  tipoDaVistoria,
  usuarioPeloNome,
} from "@/lib/os/importacao-conferencia";
import type {
  FotoLegado,
  OsInterna,
  OsTerceirizada,
  PacoteImportacao,
} from "@/lib/os/importacao-modelo";
import { resultadoParaBanco } from "@/lib/os/ordem";
import { localEData } from "@/lib/os/vistoria";
import type { Database, Json } from "@/lib/supabase/database.types";
import { registrarDepois } from "@/server/logs";
import { configDoSistema } from "../automacao";
import { os, osAdmin } from "../base";
import {
  gravarNoBucket,
  mimeDoArquivo,
  nomeLimpo,
  removerEmLotes,
} from "./arquivos";
import {
  abrirPacote,
  type ContextoDoModulo,
  contextoDoModulo,
  gravarResumo,
  importacao,
  lerMapeamento,
  lerResumo,
  type PlanoDeFoto,
} from "./previa";

// Gravação da importação (spec 4.14), depois da prévia sem bloqueio. Tudo o
// que entra leva importacao_id (e origem = 'importacao' nos chamados), para
// os.desfazer_importacao apagar só isso. Grava com a service role depois de
// conferir os.importacao: o RLS de abertura exige aberto_por = quem abre, e
// a OS antiga tem dono, datas e número próprios. Registro importado antes
// (mesma origem e id) é atualizado, não duplicado. As fotos vão numa etapa
// à parte, aos poucos (copiarFotos), porque um backup pode ter milhares.

type Tabelas = Database["os"]["Tables"];
type Ins<T extends keyof Tabelas> = Tabelas[T]["Insert"];

const LOTE = 400;
/**
 * Lote com linhas de campos diferentes: o que uma linha não traz fica com o
 * padrão da coluna (sem isto, o PostgREST grava null e fura os not null).
 */
const PADRAO = { defaultToNull: false } as const;
const iso = (d: Date) => d.toISOString();
const chave = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Resposta = PromiseLike<{ error: { message: string } | null }>;
async function emLotes<T>(
  nome: string,
  linhas: T[],
  gravar: (lote: T[]) => Resposta,
): Promise<void> {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await gravar(linhas.slice(i, i + LOTE));
    if (error) throw new Error(`Importar ${nome}: ${error.message}`);
  }
}

async function emParalelo<T>(
  itens: T[],
  deUmaVez: number,
  tarefa: (item: T) => Promise<void>,
): Promise<void> {
  const fila = [...itens];
  const trabalhar = async () => {
    for (let i = fila.shift(); i !== undefined; i = fila.shift())
      await tarefa(i);
  };
  await Promise.all(Array.from({ length: deUmaVez }, trabalhar));
}

/** Campos que o gatilho do ciclo mexe ou que os checks exigem por status. */
const CAMPOS_DO_CICLO = [
  "prazo",
  "primeira_resposta_em",
  "iniciado_em",
  "aguardando_desde",
  "aguardando_tipo",
  "aguardando_motivo",
  "concluido_em",
  "fechado_em",
  "fechado_automatico",
  "cancelado_em",
  "motivo_cancelamento",
] as const;

const falhar = (o: string, e: { message: string } | null) => {
  if (e) throw new Error(`Importar ${o}: ${e.message}`);
};

export interface ResultadoDaImportacao {
  gravacao: Record<string, number>;
  avisos: string[];
  fotos: number;
}

/**
 * Confirma: confere de novo (o banco pode ter mudado desde a prévia) e grava
 * tudo. A importação passa a "confirmada" antes de gravar (duas
 * confirmações ao mesmo tempo não passam); se parar no meio, desfazer limpa.
 */
export async function confirmarImportacao(
  importacaoId: string,
  usuarioId: string,
): Promise<ResultadoDaImportacao> {
  const imp = await importacao(importacaoId);
  if (!imp) throw new Error("Importação não encontrada.");
  if (imp.status !== "previa")
    throw new Error("Esta importação já foi confirmada ou desfeita.");
  const resumo = lerResumo(imp.resumo);
  const mapeamento = lerMapeamento(imp.mapeamento);
  const aberto = await abrirPacote(importacaoId, resumo);
  const ctx = await contextoDoModulo(
    aberto.pacote,
    mapeamento,
    aberto.acharArquivo,
  );
  const previa = conferir(aberto.pacote, ctx);
  if (!previa.podeConfirmar)
    throw new Error(
      "A prévia ainda tem pendências: confira antes de confirmar.",
    );

  const { data: travou, error } = await (await os())
    .from("importacoes")
    .update({
      status: "confirmada",
      confirmado_em: new Date().toISOString(),
      confirmado_por: usuarioId,
    })
    .eq("id", importacaoId)
    .eq("status", "previa")
    .select("id");
  if (error) throw new Error(`Confirmar: ${error.message}`);
  if (!travou?.length)
    throw new Error("Esta importação já está sendo confirmada.");

  try {
    const g = new Gravacao(
      importacaoId,
      aberto.pacote,
      ctx,
      mapeamento,
      aberto.acharArquivo,
    );
    const resultado = await g.gravar();
    await gravarResumo(importacaoId, {
      ...resumo,
      previa,
      gravacao: resultado.gravacao,
      avisos: resultado.avisos,
      fotos: { total: g.fotos.length, copiadas: 0, plano: g.fotos },
    });
    registrarDepois({
      modulo: "os",
      evento: "os_importacao_confirmada",
      descricao: `Confirmou a importação do sistema de OS: ${resultado.gravacao.os ?? 0} OS, ${resultado.gravacao.tarefas ?? 0} tarefas e ${resultado.gravacao.vistorias ?? 0} vistorias`,
      usuarioId,
      detalhes: {
        importacao_id: importacaoId,
        ...resultado.gravacao,
        avisos: resultado.avisos,
      },
    });
    return { ...resultado, fotos: g.fotos.length };
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "falha na gravação";
    await gravarResumo(importacaoId, {
      ...resumo,
      previa,
      erro: `A importação parou no meio (${texto}). Desfaça e tente de novo.`,
    });
    throw erro;
  }
}

class Gravacao {
  readonly db = osAdmin();
  readonly fotos: PlanoDeFoto[] = [];
  private readonly avisos: string[] = [];
  private readonly contagem: Record<string, number> = {};
  private operacoes = "";
  private readonly tecnicos = new Map<string, string>();
  private readonly categorias = new Map<string, string>();
  private readonly empresas = new Map<string, string>();
  private readonly profissionais = new Map<string, string>();
  private readonly ativos = new Map<string, string>();
  private readonly osPorNumero = new Map<number, string>();
  private readonly tarefas = new Map<string, string>();

  constructor(
    private readonly id: string,
    private readonly pacote: PacoteImportacao,
    private readonly ctx: ContextoDoModulo,
    private readonly mapeamento: Record<string, string>,
    private readonly acharArquivo: (c: string) => unknown,
  ) {}

  private contar(nome: string, n: number) {
    this.contagem[nome] = (this.contagem[nome] ?? 0) + n;
  }

  async gravar(): Promise<{
    gravacao: Record<string, number>;
    avisos: string[];
  }> {
    await this.setorDeOperacoes();
    await this.gravarTecnicos();
    await this.gravarCategorias();
    await this.gravarTerceirizados();
    await this.gravarEquipamentosEContatos();
    await this.gravarOS();
    await this.gravarTarefas();
    await this.gravarVistorias();
    await this.gravarCompromissos();
    await this.gravarRegistros();
    await this.ajustarNumeracao();
    return { gravacao: this.contagem, avisos: this.avisos };
  }

  private async setorDeOperacoes() {
    const { data, error } = await this.db
      .from("setores")
      .select("id, nome")
      .order("ordem");
    falhar("setores", error);
    const s =
      (data ?? []).find((x) => chave(x.nome) === "operacoes") ?? data?.[0];
    if (!s) throw new Error("Cadastre os setores antes de importar.");
    this.operacoes = s.id;
  }

  /** Linhas que já existem (importadas antes), pelo legado_id. */
  private async existentes(
    tabela: "tecnicos" | "empresas" | "profissionais" | "contatos" | "ativos",
    ids: string[],
  ): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await this.db
        .from(tabela)
        .select("id, legado_id")
        .in("legado_id", ids.slice(i, i + 100));
      falhar(tabela, error);
      for (const r of data ?? []) if (r.legado_id) mapa.set(r.legado_id, r.id);
    }
    return mapa;
  }

  // --- Técnicos, com o valor atual como primeira vigência -----------------
  private async gravarTecnicos() {
    const r = this.pacote.registros;
    const ja = await this.existentes(
      "tecnicos",
      r.tecnicos.map((t) => t.id),
    );
    const { data: ligados, error } = await this.db
      .from("tecnicos")
      .select("id, usuario_id")
      .not("usuario_id", "is", null);
    falhar("técnicos", error);
    const usuarioDoTecnico = new Map(
      (ligados ?? []).map((t) => [t.usuario_id, t.id]),
    );
    // Primeira sessão de cada técnico: a vigência começa nela.
    const primeira = new Map<string, string>();
    for (const o of r.os_internas)
      for (const s of o.sessoes)
        for (const t of s.tecnicos)
          if (!primeira.has(t) || s.data < (primeira.get(t) ?? ""))
            primeira.set(t, s.data);

    const novos: Ins<"tecnicos">[] = [];
    for (const t of r.tecnicos) {
      const existente = ja.get(t.id);
      const id = existente ?? randomUUID();
      this.tecnicos.set(t.id, id);
      const usuario = usuarioPeloNome(t.nome, this.ctx.usuarios);
      // tecnicos.usuario_id é único: dois técnicos antigos com o mesmo nome
      // não ficam ligados ao mesmo usuário (só o primeiro).
      const livre =
        usuario &&
        (!usuarioDoTecnico.has(usuario) ||
          usuarioDoTecnico.get(usuario) === id);
      if (livre) usuarioDoTecnico.set(usuario, id);
      const linha = {
        nome: t.nome,
        desligado_em: t.desligado_em ?? null,
        importacao_id: this.id,
        ...(livre ? { usuario_id: usuario } : {}),
      };
      if (existente) {
        const { error: e } = await this.db
          .from("tecnicos")
          .update(linha)
          .eq("id", id);
        falhar("técnico", e);
      } else
        novos.push({ id, ...linha, setor_id: this.operacoes, legado_id: t.id });
    }
    await emLotes("técnicos", novos, (l) =>
      this.db.from("tecnicos").insert(l, PADRAO),
    );
    const valores = r.tecnicos.flatMap((t) =>
      t.valor_minuto == null
        ? []
        : [
            {
              tecnico_id: this.tecnicos.get(t.id) as string,
              vigente_desde:
                primeira.get(t.id) ?? new Date().toISOString().slice(0, 10),
              valor_minuto: t.valor_minuto,
            },
          ],
    );
    await emLotes("valor por minuto", valores, (l) =>
      this.db.from("tecnico_valores").upsert(l, {
        onConflict: "tecnico_id,vigente_desde",
        ...PADRAO,
        ignoreDuplicates: true,
      }),
    );
    this.contar("tecnicos", r.tecnicos.length);
    const semValor = r.tecnicos.filter((t) => t.valor_minuto == null).length;
    if (semValor)
      this.avisos.push(
        `${semValor} ${semValor === 1 ? "técnico entrou" : "técnicos entraram"} sem valor por minuto: complete em Parâmetros.`,
      );
  }

  // --- Tipos de serviço → categorias de Operações --------------------------
  private async gravarCategorias() {
    const { data, error } = await this.db
      .from("categorias")
      .select("id, nome")
      .eq("setor_id", this.operacoes)
      .is("pai_id", null);
    falhar("categorias", error);
    const porNome = new Map((data ?? []).map((c) => [chave(c.nome), c.id]));
    let criadas = 0;
    for (const t of this.pacote.registros.tipos_servico) {
      let id = porNome.get(chave(t.nome));
      if (!id) {
        id = randomUUID();
        const { error: e } = await this.db.from("categorias").insert({
          id,
          setor_id: this.operacoes,
          nome: t.nome,
          icone: "wrench",
          ordem: 50,
          tipo_padrao: "os",
          registrar_tempo: true,
          vincular_ativo: true,
          vincular_loja: true,
        });
        falhar("categoria", e);
        porNome.set(chave(t.nome), id);
        criadas++;
      }
      this.categorias.set(t.id, id);
      this.categorias.set(chave(t.nome), id);
    }
    this.contar("categorias_criadas", criadas);
  }

  private categoriaDe(tipo: string | undefined): string | null {
    if (!tipo) return null;
    return (
      this.categorias.get(tipo) ?? this.categorias.get(chave(tipo)) ?? null
    );
  }

  // --- Empresas e profissionais terceirizados -----------------------------
  private async gravarTerceirizados() {
    const r = this.pacote.registros;
    const nomes = new Map<string, string>();
    for (const n of [
      ...r.profissionais.map((p) => p.empresa),
      ...r.os_terceirizadas.flatMap((o) => (o.empresa ? [o.empresa] : [])),
    ])
      nomes.set(`empresa:${chave(n)}`, n);
    const ja = await this.existentes("empresas", [...nomes.keys()]);
    const novas: Ins<"empresas">[] = [];
    for (const [legado, nome] of nomes) {
      const id = ja.get(legado) ?? randomUUID();
      this.empresas.set(chave(nome), id);
      if (ja.has(legado)) {
        const { error } = await this.db
          .from("empresas")
          .update({ importacao_id: this.id })
          .eq("id", id);
        falhar("empresa", error);
      } else
        novas.push({ id, nome, legado_id: legado, importacao_id: this.id });
    }
    await emLotes("empresas", novas, (l) =>
      this.db.from("empresas").insert(l, PADRAO),
    );

    const jaProf = await this.existentes(
      "profissionais",
      r.profissionais.map((p) => p.id),
    );
    const novos: Ins<"profissionais">[] = [];
    for (const p of r.profissionais) {
      const id = jaProf.get(p.id) ?? randomUUID();
      this.profissionais.set(p.id, id);
      const linha = {
        nome: p.nome,
        telefone: p.telefone ?? null,
        empresa_id: this.empresas.get(chave(p.empresa)) as string,
        importacao_id: this.id,
      };
      if (jaProf.has(p.id)) {
        const { error } = await this.db
          .from("profissionais")
          .update(linha)
          .eq("id", id);
        falhar("profissional", error);
      } else novos.push({ id, ...linha, legado_id: p.id });
    }
    await emLotes("profissionais", novos, (l) =>
      this.db.from("profissionais").insert(l, PADRAO),
    );
    this.contar("empresas", nomes.size);
    this.contar("profissionais", r.profissionais.length);
  }

  // --- Equipamentos (ativos com cadastro incompleto) e contatos -------------
  private async gravarEquipamentosEContatos() {
    const r = this.pacote.registros;
    const ja = await this.existentes(
      "ativos",
      r.equipamentos.map((e) => e.id),
    );
    const novos: Ins<"ativos">[] = [];
    for (const e of r.equipamentos) {
      const id = ja.get(e.id) ?? randomUUID();
      this.ativos.set(e.id, id);
      const linha = {
        nome: e.nome,
        bloco: e.bloco ?? null,
        area: e.local ?? null,
        fabricante: e.fabricante ?? null,
        modelo: e.modelo ?? null,
        numero_serie: e.numero_serie ?? null,
        observacao: e.observacao ?? null,
        importacao_id: this.id,
      };
      if (ja.has(e.id)) {
        const { error } = await this.db
          .from("ativos")
          .update(linha)
          .eq("id", id);
        falhar("ativo", error);
      } else
        novos.push({ id, ...linha, setor_id: this.operacoes, legado_id: e.id });
    }
    await emLotes("ativos", novos, (l) =>
      this.db.from("ativos").insert(l, PADRAO),
    );

    const contatos = [
      ...r.equipamentos.flatMap((e) =>
        e.fornecedor_telefone
          ? [
              {
                legado_id: `fornecedor:${e.id}`,
                nome: e.fornecedor_contato ?? e.fornecedor ?? e.nome,
                telefone: e.fornecedor_telefone,
                empresa: e.fornecedor ?? null,
                observacao: `Fornecedor de ${e.nome}`,
              },
            ]
          : [],
      ),
      ...r.contatos.map((c) => ({
        legado_id: `whatsapp:${c.id}`,
        nome: c.nome,
        telefone: c.telefone,
        empresa: c.empresa ?? null,
        observacao: c.observacao ?? null,
      })),
    ];
    const jaContatos = await this.existentes(
      "contatos",
      contatos.map((c) => c.legado_id),
    );
    const novosContatos: Ins<"contatos">[] = [];
    for (const c of contatos) {
      const existente = jaContatos.get(c.legado_id);
      if (existente) {
        const { error } = await this.db
          .from("contatos")
          .update({ ...c, importacao_id: this.id })
          .eq("id", existente);
        falhar("contato", error);
      } else novosContatos.push({ ...c, importacao_id: this.id });
    }
    await emLotes("contatos", novosContatos, (l) =>
      this.db.from("contatos").insert(l, PADRAO),
    );
    this.contar("ativos", r.equipamentos.length);
    this.contar("contatos", contatos.length);
  }

  // --- OS internas e de terceirizados --------------------------------------
  private async gravarOS() {
    const r = this.pacote.registros;
    const decisoes = decidirNumeros(this.pacote, this.ctx.numerosNoModulo);
    const novas: Ins<"chamados">[] = [];
    const atualizar: { id: string; linha: Ins<"chamados"> }[] = [];
    const todas: {
      id: string;
      os: OsInterna | OsTerceirizada;
      tipo: keyof typeof ORIGEM_LEGADO;
    }[] = [];
    let numerosNovos = 0;

    for (const tipo of ["os_internas", "os_terceirizadas"] as const)
      for (const o of r[tipo]) {
        const decisao = decisoes.get(`${tipo}:${o.numero}`) ?? "manter";
        const existente =
          decisao === "atualizar"
            ? this.ctx.numerosNoModulo.get(o.numero)?.id
            : undefined;
        const id = existente ?? randomUUID();
        if (tipo === "os_internas" || !this.osPorNumero.has(o.numero))
          this.osPorNumero.set(o.numero, id);
        const linha = this.linhaDaOS(o, tipo, decisao === "numero_novo");
        if (existente) atualizar.push({ id, linha });
        else
          novas.push({
            id,
            ...linha,
            ...(decisao === "manter" ? { numero: o.numero } : {}),
          });
        if (decisao === "numero_novo") numerosNovos++;
        todas.push({ id, os: o, tipo });
      }

    await this.limparFilhos(atualizar.map((a) => a.id));
    // Primeiro as que mantêm o número antigo; a sequência sobe acima do
    // maior; só então as de número novo (e, depois, as tarefas) pegam o
    // próximo. Na outra ordem, o número novo podia cair num antigo ainda não
    // gravado e o lote inteiro parava no unique.
    await emLotes(
      "OS",
      novas.filter((n) => n.numero != null),
      (l) => this.db.from("chamados").insert(l, PADRAO),
    );
    await this.numerarAcimaDoMaior();
    await emLotes(
      "OS",
      novas.filter((n) => n.numero == null),
      (l) => this.db.from("chamados").insert(l, PADRAO),
    );
    await emParalelo(atualizar, 6, ({ id, linha }) =>
      this.atualizarChamado(id, linha, `OS ${linha.legado_id}`),
    );

    await this.gravarSessoesEMateriais(todas);
    this.contar("os", todas.length);
    this.contar("os_atualizadas", atualizar.length);
    if (numerosNovos)
      this.avisos.push(
        `${numerosNovos} OS ${numerosNovos === 1 ? "entrou" : "entraram"} com número novo (o antigo ficou na etiqueta).`,
      );
  }

  private linhaDaOS(
    o: OsInterna | OsTerceirizada,
    tipo: "os_internas" | "os_terceirizadas",
    numeroNovo: boolean,
  ): Ins<"chamados"> {
    const s = statusDoRegistro("os", o.status, this.mapeamento);
    if (!s)
      throw new Error(
        `OS ${o.numero}: status "${o.status}" sem correspondência.`,
      );
    const sessoes = "sessoes" in o ? o.sessoes : [];
    const inicio = sessoes
      .map((x) => `${x.data}T${x.inicio}:00-03:00`)
      .sort()[0];
    const fim = sessoes
      .flatMap((x) => (x.fim ? [`${x.data}T${x.fim}:00-03:00`] : []))
      .sort()
      .at(-1);
    const aberta = o.aberta_em;
    const encerrada = o.concluida_em ?? fim ?? aberta;
    const fechado = s.status === "fechado";
    const cancelado = s.status === "cancelado";
    const categoria = this.categoriaDe(o.tipo_servico);
    const terceirizada = tipo === "os_terceirizadas";
    const regra = o.rateio ? regraDeRateio(o.rateio.regra) : null;
    const local = o.local ?? null;
    return {
      tipo: "os",
      titulo:
        (
          o.titulo ??
          [o.tipo_servico && !categoria ? o.tipo_servico : null, local]
            .filter(Boolean)
            .join(" – ") ??
          ""
        ).trim() || `OS ${o.numero} do sistema antigo`,
      descricao: o.descricao ?? null,
      setor_id: this.operacoes,
      categoria_id: categoria,
      status: s.status,
      prioridade: "media",
      origem: "importacao",
      precisa_confirmacao: true,
      aberto_por: null,
      solicitante_nome: o.solicitante ?? null,
      primeira_resposta_em: s.status === "aberto" ? null : (inicio ?? aberta),
      iniciado_em: s.status === "aberto" ? null : (inicio ?? aberta),
      // Desde quando aguarda o sistema antigo não guarda: conta de agora.
      aguardando_desde:
        s.status === "aguardando" ? new Date().toISOString() : null,
      aguardando_tipo: s.aguardando_tipo ?? null,
      aguardando_motivo:
        s.status === "aguardando" ? `Importada como "${o.status}"` : null,
      concluido_em: fechado ? encerrada : null,
      fechado_em: fechado ? encerrada : null,
      fechado_automatico: false,
      cancelado_em: cancelado ? encerrada : null,
      motivo_cancelamento: cancelado ? "Cancelada no sistema antigo." : null,
      execucao: terceirizada ? "terceirizada" : "interna",
      local,
      bloco: o.bloco ?? null,
      empresa_id:
        "empresa" in o && o.empresa
          ? (this.empresas.get(chave(o.empresa)) ?? null)
          : null,
      visita_data: "visita_data" in o ? (o.visita_data ?? null) : null,
      visita_periodo:
        "visita_periodo" in o ? periodoDaVisita(o.visita_periodo) : null,
      solucao: o.solucao ?? null,
      ativo_id:
        "equipamento" in o && o.equipamento
          ? (this.ativos.get(o.equipamento) ?? null)
          : null,
      rateio: !!regra,
      etiquetas: numeroNovo ? [`OS antiga nº ${o.numero}`] : [],
      legado_origem: ORIGEM_LEGADO[tipo],
      legado_id: String(o.numero),
      importacao_id: this.id,
      criado_em: aberta,
    };
  }

  /** Reimportação: o que a importação anterior pôs no chamado sai antes. */
  private async limparFilhos(ids: string[]) {
    // Lote pequeno: as fotos de 50 OS cabem nas 1000 linhas de uma consulta.
    for (let i = 0; i < ids.length; i += 50) {
      const lote = ids.slice(i, i + 50);
      const anexos = await this.db
        .from("anexos")
        .select("path")
        .in("chamado_id", lote)
        .not("importacao_id", "is", null);
      falhar("anexos", anexos.error);
      await removerEmLotes((anexos.data ?? []).map((a) => a.path));
      for (const r of await Promise.all([
        this.db
          .from("anexos")
          .delete()
          .in("chamado_id", lote)
          .not("importacao_id", "is", null),
        this.db
          .from("sessoes")
          .delete()
          .in("chamado_id", lote)
          .not("importacao_id", "is", null),
        this.db
          .from("materiais")
          .delete()
          .in("chamado_id", lote)
          .is("criado_por", null),
        this.db
          .from("eventos")
          .delete()
          .in("chamado_id", lote)
          .contains("dados", { importado: true }),
        this.db.from("chamado_profissionais").delete().in("chamado_id", lote),
      ]))
        falhar("reimportação", r.error);
    }
  }

  private async gravarSessoesEMateriais(
    todas: {
      id: string;
      os: OsInterna | OsTerceirizada;
      tipo: keyof typeof ORIGEM_LEGADO;
    }[],
  ) {
    const r = this.pacote.registros;
    const sessoes: Ins<"sessoes">[] = [];
    const tecnicos: Ins<"sessao_tecnicos">[] = [];
    const materiais: Ins<"materiais">[] = [];
    const valores: Ins<"material_valores">[] = [];
    const custos: Ins<"os_custos">[] = [];
    const profissionais: Ins<"chamado_profissionais">[] = [];
    const eventos: Ins<"eventos">[] = [];

    for (const { id, os: o, tipo } of todas) {
      if ("sessoes" in o)
        for (const s of o.sessoes) {
          const sessaoId = randomUUID();
          const almoco = !!(
            s.almoco_inicio &&
            s.almoco_fim &&
            s.almoco_inicio < s.almoco_fim
          );
          sessoes.push({
            id: sessaoId,
            chamado_id: id,
            data: s.data,
            inicio: s.inicio,
            fim: s.fim ?? null,
            almoco_inicio: almoco ? s.almoco_inicio : null,
            almoco_fim: almoco ? s.almoco_fim : null,
            importacao_id: this.id,
          });
          for (const t of new Set(s.tecnicos)) {
            const tecnico = this.tecnicos.get(t);
            if (tecnico)
              tecnicos.push({ sessao_id: sessaoId, tecnico_id: tecnico });
          }
        }
      if ("materiais" in o)
        for (const m of o.materiais) {
          const materialId = randomUUID();
          materiais.push({
            id: materialId,
            chamado_id: id,
            descricao: m.descricao,
            quantidade: m.quantidade,
            unidade: m.unidade ?? null,
          });
          if (m.valor_unitario != null)
            valores.push({
              material_id: materialId,
              valor_unitario: m.valor_unitario,
            });
        }
      if ("profissionais" in o)
        for (const p of new Set(o.profissionais)) {
          const profissional = this.profissionais.get(p);
          if (profissional)
            profissionais.push({
              chamado_id: id,
              profissional_id: profissional,
            });
        }
      const regra = o.rateio ? regraDeRateio(o.rateio.regra) : null;
      custos.push({
        chamado_id: id,
        valor_terceirizado: "valor" in o ? (o.valor ?? null) : null,
        orcamento_numero: "orcamento" in o ? (o.orcamento ?? null) : null,
        rateio_regra: regra,
        rateio_valor:
          regra === "manual" || regra === "percentual"
            ? (o.rateio?.valor ?? null)
            : null,
        legado_valor: o.legado?.valor_total ?? null,
        legado_valor_rateio: o.legado?.valor_rateio ?? null,
        legado_minutos:
          o.legado?.minutos == null ? null : Math.round(o.legado.minutos),
        legado_minuto_homem:
          o.legado?.minuto_homem == null
            ? null
            : Math.round(o.legado.minuto_homem),
      });
      eventos.push({
        chamado_id: id,
        tipo: "criado",
        texto: `Importada do sistema atual (${tipo === "os_terceirizadas" ? "O.S. terceirizado" : "OS"} nº ${o.numero}, status "${o.status}").`,
        autor_nome: "Importação",
        em: o.aberta_em,
        dados: { importado: true, importacao_id: this.id },
      });
      this.planejarFotos(o.fotos, { chamadoId: id, pasta: `chamados/${id}` });
    }

    await emLotes("sessões", sessoes, (l) =>
      this.db.from("sessoes").insert(l, PADRAO),
    );
    await emLotes("técnicos das sessões", tecnicos, (l) =>
      this.db.from("sessao_tecnicos").insert(l, PADRAO),
    );
    await emLotes("materiais", materiais, (l) =>
      this.db.from("materiais").insert(l, PADRAO),
    );
    await emLotes("valores dos materiais", valores, (l) =>
      this.db.from("material_valores").insert(l, PADRAO),
    );
    await emLotes("custos", custos, (l) =>
      this.db
        .from("os_custos")
        .upsert(l, { onConflict: "chamado_id", ...PADRAO }),
    );
    await emLotes("profissionais da OS", profissionais, (l) =>
      this.db.from("chamado_profissionais").insert(l, PADRAO),
    );
    await emLotes("linha do tempo", eventos, (l) =>
      this.db.from("eventos").insert(l, PADRAO),
    );

    // Custo pelo cálculo do módulo, no modo do sistema antigo.
    let semCusto = 0;
    await emParalelo(todas, 10, async ({ id, os: o }) => {
      const resultado = calcularOS(entradaDoCalculo(o, r.tecnicos));
      const { error } = await this.db.rpc("gravar_calculo_os", {
        p_chamado: id,
        p_resultado: resultadoParaBanco(resultado) as unknown as Json,
      });
      if (error) semCusto++;
    });
    if (semCusto)
      this.avisos.push(`${semCusto} OS ficaram sem o custo calculado.`);
    this.contar("sessoes", sessoes.length);
    this.contar("materiais", materiais.length);
  }

  private planejarFotos(
    fotos: FotoLegado[],
    dono: {
      chamadoId?: string;
      vistoriaId?: string;
      ambienteId?: string;
      pasta: string;
    },
  ) {
    fotos.forEach((f, i) => {
      if (!this.acharArquivo(f.arquivo)) return;
      const nome = f.arquivo.replace(/\\/g, "/").split("/").at(-1) ?? f.arquivo;
      this.fotos.push({
        citado: f.arquivo,
        nome,
        path: `${dono.pasta}/imp-${i}-${nomeLimpo(nome)}`,
        categoria: f.tipo,
        chamadoId: dono.chamadoId,
        vistoriaId: dono.vistoriaId,
        ambienteId: dono.ambienteId,
      });
    });
  }

  // --- Tarefas (com o vínculo à OS em que foram convertidas) ---------------
  private async gravarTarefas() {
    const novas: Ins<"chamados">[] = [];
    const atualizar: { id: string; linha: Ins<"chamados"> }[] = [];
    const convertidas: { osId: string; tarefaId: string }[] = [];
    for (const t of this.pacote.registros.tarefas) {
      const s = statusDoRegistro("tarefa", t.status, this.mapeamento);
      if (!s)
        throw new Error(
          `Tarefa ${t.id}: status "${t.status}" sem correspondência.`,
        );
      const existente = this.ctx.tarefasNoModulo.get(t.id);
      const id = existente ?? randomUUID();
      this.tarefas.set(t.id, id);
      const osId = t.os_numero ? this.osPorNumero.get(t.os_numero) : undefined;
      if (s.convertida_em_os && osId) convertidas.push({ osId, tarefaId: id });
      const fim = t.concluida_em ?? t.criada_em;
      const linha: Ins<"chamados"> = {
        tipo: "tarefa",
        titulo: t.titulo,
        descricao: t.descricao ?? null,
        setor_id: this.operacoes,
        status: s.status,
        prioridade: "media",
        origem: "importacao",
        responsavel_id: usuarioPeloNome(t.responsavel, this.ctx.usuarios),
        prazo: t.prazo ?? null,
        primeira_resposta_em: s.status === "aberto" ? null : t.criada_em,
        iniciado_em: s.status === "aberto" ? null : t.criada_em,
        aguardando_desde:
          s.status === "aguardando" ? new Date().toISOString() : null,
        aguardando_tipo: s.aguardando_tipo ?? null,
        concluido_em: s.status === "fechado" ? fim : null,
        fechado_em: s.status === "fechado" ? fim : null,
        cancelado_em: s.status === "cancelado" ? fim : null,
        motivo_cancelamento:
          s.status === "cancelado" ? "Cancelada no sistema antigo." : null,
        convertido_em_id: s.convertida_em_os ? (osId ?? null) : null,
        legado_origem: ORIGEM_LEGADO.tarefas,
        legado_id: t.id,
        importacao_id: this.id,
        criado_em: t.criada_em,
      };
      if (existente) atualizar.push({ id, linha });
      else novas.push({ id, ...linha });
    }
    await this.limparFilhos(atualizar.map((a) => a.id));
    await emLotes("tarefas", novas, (l) =>
      this.db.from("chamados").insert(l, PADRAO),
    );
    await emParalelo(atualizar, 6, ({ id, linha }) =>
      this.atualizarChamado(id, linha, `Tarefa ${linha.legado_id}`),
    );
    await emParalelo(convertidas, 6, async ({ osId, tarefaId }) => {
      const { error } = await this.db
        .from("chamados")
        .update({ convertido_de_id: tarefaId })
        .eq("id", osId);
      falhar("vínculo da tarefa", error);
    });
    this.contar("tarefas", this.pacote.registros.tarefas.length);
  }

  // --- Vistorias (mantendo o código do laudo) -------------------------------
  private async gravarVistorias() {
    const vistorias = this.pacote.registros.vistorias;
    if (!vistorias.length) return;
    const { p } = await configDoSistema();
    const ambientes: Ins<"vistoria_ambientes">[] = [];
    for (const v of vistorias) {
      const codigo = v.codigo.trim().toUpperCase();
      const existente = this.ctx.codigosNoModulo.get(codigo);
      const id = existente?.legado_id === codigo ? existente.id : randomUUID();
      const status = statusDaVistoria(v.status, this.mapeamento);
      if (!status)
        throw new Error(`Vistoria ${codigo}: status sem correspondência.`);
      const linha: Ins<"vistorias"> = {
        codigo,
        tipo: tipoDaVistoria(v.tipo) ?? "extraordinaria",
        status,
        rascunho: status === "andamento",
        data: v.data,
        hora: v.hora ?? null,
        vistoriador_nome: v.vistoriador,
        vistoriador_id: usuarioPeloNome(v.vistoriador, this.ctx.usuarios),
        locador: p.vistoria_locador,
        locatario: v.locatario,
        bloco: v.bloco,
        unidade: v.unidade,
        campo_tipo: campoDoTipo(v.campo_tipo),
        itens_anteriores: v.itens_anteriores ?? null,
        observacao: v.observacao ?? "",
        consideracoes: v.consideracoes ?? null,
        termo: v.termo ?? "",
        local_data: localEData(p.vistoria_local, v.data),
        legado_id: codigo,
        importacao_id: this.id,
      };
      if (existente?.legado_id === codigo) {
        const fotos = await this.db
          .from("anexos")
          .select("path")
          .eq("vistoria_id", id)
          .not("importacao_id", "is", null);
        falhar("anexos da vistoria", fotos.error);
        await removerEmLotes((fotos.data ?? []).map((a) => a.path));
        const { error: e1 } = await this.db
          .from("anexos")
          .delete()
          .eq("vistoria_id", id)
          .not("importacao_id", "is", null);
        falhar("anexos da vistoria", e1);
        const { error: e2 } = await this.db
          .from("vistoria_ambientes")
          .delete()
          .eq("vistoria_id", id);
        falhar("ambientes", e2);
        const { error: e3 } = await this.db
          .from("vistorias")
          .update(linha)
          .eq("id", id);
        falhar("vistoria", e3);
      } else {
        const { error } = await this.db
          .from("vistorias")
          .insert({ id, ...linha });
        falhar("vistoria", error);
      }
      v.ambientes.forEach((a, ordem) => {
        const ambienteId = randomUUID();
        ambientes.push({
          id: ambienteId,
          vistoria_id: id,
          ordem,
          titulo: a.titulo,
          resposta: respostaDoAmbiente(a.resposta),
          descricao: a.descricao ?? null,
          problema: a.problema ?? false,
        });
        this.planejarFotos(a.fotos, {
          vistoriaId: id,
          ambienteId,
          pasta: `ambientes/${ambienteId}`,
        });
      });
      for (const [quem, arquivo] of [
        ["locador", v.assinatura_locador],
        ["locatario", v.assinatura_locatario],
      ] as const)
        if (arquivo && this.acharArquivo(arquivo)) {
          const nome = arquivo.replace(/\\/g, "/").split("/").at(-1) ?? arquivo;
          this.fotos.push({
            citado: arquivo,
            nome,
            path: `assinaturas/${id}/imp-${quem}-${nomeLimpo(nome)}`,
            categoria: "assinatura",
            vistoriaId: id,
            assinatura: quem,
          });
        }
    }
    await emLotes("ambientes", ambientes, (l) =>
      this.db.from("vistoria_ambientes").insert(l, PADRAO),
    );
    this.contar("vistorias", vistorias.length);
  }

  // --- Compromissos → agendamentos -----------------------------------------
  private async gravarCompromissos() {
    const compromissos = this.pacote.registros.compromissos;
    if (!compromissos.length) return;
    const { data, error } = await this.db.from("agendas").select("id, nome");
    falhar("agendas", error);
    const agendas = new Map((data ?? []).map((a) => [chave(a.nome), a.id]));
    const reserva = "Compromissos do sistema antigo";
    const agendaDe = async (nome: string | undefined) => {
      const achada = nome ? agendas.get(chave(nome)) : undefined;
      if (achada) return achada;
      let id = agendas.get(chave(reserva));
      if (!id) {
        id = randomUUID();
        // Agenda só para guardar o histórico: fora do portal (inativa).
        const { error: e } = await this.db.from("agendas").insert({
          id,
          nome: reserva,
          hora_inicio: "00:00",
          hora_fim: "23:59",
          limite_por_dia: 1000,
          dias_semana: [0, 1, 2, 3, 4, 5, 6],
          ativo: false,
        });
        falhar("agenda", e);
        agendas.set(chave(reserva), id);
      }
      return id;
    };
    // Compromissos de importações anteriores são trocados pelos de agora.
    const anteriores = await this.db
      .from("importacoes")
      .select("id")
      .eq("status", "confirmada")
      .neq("id", this.id);
    falhar("importações anteriores", anteriores.error);
    const ids = (anteriores.data ?? []).map((i) => i.id);
    if (ids.length) {
      const { error: e } = await this.db
        .from("agendamentos")
        .delete()
        .in("importacao_id", ids);
      falhar("compromissos anteriores", e);
    }
    const agora = Date.now();
    const linhas: Ins<"agendamentos">[] = [];
    for (const c of compromissos) {
      const inicio = new Date(c.inicio);
      const fim =
        c.fim && new Date(c.fim) > inicio
          ? new Date(c.fim)
          : new Date(inicio.getTime() + 3_600_000);
      const s = chave(c.status ?? "");
      linhas.push({
        agenda_id: await agendaDe(c.agenda),
        inicio: iso(inicio),
        fim: iso(fim),
        status: s.includes("cancel")
          ? "cancelado"
          : s.includes("remarc")
            ? "remarcar"
            : inicio.getTime() < agora
              ? "realizado"
              : "marcado",
        observacao: [c.titulo, c.observacao].filter(Boolean).join(" · "),
        importacao_id: this.id,
      });
    }
    await emLotes("compromissos", linhas, (l) =>
      this.db.from("agendamentos").insert(l, PADRAO),
    );
    this.contar("compromissos", linhas.length);
  }

  // --- Registro de atividades → linha do tempo de cada chamado -------------
  private async gravarRegistros() {
    const eventos: Ins<"eventos">[] = [];
    for (const r of this.pacote.registros.registros) {
      const chamado =
        (r.os_numero ? this.osPorNumero.get(r.os_numero) : undefined) ??
        (r.tarefa_id ? this.tarefas.get(r.tarefa_id) : undefined);
      if (!chamado) continue;
      eventos.push({
        chamado_id: chamado,
        tipo: "sistema",
        texto: r.texto,
        autor_nome: r.usuario
          ? `${r.usuario} (sistema antigo)`
          : "Sistema antigo",
        em: r.em,
        dados: { importado: true, importacao_id: this.id },
      });
    }
    await emLotes("registro de atividades", eventos, (l) =>
      this.db.from("eventos").insert(l, PADRAO),
    );
    this.contar("registros", eventos.length);
  }

  /**
   * Reimportação: grava o registro e só então tenta o status. O gatilho do
   * ciclo recusa algumas mudanças (ex.: fechado não volta) e carimba as datas
   * com "agora": as datas do ciclo (e os campos que os checks exigem de cada
   * status) só vão depois que o status mudou, com as do sistema antigo. O
   * status que não passar fica como estava e vira aviso.
   */
  private async atualizarChamado(
    id: string,
    linha: Ins<"chamados">,
    rotulo: string,
  ): Promise<void> {
    const { status, ...resto } = linha;
    const ciclo: Partial<Ins<"chamados">> = {};
    for (const campo of CAMPOS_DO_CICLO)
      if (campo in resto) {
        Object.assign(ciclo, { [campo]: resto[campo] });
        delete resto[campo];
      }
    const { error } = await this.db.from("chamados").update(resto).eq("id", id);
    falhar(rotulo, error);
    const { error: e } = await this.db
      .from("chamados")
      .update({ status })
      .eq("id", id)
      .neq("status", status as NonNullable<typeof status>);
    if (e) {
      this.avisos.push(`${rotulo}: o status não mudou (${e.message}).`);
      return;
    }
    if (!Object.keys(ciclo).length) return;
    const { error: e2 } = await this.db
      .from("chamados")
      .update(ciclo)
      .eq("id", id);
    falhar(rotulo, e2);
  }

  /** A sequência dos chamados passa do maior número já gravado. */
  private async numerarAcimaDoMaior() {
    const { error } = await this.db.rpc("ajustar_numeracao");
    if (error) throw new Error(`Ajustar a numeração: ${error.message}`);
  }

  /** O número das próximas OS fica acima do maior importado. */
  private async ajustarNumeracao() {
    const { error } = await this.db.rpc("ajustar_numeracao");
    if (error) {
      console.error("ajustar numeração", error);
      this.avisos.push(
        "A numeração dos chamados novos não foi ajustada acima do maior número importado: peça ao administrador para rodar os.ajustar_numeracao().",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Fotos (aos poucos) e desfazer
// ---------------------------------------------------------------------------

/**
 * Caminhos de todos os arquivos que a importação trouxe. Aos lotes: o
 * PostgREST devolve no máximo 1000 linhas por consulta, e um backup pode ter
 * milhares de fotos.
 */
async function caminhosDaImportacao(importacaoId: string): Promise<string[]> {
  const caminhos: string[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await osAdmin()
      .from("anexos")
      .select("path")
      .eq("importacao_id", importacaoId)
      .order("id")
      .range(de, de + 999);
    if (error) throw new Error(`Fotos da importação: ${error.message}`);
    caminhos.push(...(data ?? []).map((a) => a.path));
    if ((data ?? []).length < 1000) return caminhos;
  }
}

/**
 * Copia as fotos que faltam, até o tempo acabar; a tela chama de novo até
 * terminar. O que já foi copiado (caminho em os.anexos) é pulado.
 */
export async function copiarFotos(
  importacaoId: string,
  limiteMs = 200_000,
): Promise<{ copiadas: number; total: number; falhas: string[] }> {
  const comeco = Date.now();
  const imp = await importacao(importacaoId);
  if (!imp || imp.status !== "confirmada")
    throw new Error("Só dá para copiar as fotos de uma importação confirmada.");
  const resumo = lerResumo(imp.resumo);
  const plano = resumo.fotos?.plano ?? [];
  const db = osAdmin();
  const feitas = new Set(await caminhosDaImportacao(importacaoId));

  const pendentes = plano.filter((f) => !feitas.has(f.path));
  const falhas: string[] = [];
  if (pendentes.length) {
    const aberto = await abrirPacote(importacaoId, resumo);
    for (const f of pendentes) {
      if (Date.now() - comeco > limiteMs) break;
      try {
        const arquivo = aberto.acharArquivo(f.citado);
        if (!arquivo) throw new Error("arquivo não encontrado no pacote");
        const bytes = await arquivo.ler();
        const mime = mimeDoArquivo(f.nome);
        await gravarNoBucket(f.path, bytes, mime);
        const { error: e } = await db.from("anexos").insert({
          chamado_id: f.chamadoId ?? null,
          vistoria_id: f.vistoriaId ?? null,
          ambiente_id: f.ambienteId ?? null,
          categoria: f.categoria,
          nome: f.nome,
          path: f.path,
          mime,
          tamanho: bytes.length,
          enviado_por_nome: "Importação",
          importacao_id: importacaoId,
        });
        if (e) throw new Error(e.message);
        if (f.assinatura && f.vistoriaId) {
          await db
            .from("vistorias")
            .update(
              f.assinatura === "locador"
                ? { assinatura_locador_path: f.path }
                : { assinatura_locatario_path: f.path },
            )
            .eq("id", f.vistoriaId);
        }
        feitas.add(f.path);
      } catch (erro) {
        falhas.push(
          `${f.citado}: ${erro instanceof Error ? erro.message : "falha"}`,
        );
      }
    }
  }
  const copiadas = plano.filter((f) => feitas.has(f.path)).length;
  await gravarResumo(importacaoId, {
    ...resumo,
    fotos: { total: plano.length, copiadas, plano },
  });
  return { copiadas, total: plano.length, falhas };
}

/**
 * Desfaz: tira do bucket as fotos que a importação trouxe e apaga só o que
 * ela gravou (os.desfazer_importacao, pela sessão: o banco confere a
 * permissão). Categorias e a agenda de compromissos criadas ficam.
 */
export async function desfazerImportacao(
  importacaoId: string,
  usuarioId: string,
): Promise<void> {
  const imp = await importacao(importacaoId);
  if (!imp) throw new Error("Importação não encontrada.");
  if (imp.status !== "confirmada")
    throw new Error("Só uma importação confirmada pode ser desfeita.");
  await removerEmLotes(await caminhosDaImportacao(importacaoId));
  const { error: e } = await (await os()).rpc("desfazer_importacao", {
    p_importacao: importacaoId,
  });
  if (e) throw new Error(e.message);
  registrarDepois({
    modulo: "os",
    evento: "os_importacao_desfeita",
    descricao: `Desfez a importação do sistema de OS de ${new Date(imp.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    usuarioId,
    detalhes: { importacao_id: importacaoId },
  });
}
