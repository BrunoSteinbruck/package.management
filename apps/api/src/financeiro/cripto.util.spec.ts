import { beforeAll, describe, expect, it } from "vitest";
import {
  cifrar,
  criptoConfigurado,
  decifrar,
  diagnosticoDeSubida,
} from "./cripto.util";

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

describe("diagnóstico de subida", () => {
  const CHAVE = "chave-de-teste-suficientemente-longa";

  it("com chave boa, cala a boca", () => {
    expect(diagnosticoDeSubida({ FINANCEIRO_CRIPTO_CHAVE: CHAVE })).toEqual({
      nivel: "ok",
    });
    expect(
      diagnosticoDeSubida({
        FINANCEIRO_CRIPTO_CHAVE: CHAVE,
        ASAAS_API_URL: "https://api.asaas.com/v3",
      }),
    ).toEqual({ nivel: "ok" });
  });

  it("sem chave e sem provedor real é aviso, não morte", () => {
    // O financeiro é módulo opcional por condomínio: derrubar a API inteira
    // por uma env que a maioria das instalações não usa seria pior.
    const d = diagnosticoDeSubida({});
    expect(d.nivel).toBe("aviso");
  });

  it("sem chave COM provedor real é fatal", () => {
    // Aqui o deploy subiria verde e não emitiria um boleto sequer.
    const d = diagnosticoDeSubida({ ASAAS_API_URL: "https://api.asaas.com/v3" });
    expect(d.nivel).toBe("fatal");
  });

  it("chave curta demais conta como ausente", () => {
    // 15 caracteres: o sha256 derivaria 32 bytes de qualquer coisa, então o
    // tamanho é a única defesa contra um segredo fraco.
    expect(diagnosticoDeSubida({ FINANCEIRO_CRIPTO_CHAVE: "x".repeat(15) }).nivel).toBe(
      "aviso",
    );
    expect(diagnosticoDeSubida({ FINANCEIRO_CRIPTO_CHAVE: "x".repeat(16) })).toEqual({
      nivel: "ok",
    });
  });
});
