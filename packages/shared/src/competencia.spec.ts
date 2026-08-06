import { describe, expect, it } from "vitest";
import {
  competenciaDeData,
  mesAno,
  mesCapitalizado,
  mesCurto,
  mesCurtoAno,
  mesDeAno,
  mesPorExtenso,
} from "./competencia";

/**
 * Os doze meses fixados um a um, e não gerados por laço a partir da mesma
 * lista que o código usa: um teste que deriva do próprio dado não descobre
 * que o dado está errado. É o que trava "Março" → "mar" (e não "mar" virar
 * "mço" se alguém trocar a abreviação por um `replace` esperto).
 */
const ESPERADO = [
  ["2026-01", "Janeiro", "jan"],
  ["2026-02", "Fevereiro", "fev"],
  ["2026-03", "Março", "mar"],
  ["2026-04", "Abril", "abr"],
  ["2026-05", "Maio", "mai"],
  ["2026-06", "Junho", "jun"],
  ["2026-07", "Julho", "jul"],
  ["2026-08", "Agosto", "ago"],
  ["2026-09", "Setembro", "set"],
  ["2026-10", "Outubro", "out"],
  ["2026-11", "Novembro", "nov"],
  ["2026-12", "Dezembro", "dez"],
] as const;

describe("os doze meses, em todos os formatos", () => {
  it.each(ESPERADO)("%s", (competencia, nome, curto) => {
    expect(mesCapitalizado(competencia)).toBe(nome);
    expect(mesPorExtenso(competencia)).toBe(nome.toLowerCase());
    expect(mesAno(competencia)).toBe(`${nome}/2026`);
    expect(mesDeAno(competencia)).toBe(`${nome} de 2026`);
    expect(mesCurto(competencia)).toBe(curto);
    expect(mesCurtoAno(competencia)).toBe(`${curto}/2026`);
  });
});

/**
 * Cada linha aqui é o formato que UMA tela mostrava antes desta extração. Se
 * algum deles mudar, a tela correspondente mudou de texto sem ninguém pedir.
 */
describe("os formatos que já estavam na tela continuam iguais", () => {
  it("Consumos e Financeiro: 'Julho/2026'", () => {
    expect(mesAno("2026-07")).toBe("Julho/2026");
  });

  it("Boletos: 'Julho' e 'Julho de 2025'", () => {
    expect(mesCapitalizado("2026-07")).toBe("Julho");
    expect(mesDeAno("2025-07")).toBe("Julho de 2025");
  });

  it("Leitura anterior e conciliação: 'jun/2026'", () => {
    expect(mesCurtoAno("2026-06")).toBe("jun/2026");
  });

  it("Barra do gráfico de consumos: 'jul'", () => {
    expect(mesCurto("2026-07")).toBe("jul");
  });

  it("Leituras da portaria: 'julho'", () => {
    expect(mesPorExtenso("2026-07")).toBe("julho");
  });
});

describe("competência inválida volta como veio", () => {
  /**
   * Quatro das seis cópias indexavam o array sem checar nada e escreviam
   * "undefined/2026" na tela. Devolver a entrada crua não conserta o dado
   * ruim, mas para de inventar uma palavra que não existe.
   */
  it.each([
    "2026-13",
    "2026-00",
    "2026-7x",
    "2026",
    "julho",
    "",
    "26-07",
  ])("%s", (ruim) => {
    for (const f of [
      mesCapitalizado,
      mesPorExtenso,
      mesAno,
      mesDeAno,
      mesCurto,
      mesCurtoAno,
    ]) {
      expect(f(ruim)).toBe(ruim);
    }
  });

  it("mês de um dígito sem zero à esquerda ainda é lido", () => {
    // O banco sempre grava "2026-07", mas texto montado à mão chega assim.
    expect(mesAno("2026-7")).toBe("Julho/2026");
  });
});

describe("competência a partir da coluna DATE", () => {
  it("lê o mês em UTC, não no fuso do servidor", () => {
    // A coluna guarda o dia 1 à meia-noite UTC. Com getMonth() local, no
    // Brasil isso volta como o dia 30 do mês ANTERIOR: a cobrança de julho
    // apareceria conciliada como junho.
    expect(competenciaDeData(new Date("2026-07-01T00:00:00.000Z"))).toBe("2026-07");
    expect(competenciaDeData(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
    expect(competenciaDeData(new Date("2026-12-01T00:00:00.000Z"))).toBe("2026-12");
  });

  it("vai e volta: data vira competência que vira o mesmo rótulo", () => {
    expect(mesCurtoAno(competenciaDeData(new Date("2026-06-01T00:00:00.000Z")))).toBe(
      "jun/2026",
    );
  });
});
