import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfCnpjValido,
  cpfValido,
  formatarCpfCnpj,
  soDigitos,
} from "./documento";

/**
 * Documento inválido só apareceria no dia da geração do mês, no meio de um
 * laço, com a cobrança já gravada e sem boleto. Estes testes movem a falha
 * para o momento em que o síndico digita.
 */

describe("cpfValido", () => {
  it("aceita CPF válido, com e sem máscara", () => {
    // CPF de teste válido pelos dígitos verificadores.
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
  });

  it("recusa todos os dígitos iguais", () => {
    // 111.111.111-11 fecha a conta dos verificadores: sem a regra explícita,
    // passaria como válido.
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });

  it("recusa tamanho errado", () => {
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ válido, com e sem máscara", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
  });

  it("recusa todos os dígitos iguais e tamanho errado", () => {
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("1122233300018")).toBe(false);
  });
});

describe("cpfCnpjValido", () => {
  it("decide pelo tamanho: 14 dígitos é CNPJ, o resto tenta CPF", () => {
    expect(cpfCnpjValido("529.982.247-25")).toBe(true);
    expect(cpfCnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cpfCnpjValido("123")).toBe(false);
  });
});

describe("formatação", () => {
  it("aplica a máscara certa para cada tamanho", () => {
    expect(formatarCpfCnpj("52998224725")).toBe("529.982.247-25");
    expect(formatarCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("devolve como veio o que não tem tamanho de documento", () => {
    expect(formatarCpfCnpj("abc")).toBe("abc");
  });

  it("soDigitos limpa qualquer pontuação", () => {
    expect(soDigitos("529.982.247-25")).toBe("52998224725");
  });
});
