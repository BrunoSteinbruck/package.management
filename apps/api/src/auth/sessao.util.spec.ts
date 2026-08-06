import { describe, expect, it } from "vitest";
import { sessaoRevogada, validadeDaSessao } from "./sessao.util";

describe("validade da sessão", () => {
  it("painel vale 24 horas", () => {
    expect(validadeDaSessao("painel")).toBe("24h");
  });

  it("app vale 90 dias", () => {
    // `undefined` é o caso do app e o de todo token emitido antes deste
    // campo existir: sem tratamento, uma sessão antiga renovaria curto e
    // derrubaria o morador do nada.
    expect(validadeDaSessao(undefined)).toBe("90d");
  });
});

describe("revogação de sessão", () => {
  const emSegundos = (d: Date) => Math.floor(d.getTime() / 1000);

  it("sem carimbo, nada é revogado", () => {
    // O estado de toda conta que nunca trocou senha nem pediu para sair dos
    // outros aparelhos: a coluna é nula e ninguém pode ser derrubado por ela.
    expect(sessaoRevogada(emSegundos(new Date()), null)).toBe(false);
    expect(sessaoRevogada(emSegundos(new Date()), undefined)).toBe(false);
  });

  it("token anterior ao carimbo morre", () => {
    const carimbo = new Date("2026-08-06T12:00:00.000Z");
    expect(sessaoRevogada(emSegundos(carimbo) - 1, carimbo)).toBe(true);
    expect(sessaoRevogada(emSegundos(carimbo) - 86_400, carimbo)).toBe(true);
  });

  it("token posterior ao carimbo vive", () => {
    const carimbo = new Date("2026-08-06T12:00:00.000Z");
    expect(sessaoRevogada(emSegundos(carimbo) + 1, carimbo)).toBe(false);
  });

  it("token do mesmo segundo do carimbo sobrevive, de propósito", () => {
    // É o que mantém logado quem ACABOU de trocar a senha: o token novo é
    // assinado no mesmo segundo do carimbo. Sem isso a pessoa se expulsaria
    // sozinha, e no app cada relogin custa um SMS.
    const carimbo = new Date("2026-08-06T12:00:00.750Z");
    expect(sessaoRevogada(emSegundos(carimbo), carimbo)).toBe(false);
  });

  it("milissegundos do carimbo não derrubam token do mesmo segundo", () => {
    // O `iat` é truncado para segundo (RFC 7519); comparar contra o carimbo
    // em milissegundos mataria todo token assinado naquele segundo.
    const carimbo = new Date("2026-08-06T12:00:00.999Z");
    expect(sessaoRevogada(emSegundos(carimbo), carimbo)).toBe(false);
  });

  it("token sem iat é recusado", () => {
    // Não há como provar que veio depois do carimbo. Na prática não ocorre:
    // quem assina é `assinarSessao`, e o jsonwebtoken sempre põe `iat`.
    expect(sessaoRevogada(undefined, new Date())).toBe(true);
    // Mas sem carimbo nenhum continua passando: conta que nunca revogou nada
    // não pode ser derrubada por um campo ausente.
    expect(sessaoRevogada(undefined, null)).toBe(false);
  });
});
