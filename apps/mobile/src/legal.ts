import { Linking } from "react-native";

/**
 * URLs dos documentos legais. As duas lojas exigem a política de privacidade
 * publicada e alcançável; a Apple também pede o link no próprio app.
 *
 * Vêm de env porque o domínio ainda depende do nome definitivo do produto.
 * Enquanto não existirem, o texto do login continua sendo texto simples em
 * vez de virar um link que não abre nada.
 */
export const URL_TERMOS = process.env.EXPO_PUBLIC_URL_TERMOS ?? "";
export const URL_PRIVACIDADE = process.env.EXPO_PUBLIC_URL_PRIVACIDADE ?? "";

export const temLinksLegais = Boolean(URL_TERMOS && URL_PRIVACIDADE);

export function abrir(url: string) {
  if (url) Linking.openURL(url).catch(() => {});
}
