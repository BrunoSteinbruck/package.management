import { describe, expect, it } from "vitest";
import { normalizarTelefone, RequestOtpSchema } from "./dto";

/**
 * O `+55` que a pessoa digita naturalmente quebrava o login em silêncio: o
 * telefone é chave de busca exata, e "5551900000001" não encontra o cadastro
 * gravado como "51900000001". No app aparecia como "Código expirado", que
 * manda pedir outro código e falhar de novo. Já havia produzido dado ruim.
 */
describe("normalização de telefone", () => {
  it("tira o código do país nas formas que a pessoa escreve", () => {
    for (const escrito of [
      "+5551900000001",
      "5551900000001",
      "+55 51 90000-0001",
      "55 (51) 90000-0001",
    ]) {
      expect(normalizarTelefone(escrito)).toBe("51900000001");
    }
  });

  it("não mexe no telefone que já está no formato do cadastro", () => {
    expect(normalizarTelefone("51900000001")).toBe("51900000001");
    expect(normalizarTelefone("(51) 90000-0001")).toBe("51900000001");
    expect(normalizarTelefone("4133334444")).toBe("4133334444");
  });

  it("PRESERVA o DDD 55, que é de Santa Maria e não é código de país", () => {
    // Sem a checagem de tamanho, estes perderiam o próprio DDD e passariam a
    // apontar para outra pessoa (ou para ninguém).
    expect(normalizarTelefone("5599999999")).toBe("5599999999");
    expect(normalizarTelefone("55999999999")).toBe("55999999999");
    expect(normalizarTelefone("(55) 99999-9999")).toBe("55999999999");
  });

  it("fixo com o país também volta ao formato local", () => {
    expect(normalizarTelefone("+555133334444")).toBe("5133334444");
  });

  it("não inventa nada com entrada estranha", () => {
    expect(normalizarTelefone("")).toBe("");
    expect(normalizarTelefone("abc")).toBe("");
    expect(normalizarTelefone("+55")).toBe("55");
  });
});

describe("o schema aplica a normalização na borda", () => {
  const ler = (telefone: string) => {
    const r = RequestOtpSchema.safeParse({ telefone });
    return r.success ? r.data.telefone : null;
  };

  it("o que chega com o país é gravado e buscado sem ele", () => {
    expect(ler("+5551900000001")).toBe("51900000001");
    expect(ler("51900000001")).toBe("51900000001");
  });

  it("as duas formas do mesmo número convergem", () => {
    expect(ler("+5551900000001")).toBe(ler("(51) 90000-0001"));
  });

  it("continua recusando o que não é telefone", () => {
    expect(ler("123")).toBeNull();
    expect(ler("")).toBeNull();
    expect(ler("nao-e-telefone")).toBeNull();
  });
});
