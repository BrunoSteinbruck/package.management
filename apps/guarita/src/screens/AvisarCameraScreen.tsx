import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Botao } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

type Props = NativeStackScreenProps<PortariaStackParamList, "AvisarCamera">;

export function AvisarCameraScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const capturando = useRef(false);

  async function capturar() {
    if (capturando.current) return;
    capturando.current = true;
    try {
      const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      navigation.replace("AvisarConfirm", { fotoUri: foto?.uri ?? null });
    } finally {
      capturando.current = false;
    }
  }

  if (!permissao) return <View style={styles.tela} />;
  if (!permissao.granted) {
    return (
      <View style={[styles.tela, styles.centro]}>
        <Text style={styles.aviso}>
          A câmera é usada para fotografar a situação (carro, vaga...).
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
        <Botao
          titulo="Sem foto"
          variante="outline"
          onPress={() => navigation.replace("AvisarConfirm", { fotoUri: null })}
          estilo={{ marginTop: theme.spacing.sm }}
        />
      </View>
    );
  }

  return (
    <View style={styles.tela}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <View style={[styles.topo, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.botaoRedondo} onPress={() => navigation.goBack()}>
          <Icone nome="fechar" tamanho={20} traco={2.2} />
        </Pressable>
        <Text style={styles.titulo}>Avisar morador</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={[styles.rodape, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.dica}>
          Fotografe a placa, a vaga ou a situação: o app tenta achar a unidade.
        </Text>
        <View style={styles.linhaAcoes}>
          <Pressable
            style={styles.piloAcao}
            onPress={() => navigation.replace("AvisarConfirm", { fotoUri: null })}
          >
            <Text style={styles.piloAcaoTexto}>Sem foto</Text>
          </Pressable>
          <Pressable style={styles.shutterAnel} onPress={capturar}>
            <View style={styles.shutter} />
          </Pressable>
          <View style={{ width: 92 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.cameraBg },
  centro: {
    alignItems: "stretch",
    justifyContent: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.bg,
  },
  aviso: {
    fontSize: theme.font.corpo,
    color: theme.colors.text,
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
  rodape: { paddingHorizontal: theme.spacing.lg, gap: 14 },
  dica: { color: "rgba(255,255,255,0.8)", fontSize: 13.5, textAlign: "center", fontWeight: "500" },
  linhaAcoes: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  piloAcao: {
    width: 92,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    paddingVertical: 12,
    alignItems: "center",
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
