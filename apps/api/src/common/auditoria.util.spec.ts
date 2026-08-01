import { describe, expect, it } from "vitest";
import { mascararCpfCnpj } from "./auditoria.util";

describe("documento no registro de auditoria", () => {
  it("mostra só os últimos três dígitos", () => {
    // O suficiente para conferir que o pagador mudou, sem duplicar o dado
    // pessoal inteiro numa tabela que ninguém pensa em proteger ao exportar.
    expect(mascararCpfCnpj("529.982.247-25")).toBe("********725");
    expect(mascararCpfCnpj("52998224725")).toBe("********725");
  });

  it("funciona com CNPJ", () => {
    expect(mascararCpfCnpj("11.222.333/0001-81")).toBe("***********181");
  });

  it("ausência continua ausência", () => {
    expect(mascararCpfCnpj(null)).toBeNull();
    expect(mascararCpfCnpj(undefined)).toBeNull();
    expect(mascararCpfCnpj("")).toBeNull();
  });

  it("nunca devolve o documento inteiro", () => {
    for (const doc of ["52998224725", "11222333000181", "123456"]) {
      const mascarado = mascararCpfCnpj(doc)!;
      expect(mascarado).not.toBe(doc);
      expect(mascarado).toContain("*");
      // O comprimento é preservado: some o valor, não a forma.
      expect(mascarado.length).toBe(doc.length);
    }
  });

  it("valor curto demais some inteiro, em vez de vazar quase tudo", () => {
    expect(mascararCpfCnpj("12")).toBe("**");
    expect(mascararCpfCnpj("123")).toBe("***");
  });
});
