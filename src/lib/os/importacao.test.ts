import { describe, expect, it } from "vitest";
import {
  mapearStatusOS,
  mapearStatusTarefa,
  mapearStatusVistoria,
} from "./importacao";

describe("de-para do sistema antigo", () => {
  it("O.S.", () => {
    expect(mapearStatusOS("Aberto")).toEqual({ status: "aberto" });
    expect(mapearStatusOS("EM ANÁLISE")).toEqual({ status: "em_andamento" });
    expect(mapearStatusOS("  em   andamento ")).toEqual({
      status: "em_andamento",
    });
    expect(mapearStatusOS("Aguardando Material")).toEqual({
      status: "aguardando",
      aguardando_tipo: "material",
    });
    expect(mapearStatusOS("Finalizado")).toEqual({ status: "fechado" });
    expect(mapearStatusOS("Concluída")).toEqual({ status: "fechado" });
    expect(mapearStatusOS("Cancelada")).toEqual({ status: "cancelado" });
    expect(mapearStatusOS("Cancelado")).toEqual({ status: "cancelado" });
  });

  it("tarefa", () => {
    expect(mapearStatusTarefa("Pendente")).toEqual({ status: "aberto" });
    expect(mapearStatusTarefa("Em andamento")).toEqual({
      status: "em_andamento",
    });
    expect(mapearStatusTarefa("Concluida")).toEqual({ status: "fechado" });
    expect(mapearStatusTarefa("Convertida em O.S")).toEqual({
      status: "fechado",
      convertida_em_os: true,
    });
    expect(mapearStatusTarefa("convertida em o.s.")?.convertida_em_os).toBe(
      true,
    );
  });

  it("vistoria", () => {
    expect(mapearStatusVistoria("Andamento")).toEqual({ status: "andamento" });
    expect(mapearStatusVistoria("FINALIZADO")).toEqual({
      status: "finalizado",
    });
    expect(mapearStatusVistoria("Cancelado")).toEqual({ status: "cancelado" });
  });

  it("fora da tabela: null (a importação pede para escolher)", () => {
    expect(mapearStatusOS("Pendente")).toBeNull();
    expect(mapearStatusTarefa("Aguardando Material")).toBeNull();
    expect(mapearStatusVistoria("Aberto")).toBeNull();
    expect(mapearStatusOS("toString")).toBeNull();
  });
});
