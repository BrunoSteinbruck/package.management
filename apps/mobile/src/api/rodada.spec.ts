import type { EstadoLeituras } from "@pacotes/shared";
import { describe, expect, it } from "vitest";
import { proximasPendentes } from "./rodada";

function estadoCom(
  unidades: { id: string; atual: number | null }[],
): EstadoLeituras {
  return {
    competencia: "2026-07",
    tipo: "AGUA",
    total: unidades.length,
    lidas: unidades.filter((u) => u.atual !== null).length,
    unidades: unidades.map((u) => ({
      unidadeId: u.id,
      bloco: "A",
      identificacao: u.id,
      anterior: null,
      atual: u.atual,
    })),
  };
}

describe("proximasPendentes", () => {
  const estado = estadoCom([
    { id: "101", atual: null },
    { id: "102", atual: 10 },
    { id: "201", atual: null },
    { id: "202", atual: null },
  ]);

  it("sem última registrada, segue a ordem do condomínio", () => {
    expect(proximasPendentes(estado, null).map((u) => u.id)).toEqual([
      "101",
      "201",
      "202",
    ]);
  });

  it("gira a rodada para começar depois da última registrada", () => {
    // "201" segue pendente aqui (no fluxo real o cache a marca como lida ao
    // registrar), então ela cai para o FIM do rodízio, não some.
    expect(proximasPendentes(estado, "201").map((u) => u.id)).toEqual([
      "202",
      "101",
      "201",
    ]);
  });

  it("a última do prédio volta a rodada para o começo", () => {
    expect(proximasPendentes(estado, "202").map((u) => u.id)).toEqual([
      "101",
      "201",
      "202",
    ]);
  });

  it("última desconhecida (outro tipo, cache velho) não quebra", () => {
    expect(proximasPendentes(estado, "999").map((u) => u.id)).toEqual([
      "101",
      "201",
      "202",
    ]);
  });

  it("respeita o máximo e lida com vazio", () => {
    expect(proximasPendentes(estado, null, 1).map((u) => u.id)).toEqual(["101"]);
    expect(proximasPendentes(estadoCom([]), null)).toEqual([]);
    expect(
      proximasPendentes(estadoCom([{ id: "101", atual: 5 }]), null),
    ).toEqual([]);
  });
});
