import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regressão do achado 11 da Revisão 1 (e do quase-repeteco na Revisão de
 * leituras): toda tabela com condominio_id precisa estar na lista de RLS do
 * rls.sql E em alguma migração, porque produção só roda `migrate deploy`.
 * Este teste falha no momento em que alguém cria a tabela e esquece um dos
 * dois lados.
 */

const prismaDir = join(fileURLToPath(import.meta.url), "..", "..", "prisma");

// Globais por decisão documentada no cabeçalho do rls.sql: o isolamento
// delas é responsabilidade da API (login/onboarding acontecem sem tenant).
const GLOBAIS = new Set(["usuarios", "vinculos", "convites"]);

function tabelasComTenant(): string[] {
  const schema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");
  const tabelas: string[] = [];
  for (const [, corpo] of schema.matchAll(/model\s+\w+\s+\{([\s\S]*?)\n\}/g)) {
    if (!corpo.includes('@map("condominio_id")')) continue;
    const mapa = corpo.match(/@@map\("(\w+)"\)/);
    if (mapa) tabelas.push(mapa[1]);
  }
  return tabelas;
}

function listaEnableDoRls(): string {
  const rls = readFileSync(join(prismaDir, "sql", "rls.sql"), "utf8");
  const arrays = [...rls.matchAll(/ARRAY\[([^\]]*)\]/g)].map((m) => m[1]);
  const enable = arrays.find((a) => a.includes("'unidades'"));
  expect(enable, "rls.sql sem o array de tabelas com RLS").toBeDefined();
  return enable!;
}

function migracoesComRls(): string {
  const dir = join(prismaDir, "migrations");
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      try {
        return readFileSync(join(dir, e.name, "migration.sql"), "utf8");
      } catch {
        return "";
      }
    })
    .filter((sql) => sql.includes("ENABLE ROW LEVEL SECURITY"))
    .join("\n");
}

describe("consistência schema x RLS", () => {
  const tenants = tabelasComTenant().filter((t) => !GLOBAIS.has(t));

  it("o schema tem as tabelas de tenant esperadas", () => {
    expect(tenants).toContain("pacotes");
    expect(tenants).toContain("leituras_medidor");
    expect(tenants).toContain("tarifas_consumo");
  });

  it("toda tabela de tenant está no rls.sql", () => {
    const enable = listaEnableDoRls();
    for (const tabela of tenants) {
      expect(enable, `rls.sql sem '${tabela}'`).toContain(`'${tabela}'`);
    }
  });

  it("toda tabela de tenant tem RLS em alguma migração (produção só roda migrate deploy)", () => {
    const migracoes = migracoesComRls();
    for (const tabela of tenants) {
      expect(
        migracoes,
        `nenhuma migração aplica RLS em '${tabela}'`,
      ).toContain(`'${tabela}'`);
    }
  });
});
