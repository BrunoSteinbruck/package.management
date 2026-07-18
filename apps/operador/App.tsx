import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { JwtPayload } from "@pacotes/shared";
import { renovarSessao } from "./src/api/client";
import { carregarSessao } from "./src/api/session";
import type { RootStackParamList } from "./src/navigation";
import { ArmazenadosScreen } from "./src/screens/ArmazenadosScreen";
import { EntradaCameraScreen } from "./src/screens/EntradaCameraScreen";
import { EntradaConfirmScreen } from "./src/screens/EntradaConfirmScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { QrScanScreen } from "./src/screens/QrScanScreen";
import { RetiradaScreen } from "./src/screens/RetiradaScreen";
import { SaidaCameraScreen } from "./src/screens/SaidaCameraScreen";

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
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoginScreen aoEntrar={setPerfil} />
      </SafeAreaProvider>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {(props) => (
            <HomeScreen {...props} perfil={perfil} aoSair={() => setPerfil(null)} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Armazenados" component={ArmazenadosScreen} />
        <Stack.Screen name="EntradaCamera" component={EntradaCameraScreen} />
        <Stack.Screen name="EntradaConfirm" component={EntradaConfirmScreen} />
        <Stack.Screen name="Retirada" component={RetiradaScreen} />
        <Stack.Screen name="QrScan" component={QrScanScreen} />
        <Stack.Screen name="SaidaCamera" component={SaidaCameraScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
