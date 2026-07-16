import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { JwtPayload } from "@pacotes/shared";
import { renovarSessao } from "./src/api/client";
import { carregarSessao } from "./src/api/session";
import type { RootStackParamList } from "./src/navigation";
import { EntradaCameraScreen } from "./src/screens/EntradaCameraScreen";
import { EntradaConfirmScreen } from "./src/screens/EntradaConfirmScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { QrScanScreen } from "./src/screens/QrScanScreen";
import { RetiradaScreen } from "./src/screens/RetiradaScreen";
import { SaidaCameraScreen } from "./src/screens/SaidaCameraScreen";
import { theme } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [carregado, setCarregado] = useState(false);
  const [perfil, setPerfil] = useState<JwtPayload | null>(null);

  useEffect(() => {
    carregarSessao().then((sessao) => {
      if (sessao?.perfil.tipo === "usuario") {
        setPerfil(sessao.perfil);
        renovarSessao();
      }
      setCarregado(true);
    });
  }, []);

  if (!carregado) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!perfil) {
    return (
      <>
        <StatusBar style="auto" />
        <LoginScreen aoEntrar={setPerfil} />
      </>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Home" options={{ headerShown: false }}>
          {(props) => (
            <HomeScreen {...props} perfil={perfil} aoSair={() => setPerfil(null)} />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="EntradaCamera"
          component={EntradaCameraScreen}
          options={{ title: "Nova entrada" }}
        />
        <Stack.Screen
          name="EntradaConfirm"
          component={EntradaConfirmScreen}
          options={{ title: "Confirmar entrada" }}
        />
        <Stack.Screen
          name="Retirada"
          component={RetiradaScreen}
          options={{ title: "Retirada" }}
        />
        <Stack.Screen
          name="QrScan"
          component={QrScanScreen}
          options={{ title: "Bipar QR do morador" }}
        />
        <Stack.Screen
          name="SaidaCamera"
          component={SaidaCameraScreen}
          options={{ title: "Comprovante de entrega" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
