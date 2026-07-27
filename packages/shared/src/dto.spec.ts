import { describe, expect, it } from "vitest";
import {
  CompetenciaSchema,
  FotoKeySchema,
  RegistrarLeituraSchema,
} from "./dto";

describe("CompetenciaSchema", () => {
  it("aceita YYYY-MM", () => {
    expect(CompetenciaSchema.safeParse("2026-07").success).toBe(true);
    expect(CompetenciaSchema.safeParse("2026-12").success).toBe(true);
  });

  it("rejeita mês inválido ou formato solto", () => {
    for (const ruim of ["2026-13", "2026-00", "2026-7", "26-07", "2026/07"]) {
      expect(CompetenciaSchema.safeParse(ruim).success).toBe(false);
    }
  });
});

describe("FotoKeySchema", () => {
  it("aceita a key como o upload emite (uuid + extensão)", () => {
    expect(
      FotoKeySchema.safeParse("c0f82164-4b50-4095-9cf0-2726f294a47d.jpg").success,
    ).toBe(true);
    expect(FotoKeySchema.safeParse("abc_123.webp").success).toBe(true);
  });

  it("rejeita caminho, extensão estranha e lixo", () => {
    for (const ruim of ["../../etc/passwd", "a/b.jpg", "foto.exe", "semext", ""]) {
      expect(FotoKeySchema.safeParse(ruim).success).toBe(false);
    }
  });
});

describe("RegistrarLeituraSchema", () => {
  const base = {
    unidadeId: "62fc3ec1-daa8-44a8-a409-2daafccd5baf",
    tipo: "AGUA",
    competencia: "2026-07",
    valor: 458,
  };

  it("aceita leitura válida, com e sem foto", () => {
    expect(RegistrarLeituraSchema.safeParse(base).success).toBe(true);
    expect(
      RegistrarLeituraSchema.safeParse({ ...base, fotoKey: "x-1.png" }).success,
    ).toBe(true);
  });

  it("rejeita valor negativo, acima do teto e tipo desconhecido", () => {
    expect(RegistrarLeituraSchema.safeParse({ ...base, valor: -1 }).success).toBe(false);
    expect(
      RegistrarLeituraSchema.safeParse({ ...base, valor: 1_000_000_000 }).success,
    ).toBe(false);
    expect(
      RegistrarLeituraSchema.safeParse({ ...base, tipo: "LUZ" }).success,
    ).toBe(false);
  });
});
