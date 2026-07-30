/**
 * Lê um valor em reais como um brasileiro escreve.
 *
 * As telas de despesa e de taxa usavam `Number(texto.replace(",", "."))`, que
 * erra dos dois lados:
 *
 *  - recusa "1.500,00", que é exatamente como se escreve mil e quinhentos
 *    reais aqui. O síndico digitava a taxa do apartamento, via "Preencha
 *    descrição e valor" e não tinha como saber o que estava errado;
 *  - aceita o que só um "colar" produz: `Number("0x10")` é 16 e
 *    `Number("1e5")` é 100000, e isso entrava como valor de cobrança.
 *
 * Devolve null para tudo que não seja um número escrito, incluindo vazio,
 * negativo e emoji. Quem chama decide se zero vale.
 */
export function lerValorEmReais(bruto: string): number | null {
  // Símbolo de moeda, espaço comum e espaço não separável (vem colado de
  // planilha e de extrato de banco): tudo isso é ruído em volta do número.
  const limpo = bruto
    .replace(/R\$/gi, "")
    .replace(/[\s ]/g, "")
    .trim();
  if (limpo === "" || !/^\d[\d.,]*$/.test(limpo)) return null;

  const ultimoPonto = limpo.lastIndexOf(".");
  const ultimaVirgula = limpo.lastIndexOf(",");
  let texto: string;

  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    // Com os dois presentes, o que vem por último é o decimal.
    const decimal = ultimoPonto > ultimaVirgula ? "." : ",";
    const semMilhar = limpo.split(decimal === "." ? "," : ".").join("");
    const [inteiro, ...resto] = semMilhar.split(decimal);
    if (resto.length > 1) return null; // "1.2,3,4" não é número
    texto = resto.length === 1 ? `${inteiro}.${resto[0]}` : inteiro;
  } else if (ultimaVirgula >= 0) {
    // Vírgula em pt-BR é decimal, sempre: "1,5" e "1,500" são 1,5.
    const partes = limpo.split(",");
    if (partes.length > 2) return null;
    texto = `${partes[0]}.${partes[1]}`;
  } else if (ultimoPonto >= 0) {
    const partes = limpo.split(".");
    const ultima = partes[partes.length - 1];
    const inteiroZero = partes[0] === "0" || partes[0] === "";
    // Ponto separando grupos exatos de 3 é milhar ("1.500", "1.234.567").
    // Fora disso é decimal digitado no teclado do computador ("1.5", "0.500").
    const milhar =
      partes.length > 2 ||
      (ultima.length === 3 && partes[0].length >= 1 && !inteiroZero);
    if (milhar) {
      if (partes.slice(1).some((p) => p.length !== 3)) return null;
      texto = partes.join("");
    } else {
      if (partes.length > 2) return null;
      texto = `${partes[0]}.${partes[1]}`;
    }
  } else {
    texto = limpo;
  }

  const valor = Number(texto);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}
