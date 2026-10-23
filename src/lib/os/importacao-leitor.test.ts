import { describe, expect, it } from "vitest";
import {
  caminhoNormal,
  chaveDaColuna,
  decodificar,
  ErroPacote,
  escolherLeitor,
  indiceDeArquivos,
  LEITOR_PACOTE,
  lerCsv,
} from "./importacao-leitor";
import {
  type ArquivoDoPacote,
  lerData,
  lerDataHora,
  lerHora,
  lerNumero,
} from "./importacao-modelo";

const arquivo = (
  nome: string,
  conteudo: string | Uint8Array,
): ArquivoDoPacote => {
  const bytes =
    typeof conteudo === "string"
      ? new TextEncoder().encode(conteudo)
      : conteudo;
  return { nome, tamanho: bytes.length, ler: async () => bytes };
};

describe("campos no jeito brasileiro", () => {
  it("números, datas e horas", () => {
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("0,4485")).toBe(0.4485);
    expect(lerNumero("12")).toBe(12);
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("abc")).toBe("abc");
    expect(lerData("21/10/2026")).toBe("2026-10-21");
    expect(lerData("1/2/2026")).toBe("2026-02-01");
    expect(lerData("2026-10-21T08:00")).toBe("2026-10-21");
    expect(lerHora("8:05")).toBe("08:05");
    expect(lerHora("08:05:59")).toBe("08:05");
    expect(lerDataHora("21/10/2026 08:05")).toBe("2026-10-21T08:05:00-03:00");
    expect(lerDataHora("2026-10-21")).toBe("2026-10-21T00:00:00-03:00");
    expect(lerDataHora("2026-10-21T11:05:00Z")).toBe("2026-10-21T11:05:00Z");
  });
});

describe("CSV", () => {
  it("separador ; com aspas, quebra de linha dentro e BOM", () => {
    const csv =
      '﻿Id;Nome do Técnico;Valor\r\n1;"Silva; Ana";"0,45"\r\n2;"Linha\nquebrada";\r\n\r\n';
    expect(lerCsv(csv)).toEqual([
      { id: "1", nome_do_tecnico: "Silva; Ana", valor: "0,45" },
      { id: "2", nome_do_tecnico: "Linha\nquebrada", valor: "" },
    ]);
  });

  it("separador vírgula e aspas escapadas", () => {
    expect(lerCsv('a,b\n"diz ""oi""",2')).toEqual([{ a: 'diz "oi"', b: "2" }]);
  });

  it("chave da coluna sem acento", () => {
    expect(chaveDaColuna(" Data de Conclusão ")).toBe("data_de_conclusao");
  });

  it("texto em UTF-8 ou na página de código do Windows", () => {
    expect(decodificar(new TextEncoder().encode("ação"))).toBe("ação");
    expect(decodificar(new Uint8Array([0x61, 0xe7, 0xe3, 0x6f]))).toBe("ação");
  });
});

describe("arquivos citados", () => {
  const achar = indiceDeArquivos([
    arquivo("Backup/Fotos/OS 12/Antes.JPG", ""),
    arquivo("fotos/depois.jpg", ""),
    arquivo("outra/depois.jpg", ""),
  ]);
  it("pelo caminho, dentro de fotos/ ou pelo nome", () => {
    expect(achar("Fotos\\OS 12\\antes.jpg")?.nome).toBe(
      "Backup/Fotos/OS 12/Antes.JPG",
    );
    expect(achar("depois.jpg")?.nome).toBe("fotos/depois.jpg");
    expect(achar("antes.jpg")?.nome).toBe("Backup/Fotos/OS 12/Antes.JPG");
    expect(achar("nao-existe.jpg")).toBeNull();
  });
  it("normaliza o caminho", () => {
    expect(caminhoNormal(".\\Fotos\\A.jpg")).toBe("fotos/a.jpg");
  });
});

describe("pacote de importação", () => {
  it("lê JSON e CSV e recusa linha inválida com o motivo", async () => {
    const arquivos = [
      arquivo(
        "pacote/manifesto.json",
        JSON.stringify({ sistema: "O.S Arp 4.42", totais: { tecnicos: "2" } }),
      ),
      arquivo(
        "pacote/tecnicos.csv",
        "id;nome;valor_minuto;desligado_em\n1;Técnico A;0,45;\n2;;0,5;\n3;Técnico C;;01/09/2026",
      ),
      arquivo(
        "pacote/os_internas.json",
        JSON.stringify({
          os_internas: [
            {
              numero: 10,
              status: "Finalizado",
              aberta_em: "20/10/2026 08:00",
              sessoes: [
                {
                  data: "20/10/2026",
                  inicio: "8:00",
                  fim: "12:00",
                  tecnicos: "1|3",
                },
              ],
              materiais: [
                { descricao: "Fita", quantidade: "2", valor_unitario: "7,50" },
              ],
              fotos: ["antes.jpg"],
            },
          ],
        }),
      ),
    ];
    expect(escolherLeitor(arquivos)).toBe(LEITOR_PACOTE);
    const p = await LEITOR_PACOTE.ler(arquivos);
    expect(p.manifesto.totais.tecnicos).toBe(2);
    expect(p.registros.tecnicos.map((t) => t.nome)).toEqual([
      "Técnico A",
      "Técnico C",
    ]);
    expect(p.registros.tecnicos[1]?.desligado_em).toBe("2026-09-01");
    expect(p.recusadas).toEqual([
      expect.objectContaining({ tipo: "tecnicos", linha: 3 }),
    ]);
    const os = p.registros.os_internas[0];
    expect(os?.aberta_em).toBe("2026-10-20T08:00:00-03:00");
    expect(os?.sessoes[0]?.tecnicos).toEqual(["1", "3"]);
    expect(os?.materiais[0]?.valor_unitario).toBe(7.5);
    expect(os?.fotos[0]).toEqual({ arquivo: "antes.jpg", tipo: "foto" });
  });

  it("sem manifesto não reconhece; JSON quebrado explica", async () => {
    expect(() => escolherLeitor([arquivo("tecnicos.csv", "id;nome")])).toThrow(
      ErroPacote,
    );
    await expect(
      LEITOR_PACOTE.ler([
        arquivo("manifesto.json", "{}"),
        arquivo("tarefas.json", "{ quebrado"),
      ]),
    ).rejects.toThrow(/não é um JSON válido/);
  });
});
