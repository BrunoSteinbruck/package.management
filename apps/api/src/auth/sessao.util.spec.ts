import { describe, expect, it } from "vitest";
import { validadeDaSessao } from "./sessao.util";

describe("validade da sessão", () => {
  it("painel vale 24 horas", () => {
    expect(validadeDaSessao("painel")).toBe("24h");
  });

  it("app vale 90 dias", () => {
    // `undefined` é o caso do app e o de todo token emitido antes deste
    // campo existir: sem tratamento, uma sessão antiga renovaria curto e
    // derrubaria o morador do nada.
    expect(validadeDaSessao(undefined)).toBe("90d");
  });
});
