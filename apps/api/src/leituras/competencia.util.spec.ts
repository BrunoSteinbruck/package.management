import { describe, expect, it } from "vitest";
import {
  competenciaParaData,
  dataParaCompetencia,
  somarMeses,
} from "./competencia.util";

describe("competencia.util", () => {
  it("converte competência para o dia 1 do mês em UTC", () => {
    const d = competenciaParaData("2026-07");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(6);
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
  });

  it("faz ida e volta sem deslocar o mês (o bug clássico de fuso)", () => {
    for (const comp of ["2026-01", "2026-07", "2026-12", "1999-02"]) {
      expect(dataParaCompetencia(competenciaParaData(comp))).toBe(comp);
    }
  });

  it("soma meses atravessando viradas de ano", () => {
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-07", -12)).toBe("2025-07");
    expect(somarMeses("2026-07", 0)).toBe("2026-07");
    expect(somarMeses("2026-03", -25)).toBe("2024-02");
  });
});
