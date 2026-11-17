import { describe, expect, it } from "vitest";
import {
  acessosDoDiaSchema,
  clientesSchema,
  garagensSchema,
  lancamentosSchema,
  limpezasDePatioSchema,
  selosUtilizadosSchema,
  validacoesSchema,
} from "@/connectors/wps/schemas";
import {
  acessosDoDia,
  contratosDe,
  eventosDe,
  garagemDe,
  instante,
  mensalidadesDe,
} from "./wps.detalhes";

// Dados fictícios, no formato que a homologação da WPS devolveu.

const acesso = (data: string, descricao: string, extra = {}) => ({
  codigo: 1,
  descricao,
  data,
  ticket: "000",
  placa: "AAA0A00",
  ticketCancelado: false,
  mensal: false,
  terminal: {},
  setor: {},
  tipoServico: {},
  ...extra,
});

describe("acessos por hora", () => {
  const entradas = acessosDoDiaSchema.parse({
    quantidade: 4,
    subdetalhes: {
      carro: {
        quantidade: 3,
        descricao: "carro",
        detalhes: [
          acesso("2026-11-03 09:10:00", "ROTATIVO"),
          acesso("2026-11-03 09:50:00", "ROTATIVO", { ticketCancelado: true }),
          acesso("2026-11-03 14:00:00", "MENSALISTA", {
            tipoServico: { codigo: 3, descricao: "SEM PARAR" },
          }),
        ],
      },
      // Somada pela WPS, mas sem a lista.
      moto: { quantidade: 1, descricao: "moto" },
      caminhao: { quantidade: 0, descricao: "caminhao" },
    },
  });
  const saidas = acessosDoDiaSchema.parse({
    quantidade: 1,
    subdetalhes: {
      carro: {
        quantidade: 1,
        descricao: "carro",
        detalhes: [acesso("2026-11-03 18:30:00", "CARENCIA")],
      },
    },
  });

  it("soma por sentido, hora, tipo de cliente, veículo e serviço", () => {
    const { linhas, semDetalhe } = acessosDoDia(entradas, saidas);
    expect(semDetalhe).toBe(1);
    expect(linhas).toEqual([
      {
        sentido: "entrada",
        hora: 9,
        tipo_cliente: "ROTATIVO",
        tipo_veiculo: "carro",
        servico: "",
        quantidade: 2,
        cancelados: 1,
      },
      {
        sentido: "entrada",
        hora: 14,
        tipo_cliente: "MENSALISTA",
        tipo_veiculo: "carro",
        servico: "SEM PARAR",
        quantidade: 1,
        cancelados: 0,
      },
      {
        sentido: "saida",
        hora: 18,
        tipo_cliente: "CARENCIA",
        tipo_veiculo: "carro",
        servico: "",
        quantidade: 1,
        cancelados: 0,
      },
    ]);
  });

  it("o schema não lê placa nem ticket", () => {
    const lido = entradas.subdetalhes.carro?.detalhes?.[0];
    expect(lido).not.toHaveProperty("placa");
    expect(lido).not.toHaveProperty("ticket");
  });
});

describe("eventos", () => {
  it("validações: achata situação e tipo", () => {
    const r = validacoesSchema.parse({
      quantidade: 1,
      detalhes: [
        {
          ISENCOES: {
            HIPERMERCADO: [
              {
                ticket: "1",
                data_hora_validacao: "2026-11-03 10:00:00",
                tempo_abonado: 120,
                valor_abonado: 12.5,
                tipo_abono: "HIPERMERCADO",
                cliente_validador: "HIPER EXEMPLO",
              },
            ],
            CONVENIO_CPF: [],
          },
          PAGANTES: { HIPERMERCADO: [], CONVENIO_CPF: [] },
        },
      ],
    });
    expect(eventosDe("validacao", r)).toEqual([
      {
        tipo: "validacao",
        ocorrido_em: "2026-11-03 10:00:00",
        ticket: "1",
        categoria: "HIPERMERCADO",
        situacao: "ISENCOES",
        detalhe: "HIPER EXEMPLO",
        setor: null,
        valor: 12.5,
        quantidade: 1,
        dados: { minutos: 120 },
      },
    ]);
  });

  it("selos utilizados: o tipo vem do grupo quando o selo não diz", () => {
    const r = selosUtilizadosSchema.parse({
      quantidade: 1,
      detalhes: [
        {
          HORA: {
            quantidade: 1,
            detalhes: [
              {
                data_utilizacao: "2026-11-03 11:00:00",
                ticket: "2",
                operador_caixa: "NÃO É LIDO",
                selo: { numero: 9, lote: 4, valor_descontado_tempo: 60 },
              },
            ],
          },
          VALOR_FIXO: { quantidade: 0, detalhes: [] },
        },
      ],
    });
    const [e] = eventosDe("selo_utilizado", r);
    expect(e).toMatchObject({
      categoria: "HORA",
      valor: null,
      dados: { lote: 4, minutos: 60 },
    });
    expect(JSON.stringify(e)).not.toContain("NÃO É LIDO");
  });

  it("limpeza de pátio: quantidade de veículos, sem a lista com placas", () => {
    const r = limpezasDePatioSchema.parse({
      quantidade: 1,
      detalhes: [
        {
          id: "1",
          data_manut: "2026-11-03 23:00:00",
          operador: "NÃO É LIDO",
          quantidade_excluido: 7,
          detalhes: [{ placa: "AAA0A00", ticket: "3" }],
        },
      ],
    });
    const [e] = eventosDe("manutencao_patio", r);
    expect(e).toMatchObject({
      quantidade: 7,
      ocorrido_em: "2026-11-03 23:00:00",
    });
    expect(JSON.stringify(e)).not.toContain("AAA0A00");
  });

  it("dia sem nada vira lista vazia", () => {
    expect(eventosDe("desconto", { quantidade: 0 })).toEqual([]);
  });

  it("instante: aceita 'T' e sem segundos; o resto vira null", () => {
    expect(instante("2026-11-03T08:05")).toBe("2026-11-03 08:05:00");
    expect(instante("03/11/2026")).toBeNull();
    expect(instante(null)).toBeNull();
  });
});

