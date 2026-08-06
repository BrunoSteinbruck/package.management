import { Alert } from "react-native";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch } from "./client";
import { salvarSessao } from "./session";

/**
 * Encerra as sessões dos OUTROS aparelhos, mantendo este.
 *
 * É o que fazer com um celular perdido. Antes disto as únicas saídas eram o
 * síndico desativar a conta, que também derruba a pessoa no aparelho novo,
 * ou o morador excluir a própria conta.
 *
 * Guardar a sessão devolvida é obrigatório: o servidor carimba a conta e o
 * token que está aqui na mão nasceu antes do carimbo. Sem trocar, o próximo
 * request levaria 401 e a pessoa se expulsaria ao tentar expulsar os outros.
 */
export async function sairDosOutrosAparelhos() {
  Alert.alert(
    "Sair dos outros aparelhos?",
    "Quem estiver com sua conta aberta em outro celular ou no computador precisa entrar de novo. Você continua conectado aqui.",
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Encerrar",
        style: "destructive",
        onPress: async () => {
          try {
            const sessao = await apiFetch<{ token: string; perfil: JwtPayload }>(
              "/conta/sair-outros-aparelhos",
              { method: "POST" },
            );
            await salvarSessao(sessao);
            Alert.alert(
              "Pronto",
              "As sessões dos outros aparelhos foram encerradas.",
            );
          } catch (e) {
            Alert.alert(
              "Não foi possível encerrar",
              String((e as Error).message),
            );
          }
        },
      },
    ],
  );
}
