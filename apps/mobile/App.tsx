import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { perfilDe, type JwtPayload } from "@pacotes/shared";
import {
  assinarSessaoExpirada,
  renovarSessao,
  sincronizarModulos,
} from "./src/api/client";
import { useModulos } from "./src/useModulos";
import { carregarSessao, limparSessao } from "./src/api/session";
import type {
  MoradorStackParamList,
  PortariaStackParamList,
  SindicoStackParamList,
} from "./src/navigation";
import { AprovacoesScreen } from "./src/screens/AprovacoesScreen";
import { OcorrenciaDetalheScreen } from "./src/screens/OcorrenciaDetalheScreen";
import { OcorrenciasScreen } from "./src/screens/OcorrenciasScreen";
import { SindicoHomeScreen } from "./src/screens/SindicoHomeScreen";
import { UnidadesScreen } from "./src/screens/UnidadesScreen";
import { EquipeScreen } from "./src/screens/EquipeScreen";
import { ArmazenadosScreen } from "./src/screens/ArmazenadosScreen";
import { AvisarScreen } from "./src/screens/AvisarScreen";
import { AvisosScreen } from "./src/screens/AvisosScreen";
import { ComunicadoScreen } from "./src/screens/ComunicadoScreen";
import { ComunicadosScreen } from "./src/screens/ComunicadosScreen";
import { ComunicadosMoradorScreen } from "./src/screens/ComunicadosMoradorScreen";
import { DocumentosScreen } from "./src/screens/DocumentosScreen";
import { NovoComunicadoScreen } from "./src/screens/NovoComunicadoScreen";
import { NovaVisitaScreen } from "./src/screens/NovaVisitaScreen";
import { VisitasHojeScreen } from "./src/screens/VisitasHojeScreen";
import { VisitasScreen } from "./src/screens/VisitasScreen";
import { CobrancasScreen } from "./src/screens/CobrancasScreen";
import { DetalheScreen } from "./src/screens/DetalheScreen";
import { EncomendasScreen } from "./src/screens/EncomendasScreen";
import { EntradaCameraScreen } from "./src/screens/EntradaCameraScreen";
import { EntradaConfirmScreen } from "./src/screens/EntradaConfirmScreen";
import { ConsumosScreen } from "./src/screens/ConsumosScreen";
import { LeituraCameraScreen } from "./src/screens/LeituraCameraScreen";
import { LeituraConfirmScreen } from "./src/screens/LeituraConfirmScreen";
import { LeiturasScreen } from "./src/screens/LeiturasScreen";
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
const Sindico = createNativeStackNavigator<SindicoStackParamList>();
const Morador = createNativeStackNavigator<MoradorStackParamList>();

interface PropsPilha {
  perfil: JwtPayload;
  aoSair: () => void;
}

function PilhaPortaria({ perfil, aoSair }: PropsPilha) {
  // Lido aqui e não dentro da tela porque quem monta `ArmazenadosScreen` com
  // as ações é esta pilha: a tela recebe o que pode fazer, não decide.
  const qrLigado = useModulos().includes("qr_retirada");
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Portaria.Navigator screenOptions={{ headerShown: false }}>
        <Portaria.Screen name="Home">
          {(props) => (
            <PortariaHomeScreen {...props} perfil={perfil} aoSair={aoSair} />
          )}
        </Portaria.Screen>
        <Portaria.Screen name="Armazenados">
          {(props) => (
            <ArmazenadosScreen
              {...props}
              aoTocarPacote={(unidade) =>
                props.navigation.navigate("Retirada", { unidadeInicial: unidade })
              }
              // `aoBiparQr` ausente esconde o botão: a tela já trata a
              // ausência da ação, que é como o síndico a usa em leitura.
              aoBiparQr={
                qrLigado
                  ? () => props.navigation.navigate("QrScan")
                  : undefined
              }
            />
          )}
        </Portaria.Screen>
        <Portaria.Screen name="RetiradasHoje" component={RetiradasHojeScreen} />
        <Portaria.Screen name="EntradaCamera" component={EntradaCameraScreen} />
        <Portaria.Screen name="EntradaConfirm" component={EntradaConfirmScreen} />
        <Portaria.Screen name="Retirada" component={RetiradaScreen} />
        <Portaria.Screen name="QrScan" component={QrScanScreen} />
        <Portaria.Screen name="SaidaCamera" component={SaidaCameraScreen} />
        <Portaria.Screen name="Avisar" component={AvisarScreen} />
        <Portaria.Screen name="Leituras" component={LeiturasScreen} />
        <Portaria.Screen name="LeituraCamera" component={LeituraCameraScreen} />
        <Portaria.Screen name="LeituraConfirm" component={LeituraConfirmScreen} />
        <Portaria.Screen name="VisitasHoje">
          {(props) => <VisitasHojeScreen {...props} podeDarBaixa />}
        </Portaria.Screen>
      </Portaria.Navigator>
    </NavigationContainer>
  );
}

