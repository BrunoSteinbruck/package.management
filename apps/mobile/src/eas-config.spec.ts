import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O perfil `production` do eas.json não definia `EXPO_PUBLIC_API_URL`.
 *
 * O cliente cai para `http://localhost:3001/v1` quando a variável falta, então
 * o app enviado às lojas apontaria para o próprio celular: nada responde, toda
 * tela falha, e no iOS o ATS bloqueia HTTP puro antes disso. O revisor não
 * conseguiria nem entrar, o que é rejeição automática e um ciclo de review
 * perdido, medido em dias.
 *
 * O erro é invisível em desenvolvimento (onde o `.env` local preenche a
 * variável) e só aparece no aparelho de outra pessoa. Por isso vira teste: é
 * exatamente a classe de defeito que não se descobre rodando o projeto.
 */
const eas = JSON.parse(
  readFileSync(join(__dirname, "..", "eas.json"), "utf8"),
) as {
  build: Record<string, { env?: Record<string, string>; developmentClient?: boolean }>;
};

const distribuiveis = Object.entries(eas.build).filter(
  ([nome, perfil]) => !perfil.developmentClient && nome !== "development",
);

describe("eas.json: perfis que geram build para outra pessoa", () => {
  it("há perfis distribuíveis para conferir", () => {
    expect(distribuiveis.length).toBeGreaterThan(0);
  });

  it.each(distribuiveis)("%s aponta para uma API alcançável", (_nome, perfil) => {
    const url = perfil.env?.EXPO_PUBLIC_API_URL;
    expect(url, "sem EXPO_PUBLIC_API_URL o build cai para localhost").toBeTruthy();
    expect(url).not.toMatch(/localhost|127\.0\.0\.1|10\.0\.2\.2/);
    // Rede local também não: o IP da máquina de quem buildou não existe para
    // o aparelho de um morador.
    expect(url).not.toMatch(/^https?:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./);
    // iOS bloqueia cleartext por padrão (ATS).
    expect(url).toMatch(/^https:\/\//);
  });
});
