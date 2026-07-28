import { describe, expect, it } from "vitest";
import { extrairLeituraMedidor } from "./medidorParser";

describe("extrairLeituraMedidor", () => {
  it("lê o odômetro simples com zeros à esquerda", () => {
    expect(extrairLeituraMedidor("00458").sugestao).toBe(458);
  });

  it("prefere o comprimento típico de odômetro ao número mais curto", () => {
    // Texto realista de um visor: modelo, leitura e ano de fabricação.
    const { sugestao } = extrairLeituraMedidor("MOD 77\n00458\n2026");
    expect(sugestao).toBe(458);
  });

  it("descarta tokens colados em letras (série, modelo, unidade)", () => {
    expect(extrairLeituraMedidor("N123456 ABC-77").sugestao).toBeNull();
    expect(extrairLeituraMedidor("12345m3").sugestao).toBeNull();
  });

  it("entende vírgula decimal e ponto de milhar", () => {
    expect(extrairLeituraMedidor("1.234,5").sugestao).toBe(1234.5);
    expect(extrairLeituraMedidor("845,3").sugestao).toBe(845.3);
  });

  it("vários separadores viram milhar", () => {
    expect(extrairLeituraMedidor("1.234.567").sugestao).toBe(1234567);
  });

  it("texto sem número plausível devolve null", () => {
    expect(extrairLeituraMedidor("").sugestao).toBeNull();
    expect(extrairLeituraMedidor("agua fria").sugestao).toBeNull();
    // Dígito solto (< 2 dígitos) é ruído, não leitura.
    expect(extrairLeituraMedidor("7").sugestao).toBeNull();
  });

  it("lista candidatos únicos para desempate humano", () => {
    const { candidatos } = extrairLeituraMedidor("00458 00458 1234");
    expect(candidatos).toEqual([458, 1234]);
  });
});
