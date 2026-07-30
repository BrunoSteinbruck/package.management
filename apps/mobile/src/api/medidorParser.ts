/**
 * Extrai a leitura mais plausível do texto que o ML Kit reconheceu na foto do
 * medidor. Puro e offline: nenhuma chamada de rede.
 *
 * Heurística, na ordem:
 *  1. só sequências numéricas (com separadores . e ,), fora as coladas em
 *     letras: número de série, modelo e "m³" ficam de fora;
 *  2. prefere comprimento típico de odômetro (4 a 8 dígitos);
 *  3. empate resolve pela MAIOR sequência: o odômetro é o número mais longo
 *     do visor.
 */
export function extrairLeituraMedidor(texto: string): {
  sugestao: number | null;
  candidatos: number[];
} {
  const candidatos: { valor: number; digitos: number }[] = [];
  // Token a token (sem lookbehind: Hermes). Token com letra é descartado
  // inteiro: "12345m3", "Nº8891" e "MOD-77" não são leitura.
  for (const token of texto.split(/\s+/)) {
    if (!/^\d[\d.,]*$/.test(token)) continue;
    const digitos = token.replace(/\D/g, "").length;
    if (digitos < 2 || digitos > 12) continue;
    const valor = normalizar(token);
    if (valor === null) continue;
    candidatos.push({ valor, digitos });
  }
  if (candidatos.length === 0) return { sugestao: null, candidatos: [] };

  const pontuacao = (c: { digitos: number }) =>
    // Faixa de odômetro vale mais; dentro dela, mais dígitos ganham.
    (c.digitos >= 4 && c.digitos <= 8 ? 100 : 0) + c.digitos;
  const ordenados = [...candidatos].sort((a, b) => pontuacao(b) - pontuacao(a));
  return {
    sugestao: ordenados[0].valor,
    candidatos: [...new Set(ordenados.map((c) => c.valor))].slice(0, 5),
  };
}

/**
 * A leitura que o zelador DIGITOU, com o mesmo rigor do que foi lido da foto.
 *
 * O campo usava `Number(texto.replace(",", "."))`, que aceita coisas que um
 * teclado decimal nunca produz mas um "colar" produz: "0x10" virava 16 e
 * "1e5" virava 100000, entrando na conta de consumo como se fossem leituras
 * legítimas. E, do outro lado, "1.234,5" era recusado sem explicação, apesar
 * de ser exatamente o que o OCR sugere para o mesmo medidor.
 *
 * Devolve null para tudo que não seja dígitos com separadores decimais.
 */
export function lerLeituraDigitada(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d[\d.,]*$/.test(limpo)) return null;
  const valor = normalizar(limpo);
  return valor !== null && valor >= 0 ? valor : null;
}

/**
 * "1.234,5" e "1,234.5" viram 1234.5; "00458" vira 458. Com os dois
 * separadores, o que aparece por último é o decimal e o outro é milhar.
 * Separador único com até 3 dígitos à direita é tratado como decimal
 * (padrão de medidor com dígitos vermelhos); repetido é milhar.
 */
function normalizar(bruto: string): number | null {
  const s = bruto.replace(/[^\d.,]/g, "");
  const ultimoPonto = s.lastIndexOf(".");
  const ultimaVirgula = s.lastIndexOf(",");
  let texto: string;
  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    const decimal = ultimoPonto > ultimaVirgula ? "." : ",";
    const semMilhar = s.replace(decimal === "." ? /,/g : /\./g, "");
    const partes = semMilhar.split(decimal);
    texto = partes.length === 2 ? `${partes[0]}.${partes[1]}` : partes.join("");
  } else {
    const partes = s.split(/[.,]/);
    if (partes.length === 1) {
      texto = partes[0];
    } else if (partes.length === 2 && partes[1].length >= 1 && partes[1].length <= 3) {
      texto = `${partes[0]}.${partes[1]}`;
    } else {
      texto = partes.join("");
    }
  }
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}