describe("cadastros", () => {
  it("contratos: nome só de pessoa jurídica; conta usuários e veículos", () => {
    const c = clientesSchema.parse({
      quantidade: 2,
      detalhes: [
        {
          nome_cliente: "LOJA EXEMPLO LTDA",
          documento: "00.000.000/0001-00",
          vagas: [
            {
              contrato: 0,
              tipo: "CREDENCIADO",
              data_criacao: "2026-08-11 00:00:00",
              situacao: "ATIVO",
              descricao_mensalidade: "",
              valor_mensalidade: 0,
              numero_vagas: 2,
              numero_usuarios: 5,
              usuarios: [
                {
                  usuario: "X",
                  cartao: "1",
                  veiculos: [{ placa: "A" }, { placa: "B" }],
                },
                { usuario: "Y", cartao: "2", veiculos: [] },
              ],
              grupo_acesso: {
                descricao_grupo_acesso: "LOJISTAS",
                zonas_tempos: [],
              },
            },
          ],
        },
        {
          nome_cliente: "PESSOA FISICA EXEMPLO",
          documento: "000.000.000-00",
          vagas: [
            {
              contrato: 7,
              tipo: "mensalista",
              situacao: "inativo",
              valor_mensalidade: 250,
            },
          ],
        },
      ],
    });
    expect(contratosDe(c)).toEqual([
      {
        contrato: 0,
        tipo: "CREDENCIADO",
        situacao: "ATIVO",
        cliente: "LOJA EXEMPLO LTDA",
        plano: null,
        valor_mensalidade: 0,
        vagas: 2,
        usuarios: 2,
        veiculos: 2,
        grupo_acesso: "LOJISTAS",
        criado_em: "2026-08-11",
      },
      {
        contrato: 7,
        tipo: "MENSALISTA",
        situacao: "INATIVO",
        cliente: null,
        plano: null,
        valor_mensalidade: 250,
        vagas: 0,
        usuarios: 0,
        veiculos: 0,
        grupo_acesso: null,
        criado_em: null,
      },
    ]);
  });

  it("mensalidades: status em maiúsculas; sem vencimento é descartada", () => {
    const l = lancamentosSchema.parse({
      quantidade: 1,
      detalhes: [
        {
          contrato: 3,
          data_inicio_contrato: "2026-10-05 12:55:01",
          data_fim_contrato: "2026-12-30 12:55:01",
          status_contrato: "Inadimplente",
          lancamentos: [
            {
              data_vencimento: "2026-10-07 00:00:00",
              data_pagamento: null,
              forma_pagamento: "BOLETO",
              valor_pendencia: 242,
              valor_pago: 0,
              status_lancamento: "Inadimplente",
            },
            {
              data_vencimento: "",
              forma_pagamento: "BOLETO",
              valor_pendencia: 1,
              status_lancamento: "Aberto",
            },
          ],
        },
      ],
    });
    const { linhas, descartadas } = mensalidadesDe(l);
    expect(descartadas).toBe(1);
    expect(linhas).toEqual([
      {
        contrato: 3,
        status_contrato: "INADIMPLENTE",
        contrato_inicio: "2026-10-05 12:55:01",
        contrato_fim: "2026-12-30 12:55:01",
        vencimento: "2026-10-07",
        pago_em: null,
        forma_pagamento: "BOLETO",
        valor: 242,
        valor_pago: 0,
        status: "INADIMPLENTE",
      },
    ]);
  });

  it("garagem: só a configurada, sem a chave e a senha da API", () => {
    const garagens = garagensSchema.parse([
      { id: 1, descricao: "OUTRA", chave: "x", senhaAPI: "y" },
      {
        id: 43,
        descricao: "GARAGEM",
        cidade: "RIO",
        uf: "RJ",
        qtdVagas: 800,
        chave: "x",
        senhaAPI: "y",
      },
    ]);
    expect(JSON.stringify(garagens)).not.toContain("senhaAPI");
    expect(
      garagemDe(garagens, 43, null, { mensalistas: 36, credenciados: 9 }),
    ).toEqual({
      descricao: "GARAGEM",
      cidade: "RIO",
      uf: "RJ",
      vagas: 800,
      vagas_mensalistas: null,
      clientes_mensalistas: 36,
      clientes_credenciados: 9,
      setores: [],
    });
    expect(
      garagemDe(garagens, 99, null, { mensalistas: null, credenciados: null }),
    ).toBeNull();
  });
});
