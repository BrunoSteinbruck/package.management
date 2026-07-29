/**
 * Leitor de extrato OFX, o formato que todo banco brasileiro exporta.
 *
 * OFX 1.x é SGML (tag sem fechamento) e 2.x é XML. Um parser de XML de
 * verdade recusaria a maioria dos arquivos reais, então isto lê do jeito que
 * os bancos escrevem: varre os blocos <STMTTRN> e pesca os campos, tolerando
 * fechamento ausente, acentuação quebrada e vírgula como separador decimal
 * (Bradesco e afins emitem "TRNAMT>-150,00" contra a especificação).
 *
 * Puro de propósito: é aqui que mora o risco de interpretar dinheiro errado,
 * então é o arquivo que ganha vitest.
 */

export interface LancamentoOfx {
  /** Id da transação NO BANCO: é o dedupe de reimportação. */
  fitid: string;
  /** YYYY-MM-DD. */
  data: string;
  /** Em CENTAVOS, com sinal: positivo entra, negativo sai. */
  valorCentavos: number;
  descricao: string;
}

/** Pesca `<TAG>valor` num bloco SGML, com ou sem fechamento. */
function campo(bloco: string, tag: string): string | null {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  const bruto = m?.[1]?.trim();
  return bruto ? bruto : null;
}

/**
 * "20260703100000[-3:BRT]" vira "2026-07-03". Só os 8 primeiros dígitos
 * importam: o horário e o fuso variam por banco e não mudam o dia do extrato.
 */
function dataDe(bruto: string): string | null {
  const d = bruto.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!d) return null;
  const [, ano, mes, dia] = d;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) {
    return null;
  }
  return `${ano}-${mes}-${dia}`;
}

/**
 * Valor monetário em centavos. Aceita "." e "," como separador decimal e
 * rejeita o que não for número: melhor pular a linha do que inventar valor.
 */
export function centavosDe(bruto: string): number | null {
  const normalizado = bruto.replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  // Sem float: "123.45" vira 12345 por manipulação de texto, porque
  // Math.round(1.005 * 100) é o tipo de bug que só aparece na auditoria.
  const negativo = normalizado.startsWith("-");
  const [inteiro, decimal = ""] = normalizado.replace(/^[+-]/, "").split(".");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  return negativo ? -centavos : centavos;
}

export interface ResultadoOfx {
  lancamentos: LancamentoOfx[];
  /** Blocos que existiam mas não deram para ler (campo faltando/ilegível). */
  ilegiveis: number;
}

export function lerOfx(conteudo: string): ResultadoOfx {
  const blocos = conteudo.split(/<STMTTRN>/i).slice(1);
  const lancamentos: LancamentoOfx[] = [];
  let ilegiveis = 0;

  for (const brutoBloco of blocos) {
    // O bloco vai até o fechamento (quando existe) ou até a próxima transação.
    const bloco = brutoBloco.split(/<\/STMTTRN>/i)[0];
    const fitid = campo(bloco, "FITID");
    const dataBruta = campo(bloco, "DTPOSTED");
    const valorBruto = campo(bloco, "TRNAMT");
    const data = dataBruta ? dataDe(dataBruta) : null;
    const valorCentavos = valorBruto ? centavosDe(valorBruto) : null;
    if (!fitid || !data || valorCentavos === null) {
      ilegiveis++;
      continue;
    }
    lancamentos.push({
      fitid,
      data,
      valorCentavos,
      // MEMO é a descrição na maioria dos bancos; NAME é o fallback.
      descricao: campo(bloco, "MEMO") ?? campo(bloco, "NAME") ?? "(sem descrição)",
    });
  }
  return { lancamentos, ilegiveis };
}
