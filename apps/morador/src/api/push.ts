import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { apiFetch } from "./client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registra o Expo push token na API. Silencioso em caso de falha —
 * push remoto não funciona no Expo Go (Android); exige development build.
 */
export async function registrarPush(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Encomendas",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await apiFetch("/morador/devices", {
      method: "POST",
      body: {
        pushToken: token,
        plataforma: Platform.OS === "ios" ? "IOS" : "ANDROID",
      },
    });
  } catch (e) {
    console.warn("Registro de push falhou (ok em Expo Go):", e);
  }
}
