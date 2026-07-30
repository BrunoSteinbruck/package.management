import { describe, expect, it } from "vitest";
import { CriarUnidadesSchema } from "./dto";

/**
 * O bug que motivou isto foi reproduzido no QA: cadastrar "777", "777 " e
 * "777 " (com espaço não separável) criou TRÊS unidades no mesmo bloco, que
 * a tela desenha idênticas como "777 · Z". A partir daí a encomenda entra na
 * unidade errada e o síndico não vê diferença nenhuma na lista.
 *
 * `@@unique([condominioId, bloco, identificacao])` não protege: as strings
 * de fato diferem. A defesa tem que estar na borda.
 */
function normalizar(bloco: string | undefined, identificacao: string) {
  const r = CriarUnidadesSchema.safeParse({
    unidades: [{ ...(bloco !== undefined ? { bloco } : {}), identificacao }],
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  return r.data.unidades[0];
}

describe("chave da unidade (bloco + identificação)", () => {
  it("apara espaço nas pontas", () => {
    expect(normalizar("Z", "777 ")).toEqual({ bloco: "Z", identificacao: "777" });
    expect(normalizar(" Z ", "777")).toEqual({ bloco: "Z", identificacao: "777" });
  });

  it("trata espaço não separável como espaço comum", () => {
    // U+00A0 vem colado de planilha e é invisível na tela.
    expect(normalizar("Z", "777 ")).toEqual({ bloco: "Z", identificacao: "777" });
    expect(normalizar(" Z", "777")).toEqual({ bloco: "Z", identificacao: "777" });
  });

  it("as três formas do bug colapsam na mesma chave", () => {
    const a = normalizar("Z", "777");
    const b = normalizar("Z", "777 ");
    const c = normalizar("Z ", "777");
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("colapsa espaço interno repetido, sem juntar palavras", () => {
    expect(normalizar("Bloco   A", "casa  1")).toEqual({
      bloco: "Bloco A",
      identificacao: "casa 1",
    });
  });

  it("identificação que era só espaço é recusada, não vira vazia", () => {
    expect(normalizar("Z", "   ")).toHaveProperty("erro");
  });

  it("não mexe no que já está limpo", () => {
    expect(normalizar("A", "302")).toEqual({ bloco: "A", identificacao: "302" });
  });
});
