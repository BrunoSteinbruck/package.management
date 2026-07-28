import { describe, expect, it } from "vitest";
import { rotuloCurto } from "./nomes";

/**
 * O chip de "quem recebeu" só serve se der para distinguir as pessoas da
 * unidade. Um rótulo ambíguo transforma o registro de custódia num chute, que
 * é pior do que não registrar nada.
 */
describe("rotuloCurto", () => {
  const so = (nomes: string[]) => nomes.map((n) => rotuloCurto(n, nomes));

  it("usa o primeiro nome quando não há ambiguidade", () => {
    expect(so(["Marina Alves", "Carlos Mendes"])).toEqual(["Marina", "Carlos"]);
  });

  it("cresce até o sobrenome quando o primeiro nome se repete", () => {
    expect(so(["João Silva", "João Pedro Souza"])).toEqual([
      "João Silva",
      "João Pedro",
    ]);
  });

  it("devolve o nome inteiro quando nem o sobrenome desempata", () => {
    // Pai e filho homônimos, ou cadastro duplicado: não há rótulo curto
    // honesto, então mostra tudo em vez de esconder a coincidência.
    expect(so(["Marina Alves", "Marina Alves"])).toEqual([
      "Marina Alves",
      "Marina Alves",
    ]);
  });

  it("desambigua só quem colide, mantendo os outros curtos", () => {
    expect(so(["Ana Lima", "Ana Paula Rocha", "Bruno Steinbruck"])).toEqual([
      "Ana Lima",
      "Ana Paula",
      "Bruno",
    ]);
  });

  it("aguenta nome de uma palavra e espaços sobrando", () => {
    expect(rotuloCurto("  Madonna  ", ["  Madonna  "])).toBe("Madonna");
    expect(rotuloCurto("Ana", ["Ana", "Ana"])).toBe("Ana");
  });
});
