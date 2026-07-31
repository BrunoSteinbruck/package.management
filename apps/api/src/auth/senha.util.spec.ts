import { describe, expect, it } from "vitest";
import {
  gerarHash,
  gerarTokenRedefinicao,
  hashDoToken,
  HASH_FANTASMA,
  verificarHash,
} from "./senha.util";

describe("hash de senha", () => {
  it("a senha certa entra e a errada não", () => {
    const h = gerarHash("senha-do-sindico");
    expect(verificarHash("senha-do-sindico", h)).toBe(true);
    expect(verificarHash("senha-do-sindic", h)).toBe(false);
    expect(verificarHash("Senha-do-sindico", h)).toBe(false);
    expect(verificarHash("", h)).toBe(false);
  });

  it("o mesmo texto gera hashes diferentes", () => {
    // Sal por senha: duas contas com a mesma senha não podem ter o mesmo
    // hash, senão um vazamento revela quem repetiu senha com quem.
    expect(gerarHash("igual")).not.toBe(gerarHash("igual"));
  });

  it("preserva espaço, que é caractere de senha como outro qualquer", () => {
    const h = gerarHash("  com espaco nas pontas  ");
    expect(verificarHash("  com espaco nas pontas  ", h)).toBe(true);
    expect(verificarHash("com espaco nas pontas", h)).toBe(false);
  });

  it("acento composto e acento simples são a mesma senha", () => {
    // "á" pode chegar como um code point ou como "a" + acento combinante,
    // dependendo do teclado e do sistema. Sem normalizar, a mesma senha
    // digitada no Mac e no Windows daria hashes diferentes.
    const h = gerarHash("sábado");
    expect(verificarHash("sábado", h)).toBe(true);
  });

  it("nunca lança: hash malformado é só senha errada", () => {
    // Um throw aqui viraria 500 no login e distinguiria "sem senha" de
    // "senha errada" pelo código de resposta.
    for (const ruim of [
      null,
      "",
      "nao-e-hash",
      "scrypt:so:duas",
      "bcrypt:16384:8:1:c2Fs:aGFzaA",
      "scrypt:16384:8:1:c2Fs:",
      "scrypt:abc:def:ghi:c2Fs:aGFzaA",
    ]) {
      expect(verificarHash("qualquer", ruim)).toBe(false);
    }
  });

  it("o hash fantasma não abre com nada", () => {
    expect(verificarHash("", HASH_FANTASMA)).toBe(false);
    expect(verificarHash("admin", HASH_FANTASMA)).toBe(false);
    expect(HASH_FANTASMA.startsWith("scrypt:")).toBe(true);
  });

  it("o custo fica gravado no hash, então subir N não invalida senha antiga", () => {
    const [algo, n, r, p] = gerarHash("x").split(":");
    expect(algo).toBe("scrypt");
    expect([n, r, p]).toEqual(["16384", "8", "1"]);
  });
});

describe("token de redefinição", () => {
  it("o que vai no link não é o que fica no banco", () => {
    const { token, hash } = gerarTokenRedefinicao();
    expect(hash).not.toBe(token);
    expect(hash).toBe(hashDoToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("é longo e novo a cada chamada", () => {
    const a = gerarTokenRedefinicao();
    const b = gerarTokenRedefinicao();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    // base64url não pode precisar de escape na URL do link.
    expect(a.token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
