import { describe, expect, it } from "vitest";
import { termoLiteral } from "./busca.util";

describe("termo de busca virando texto literal", () => {
  it("não mexe no que já é literal", () => {
    expect(termoLiteral("302")).toBe("302");
    expect(termoLiteral("BR1000 04XX")).toBe("BR1000 04XX");
    expect(termoLiteral("Mercado Livre")).toBe("Mercado Livre");
  });

  it("desarma os curingas do LIKE", () => {
    // Buscar "_" devolvia a lista inteira de encomendas.
    expect(termoLiteral("_")).toBe("\\_");
    expect(termoLiteral("%")).toBe("\\%");
    expect(termoLiteral("A_a")).toBe("A\\_a");
    expect(termoLiteral("100%_off")).toBe("100\\%\\_off");
  });

  it("escapa a contrabarra antes dos curingas", () => {
    // Na ordem inversa, o escape do "%" produziria "\\%" e o passo seguinte
    // escaparia aquela contrabarra recém-inserida, virando "\\\\%": o termo
    // voltaria a ser curinga.
    expect(termoLiteral("\\")).toBe("\\\\");
    expect(termoLiteral("\\%")).toBe("\\\\\\%");
  });

  it("deixa acento e emoji em paz", () => {
    expect(termoLiteral("São João")).toBe("São João");
    expect(termoLiteral("🎉")).toBe("🎉");
  });

  it("é idempotente no sentido que importa: aplicar de novo não perde texto", () => {
    // Não é idempotente literalmente (escapar duas vezes dobra as barras), e o
    // teste existe para lembrar de aplicar em UM lugar só.
    expect(termoLiteral(termoLiteral("_"))).toBe("\\\\\\_");
  });
});
