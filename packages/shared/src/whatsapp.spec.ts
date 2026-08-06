import { describe, expect, it } from "vitest";
import { linkWhatsApp } from "./whatsapp";

/** O que vem depois de `wa.me/` e antes da query. */
function destino(url: string): string {
  return url.slice("https://wa.me/".length).split("?")[0];
}

describe("destino do link", () => {
  it("celular e fixo daqui ganham o código do país", () => {
    expect(destino(linkWhatsApp("51900000001", "oi"))).toBe("5551900000001");
    expect(destino(linkWhatsApp("4133334444", "oi"))).toBe("554133334444");
  });

  it("as formas que a pessoa escreve convergem para o mesmo destino", () => {
    // O cadastro grava só dígitos, mas o número pode chegar de um CSV ou de
    // um campo digitado à mão.
    const esperado = destino(linkWhatsApp("51900000001", "oi"));
    for (const escrito of [
      "+5551900000001",
      "5551900000001",
      "(51) 90000-0001",
      "+55 51 90000-0001",
    ]) {
      expect(destino(linkWhatsApp(escrito, "oi"))).toBe(esperado);
    }
  });

  it("o DDD 55 é preservado E ganha o país", () => {
    // Santa Maria. Sem a checagem de tamanho em `normalizarTelefone`, este
    // número perderia o próprio DDD antes de chegar aqui.
    expect(destino(linkWhatsApp("55999999999", "oi"))).toBe("5555999999999");
    expect(destino(linkWhatsApp("5599999999", "oi"))).toBe("555599999999");
  });

  it("número fora da faixa brasileira não ganha 55 na frente", () => {
    // TelefoneSchema aceita até 14 dígitos. Prefixar um número estrangeiro
    // produziria um destino que não existe, e o convite morreria em silêncio.
    expect(destino(linkWhatsApp("123456789012", "oi"))).toBe("123456789012");
    expect(destino(linkWhatsApp("123456789", "oi"))).toBe("123456789");
  });
});

describe("texto da mensagem", () => {
  it("acento, espaço e quebra de linha saem codificados", () => {
    const url = linkWhatsApp("51900000001", "Olá, João!\nBaixe o app");
    expect(url).toContain("?text=");
    expect(url.split("?text=")[1]).toBe(
      encodeURIComponent("Olá, João!\nBaixe o app"),
    );
    // O que quebraria a URL não pode aparecer cru.
    expect(url.split("?text=")[1]).not.toContain(" ");
    expect(url.split("?text=")[1]).not.toContain("\n");
  });

  it("o & do texto não vira separador de parâmetro", () => {
    const url = linkWhatsApp("51900000001", "encomendas & avisos");
    expect(url.split("?")[1].split("&")).toHaveLength(1);
  });
});
