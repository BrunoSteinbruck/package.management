import type { FotoRef } from "./api";
import type { StatusAviso } from "./enums";

/**
 * A caixa de entrada do morador, em um formato só.
 *
 * O banco já era genérico: `Aviso` é polimórfico por `via` e `Notificacao` tem
 * um tipo fechado com FK opcional para pacote ou aviso. Essa genericidade
 * morria no controller, onde virava quatro endpoints com quatro formatos, e o
 * cliente remontava três blocos de tela quase iguais. `ItemFeed` é onde ela
 * sobrevive até a borda.
 *
 * O discriminante é o `TipoNotificacao` que já existe no Postgres, e não um
 * vocabulário novo: é justamente a tradução para vocabulários paralelos que
 * fazia a mesma coluna `motivo` chegar ao cliente ora como `motivo`, ora como
 * `categoria`.
 *
 * Ao acrescentar um tipo aqui, o `Record<ItemFeed["tipo"], ...>` dos dois
 * registries (servidor e app) para de compilar até ganhar a entrada nova. Foi
 * exatamente essa checagem que faltou quando LEMBRETE entrou no enum e chegou
 * ao app como "Encomenda retirada".
 */
export type ItemFeed =
  | {
      tipo: "ENTRADA";
      id: string;
      em: string;
      pacoteId: string;
      transportadora: string | null;
    }
  | {
      tipo: "RETIRADA";
      id: string;
      em: string;
      pacoteId: string;
      transportadora: string | null;
    }
  | {
      tipo: "LEMBRETE";
      id: string;
      em: string;
      pacoteId: string;
      /** Há quantos dias o pacote está na portaria. */
      dias: number;
    }
  | {
      tipo: "AVISO";
      id: string;
      em: string;
      avisoId: string;
      motivo: string;
      descricao: string | null;
      status: StatusAviso;
      foto: FotoRef | null;
      /** Só o destinatário encerra um aviso direcionado. */
      podeResolver: boolean;
    }
  | {
      tipo: "OCORRENCIA";
      id: string;
      em: string;
      avisoId: string;
      categoria: string;
      descricao: string | null;
      status: StatusAviso;
      foto: FotoRef | null;
    };

export type TipoItemFeed = ItemFeed["tipo"];

/**
 * Versão do contrato do feed que este código entende. O app manda a sua em
 * `GET /morador/feed?v=`, e a API omite o que for mais novo que isso.
 *
 * Existe porque `apresentar()` no app é um `switch` sem ramo final: item de
 * tipo desconhecido devolveria `undefined` e derrubaria a caixa de entrada.
 * Enquanto o feed só tinha os cinco tipos originais isso era teórico, porque
 * app e API subiam juntos. Deixou de ser no momento em que existe versão
 * instalada nas lojas que não acompanha o servidor.
 *
 * Cliente que não manda `v` é anterior a este mecanismo: vale como v1.
 */
export const VERSAO_FEED = 1;

/**
 * A partir de qual versão de cliente cada tipo pode ser entregue.
 *
 * `Record` sobre a união: tipo novo em `ItemFeed` não compila até declarar
 * aqui a partir de quando ele existe, que é justamente a decisão fácil de
 * esquecer.
 */
export const VERSAO_MINIMA_ITEM: Record<TipoItemFeed, number> = {
  ENTRADA: 1,
  RETIRADA: 1,
  LEMBRETE: 1,
  AVISO: 1,
  OCORRENCIA: 1,
};

/** Filtra o que um cliente naquela versão sabe renderizar. */
export function itensParaVersao(itens: ItemFeed[], versao: number): ItemFeed[] {
  return itens.filter((i) => VERSAO_MINIMA_ITEM[i.tipo] <= versao);
}
