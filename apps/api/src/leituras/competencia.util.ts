/**
 * Competência é sempre "YYYY-MM" nas bordas (DTO e response) e Date (dia 1,
 * UTC) só no banco. Nunca `new Date(ano, mes-1, 1)`: o construtor local
 * desloca o dia conforme o fuso e a competência cairia no mês errado.
 */
export function competenciaParaData(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, 1));
}

export function dataParaCompetencia(data: Date): string {
  return data.toISOString().slice(0, 7);
}

/** Desloca uma competência em N meses (negativo volta no tempo). */
export function somarMeses(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return dataParaCompetencia(new Date(Date.UTC(ano, mes - 1 + meses, 1)));
}
