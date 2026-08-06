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

/**
 * O dia corrente NO FUSO DO CONDOMÍNIO, em AAAA-MM-DD.
 *
 * `new Date().toISOString()` converte para UTC antes de cortar: no Brasil,
 * das 21h à meia-noite o "hoje" do servidor já é amanhã. Isso adiantava o
 * atraso mostrado ao morador e, na régua de cobrança, deslocava a data que o
 * `findMany` compara por igualdade exata: o lote daquele dia não era pego
 * naquela rodada nem em nenhuma outra, e o lembrete nunca saía.
 */
export function hojeNoFuso(timezone: string, agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** A competência do mês corrente no fuso do condomínio. */
export function competenciaAtual(timezone: string, agora = new Date()): string {
  return hojeNoFuso(timezone, agora).slice(0, 7);
}

/** Soma dias a uma data AAAA-MM-DD, sem passar por fuso nenhum. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
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

/**
 * A geração automática do mês deve rodar hoje?
 *
 * Só enquanto o vencimento da competência corrente ainda está no futuro.
 * Gerar no dia do vencimento ou depois criaria uma cobrança que nasce sem
 * prazo nenhum: no ciclo seguinte a própria régua a marcaria VENCIDA e
 * mandaria push de atraso para um morador que nunca chegou a ver o boleto.
 *
 * O custo dessa escolha é uma unidade cadastrada tarde no mês ficar de fora
 * da rodada automática. Fica para o síndico gerar à mão, que é quem sabe se
 * aquela unidade se cobra neste mês ou no que vem.
 */
export function geracaoDevidaHoje(
  hoje: string,
  diaVencimento: number,
): boolean {
  return hoje < vencimentoDa(hoje.slice(0, 7), diaVencimento);
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
