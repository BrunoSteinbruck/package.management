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
