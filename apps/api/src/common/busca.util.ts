/**
 * Termo digitado pelo porteiro virando texto literal para o `contains`.
 *
 * O `contains` do Prisma vira `ILIKE '%' || termo || '%'`, e no Postgres o
 * `%` e o `_` dentro do termo continuam sendo curinga. Buscar `_` na tela de
 * encomendas devolvia a lista inteira, e um código de rastreio com `_` casava
 * com qualquer caractere naquela posição: a busca respondia coisas que
 * ninguém pediu, sem nada indicando que estava fazendo isso.
 *
 * Não é brecha de injeção (o valor vai parametrizado); é semântica de padrão
 * vazando para quem só queria procurar um texto.
 *
 * A contrabarra vem primeiro de propósito: escapá-la depois transformaria as
 * contrabarras que este próprio código acabou de inserir.
 */
export function termoLiteral(termo: string): string {
  return termo.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
