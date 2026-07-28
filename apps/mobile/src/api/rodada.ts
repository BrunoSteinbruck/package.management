import type { EstadoLeituras } from "@pacotes/shared";

/**
 * Pendentes na ordem da rodada: a lista gira para começar logo depois da
 * última unidade registrada, então o apartamento seguinte é o primeiro chip.
 * Puro (sem rede nem AsyncStorage) de propósito: roda offline e em teste.
 */
export function proximasPendentes(
  estado: EstadoLeituras,
  ultimaUnidadeId: string | null,
  max = 12,
): { id: string; bloco: string | null; identificacao: string }[] {
  const total = estado.unidades.length;
  if (total === 0) return [];
  const posicao = new Map(estado.unidades.map((u, i) => [u.unidadeId, i]));
  const inicio = (ultimaUnidadeId ? (posicao.get(ultimaUnidadeId) ?? -1) : -1) + 1;
  return estado.unidades
    .filter((u) => u.atual === null)
    .sort(
      (a, b) =>
        ((posicao.get(a.unidadeId)! - inicio + total) % total) -
        ((posicao.get(b.unidadeId)! - inicio + total) % total),
    )
    .slice(0, max)
    .map((u) => ({
      id: u.unidadeId,
      bloco: u.bloco,
      identificacao: u.identificacao,
    }));
}
