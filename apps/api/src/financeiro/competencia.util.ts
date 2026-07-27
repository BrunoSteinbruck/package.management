/**
 * Contas de calendário do financeiro, isoladas do banco e da rede.
 *
 * Ficam aqui porque é o que erra sozinho e o que dá para testar: mês com 28,
 * 30 e 31 dias, virada de ano, e o dia de vencimento que não existe no mês.
 */

/** "2026-07" vira o dia 1 em UTC, como as demais competências do sistema. */
export function inicioDaCompetencia(competencia: string): Date {
  return new Date(`${competencia}-01T00:00:00.000Z`);
}

/** A competência do mês corrente no fuso do condomínio. */
export function competenciaAtual(timezone: string, agora = new Date()): string {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return iso.slice(0, 7);
}

/**
 * O vencimento da competência, respeitando o dia configurado.
 *
 * Dia 31 em fevereiro vira o último dia de fevereiro em vez de escorregar
 * para março: cobrança que pula de mês é reclamação certa, e o `new Date`
 * com dia 31 faz exatamente esse escorregão sozinho.
 */
export function vencimentoDa(competencia: string, diaVencimento: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(Math.max(1, diaVencimento), ultimoDia);
  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

/** Diferença em dias entre duas datas AAAA-MM-DD (b menos a). */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}

/** Rótulo "julho de 2026" para a descrição do boleto. */
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}
