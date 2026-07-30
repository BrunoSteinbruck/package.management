import { describe, expect, it } from "vitest";
import { RegistrarPacoteSchema } from "./dto";

const UNIDADE = "63d757e3-143a-4908-948f-fc9973119e66";
const ler = (campos: Record<string, unknown>) => {
  const r = RegistrarPacoteSchema.safeParse({ unidadeId: UNIDADE, ...campos });
  return r.success ? r.data : { erro: r.error.issues[0].message };
};

/**
 * O bug: a API aceitava `transportadora: "   "` e devolvia os três espaços
 * intactos. A home do morador escreve `transportadora ?? "Encomenda"`, que
 * cobre null e não cobre espaço em branco: o cartão aparecia SEM TÍTULO, só
 * com a data. Reproduzido contra a API rodando antes da correção.
 */
describe("texto opcional em branco é ausência", () => {
  it("só espaço vira ausente, e o padrão da tela volta a valer", () => {
    expect(ler({ transportadora: "   " }).transportadora).toBeUndefined();
    expect(ler({ transportadora: "" }).transportadora).toBeUndefined();
    expect(ler({ codigoRastreio: "  " }).codigoRastreio).toBeUndefined();
  });

  it("apara as pontas sem mexer no meio", () => {
    expect(ler({ transportadora: "  Mercado Livre  " }).transportadora).toBe(
      "Mercado Livre",
    );
    expect(ler({ transportadora: "Mercado Livre" }).transportadora).toBe(
      "Mercado Livre",
    );
  });

  it("campo ausente continua ausente", () => {
    expect(ler({}).transportadora).toBeUndefined();
  });

  it("o teto é conferido antes de aparar", () => {
    // Aparar 1 MB de espaço para depois recusar é trabalho jogado fora.
    expect(ler({ transportadora: "x".repeat(121) })).toHaveProperty("erro");
    expect(ler({ transportadora: " ".repeat(200) })).toHaveProperty("erro");
  });

  it("emoji e acento passam: é nome digitado, não chave de negócio", () => {
    expect(ler({ transportadora: "Correios 🎉" }).transportadora).toBe("Correios 🎉");
    expect(ler({ transportadora: "Transportes São João" }).transportadora).toBe(
      "Transportes São João",
    );
  });
});
