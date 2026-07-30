import { describe, expect, it } from "vitest";
import { lerValorEmReais } from "./valor";

describe("valor em reais escrito por gente", () => {
  it("inteiro simples", () => {
    expect(lerValorEmReais("1500")).toBe(1500);
    expect(lerValorEmReais("0")).toBe(0);
    expect(lerValorEmReais("  200  ")).toBe(200);
  });

  it("vírgula é decimal, como em pt-BR", () => {
    expect(lerValorEmReais("1500,50")).toBe(1500.5);
    expect(lerValorEmReais("1,5")).toBe(1.5);
    expect(lerValorEmReais("0,99")).toBe(0.99);
  });

  it("milhar com ponto e centavos com vírgula, que era o bug", () => {
    // `Number("1.500,00".replace(",","."))` dava NaN, e a tela respondia
    // "Preencha descrição e valor" para um valor perfeitamente escrito.
    expect(lerValorEmReais("1.500,00")).toBe(1500);
    expect(lerValorEmReais("1.500,50")).toBe(1500.5);
    expect(lerValorEmReais("12.345,67")).toBe(12345.67);
    expect(lerValorEmReais("1.234.567,89")).toBe(1234567.89);
  });

  it("milhar sem centavos", () => {
    expect(lerValorEmReais("1.500")).toBe(1500);
    expect(lerValorEmReais("12.500")).toBe(12500);
    expect(lerValorEmReais("1.234.567")).toBe(1234567);
  });

  it("ponto decimal do teclado do computador", () => {
    expect(lerValorEmReais("1.5")).toBe(1.5);
    expect(lerValorEmReais("1.50")).toBe(1.5);
    expect(lerValorEmReais("0.500")).toBe(0.5);
    expect(lerValorEmReais("0.99")).toBe(0.99);
  });

  it("formato inglês colado do exterior", () => {
    expect(lerValorEmReais("1,234.56")).toBe(1234.56);
  });

  it("R$ colado do extrato do banco", () => {
    expect(lerValorEmReais("R$ 200")).toBe(200);
    expect(lerValorEmReais("R$ 1.500,00")).toBe(1500);
    expect(lerValorEmReais("r$1.500,00")).toBe(1500);
  });

  it("espaço não separável de planilha", () => {
    expect(lerValorEmReais("1 500")).toBe(1500);
  });

  it("recusa o que só um colar produz", () => {
    expect(lerValorEmReais("0x10")).toBeNull();
    expect(lerValorEmReais("1e5")).toBeNull();
    expect(lerValorEmReais("1e-3")).toBeNull();
    expect(lerValorEmReais("Infinity")).toBeNull();
    expect(lerValorEmReais("NaN")).toBeNull();
  });

  it("recusa negativo, vazio e emoji", () => {
    expect(lerValorEmReais("-50")).toBeNull();
    expect(lerValorEmReais("")).toBeNull();
    expect(lerValorEmReais("   ")).toBeNull();
    expect(lerValorEmReais("🎉")).toBeNull();
    expect(lerValorEmReais("mil reais")).toBeNull();
    expect(lerValorEmReais("١٥٠٠")).toBeNull();
  });

  it("recusa separador em posição impossível", () => {
    expect(lerValorEmReais("1.50.75")).toBeNull();
    expect(lerValorEmReais("1,50,75")).toBeNull();
    expect(lerValorEmReais("1.2,3,4")).toBeNull();
  });

  it("nunca devolve um número que o servidor recusaria por sinal", () => {
    for (const t of ["1500", "1.500,00", "0,01", "R$ 9.999.999,99"]) {
      const v = lerValorEmReais(t);
      expect(v).not.toBeNull();
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
