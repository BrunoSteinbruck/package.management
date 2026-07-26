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
  }
}

function comDescricao(descricao: string | null, em: string): string {
  return descricao ? `${descricao} · ${dataCurta(em)}` : dataCurta(em);
}
