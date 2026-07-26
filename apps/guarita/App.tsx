import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { perfilDe, type JwtPayload } from "@pacotes/shared";
import { renovarSessao } from "./src/api/client";
import { carregarSessao, limparSessao } from "./src/api/session";
import type {
  MoradorStackParamList,
  PortariaStackParamList,
} from "./src/navigation";
import { ArmazenadosScreen } from "./src/screens/ArmazenadosScreen";
import { AvisarCameraScreen } from "./src/screens/AvisarCameraScreen";
import { AvisarConfirmScreen } from "./src/screens/AvisarConfirmScreen";
import { AvisosScreen } from "./src/screens/AvisosScreen";
import { DetalheScreen } from "./src/screens/DetalheScreen";
import { EntradaCameraScreen } from "./src/screens/EntradaCameraScreen";
import { EntradaConfirmScreen } from "./src/screens/EntradaConfirmScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MinhaUnidadeScreen } from "./src/screens/MinhaUnidadeScreen";
import { MoradorHomeScreen } from "./src/screens/MoradorHomeScreen";
import { PortariaHomeScreen } from "./src/screens/PortariaHomeScreen";
import { QrScanScreen } from "./src/screens/QrScanScreen";
import { QrScreen } from "./src/screens/QrScreen";
import { RetiradaScreen } from "./src/screens/RetiradaScreen";
import { ReportarScreen } from "./src/screens/ReportarScreen";
import { RetiradasHojeScreen } from "./src/screens/RetiradasHojeScreen";
import { SaidaCameraScreen } from "./src/screens/SaidaCameraScreen";

const Portaria = createNativeStackNavigator<PortariaStackParamList>();
const Morador = createNativeStackNavigator<MoradorStackParamList>();

interface PropsPilha {
  perfil: JwtPayload;
  aoSair: () => void;
}

function PilhaPortaria({ perfil, aoSair }: PropsPilha) {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Portaria.Navigator screenOptions={{ headerShown: false }}>
        <Portaria.Screen name="Home">
          {(props) => (
            <PortariaHomeScreen {...props} perfil={perfil} aoSair={aoSair} />
          )}
        </Portaria.Screen>
        <Portaria.Screen name="Armazenados" component={ArmazenadosScreen} />
        <Portaria.Screen name="RetiradasHoje" component={RetiradasHojeScreen} />
        <Portaria.Screen name="EntradaCamera" component={EntradaCameraScreen} />
        <Portaria.Screen name="EntradaConfirm" component={EntradaConfirmScreen} />
        <Portaria.Screen name="Retirada" component={RetiradaScreen} />
        <Portaria.Screen name="QrScan" component={QrScanScreen} />
        <Portaria.Screen name="SaidaCamera" component={SaidaCameraScreen} />
        <Portaria.Screen name="AvisarCamera" component={AvisarCameraScreen} />
        <Portaria.Screen name="AvisarConfirm" component={AvisarConfirmScreen} />
      </Portaria.Navigator>
    </NavigationContainer>
  );
}

function PilhaMorador({ perfil, aoSair }: PropsPilha) {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Morador.Navigator screenOptions={{ headerShown: false }}>
        <Morador.Screen name="Home">
          {(props) => <MoradorHomeScreen {...props} perfil={perfil} />}
        </Morador.Screen>
        <Morador.Screen name="Qr" component={QrScreen} />
        <Morador.Screen name="Detalhe" component={DetalheScreen} />
        <Morador.Screen name="MinhaUnidade">
          {(props) => <MinhaUnidadeScreen {...props} aoSair={aoSair} />}
        </Morador.Screen>
        <Morador.Screen name="Avisos" component={AvisosScreen} />
        <Morador.Screen name="Reportar" component={ReportarScreen} />
      </Morador.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [carregado, setCarregado] = useState(false);
  const [perfil, setPerfil] = useState<JwtPayload | null>(null);

  useEffect(() => {
    carregarSessao().then(async (sessao) => {
      if (sessao) {
        setPerfil(sessao.perfil);
        if (!(await renovarSessao())) {
          // Conta excluída/desativada em outro aparelho: cai para o login.
          await limparSessao();
          setPerfil(null);
        }
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

  // Um app, uma experiência por perfil: o servidor devolve a identidade no
  // login e `perfilDe` a projeta no vocabulário do produto. Cada perfil só
  // enxerga as suas telas.
  const sair = () => setPerfil(null);
  if (perfilDe(perfil) === "morador") {
    return <PilhaMorador perfil={perfil} aoSair={sair} />;
  }
  // Porteiro e síndico dividem a pilha da portaria por enquanto. O síndico
  // ganha pilha própria na F5; até lá, o comportamento é o de hoje.
  return <PilhaPortaria perfil={perfil} aoSair={sair} />;
}
