import { describe, expect, it } from "vitest";
import { centavosDe, lerOfx } from "./ofx.parser";

/**
 * O parser lê o que os bancos ESCREVEM, não o que a especificação manda:
 * SGML sem fechamento, vírgula decimal, fuso colado na data. Interpretar
 * dinheiro errado aqui contamina a prestação de contas inteira.
 */

const OFX_TIPICO = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260713100000[-3:BRT]
<TRNAMT>450.50
<FITID>2026071301
<MEMO>PIX RECEBIDO MARINA ALVES
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260715
<TRNAMT>-1200,00
<FITID>2026071502
<NAME>PAGTO ELEVADORES ATLAS
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe("lerOfx", () => {
  it("lê o arquivo típico: SGML sem fechamento de campo", () => {
    const r = lerOfx(OFX_TIPICO);
    expect(r.ilegiveis).toBe(0);
    expect(r.lancamentos).toHaveLength(2);
    const [pix, boleto] = r.lancamentos;
    expect(pix).toEqual({
      fitid: "2026071301",
      data: "2026-07-13",
      valorCentavos: 45050,
      descricao: "PIX RECEBIDO MARINA ALVES",
    });
    // Vírgula decimal (contra a spec, comum em banco brasileiro) e NAME como
    // fallback de descrição.
    expect(boleto.valorCentavos).toBe(-120000);
    expect(boleto.descricao).toBe("PAGTO ELEVADORES ATLAS");
  });

  it("bloco sem FITID ou com valor ilegível é contado, não inventado", () => {
    const quebrado = `<STMTTRN><DTPOSTED>20260713<TRNAMT>abc<FITID>x1</STMTTRN>
<STMTTRN><DTPOSTED>20260713<TRNAMT>10.00</STMTTRN>`;
    const r = lerOfx(quebrado);
    expect(r.lancamentos).toHaveLength(0);
    expect(r.ilegiveis).toBe(2);
  });

  it("arquivo sem transação nenhuma volta vazio sem explodir", () => {
    expect(lerOfx("OFXHEADER:100\n<OFX></OFX>").lancamentos).toHaveLength(0);
  });
});

describe("centavosDe", () => {
  it("aceita ponto e vírgula como decimal, com sinal", () => {
    expect(centavosDe("450.50")).toBe(45050);
    expect(centavosDe("-1200,00")).toBe(-120000);
    expect(centavosDe("+3,5")).toBe(350);
    expect(centavosDe("100")).toBe(10000);
  });

  it("recusa lixo em vez de arredondar", () => {
    expect(centavosDe("1.234,56")).toBe(null);
    expect(centavosDe("abc")).toBe(null);
    expect(centavosDe("")).toBe(null);
  });

  it("não passa por float: 0,29 são exatamente 29 centavos", () => {
    // 0.29 * 100 === 28.999999999999996 em float.
    expect(centavosDe("0,29")).toBe(29);
    expect(centavosDe("1.005,00")).toBe(null);
  });
});