function PilhaSindico({ perfil, aoSair }: PropsPilha) {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Sindico.Navigator screenOptions={{ headerShown: false }}>
        <Sindico.Screen name="Home">
          {(props) => (
            <SindicoHomeScreen {...props} perfil={perfil} aoSair={aoSair} />
          )}
        </Sindico.Screen>
        <Sindico.Screen name="Ocorrencias" component={OcorrenciasScreen} />
        <Sindico.Screen
          name="OcorrenciaDetalhe"
          component={OcorrenciaDetalheScreen}
        />
        <Sindico.Screen name="Aprovacoes" component={AprovacoesScreen} />
        {/* O nome do condomínio vem do perfil: é ele que assina o texto do
            convite por WhatsApp. */}
        <Sindico.Screen name="Unidades">
          {(props) => (
            <UnidadesScreen
              {...props}
              condominio={perfil.condominioNome ?? "condomínio"}
            />
          )}
        </Sindico.Screen>
        <Sindico.Screen name="Equipe" component={EquipeScreen} />
        {/* Portaria em modo leitura: sem as ações, a lista de encomendas não
            leva a lugar nenhum. O síndico acompanha, não movimenta. */}
        <Sindico.Screen name="Armazenados" component={ArmazenadosScreen} />
        <Sindico.Screen name="RetiradasHoje" component={RetiradasHojeScreen} />
        <Sindico.Screen name="Avisar" component={AvisarScreen} />
        {/* Consumos em modo leitura: registrar leitura é rota da portaria e
            nem compila nesta pilha. */}
        <Sindico.Screen name="Consumos" component={ConsumosScreen} />
        <Sindico.Screen name="Comunicados" component={ComunicadosScreen} />
        <Sindico.Screen name="NovoComunicado" component={NovoComunicadoScreen} />
        {/* Mesma tela do morador, lendo a lista do gestor. */}
        <Sindico.Screen name="Documentos">
          {(props) => <DocumentosScreen {...props} gestor />}
        </Sindico.Screen>
        {/* Sem `podeDarBaixa`: quem confere no portão é a portaria. */}
        <Sindico.Screen name="VisitasHoje" component={VisitasHojeScreen} />
      </Sindico.Navigator>
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
        <Morador.Screen name="Encomendas" component={EncomendasScreen} />
        <Morador.Screen name="Qr" component={QrScreen} />
        <Morador.Screen name="Detalhe" component={DetalheScreen} />
        <Morador.Screen name="MinhaUnidade">
          {(props) => <MinhaUnidadeScreen {...props} aoSair={aoSair} />}
        </Morador.Screen>
        <Morador.Screen name="Avisos" component={AvisosScreen} />
        <Morador.Screen name="Reportar" component={ReportarScreen} />
        <Morador.Screen name="Comunicados" component={ComunicadosMoradorScreen} />
        <Morador.Screen name="Comunicado" component={ComunicadoScreen} />
        <Morador.Screen name="Documentos" component={DocumentosScreen} />
        <Morador.Screen name="Visitas" component={VisitasScreen} />
        <Morador.Screen name="NovaVisita" component={NovaVisitaScreen} />
        <Morador.Screen name="Cobrancas" component={CobrancasScreen} />
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
        if (await renovarSessao()) {
          // Depois de renovar: o condomínio pode ter ligado um módulo desde
          // a última abertura, e a home decide o menu por este cache.
          await sincronizarModulos();
        } else {
          // Conta excluída/desativada em outro aparelho: cai para o login.
          await limparSessao();
          setPerfil(null);
        }
      }
      setCarregado(true);
    });
  }, []);

  /**
   * Sessão que cai NO MEIO do uso volta para o login.
   *
   * A validade só era checada na abertura. Na portaria, onde o aparelho fica
   * ligado o turno inteiro, o token vencia com o app aberto e dali em diante
   * toda tela dizia "Token inválido ou expirado" sem oferecer saída: o
   * porteiro precisava saber que fechar e reabrir resolvia.
   */
  useEffect(
    () =>
      assinarSessaoExpirada(() => {
        limparSessao();
        setPerfil(null);
        Alert.alert(
          "Sessão expirada",
          "Entre de novo com seu telefone para continuar.",
        );
      }),
    [],
  );

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
        {/* A sessão já está gravada quando `aoEntrar` dispara, então a busca
            de módulos vai autenticada.

            ESPERA antes de trocar de tela: disparar sem esperar fazia a home
            montar e ler o cache que o logout tinha acabado de apagar, e o
            menu ficava sem os módulos do condomínio. Custa uma requisição
            curta no login, e falha em silêncio (sem rede, entra com o que
            houver em cache). */}
        <LoginScreen
          aoEntrar={async (novo) => {
            await sincronizarModulos();
            setPerfil(novo);
          }}
        />
      </SafeAreaProvider>
    );
  }

  // Um app, uma experiência por perfil: o servidor devolve a identidade no
  // login e `perfilDe` a projeta no vocabulário do produto. Cada perfil só
  // enxerga as suas telas.
  const sair = () => setPerfil(null);
  switch (perfilDe(perfil)) {
    case "morador":
      return <PilhaMorador perfil={perfil} aoSair={sair} />;
    case "sindico":
      return <PilhaSindico perfil={perfil} aoSair={sair} />;
    case "porteiro":
      return <PilhaPortaria perfil={perfil} aoSair={sair} />;
  }
}
