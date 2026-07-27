import type { ItemFeed } from "@pacotes/shared";
import { dataCurta, rotuloStatusAviso } from "./api/types";
import type { NomeIcone } from "./components/icones";
import { tomDoStatus, type TomSelo } from "./components/ui";
import { theme } from "./theme";

export interface ItemApresentado {
  icone: NomeIcone;
  corFundo: string;
  corIcone: string;
  titulo: string;
  sub: string;
  selo?: { texto: string; tom: TomSelo };
  /** Presente quando o item abre o detalhe de uma encomenda. */
  pacoteId?: string;
  /** Presente quando o item abre o detalhe de um comunicado. */
  comunicadoId?: string;
}

/**
 * O único lugar que decide como cada tipo do feed aparece.
 *
 * É um `switch` e não um `Record<ItemFeed["tipo"], ...>` de propósito: o
 * `switch` estreita a união em cada braço, então cada caso enxerga só os
 * campos que existem nele, sem cast. A exaustividade vem de graça do tipo de
 * retorno declarado, porque um tipo novo sem braço deixa um caminho devolvendo
 * `undefined` e o compilador recusa.
 *
 * Foi essa checagem que faltou quando LEMBRETE entrou no enum do Postgres: o
 * app conhecia três dos seis tipos e renderizava qualquer coisa que não fosse
 * ENTRADA como "Encomenda retirada".
 */
export function apresentar(item: ItemFeed): ItemApresentado {
  switch (item.tipo) {
    case "ENTRADA":
      return {
        icone: "sino",
        corFundo: theme.colors.okBg,
        corIcone: theme.colors.ok,
        titulo: "Encomenda chegou",
        sub: `${item.transportadora ?? "Encomenda"} · ${dataCurta(item.em)}`,
        pacoteId: item.pacoteId,
      };
    case "RETIRADA":
      return {
        icone: "check",
        corFundo: theme.colors.divisor,
        corIcone: theme.colors.textSecondary,
        titulo: "Encomenda retirada",
        sub: `${item.transportadora ?? "Encomenda"} · ${dataCurta(item.em)}`,
        pacoteId: item.pacoteId,
      };
    case "LEMBRETE":
      return {
        icone: "sino",
        corFundo: theme.colors.alertaBg,
        corIcone: theme.colors.alerta,
        titulo: "Encomenda esperando",
        sub:
          item.dias === 1
            ? "Há 1 dia na portaria. Passe para retirar."
            : `Há ${item.dias} dias na portaria. Passe para retirar.`,
        selo: { texto: "aguardando", tom: "alerta" },
        pacoteId: item.pacoteId,
      };
    case "AVISO":
      return {
        icone: "sino",
        corFundo: theme.colors.alertaBg,
        corIcone: theme.colors.alerta,
        titulo: item.motivo,
        sub: comDescricao(item.descricao, item.em),
        selo: {
          texto: rotuloStatusAviso(item.status),
          tom: tomDoStatus(item.status),
        },
      };
    case "OCORRENCIA":
      return {
        icone: "escudo",
        corFundo: theme.colors.divisor,
        corIcone: theme.colors.textSecondary,
        titulo: item.categoria,
        sub: comDescricao(item.descricao, item.em),
        selo: {
          texto: rotuloStatusAviso(item.status),
          tom: tomDoStatus(item.status),
        },
      };
    case "COMUNICADO":
      return {
        icone: "sino",
        corFundo: theme.colors.okBg,
        corIcone: theme.colors.marca,
        titulo: item.titulo,
        sub: item.resumo,
        // Sem selo quando já leu: o feed do morador é longo, e marcar o que
        // ele já resolveu polui mais do que informa.
        selo: item.lido ? undefined : { texto: "novo", tom: "ok" },
        comunicadoId: item.comunicadoId,
      };
  }
  return desconhecido(item);
}

/**
 * Rede de segurança para tipo que este binário não conhece.
 *
 * Não deveria acontecer: a API filtra o feed pela versão que o app declara em
 * `?v=`. Mas o custo de estar errado é a caixa de entrada inteira em branco,
 * porque o `switch` acima devolveria `undefined`, então vale uma linha.
 *
 * O parâmetro `never` preserva a exaustividade que o switch já dava: tipo
 * novo em `ItemFeed` sem ramo acima chega aqui como algo diferente de `never`
 * e para de compilar.
 */
function desconhecido(_item: never): ItemApresentado {
  return {
    icone: "sino",
    corFundo: theme.colors.divisor,
    corIcone: theme.colors.textSecondary,
    titulo: "Novidade no seu condomínio",
    sub: "Atualize o app para ver este item.",
  };
}

function comDescricao(descricao: string | null, em: string): string {
  return descricao ? `${descricao} · ${dataCurta(em)}` : dataCurta(em);
}
