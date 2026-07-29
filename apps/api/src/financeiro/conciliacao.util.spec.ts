import { describe, expect, it } from "vitest";
import { conciliar, type Alvo, type LinhaExtrato } from "./conciliacao.util";

/**
 * Os cenários vêm da entrevista com um síndico real: a ferramenta dele marca
 * a divergência em vermelho e ele investiga uma a uma. Quase tudo é data
 * deslocada por fim de semana ou centavos de tarifa. O motor precisa
 * transformar exatamente ESSES casos em sugestão com explicação, e recusar
 * os que merecem investigação humana.
 */

function entrada(id: string, data: string, centavos: number): LinhaExtrato {
  return { id, data, valorCentavos: centavos, descricao: `pix ${id}` };
}

function cobranca(id: string, data: string, centavos: number): Alvo {
  return { id, tipo: "COBRANCA", data, valorCentavos: centavos, rotulo: id };
}

function despesa(id: string, data: string, centavos: number): Alvo {
  return { id, tipo: "DESPESA", data, valorCentavos: centavos, rotulo: id };
}

describe("casamento exato", () => {
  it("valor e data iguais casam com confiança exata", () => {
    const r = conciliar(
      [entrada("e1", "2026-07-10", 45050)],
      [cobranca("c1", "2026-07-10", 45050)],
    );
    expect(r.sugestoes).toHaveLength(1);
    expect(r.sugestoes[0].confianca).toBe("exata");
    expect(r.sugestoes[0].motivo).toBe("valor e data batem");
    expect(r.semPar).toHaveLength(0);
  });
});

describe("o caso do fim de semana (a dor número 1)", () => {
  it("pago no sábado, compensado na segunda: sugere e explica", () => {
    // 2026-07-11 é sábado; 2026-07-13 é segunda.
    const r = conciliar(
      [entrada("e1", "2026-07-13", 45050)],
      [cobranca("c1", "2026-07-11", 45050)],
    );
    expect(r.sugestoes).toHaveLength(1);
    expect(r.sugestoes[0].confianca).toBe("provavel");
    expect(r.sugestoes[0].motivo).toContain("fim de semana");
    expect(r.sugestoes[0].deltaDias).toBe(2);
  });

  it("pago na sexta, liquidado na segunda: menciona a sexta", () => {
    // 2026-07-10 é sexta.
    const r = conciliar(
      [entrada("e1", "2026-07-13", 45050)],
      [cobranca("c1", "2026-07-10", 45050)],
    );
    expect(r.sugestoes[0].motivo).toContain("sexta");
  });

  it("mais de 4 dias de diferença não vira sugestão", () => {
    const r = conciliar(
      [entrada("e1", "2026-07-20", 45050)],
      [cobranca("c1", "2026-07-10", 45050)],
    );
    expect(r.sugestoes).toHaveLength(0);
    expect(r.semPar).toEqual(["e1"]);
    expect(r.alvosSemExtrato).toEqual(["c1"]);
  });
});

describe("o caso dos centavos (a dor número 2)", () => {
  it("mesma data, centavos a menos: sugere citando o valor da diferença", () => {
    const r = conciliar(
      [entrada("e1", "2026-07-10", 44995)],
      [cobranca("c1", "2026-07-10", 45050)],
    );
    expect(r.sugestoes).toHaveLength(1);
    expect(r.sugestoes[0].motivo).toContain("0,55");
    expect(r.sugestoes[0].motivo).toContain("tarifa ou arredondamento");
  });

  it("mais de R$1,00 de diferença é investigação humana, não sugestão", () => {
    const r = conciliar(
      [entrada("e1", "2026-07-10", 44900)],
      [cobranca("c1", "2026-07-10", 45050)],
    );
    expect(r.sugestoes).toHaveLength(0);
  });

  it("data E valor divergindo ao mesmo tempo não vira sugestão", () => {
    // Cada desvio isolado seria tolerável; juntos, é chute com cara de
    // certeza, que é pior que a linha vermelha do concorrente.
    const r = conciliar(
      [entrada("e1", "2026-07-12", 45000)],
      [cobranca("c1", "2026-07-10", 45050)],
    );
    expect(r.sugestoes).toHaveLength(0);
  });
});

describe("direção do dinheiro", () => {
  it("entrada nunca casa com despesa, nem saída com cobrança", () => {
    const r = conciliar(
      [entrada("e1", "2026-07-10", 45050), entrada("s1", "2026-07-10", -45050)],
      [despesa("d1", "2026-07-10", 45050), cobranca("c1", "2026-07-10", 45050)],
    );
    const porLinha = new Map(r.sugestoes.map((s) => [s.extratoItemId, s]));
    expect(porLinha.get("e1")?.alvoTipo).toBe("COBRANCA");
    expect(porLinha.get("s1")?.alvoTipo).toBe("DESPESA");
  });
});

describe("um para um", () => {
  it("duas mensalidades iguais no mesmo dia viram dois pares, não um duplo", () => {
    const r = conciliar(
      [entrada("e1", "2026-07-10", 45050), entrada("e2", "2026-07-10", 45050)],
      [cobranca("c1", "2026-07-10", 45050), cobranca("c2", "2026-07-10", 45050)],
    );
    expect(r.sugestoes).toHaveLength(2);
    expect(new Set(r.sugestoes.map((s) => s.alvoId)).size).toBe(2);
  });

  it("o par exato vence o aproximado quando disputam o mesmo alvo", () => {
    const r = conciliar(
      [entrada("e1", "2026-07-12", 45050), entrada("e2", "2026-07-10", 45050)],
      [cobranca("c1", "2026-07-10", 45050)],
    );
    expect(r.sugestoes).toHaveLength(1);
    expect(r.sugestoes[0].extratoItemId).toBe("e2");
    expect(r.sugestoes[0].confianca).toBe("exata");
    expect(r.semPar).toEqual(["e1"]);
  });
});
