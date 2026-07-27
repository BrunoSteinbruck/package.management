import { describe, expect, it } from "vitest";
import {
  competenciaAtual,
  diasEntre,
  inicioDaCompetencia,
  nomeDaCompetencia,
  vencimentoDa,
} from "./competencia.util";

describe("calendário do financeiro", () => {
  it("competência vira o dia 1 em UTC", () => {
    expect(inicioDaCompetencia("2026-07").toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });

  it("vencimento normal", () => {
    expect(vencimentoDa("2026-07", 10)).toBe("2026-07-10");
  });

  it("dia 31 em fevereiro cai no último dia, não escorrega para março", () => {
    // O erro que isto evita: `new Date(2026, 1, 31)` vira 3 de março, e a
    // cobrança de fevereiro venceria em outro mês.
    expect(vencimentoDa("2026-02", 31)).toBe("2026-02-28");
    expect(vencimentoDa("2024-02", 31)).toBe("2024-02-29"); // bissexto
  });

  it("dia 31 em mês de 30 dias cai no dia 30", () => {
    expect(vencimentoDa("2026-04", 31)).toBe("2026-04-30");
    expect(vencimentoDa("2026-11", 31)).toBe("2026-11-30");
  });

  it("dia fora da faixa é encaixado em vez de gerar data inválida", () => {
    expect(vencimentoDa("2026-07", 0)).toBe("2026-07-01");
    expect(vencimentoDa("2026-07", 99)).toBe("2026-07-31");
  });

  it("diferença de dias atravessa a virada de mês e de ano", () => {
    expect(diasEntre("2026-07-10", "2026-07-13")).toBe(3);
    expect(diasEntre("2026-12-30", "2027-01-02")).toBe(3);
    expect(diasEntre("2026-07-13", "2026-07-10")).toBe(-3);
  });

  it("competência atual usa o fuso do condomínio, não o do servidor", () => {
    // 1º de agosto às 02:00 UTC ainda é 31 de julho em São Paulo: para o
    // condomínio a competência corrente é julho.
    const virada = new Date("2026-08-01T02:00:00.000Z");
    expect(competenciaAtual("America/Sao_Paulo", virada)).toBe("2026-07");
    expect(competenciaAtual("UTC", virada)).toBe("2026-08");
  });

  it("nome da competência sai por extenso para a descrição do boleto", () => {
    expect(nomeDaCompetencia("2026-07")).toBe("julho de 2026");
    expect(nomeDaCompetencia("2026-01")).toBe("janeiro de 2026");
  });
});
