import { describe, expect, it } from "vitest";
import {
  competenciaAtual,
  diasEntre,
  geracaoDevidaHoje,
  hojeNoFuso,
  inicioDaCompetencia,
  nomeDaCompetencia,
  somarDias,
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

  it("hoje no fuso do condomínio não vira antes da meia-noite dele", () => {
    // 22h de Brasília já é o dia seguinte em UTC. Era aqui que a régua de
    // cobrança pulava um dia inteiro de lembretes, todas as noites.
    const noite = new Date("2026-07-31T01:30:00.000Z");
    expect(hojeNoFuso("America/Sao_Paulo", noite)).toBe("2026-07-30");
    expect(hojeNoFuso("UTC", noite)).toBe("2026-07-31");
  });

  it("hoje no fuso atravessa a virada de ano do lado certo", () => {
    const reveillon = new Date("2027-01-01T02:00:00.000Z");
    expect(hojeNoFuso("America/Sao_Paulo", reveillon)).toBe("2026-12-31");
  });

  it("somar dias atravessa mês, ano e fevereiro bissexto", () => {
    expect(somarDias("2026-07-30", 3)).toBe("2026-08-02");
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(somarDias("2028-02-27", 3)).toBe("2028-03-01");
    expect(somarDias("2026-07-30", 0)).toBe("2026-07-30");
    expect(somarDias("2026-08-02", -3)).toBe("2026-07-30");
  });

  it("somar dias não escorrega no horário de verão", () => {
    // A conta é feita em UTC de propósito: um fuso com DST encolheria o dia
    // e o `+3` cairia no dia anterior às 23h.
    expect(diasEntre("2026-10-15", somarDias("2026-10-15", 3))).toBe(3);
    expect(diasEntre("2026-02-12", somarDias("2026-02-12", 3))).toBe(3);
  });
});

describe("janela da geração automática", () => {
  it("gera enquanto o vencimento está no futuro", () => {
    expect(geracaoDevidaHoje("2026-08-01", 10)).toBe(true);
    expect(geracaoDevidaHoje("2026-08-09", 10)).toBe(true);
  });

  it("não gera no dia do vencimento nem depois", () => {
    // Cobrança criada no próprio dia do vencimento nasce sem prazo, e a régua
    // a marcaria VENCIDA no ciclo seguinte: push de atraso para quem nunca
    // viu o boleto.
    expect(geracaoDevidaHoje("2026-08-10", 10)).toBe(false);
    expect(geracaoDevidaHoje("2026-08-31", 10)).toBe(false);
  });

  it("dia de vencimento 1 nunca gera sozinho", () => {
    // Não há dia do mês anterior ao dia 1. É consequência aceita da regra: com
    // vencimento no dia 1 a geração é sempre manual, e antecipada.
    expect(geracaoDevidaHoje("2026-08-01", 1)).toBe(false);
  });

  it("dia 31 em fevereiro segue a mesma correção do vencimento", () => {
    // O vencimento vira 28; então o dia 27 ainda gera e o 28 não.
    expect(geracaoDevidaHoje("2026-02-27", 31)).toBe(true);
    expect(geracaoDevidaHoje("2026-02-28", 31)).toBe(false);
  });

  it("a competência sai do próprio dia, sem virar mês", () => {
    // 31 de dezembro com vencimento no dia 10 não pode olhar para janeiro.
    expect(geracaoDevidaHoje("2026-12-31", 10)).toBe(false);
    expect(geracaoDevidaHoje("2027-01-05", 10)).toBe(true);
  });
});
