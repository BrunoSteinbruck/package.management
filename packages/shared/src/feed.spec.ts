import { describe, expect, it } from "vitest";
import {
  VERSAO_FEED,
  VERSAO_MINIMA_ITEM,
  itensParaVersao,
  type ItemFeed,
} from "./feed";

/**
 * O feed é a única resposta da API que um app instalado renderiza com um
 * `switch` sem ramo final. Enquanto app e servidor subiam juntos isso não
 * custava nada; com versão nas lojas, mandar um tipo que o binário não
 * conhece apaga a caixa de entrada de quem não atualizou.
 *
 * Estes testes cobrem a regra que impede isso.
 */

function item(tipo: ItemFeed["tipo"]): ItemFeed {
  const base = { id: "x", em: "2026-07-27T12:00:00.000Z" };
  switch (tipo) {
    case "ENTRADA":
    case "RETIRADA":
      return { ...base, tipo, pacoteId: "p", transportadora: null };
    case "LEMBRETE":
      return { ...base, tipo, pacoteId: "p", dias: 3 };
    case "AVISO":
      return {
        ...base,
        tipo,
        avisoId: "a",
        motivo: "Luz acesa",
        descricao: null,
        status: "ABERTO",
        foto: null,
        podeResolver: true,
      };
    case "OCORRENCIA":
      return {
        ...base,
        tipo,
        avisoId: "a",
        categoria: "Limpeza",
        descricao: null,
        status: "ABERTO",
        foto: null,
      };
  }
}

describe("versionamento do feed", () => {
  it("todo tipo declara a partir de qual versão existe", () => {
    for (const [tipo, minima] of Object.entries(VERSAO_MINIMA_ITEM)) {
      expect(minima, `${tipo} sem versão mínima válida`).toBeGreaterThanOrEqual(1);
    }
  });

  it("nenhum tipo exige versão maior que a atual", () => {
    // Um tipo com mínima acima de VERSAO_FEED nunca seria entregue a ninguém,
    // nem ao app compilado deste mesmo commit: é sempre engano.
    for (const [tipo, minima] of Object.entries(VERSAO_MINIMA_ITEM)) {
      expect(minima, `${tipo} exige versão futura`).toBeLessThanOrEqual(VERSAO_FEED);
    }
  });

  it("cliente na versão atual recebe todos os tipos", () => {
    const todos = (Object.keys(VERSAO_MINIMA_ITEM) as ItemFeed["tipo"][]).map(item);
    expect(itensParaVersao(todos, VERSAO_FEED)).toHaveLength(todos.length);
  });

  it("cliente antigo não recebe tipo mais novo que ele", () => {
    const itens = [item("ENTRADA"), item("AVISO")];
    // Simula um tipo introduzido depois: o filtro é por número, então vale
    // para qualquer tipo futuro sem precisar inventar um aqui.
    const versaoDoCliente = 0;
    expect(itensParaVersao(itens, versaoDoCliente)).toHaveLength(0);
    expect(itensParaVersao(itens, 1)).toHaveLength(2);
  });

  it("cliente sem versão declarada (v1) recebe os tipos originais", () => {
    const originais: ItemFeed["tipo"][] = [
      "ENTRADA",
      "RETIRADA",
      "LEMBRETE",
      "AVISO",
      "OCORRENCIA",
    ];
    const itens = originais.map(item);
    expect(itensParaVersao(itens, 1)).toHaveLength(originais.length);
  });
});
