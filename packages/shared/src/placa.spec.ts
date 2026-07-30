import { describe, expect, it } from "vitest";
import { normalizarPlaca, placaValida } from "./dto";

/**
 * O app checava só `length >= 6`, então "ABCDEF" passava pelo botão e voltava
 * recusado do servidor. A regra agora é uma só, e este teste é o contrato.
 */
describe("placa válida", () => {
  it("aceita os dois formatos brasileiros", () => {
    expect(placaValida("ABC1D23")).toBe(true); // Mercosul
    expect(placaValida("ABC1234")).toBe(true); // antiga
  });

  it("aceita como a pessoa digita: minúscula, hífen, espaço", () => {
    expect(placaValida("abc1d23")).toBe(true);
    expect(placaValida("ABC-1234")).toBe(true);
    expect(placaValida(" abc 1234 ")).toBe(true);
  });

  it("recusa o que passava só por ter seis letras", () => {
    expect(placaValida("ABCDEF")).toBe(false);
    expect(placaValida("123456")).toBe(false);
    expect(placaValida("ABC12")).toBe(false);
    expect(placaValida("ABC12345")).toBe(false);
  });

  it("recusa vazio e espaço", () => {
    expect(placaValida("")).toBe(false);
    expect(placaValida("   ")).toBe(false);
  });

  it("descarta lixo colado em vez de recusar a placa que está ali", () => {
    // `normalizarPlaca` joga fora tudo que não é A-Z0-9, então o emoji some
    // como o hífen some. É permissivo de propósito, e é o MESMO comportamento
    // do servidor: divergir aqui faria o botão acender para um pedido que
    // seria recusado, ou apagar para um que seria aceito.
    expect(placaValida("🎉ABC1234")).toBe(true);
    expect(normalizarPlaca("🎉ABC1234")).toBe("ABC1234");
  });

  it("recusa antes de varrer texto gigante", () => {
    // O teto de 20 vem antes da normalização, que varre a string inteira.
    expect(placaValida("ABC1234".padEnd(5000, "X"))).toBe(false);
  });

  it("normalizar tira o que não é placa e sobe a caixa", () => {
    expect(normalizarPlaca(" abc-1d23 ")).toBe("ABC1D23");
  });
});
