import { describe, expect, it } from "vitest";
import { mensagemDeErro } from "./erro-api";

/**
 * O caso que motivou a função: o painel mostrava "Erro 400" para qualquer
 * validação, porque o corpo do zod não tem `message`. Quem importa uma
 * planilha de 200 linhas precisa saber qual campo reprovou.
 */
describe("mensagemDeErro", () => {
  it("usa message quando é texto (exceção de domínio)", () => {
    expect(mensagemDeErro({ message: "Apenas síndico ou admin" }, 403)).toBe(
      "Apenas síndico ou admin",
    );
  });

  it("junta message quando é lista", () => {
    expect(mensagemDeErro({ message: ["campo a", "campo b"] }, 400)).toBe(
      "campo a, campo b",
    );
  });

  it("lê os fieldErrors do zod, que era o buraco", () => {
    // Corpo real de POST /cadastro/moradores/importar com telefone inválido.
    expect(
      mensagemDeErro({ linhas: ["Telefone inválido (use DDD + número)"] }, 400),
    ).toBe("Telefone inválido (use DDD + número)");
  });

  it("com mais de um campo, nomeia cada um", () => {
    expect(
      mensagemDeErro({ titulo: ["muito curto"], corpo: ["obrigatório"] }, 400),
    ).toBe("titulo: muito curto · corpo: obrigatório");
  });

  it("ignora as chaves de envelope do Nest", () => {
    expect(
      mensagemDeErro(
        { statusCode: 400, error: "Bad Request", placa: ["Placa inválida"] },
        400,
      ),
    ).toBe("Placa inválida");
  });

  it("cai no genérico quando não há nada legível", () => {
    expect(mensagemDeErro({}, 500)).toBe("Erro 500");
    expect(mensagemDeErro(null, 502)).toBe("Erro 502");
    expect(mensagemDeErro("texto solto", 400)).toBe("Erro 400");
    expect(mensagemDeErro({ message: "   " }, 400)).toBe("Erro 400");
  });
});
