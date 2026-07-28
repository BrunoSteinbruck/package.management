import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Botao } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

type Props = NativeStackScreenProps<PortariaStackParamList, "EntradaCamera">;

export function EntradaCameraScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const capturando = useRef(false);
  const [flash, setFlash] = useState(false);
  const scan = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 0.35, duration: 800, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [scan, pulso]);

  async function capturar(codigo: string | null) {
    if (capturando.current) return;
    capturando.current = true;
    try {
      const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      navigation.replace("EntradaConfirm", {
        fotoUri: foto?.uri ?? null,
        codigoRastreio: codigo,
      });
    } finally {
      capturando.current = false;
    }
  }

  if (!permissao) return <View style={styles.tela} />;
  if (!permissao.granted) {
    return (
      <View style={[styles.tela, styles.centro]}>
        <Text style={styles.avisoPermissao}>
          Precisamos da câmera para fotografar a etiqueta do pacote.
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
        <Botao
          titulo="Registrar sem foto"
          variante="outline"
          onPress={() =>
            navigation.replace("EntradaConfirm", { fotoUri: null, codigoRastreio: null })
          }
          estilo={{ marginTop: theme.spacing.sm }}
        />
      </View>
    );
  }

  return (
    <View style={styles.tela}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flash}
        barcodeScannerSettings={{
          barcodeTypes: ["code128", "code39", "ean13", "itf14", "qr", "datamatrix", "pdf417"],
        }}
        onBarcodeScanned={({ data }) => data && capturar(data)}
      />

      <View style={[styles.topo, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.botaoRedondo} onPress={() => navigation.goBack()}>
          <Icone nome="fechar" tamanho={20} traco={2.2} />
        </Pressable>
        <Text style={styles.titulo}>Nova entrada</Text>
        <Pressable
          style={[styles.botaoRedondo, flash && { backgroundColor: "rgba(63,217,138,0.35)" }]}
          onPress={() => setFlash((f) => !f)}
        >
          <Icone nome="flash" tamanho={20} traco={2.2} />
        </Pressable>
      </View>

      <View style={styles.centroTela}>
        <View style={styles.viewfinder}>
          <View style={[styles.canto, styles.cantoTL]} />
          <View style={[styles.canto, styles.cantoTR]} />
          <View style={[styles.canto, styles.cantoBL]} />
          <View style={[styles.canto, styles.cantoBR]} />
          <Animated.View
            style={[
              styles.linhaScan,
              {
                transform: [
                  {
                    translateY: scan.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 180],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <View style={styles.piloLeitor}>
          <Animated.View style={[styles.dotLeitor, { opacity: pulso }]} />
          <Text style={styles.piloLeitorTexto}>Leitor de código ativo</Text>
        </View>
        <Text style={styles.hint}>Aponte para a etiqueta: o código é lido sozinho</Text>
      </View>

      <View style={[styles.rodape, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={styles.piloAcao}
          onPress={() =>
            navigation.replace("EntradaConfirm", { fotoUri: null, codigoRastreio: null })
          }
        >
          <Text style={styles.piloAcaoTexto}>Digitar código</Text>
        </Pressable>
        <Pressable style={styles.shutterAnel} onPress={() => capturar(null)}>
          <View style={styles.shutter} />
        </Pressable>
        <Pressable
          style={styles.piloAcao}
          onPress={() =>
            navigation.replace("EntradaConfirm", { fotoUri: null, codigoRastreio: null })
          }
        >
          <Text style={styles.piloAcaoTexto}>Sem etiqueta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const TAMANHO_CANTO = 34;
const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.cameraBg },
  centro: { alignItems: "stretch", justifyContent: "center", padding: theme.spacing.lg },
  avisoPermissao: {
    fontSize: theme.font.corpo,
    color: "#FFF",
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    gap: 12,
  },
  botaoRedondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { flex: 1, textAlign: "center", color: "#FFF", fontSize: theme.font.titulo, fontWeight: "700" },
  centroTela: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  viewfinder: { width: 310, height: 225 },
  canto: {
    position: "absolute",
    width: TAMANHO_CANTO,
    height: TAMANHO_CANTO,
    borderColor: theme.colors.scanner,
  },
  cantoTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cantoTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cantoBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cantoBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  linhaScan: {
    position: "absolute",
    top: 18,
    left: 10,
    right: 10,
    height: 2.5,
    backgroundColor: theme.colors.scanner,
    borderRadius: 2,
    opacity: 0.9,
  },
  piloLeitor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dotLeitor: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.scanner },
  piloLeitorTexto: { color: "#FFF", fontSize: 13.5, fontWeight: "600" },
  hint: { color: "rgba(255,255,255,0.75)", fontSize: 13.5, fontWeight: "500" },
  rodape: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
  },
  piloAcao: {
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  piloAcaoTexto: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  shutterAnel: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#FFF" },
});
