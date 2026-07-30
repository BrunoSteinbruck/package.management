import { describe, expect, it } from "vitest";
import { janelaDePaginas, RETICENCIAS } from "./paginacao";

const numeros = (itens: (number | string)[]) => itens.filter((i) => typeof i === "number");

describe("janela de páginas", () => {
  it("lista tudo quando cabe", () => {
    expect(janelaDePaginas(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(janelaDePaginas(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("a última página sempre tem botão, era o bug", () => {
    // Com o `Math.min(total, 8)` de antes, a 42 não existia na tela.
    expect(janelaDePaginas(1, 42)).toContain(42);
    expect(janelaDePaginas(20, 42)).toContain(42);
    expect(janelaDePaginas(42, 42)).toContain(42);
  });

  it("a primeira também, de qualquer lugar", () => {
    expect(janelaDePaginas(42, 42)[0]).toBe(1);
    expect(janelaDePaginas(21, 42)[0]).toBe(1);
  });

  it("a página atual está sempre na janela", () => {
    for (const atual of [1, 2, 3, 9, 20, 39, 40, 41, 42]) {
      expect(janelaDePaginas(atual, 42)).toContain(atual);
    }
  });

  it("nunca passa do orçamento de botões", () => {
    for (const atual of [1, 5, 21, 38, 42]) {
      expect(janelaDePaginas(atual, 42).length).toBeLessThanOrEqual(7);
    }
  });

  it("dá para caminhar do começo ao fim, uma janela por vez", () => {
    // Sem vizinho alcançável a barra seria um beco: de cada página tem que
    // haver um botão maior que o atual, até chegar na última.
    let atual = 1;
    let passos = 0;
    while (atual < 42 && passos < 50) {
      const maiores = numeros(janelaDePaginas(atual, 42)).filter((n) => (n as number) > atual);
      expect(maiores.length).toBeGreaterThan(0);
      atual = Math.max(...(maiores as number[]));
      passos++;
    }
    expect(atual).toBe(42);
  });

  it("as reticências só aparecem do lado onde há salto", () => {
    // No começo não há nada escondido à esquerda, e vice-versa.
    expect(janelaDePaginas(1, 42)[1]).not.toBe(RETICENCIAS);
    expect(janelaDePaginas(1, 42)).toContain(RETICENCIAS);
    const fim = janelaDePaginas(42, 42);
    expect(fim[fim.length - 2]).not.toBe(RETICENCIAS);
    expect(fim).toContain(RETICENCIAS);
    expect(janelaDePaginas(21, 42).filter((i) => i === RETICENCIAS)).toHaveLength(2);
  });

  it("nunca desenha reticências para esconder uma página só", () => {
    // Um "..." no lugar de um número seria mentira e perda de clique.
    for (const total of [8, 9, 10, 15, 42]) {
      for (let atual = 1; atual <= total; atual++) {
        const itens = janelaDePaginas(atual, total);
        itens.forEach((item, i) => {
          if (item !== RETICENCIAS) return;
          const antes = itens[i - 1] as number;
          const depois = itens[i + 1] as number;
          expect(depois - antes).toBeGreaterThan(2);
        });
      }
    }
  });

  it("a numeração é crescente e sem repetição", () => {
    for (const atual of [1, 4, 21, 39, 42]) {
      const ns = numeros(janelaDePaginas(atual, 42)) as number[];
      expect(ns).toEqual([...new Set(ns)]);
      expect(ns).toEqual([...ns].sort((a, b) => a - b));
    }
  });

  it("aguenta os degenerados sem quebrar", () => {
    expect(janelaDePaginas(1, 1)).toEqual([1]);
    expect(janelaDePaginas(1, 0)).toEqual([1]);
    expect(janelaDePaginas(99, 3)).toEqual([1, 2, 3]);
    expect(janelaDePaginas(-5, 42)).toContain(1);
  });
});
