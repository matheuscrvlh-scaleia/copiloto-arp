import { randomUUID } from "node:crypto";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { chamadoAbertoDaOrigem } from "@/modules/os/sistema.service";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// Programas, link do parceiro, rondas e RCC de ponta a ponta na
// homologação: quem não tem acesso recebe 403; o administrador lê tudo; as
// gravações usam só registros criados aqui (um programa com um formulário
// publicado, um link, lançamentos, uma ronda e uma nota de 2001) e são
// desfeitas no fim. Ronda e nota só são gravadas se não há chamado aberto
// delas (gravar fecharia o chamado de verdade).

const SU = "/api/v1/sustentabilidade";
const MARCA = `teste-${randomUUID().slice(0, 8)}`;
const DEFINICAO = {
  secoes: [
    {
      id: "s1",
      nome: "Seção",
      ativa: true,
      perguntas: [
        {
          id: "q1",
          numero: "1",
          texto: "Quantidade",
          ajuda: "",
          tipo: "numero",
          obrigatoria: true,
          opcoes: [],
          unidades: [],
          mostrar_se: null,
          fonte_indicador: true,
          ativa: true,
          travada: false,
          auto: null,
        },
      ],
    },
  ],
};

descreverComBanco("sustentabilidade: programas, parceiro, rondas e RCC", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let anonimo: Navegador;
  let programaId: string | undefined;
  const formularioId = randomUUID();
  const hoje = hojeEmBrasilia(new Date());
  const mes = hoje.slice(0, 7);

  beforeAll(async () => {
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    anonimo = new Navegador(app);
    for (const [n, email] of [
      [admin, TESTE.email],
      [semAcesso, TESTE.emailSemAcesso],
    ] as const) {
      const r = await n.pedir("POST", "/api/v1/auth/entrar", {
        email,
        senha: TESTE.senha,
      });
      expect(r.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    // Rede de segurança: só o que este teste criou.
    await banco.comoServico(async (tx) => {
      if (programaId) {
        await tx
          .deleteFrom("sustentabilidade.lancamentos")
          .where("programa_id", "=", programaId)
          .execute();
        await tx
          .deleteFrom("sustentabilidade.programa_indicadores")
          .where("programa_id", "=", programaId)
          .execute();
        await tx
          .deleteFrom("sustentabilidade.programas")
          .where("id", "=", programaId)
          .where("nome", "=", MARCA)
          .execute();
      }
      await tx
        .deleteFrom("sustentabilidade.rondas")
        .where("observacao", "=", MARCA)
        .execute();
      await tx
        .deleteFrom("sustentabilidade.rcc_notas")
        .where("numero", "=", MARCA)
        .execute();
    });
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso: 403 nas leituras e gravações", async () => {
    const id = randomUUID();
    const leituras = [
      `${SU}/programas?mes=${mes}`,
      `${SU}/programas/${id}`,
      `${SU}/programas/${id}/resumo?mes=${mes}`,
      `${SU}/programas/${id}/indicadores`,
      `${SU}/programas/${id}/links`,
      `${SU}/programas/${id}/lancamentos?mes=${mes}`,
      `${SU}/lancamentos/${id}/correcao`,
      `${SU}/rondas?de=${hoje}&ate=${hoje}`,
      `${SU}/rondas/lancar`,
      `${SU}/rcc`,
    ];
    for (const url of leituras)
      expect((await semAcesso.pedir("GET", url)).statusCode, url).toBe(403);
    const gravacoes = [
      ["POST", `${SU}/programas`, { nome: "x", frequencia: "mensal" }],
      ["PATCH", `${SU}/programas/${id}/situacao`, { ativo: false }],
      ["POST", `${SU}/programas/${id}/link`, undefined],
      ["DELETE", `${SU}/programas/${id}/link`, undefined],
      [
        "POST",
        `${SU}/programas/${id}/lancamentos`,
        { formularioId: id, versao: 1, respostas: {}, data: hoje },
      ],
      ["DELETE", `${SU}/lancamentos/${id}`, undefined],
      ["POST", `${SU}/rondas/fotos`, { nome: "a.jpg", tamanho: 10 }],
      ["POST", `${SU}/rondas`, { itens: [] }],
      ["POST", `${SU}/rcc/pdf`, { nome: "a.pdf", tamanho: 10 }],
    ] as const;
    for (const [metodo, url, corpo] of gravacoes)
      expect(
        (await semAcesso.pedir(metodo, url, corpo)).statusCode,
        `${metodo} ${url}`,
      ).toBe(403);
  });

  it("parceiro com token inválido vê o link inativo (sem login)", async () => {
    const r = await anonimo.pedir("GET", `${SU}/parceiro/${"a".repeat(43)}`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ativo: false });
    const envio = await anonimo.pedir(
      "POST",
      `${SU}/parceiro/${"a".repeat(43)}/lancamentos`,
      { formularioId: randomUUID(), versao: 1, respostas: {}, data: hoje },
    );
    expect(envio.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("administrador cria o programa, lança, gera o link e o parceiro lança", async () => {
    const lista = await admin.pedir("GET", `${SU}/programas?mes=${mes}`);
    expect(lista.statusCode).toBe(200);

    const criado = await admin.pedir("POST", `${SU}/programas`, {
      nome: MARCA,
      descricao: "",
      area: "",
      parceiro_nome: "",
      parceiro_doc: "",
      inicio: "",
      fim: "",
      frequencia: "evento",
    });
    expect(criado.statusCode, criado.body).toBe(201);
    const id: string = criado.json().id;
    programaId = id;
    expect(
      (
        await admin.pedir("PATCH", `${SU}/programas/${id}`, {
          nome: MARCA,
          descricao: "editado",
          area: "",
          parceiro_nome: "",
          parceiro_doc: "",
          inicio: "",
          fim: "",
          frequencia: "evento",
        })
      ).statusCode,
    ).toBe(200);

    // Formulário publicado do programa (o editor é de outra tela).
    await banco.comoServico(async (tx) => {
      await tx
        .insertInto("sustentabilidade.formularios")
        .values({
          id: formularioId,
          tipo: "programa",
          programa_id: id,
          nome: MARCA,
          versao_publicada: 1,
          rascunho: JSON.stringify(DEFINICAO),
        })
        .execute();
      await tx
        .insertInto("sustentabilidade.formulario_versoes")
        .values({
          formulario_id: formularioId,
          versao: 1,
          definicao: JSON.stringify(DEFINICAO),
          resumo: "teste",
        })
        .execute();
    });

    for (const url of [
      `${SU}/programas/${id}`,
      `${SU}/programas/${id}/resumo?mes=${mes}`,
      `${SU}/programas/${id}/indicadores`,
      `${SU}/programas/${id}/links`,
    ])
      expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);

    const indicador = await admin.pedir(
      "POST",
      `${SU}/programas/${id}/indicadores`,
      {
        nome: "Quantidade",
        formulario_id: formularioId,
        campo_id: "q1",
        calculo: "soma",
        unidade: "",
        grupo: "",
        ordem: 1,
      },
    );
    expect(indicador.statusCode, indicador.body).toBe(201);

    // Lançar pela equipe, ler, abrir a correção, corrigir e excluir.
    const lancado = await admin.pedir(
      "POST",
      `${SU}/programas/${id}/lancamentos`,
      {
        formularioId,
        versao: 1,
        respostas: { q1: 3 },
        data: hoje,
      },
    );
    expect(lancado.statusCode, lancado.body).toBe(201);
    const doMes = await admin.pedir(
      "GET",
      `${SU}/programas/${id}/lancamentos?mes=${mes}`,
    );
    expect(doMes.statusCode).toBe(200);
    const lancamentos: { id: string }[] = doMes.json().lancamentos;
    expect(lancamentos).toHaveLength(1);
    const lid = lancamentos[0]?.id ?? "";
    expect(
      (await admin.pedir("GET", `${SU}/lancamentos/${lid}/correcao`))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await admin.pedir("PATCH", `${SU}/lancamentos/${lid}`, {
          respostas: { q1: 4 },
          data: hoje,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await admin.pedir("DELETE", `${SU}/lancamentos/${lid}`)).statusCode,
    ).toBe(200);
    const resumo = await admin.pedir(
      "GET",
      `${SU}/programas/${id}/resumo?mes=${mes}`,
    );
    expect(resumo.json().indicadores).toHaveLength(1);

    // Link: gerar, o parceiro abre e lança, desligar, e o link não volta.
    const gerado = await admin.pedir("POST", `${SU}/programas/${id}/link`);
    expect(gerado.statusCode, gerado.body).toBe(200);
    const token = String(gerado.json().link).split("/parceiro/")[1] ?? "";
    expect(token.length).toBeGreaterThan(20);
    const pagina = await anonimo.pedir("GET", `${SU}/parceiro/${token}`);
    expect(pagina.statusCode).toBe(200);
    const p = pagina.json();
    expect(p.ativo).toBe(true);
    expect(p.programa).toBe(MARCA);
    expect(p.formularios).toHaveLength(1);
    expect(JSON.stringify(p)).not.toContain("custo");
    const doParceiro = await anonimo.pedir(
      "POST",
      `${SU}/parceiro/${token}/lancamentos`,
      { formularioId, versao: 1, respostas: { q1: 2 }, data: hoje },
    );
    expect(doParceiro.statusCode, doParceiro.body).toBe(201);
    const depois = (
      await anonimo.pedir("GET", `${SU}/parceiro/${token}`)
    ).json();
    expect(depois.lancamentos).toHaveLength(1);
    const corrigido = await anonimo.pedir(
      "PATCH",
      `${SU}/parceiro/${token}/lancamentos/${depois.lancamentos[0].id}`,
      { respostas: { q1: 5 }, data: hoje },
    );
    expect(corrigido.statusCode, corrigido.body).toBe(200);
    const links = await admin.pedir("GET", `${SU}/programas/${id}/links`);
    expect(links.json().links[0].lancamentos).toBe(1);

    expect(
      (await admin.pedir("DELETE", `${SU}/programas/${id}/link`)).statusCode,
    ).toBe(200);
    expect(
      (await anonimo.pedir("GET", `${SU}/parceiro/${token}`)).json(),
    ).toEqual({ ativo: false });
    const aposDesligar = await anonimo.pedir(
      "POST",
      `${SU}/parceiro/${token}/lancamentos`,
      { formularioId, versao: 1, respostas: { q1: 1 }, data: hoje },
    );
    expect(aposDesligar.statusCode).toBeGreaterThanOrEqual(400);

    // Inativar e reativar.
    for (const ativo of [false, true])
      expect(
        (
          await admin.pedir("PATCH", `${SU}/programas/${id}/situacao`, {
            ativo,
          })
        ).statusCode,
      ).toBe(200);
  }, 180_000);

  it("administrador lê e lança a ronda (sem chamado aberto)", async () => {
    expect(
      (await admin.pedir("GET", `${SU}/rondas?de=${mes}-01&ate=${hoje}`))
        .statusCode,
    ).toBe(200);
    const lancar = await admin.pedir("GET", `${SU}/rondas/lancar`);
    expect(lancar.statusCode).toBe(200);
    const aberto = await banco.comoServico((tx) =>
      chamadoAbertoDaOrigem(tx, "sustentabilidade", "ronda"),
    );
    const coletor: { id: string } | undefined = lancar.json().coletores[0];
    if (aberto || !coletor) return;
    const r = await admin.pedir("POST", `${SU}/rondas`, {
      itens: [{ coletorId: coletor.id, conteineres: 1, ocupacaoPct: 0 }],
      observacao: MARCA,
    });
    expect(r.statusCode, r.body).toBe(200);
  });

  it("administrador lê o RCC e lança uma nota (sem chamado aberto)", async () => {
    const rcc = await admin.pedir("GET", `${SU}/rcc`);
    expect(rcc.statusCode).toBe(200);
    const empresa: string | undefined = rcc.json().empresas[0];
    const aberto = await banco.comoServico((tx) =>
      chamadoAbertoDaOrigem(tx, "sustentabilidade", "rcc"),
    );
    if (aberto || !empresa) return;
    const pdf = Buffer.from("%PDF-1.4\n%teste\n");
    const preparo = await admin.pedir("POST", `${SU}/rcc/pdf`, {
      nome: "nota.pdf",
      tamanho: pdf.length,
    });
    expect(preparo.statusCode, preparo.body).toBe(200);
    const { url, path } = preparo.json();
    const envio = await app.inject({
      method: "PUT",
      url,
      headers: { "content-type": "application/pdf", "x-upsert": "false" },
      payload: pdf,
    });
    expect(envio.statusCode).toBe(200);
    const nota = await admin.pedir("POST", `${SU}/rcc/notas`, {
      competencia: "2001-01",
      empresa,
      numero: MARCA,
      pdf: path,
      cacambasA: 1,
      cacambasB: 0,
      valorTotal: "",
    });
    expect(nota.statusCode, nota.body).toBe(200);
    expect(nota.json()).toHaveProperty("mensagem");
  });
});
