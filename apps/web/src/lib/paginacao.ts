/** Separador visual entre trechos distantes da paginação. */
export const RETICENCIAS = "...";

export type ItemPaginacao = number | typeof RETICENCIAS;

/**
 * As páginas que a barra desenha.
 *
 * Antes a barra era `Array.from({length: Math.min(total, 8)})`: com 12 por
 * página, tudo que estivesse além da 96ª encomenda não tinha botão nenhum que
 * chegasse lá. O histórico de um condomínio movimentado ficava inalcançável
 * pelo painel, e a página 9 existia no servidor sem existir na tela.
 *
 * A janela anda com a página atual e sempre mantém a primeira e a última à
 * vista, para não trocar um limite por outro.
 */
export function janelaDePaginas(
  atual: number,
  total: number,
  visiveis = 7,
): ItemPaginacao[] {
  if (total <= visiveis) {
    return Array.from({ length: Math.max(total, 1) }, (_, i) => i + 1);
  }

  const pagina = Math.min(Math.max(atual, 1), total);
  // Duas vagas ficam com a primeira e a última; uma pode virar reticências de
  // cada lado. O que sobra é a vizinhança da página atual.
  const vizinhos = Math.max(1, Math.floor((visiveis - 4) / 2));
  let inicio = pagina - vizinhos;
  let fim = pagina + vizinhos;

  // Nas pontas não há reticências daquele lado, e a vaga que elas ocupariam
  // vira mais um número: o orçamento de botões continua o mesmo.
  if (inicio <= 3) {
    inicio = 2;
    fim = Math.max(fim, visiveis - 2);
  }
  if (fim >= total - 2) {
    fim = total - 1;
    inicio = Math.min(inicio, total - visiveis + 3);
  }
  inicio = Math.max(inicio, 2);
  fim = Math.min(fim, total - 1);

  const itens: ItemPaginacao[] = [1];
  if (inicio > 2) itens.push(RETICENCIAS);
  for (let n = inicio; n <= fim; n++) itens.push(n);
  if (fim < total - 1) itens.push(RETICENCIAS);
  itens.push(total);
  return itens;
}
