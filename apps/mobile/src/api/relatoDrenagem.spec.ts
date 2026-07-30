import { describe, expect, it } from "vitest";
import { relatarDrenagem } from "./relatoDrenagem";

/**
 * O bug: a fila offline descartava a operação recusada pelo servidor (4xx) em
 * silêncio. O porteiro registrava a encomenda no subsolo sem sinal, subia, o
 * app sincronizava, e aquele registro simplesmente não existia. Ninguém era
 * avisado, e a encomenda ficava fora do sistema com o morador esperando.
 */
const RECUSA = {
  path: "/portaria/pacotes",
  criadaEm: "2026-07-30T13:00:00.000Z",
  motivo: "Unidade não encontrada",
};

describe("relato da drenagem da fila offline", () => {
  it("não fala nada quando não houve nada a sincronizar", () => {
    expect(relatarDrenagem({ enviadas: 0, descartadas: [] })).toBeNull();
  });

  it("confirma o sucesso simples", () => {
    const r = relatarDrenagem({ enviadas: 3, descartadas: [] });
    expect(r?.titulo).toBe("Sincronizado");
    expect(r?.corpo).toContain("3 registro(s)");
  });

  it("o registro recusado aparece, com nome de gente e ordem de refazer", () => {
    const r = relatarDrenagem({ enviadas: 0, descartadas: [RECUSA] });
    expect(r?.titulo).toBe("Registro offline recusado");
    expect(r?.corpo).toContain("entrada de encomenda");
    expect(r?.corpo).toContain("Unidade não encontrada");
    expect(r?.corpo).toContain("Refaça o registro");
  });

  it("uma recusa no meio de vários sucessos não some do texto", () => {
    const r = relatarDrenagem({ enviadas: 7, descartadas: [RECUSA] });
    expect(r?.titulo).toBe("Registro offline recusado");
    expect(r?.corpo).toContain("7 registro(s) enviados");
    expect(r?.corpo).toContain("NÃO foi aceita");
  });

  it("a foto perdida avisa sem alarmar: a operação entrou", () => {
    const r = relatarDrenagem({
      enviadas: 1,
      descartadas: [{ ...RECUSA, motivo: "a foto não estava mais no aparelho", perdeuFoto: true }],
    });
    expect(r?.titulo).toBe("Sincronizado, com ressalva");
    expect(r?.corpo).toContain("SEM a foto");
    expect(r?.corpo).not.toContain("Refaça o registro");
  });

  it("recusa e foto perdida juntas: a recusa manda no título", () => {
    const r = relatarDrenagem({
      enviadas: 2,
      descartadas: [{ ...RECUSA, perdeuFoto: true }, { ...RECUSA, path: "/leituras" }],
    });
    expect(r?.titulo).toBe("Registro offline recusado");
    expect(r?.corpo).toContain("SEM a foto");
    expect(r?.corpo).toContain("leitura de medidor");
  });

  it("path desconhecido não vira texto vazio", () => {
    const r = relatarDrenagem({
      enviadas: 0,
      descartadas: [{ ...RECUSA, path: "/rota/nova" }],
    });
    expect(r?.corpo).toContain("/rota/nova");
  });
});
