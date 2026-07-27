import { beforeAll, describe, expect, it } from "vitest";
import { cifrar, criptoConfigurado, decifrar } from "./cripto.util";

describe("cifra das credenciais de cobrança", () => {
  beforeAll(() => {
    process.env.FINANCEIRO_CRIPTO_CHAVE = "chave-de-teste-suficientemente-longa";
  });

  it("decifra o que cifrou", () => {
    const segredo = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZm";
    expect(decifrar(cifrar(segredo))).toBe(segredo);
  });

  it("o texto cifrado não contém o segredo", () => {
    const segredo = "chave-secreta-do-asaas";
    expect(cifrar(segredo)).not.toContain(segredo);
  });

  it("duas cifragens do mesmo valor são diferentes", () => {
    // IV novo a cada chamada: sem isso, valores iguais gerariam saídas iguais
    // e um dump revelaria quais condomínios compartilham credencial.
    expect(cifrar("igual")).not.toBe(cifrar("igual"));
  });

  it("valor adulterado falha em vez de decifrar em lixo", () => {
    const guardado = cifrar("original");
    const [iv, tag, cifrado] = guardado.split(":");
    const adulterado = [
      iv,
      tag,
      cifrado.slice(0, -2) + (cifrado.slice(-2) === "AA" ? "BB" : "AA"),
    ].join(":");
    expect(() => decifrar(adulterado)).toThrow();
  });

  it("formato inválido é recusado", () => {
    expect(() => decifrar("sem-separadores")).toThrow("formato inválido");
  });

  it("sem chave-mestra, falha fechado", () => {
    const anterior = process.env.FINANCEIRO_CRIPTO_CHAVE;
    process.env.FINANCEIRO_CRIPTO_CHAVE = "";
    try {
      expect(criptoConfigurado()).toBe(false);
      // Falhar é o comportamento certo: guardar em claro seria pior.
      expect(() => cifrar("x")).toThrow("FINANCEIRO_CRIPTO_CHAVE");
    } finally {
      process.env.FINANCEIRO_CRIPTO_CHAVE = anterior;
    }
  });
});
