import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { JwtPayload } from "@pacotes/shared";
import { renovarSessao } from "./src/api/client";
import { carregarSessao } from "./src/api/session";
import type { RootStackParamList } from "./src/navigation";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { QrScreen } from "./src/screens/QrScreen";
import { theme } from "./src/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [carregado, setCarregado] = useState(false);
  const [perfil, setPerfil] = useState<JwtPayload | null>(null);

  useEffect(() => {
    carregarSessao().then((sessao) => {
      if (sessao?.perfil.tipo === "morador") {
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
          name="Qr"
          component={QrScreen}
          options={{ title: "Retirada" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
