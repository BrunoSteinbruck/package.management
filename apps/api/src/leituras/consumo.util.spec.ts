import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  agruparPorUnidade,
  alertaPara,
  consumosDerivados,
} from "./consumo.util";

const dec = (n: number) => ({ valor: new Prisma.Decimal(n) });

describe("consumosDerivados", () => {
  it("deriva consumos entre leituras consecutivas (desc)", () => {
    expect(consumosDerivados([dec(130), dec(120), dec(100)])).toEqual([10, 20]);
  });

  it("lida com decimais do Decimal sem erro de float", () => {
    expect(consumosDerivados([dec(10.3), dec(10.1)])).toEqual([0.2]);
  });

  it("limita ao máximo pedido", () => {
    const leituras = [9, 8, 7, 6, 5, 4, 3, 2, 1].map(dec);
    expect(consumosDerivados(leituras)).toHaveLength(6);
    expect(consumosDerivados(leituras, 2)).toEqual([1, 1]);
  });

  it("sem par de leituras não há consumo", () => {
    expect(consumosDerivados([dec(10)])).toEqual([]);
    expect(consumosDerivados([])).toEqual([]);
  });
});

describe("alertaPara", () => {
  it("sem consumo não há alerta", () => {
    expect(alertaPara(null, [10, 10])).toBeNull();
  });

  it("consumo negativo sempre alerta, mesmo sem histórico", () => {
    expect(alertaPara(-5, [])).toBe("NEGATIVO");
  });

  it("acima de 2x a média das últimas leituras alerta", () => {
    expect(alertaPara(41, [12, 13])).toBe("ACIMA_MEDIA");
    expect(alertaPara(24, [12, 12])).toBeNull(); // exatamente 2x não alerta
  });

  it("exige pelo menos 2 consumos de base", () => {
    expect(alertaPara(100, [10])).toBeNull();
    expect(alertaPara(100, [])).toBeNull();
  });

  it("consumo negativo no histórico não envenena a média", () => {
    // Média de [10, 10] = 10; o -100 é erro antigo e fica de fora.
    expect(alertaPara(25, [10, -100, 10])).toBe("ACIMA_MEDIA");
  });

  it("média zero (unidade vazia) não dispara acima da média", () => {
    expect(alertaPara(5, [0, 0])).toBeNull();
  });
});

describe("agruparPorUnidade", () => {
  it("agrupa preservando a ordem de chegada", () => {
    const m = agruparPorUnidade([
      { unidadeId: "a", v: 1 },
      { unidadeId: "b", v: 2 },
      { unidadeId: "a", v: 3 },
    ]);
    expect(m.get("a")?.map((x) => x.v)).toEqual([1, 3]);
    expect(m.get("b")?.map((x) => x.v)).toEqual([2]);
  });
});
