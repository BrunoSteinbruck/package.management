import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { lerTextoLocal } from "../api/ocrLocal";
import { extrairLeituraMedidor } from "../api/medidorParser";
import { Botao } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

type Props = NativeStackScreenProps<PortariaStackParamList, "LeituraCamera">;

/**
 * Foto do medidor. Clone enxuto da câmera de entrada, SEM leitor de código:
 * aqui o que importa é o odômetro. Torch em destaque: medidor mora no escuro.
 */
export function LeituraCameraScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const capturando = useRef(false);
  const [flash, setFlash] = useState(false);
  const [processando, setProcessando] = useState(false);

  async function capturar() {
    if (capturando.current) return;
    capturando.current = true;
    setProcessando(true);
    try {
      const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      // OCR no aparelho (ML Kit). No Expo Go volta vazio e o zelador digita.
      const texto = foto?.uri ? await lerTextoLocal(foto.uri) : "";
      const { sugestao } = extrairLeituraMedidor(texto);
      navigation.replace("LeituraConfirm", { fotoUri: foto?.uri ?? null, sugestao });
    } finally {
      capturando.current = false;
      setProcessando(false);
    }
  }

  if (!permissao) return <View style={styles.tela} />;
  if (!permissao.granted) {
    return (
      <View style={[styles.tela, styles.centro]}>
        <Text style={styles.avisoPermissao}>
          Precisamos da câmera para fotografar o medidor. A foto é o
          comprovante da leitura.
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
        <Botao
          titulo="Digitar sem foto"
          variante="outline"
          onPress={() =>
            navigation.replace("LeituraConfirm", { fotoUri: null, sugestao: null })
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
      />

      <View style={[styles.topo, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.botaoRedondo} onPress={() => navigation.goBack()}>
          <Icone nome="fechar" tamanho={20} traco={2.2} />
        </Pressable>
        <Text style={styles.titulo}>Ler medidor</Text>
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
        </View>
        <Text style={styles.hint}>
          Enquadre os números do medidor e aproxime até encher a moldura
        </Text>
      </View>

      <View style={[styles.rodape, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={styles.piloAcao}
          onPress={() =>
            navigation.replace("LeituraConfirm", { fotoUri: null, sugestao: null })
          }
        >
          <Text style={styles.piloAcaoTexto}>Digitar sem foto</Text>
        </Pressable>
        <Pressable
          style={[styles.shutterAnel, processando && { opacity: 0.5 }]}
          onPress={capturar}
          disabled={processando}
        >
          <View style={styles.shutter} />
        </Pressable>
        <View style={{ minWidth: 108 }} />
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
  // Mais largo que alto: a régua de números do medidor é horizontal.
  viewfinder: { width: 310, height: 150 },
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
  hint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13.5,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 40,
  },
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
    minWidth: 108,
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
