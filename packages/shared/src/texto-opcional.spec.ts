import { describe, expect, it } from "vitest";
import { RegistrarPacoteSchema } from "./dto";

const UNIDADE = "63d757e3-143a-4908-948f-fc9973119e66";

/**
 * Os campos aceitos. Lança se o schema recusou, de propósito: com `?.` o teste
 * passaria tanto para "aceitou e o campo é undefined" quanto para "recusou o
 * pedido inteiro", que são coisas bem diferentes.
 */
function aceito(campos: Record<string, unknown>) {
  const r = RegistrarPacoteSchema.safeParse({ unidadeId: UNIDADE, ...campos });
  if (!r.success) {
    throw new Error(`Esperava aceitar, recusou: ${r.error.issues[0].message}`);
  }
  return r.data;
}

function recusado(campos: Record<string, unknown>): boolean {
  return !RegistrarPacoteSchema.safeParse({ unidadeId: UNIDADE, ...campos }).success;
}

/**
 * O bug: a API aceitava `transportadora: "   "` e devolvia os três espaços
 * intactos. A home do morador escreve `transportadora ?? "Encomenda"`, que
 * cobre null e não cobre espaço em branco: o cartão aparecia SEM TÍTULO, só
 * com a data. Reproduzido contra a API rodando antes da correção.
 */
describe("texto opcional em branco é ausência", () => {
  it("só espaço vira ausente, e o padrão da tela volta a valer", () => {
    expect(aceito({ transportadora: "   " }).transportadora).toBeUndefined();
    expect(aceito({ transportadora: "" }).transportadora).toBeUndefined();
    expect(aceito({ codigoRastreio: "  " }).codigoRastreio).toBeUndefined();
  });

  it("apara as pontas sem mexer no meio", () => {
    expect(aceito({ transportadora: "  Mercado Livre  " }).transportadora).toBe(
      "Mercado Livre",
    );
    expect(aceito({ transportadora: "Mercado Livre" }).transportadora).toBe(
      "Mercado Livre",
    );
  });

  it("campo ausente continua ausente", () => {
    expect(aceito({}).transportadora).toBeUndefined();
  });

  it("o teto é conferido antes de aparar", () => {
    // Aparar 1 MB de espaço para depois recusar é trabalho jogado fora, então
    // o `.max()` vem primeiro: 200 espaços com teto de 120 é recusa, e não um
    // campo que vira vazio depois do trim.
    expect(recusado({ transportadora: "x".repeat(121) })).toBe(true);
    expect(recusado({ transportadora: " ".repeat(200) })).toBe(true);
    expect(recusado({ transportadora: " ".repeat(120) })).toBe(false);
  });

  it("emoji e acento passam: é nome digitado, não chave de negócio", () => {
    expect(aceito({ transportadora: "Correios 🎉" }).transportadora).toBe(
      "Correios 🎉",
    );
    expect(aceito({ transportadora: "Transportes São João" }).transportadora).toBe(
      "Transportes São João",
    );
  });
});
