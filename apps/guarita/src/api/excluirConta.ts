import { Alert } from "react-native";
import { apiFetch } from "./client";
import { limparSessao } from "./session";

type Previa =
  | { tipo: "morador"; unidadesVinculadas: number; efeitos: string[] }
  | { tipo: "equipe"; bloqueio: string | null; efeitos: string[] };

/**
 * Exclusão de conta pelo próprio usuário — exigência das duas lojas para
 * qualquer app com cadastro (Apple desde 2022, Play desde 2024).
 *
 * O fluxo pergunta duas vezes de propósito: é irreversível, e a primeira
 * tela existe para EXPLICAR o que some e o que fica (o histórico da unidade
 * continua com o condomínio) — não é só um "tem certeza?" a mais.
 */
export async function excluirConta(aoConcluir: () => void) {
  let previa: Previa;
  try {
    previa = await apiFetch<Previa>("/conta/exclusao/previa");
  } catch (e) {
    Alert.alert("Não foi possível continuar", String((e as Error).message));
    return;
  }

  if (previa.tipo === "equipe" && previa.bloqueio) {
    Alert.alert("Não é possível excluir agora", previa.bloqueio);
    return;
  }

  Alert.alert(
    "Excluir minha conta?",
    `${previa.efeitos.map((e) => `• ${e}`).join("\n\n")}`,
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Continuar", style: "destructive", onPress: confirmar },
    ],
  );

  function confirmar() {
    Alert.alert(
      "Tem certeza?",
      "A exclusão é definitiva e não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir definitivamente",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch("/conta", { method: "DELETE" });
            } catch (e) {
              Alert.alert("Não foi possível excluir", String((e as Error).message));
              return;
            }
            // A sessão local sai mesmo se algo falhar depois: o token já não
            // vale nada no servidor.
            await limparSessao();
            aoConcluir();
            Alert.alert("Conta excluída", "Seus dados pessoais foram removidos.");
          },
        },
      ],
    );
  }
}
