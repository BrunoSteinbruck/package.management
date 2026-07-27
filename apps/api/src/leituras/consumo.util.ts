import { Prisma } from "@prisma/client";
import type { AlertaConsumo } from "@pacotes/shared";

// Regras puras de consumo e alerta, fora do service para serem testáveis
// sem banco nem Nest.

export const r3 = (n: number) => Math.round(n * 1000) / 1000;
export const r2 = (n: number) => Math.round(n * 100) / 100;

export function agruparPorUnidade<T extends { unidadeId: string }>(
  leituras: T[],
): Map<string, T[]> {
  const porUnidade = new Map<string, T[]>();
  for (const l of leituras) {
    const arr = porUnidade.get(l.unidadeId);
    if (arr) arr.push(l);
    else porUnidade.set(l.unidadeId, [l]);
  }
  return porUnidade;
}

/** Consumos derivados entre leituras consecutivas (lista em ordem desc). */
export function consumosDerivados(
  leituras: { valor: Prisma.Decimal }[],
  max = 6,
): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < leituras.length && out.length < max; i++) {
    out.push(Number(leituras[i].valor.minus(leituras[i + 1].valor)));
  }
  return out;
}

/**
 * Sinal visual, nunca bloqueio: negativo é medidor trocado ou erro de leitura;
 * acima da média (2x sobre as últimas até 6) é vazamento ou erro. Quem decide
 * é gente, o painel só aponta.
 */
export function alertaPara(
  consumo: number | null,
  historicos: number[],
): AlertaConsumo {
  if (consumo === null) return null;
  if (consumo < 0) return "NEGATIVO";
  const validos = historicos.filter((c) => c >= 0);
  if (validos.length >= 2) {
    const media = validos.reduce((a, b) => a + b, 0) / validos.length;
    if (media > 0 && consumo > 2 * media) return "ACIMA_MEDIA";
  }
  return null;
}
