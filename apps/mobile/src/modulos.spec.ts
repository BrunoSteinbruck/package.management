import { describe, expect, it } from "vitest";
import {
  MODULOS_MORADOR,
  MODULOS_PORTARIA,
  MODULOS_SINDICO,
  modulosDe,
  type Modulo,
} from "./modulos";

/**
 * `modulosDe` decide o que aparece na home de cada perfil. Errar aqui tem
 * dois modos de falha, ambos silenciosos: mostrar a porta de um módulo que o
 * condomínio não contratou (a tela seguinte quebra ou constrange a venda), ou
 * esconder um módulo pago (o síndico liga e nada aparece).
 */

const FIXTURE: readonly Modulo<"A" | "B" | "C" | "D">[] = [
  { id: "A", titulo: "Base", icone: "sino", perfis: ["morador"], slot: "rodape" },
  {
    id: "B",
    titulo: "Opcional",
    icone: "sino",
    perfis: ["morador"],
    slot: "rodape",
    flag: "visitantes",
  },
  {
    id: "C",
    titulo: "Outro perfil",
    icone: "sino",
    perfis: ["sindico"],
    slot: "secundario",
    flag: "visitantes",
  },
  {
    id: "D",
    titulo: "Outro slot",
    icone: "sino",
    perfis: ["morador"],
    slot: "secundario",
  },
];

describe("modulosDe: perfil, slot e flag", () => {
  it("módulo base (sem flag) aparece mesmo com a lista de ligados vazia", () => {
    const ids = modulosDe(FIXTURE, "morador", "rodape", []).map((m) => m.id);
    expect(ids).toEqual(["A"]);
  });

  it("módulo com flag só aparece com ela ligada", () => {
    const ids = modulosDe(FIXTURE, "morador", "rodape", ["visitantes"]).map(
      (m) => m.id,
    );
    expect(ids).toEqual(["A", "B"]);
  });

  it("flag de outro módulo não abre a porta errada", () => {
    const ids = modulosDe(FIXTURE, "morador", "rodape", ["financeiro"]).map(
      (m) => m.id,
    );
    expect(ids).toEqual(["A"]);
  });

  it("perfil e slot continuam filtrando junto com a flag", () => {
    expect(modulosDe(FIXTURE, "sindico", "rodape", ["visitantes"])).toHaveLength(0);
    expect(
      modulosDe(FIXTURE, "sindico", "secundario", ["visitantes"]).map((m) => m.id),
    ).toEqual(["C"]);
  });

  it("chamada sem o argumento de ligados esconde todo módulo com flag", () => {
    // É o comportamento antes de o cache carregar: a home mostra só a base
    // em vez de piscar itens que somem.
    const ids = modulosDe(FIXTURE, "morador", "rodape").map((m) => m.id);
    expect(ids).toEqual(["A"]);
  });
});

describe("manifestos reais", () => {
  const todos = [...MODULOS_PORTARIA, ...MODULOS_SINDICO, ...MODULOS_MORADOR];

  it("módulo com flag nunca fica no slot primario (o manifesto não o renderiza)", () => {
    for (const m of todos) {
      if (m.flag) expect(m.slot, `${m.id} com flag no slot errado`).not.toBe("primario");
    }
  });

  it("a base continua sem flag: encomendas, avisos e leituras não são opcionais", () => {
    const semFlag = todos.filter((m) => !m.flag).map((m) => m.id);
    expect(semFlag).toContain("Avisar");
    expect(semFlag).toContain("Leituras");
    expect(semFlag).toContain("Reportar");
  });

  it("os módulos das ondas estão atrás das flags certas", () => {
    const porId = new Map(todos.map((m) => [`${m.id}:${m.perfis.join(",")}`, m.flag]));
    expect(porId.get("Comunicados:sindico")).toBe("comunicados");
    expect(porId.get("Documentos:sindico")).toBe("documentos");
    expect(porId.get("Documentos:morador")).toBe("documentos");
    expect(porId.get("Visitas:morador")).toBe("visitantes");
    expect(porId.get("VisitasHoje:porteiro,sindico")).toBe("visitantes");
    expect(porId.get("Cobrancas:morador")).toBe("financeiro");
  });
});
