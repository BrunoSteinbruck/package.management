// Competência é o mês de referência, no formato "YYYY-MM": é assim que a
// leitura de medidor, a cobrança e o extrato conciliado se identificam.
//
// Este arquivo existe porque a lista de meses estava copiada em SEIS lugares
// (três telas do app, duas visões do painel e a conciliação na API), cada um
// com o seu formato, e ninguém tinha como saber que "jul/2026" na conciliação
// e "Julho/2026" no financeiro eram a mesma coisa escrita duas vezes.
//
// Aqui só mora FORMATAÇÃO. Aritmética de competência (mês seguinte, mês
// atual) segue onde está.

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/**
 * "2026-07" vira `{ ano: "2026", mes: 7 }`; qualquer outra coisa vira null.
 *
 * O mês precisa cair entre 1 e 12: sem essa checagem, "2026-13" indexava fora
 * do array e as telas imprimiam "undefined/2026" — que era o comportamento de
 * quatro das seis cópias.
 */
function partes(competencia: string): { ano: string; mes: number } | null {
  const [ano, mes] = competencia.split("-");
  const n = Number(mes);
  if (!/^\d{4}$/.test(ano ?? "") || !Number.isInteger(n) || n < 1 || n > 12) {
    return null;
  }
  return { ano, mes: n };
}

/** "2026-07" vira "Julho". Sem o ano. */
export function mesCapitalizado(competencia: string): string {
  const p = partes(competencia);
  return p ? MESES[p.mes - 1] : competencia;
}

/** "2026-07" vira "julho". Para o meio de uma frase. */
export function mesPorExtenso(competencia: string): string {
  const p = partes(competencia);
  return p ? MESES[p.mes - 1].toLowerCase() : competencia;
}

/** "2026-07" vira "Julho/2026". O formato de cabeçalho e de seletor de mês. */
export function mesAno(competencia: string): string {
  const p = partes(competencia);
  return p ? `${MESES[p.mes - 1]}/${p.ano}` : competencia;
}

/** "2026-07" vira "Julho de 2026". Para quando a frase pede a preposição. */
export function mesDeAno(competencia: string): string {
  const p = partes(competencia);
  return p ? `${MESES[p.mes - 1]} de ${p.ano}` : competencia;
}

/**
 * "2026-07" vira "jul". Rótulo de barra de gráfico, onde não cabe mais.
 *
 * A abreviação sai das três primeiras letras do nome inteiro. Em português
 * isso vale para os doze meses (inclusive "Março" → "mar"), e a suíte fixa os
 * doze para que um dia isso não deixe de ser verdade em silêncio.
 */
export function mesCurto(competencia: string): string {
  const p = partes(competencia);
  return p ? MESES[p.mes - 1].slice(0, 3).toLowerCase() : competencia;
}

/** "2026-07" vira "jul/2026". */
export function mesCurtoAno(competencia: string): string {
  const p = partes(competencia);
  return p ? `${mesCurto(competencia)}/${p.ano}` : competencia;
}

/**
 * A competência de uma coluna `DATE` do banco.
 *
 * Lê em UTC de propósito: a coluna guarda o primeiro dia do mês à meia-noite
 * UTC, e os getters locais devolveriam o mês anterior em qualquer fuso a oeste
 * de Greenwich — que é o caso do Brasil inteiro.
 */
export function competenciaDeData(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${data.getUTCFullYear()}-${mes}`;
}
