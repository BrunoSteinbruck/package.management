import { useEffect, useRef } from "react";
import { createNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import type { JwtPayload } from "@pacotes/shared";
import { rotaDoPush } from "./pushRota";

/**
 * Uma referência só para as três pilhas: o App monta uma de cada vez, por
 * perfil, então nunca há dois containers vivos disputando a referência.
 */
export const navegacaoRef = createNavigationContainerRef();

/**
 * Leva o toque na notificação até a tela do assunto.
 *
 * `useLastNotificationResponse` e não o listener: o listener só pega o toque
 * com o app já rodando, e o caso que importa é o contrário, o app fechado
 * abrindo pela notificação. O hook devolve as duas situações.
 *
 * `pronto` vem do `onReady` do container. Sem ele existe corrida real no
 * arranque frio: a resposta já está disponível no primeiro efeito, e um
 * `navigate` antes de o container montar é descartado em silêncio, deixando
 * o usuário na home sem nada explicando por quê.
 */
export function useNavegacaoPorPush(perfil: JwtPayload | null, pronto: boolean) {
  const resposta = Notifications.useLastNotificationResponse();
  const tratada = useRef<string | null>(null);

  useEffect(() => {
    if (!perfil || !pronto || !resposta) return;

    // O hook guarda a última resposta e volta a entregá-la a cada render.
    // Sem esta trava, trocar de aba ou remontar a pilha jogaria o usuário de
    // volta na tela de um push que ele já leu faz tempo.
    const identificador = resposta.notification.request.identifier;
    if (tratada.current === identificador) return;
    tratada.current = identificador;

    const destino = rotaDoPush(
      perfil,
      resposta.notification.request.content.data as
        | Record<string, unknown>
        | undefined,
    );
    if (!destino || !navegacaoRef.isReady()) return;

    // A referência é comum às três pilhas e não tem como saber qual está
    // montada, então o `navigate` dela não aceita par (rota, params) tipado.
    // Quem garante que só nome de rota existente chega aqui é a união de
    // `DestinoPush`, que é onde o erro vale a pena aparecer.
    const navegar = navegacaoRef.navigate as unknown as (
      rota: string,
      params?: object,
    ) => void;
    navegar(destino.rota, "params" in destino ? destino.params : undefined);
  }, [perfil, pronto, resposta]);
}
