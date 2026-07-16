import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import type { Unidade } from "../api/types";
import { Botao } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "QrScan">;

export function QrScanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const resolvendo = useRef(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoLerQr(data: string) {
    if (resolvendo.current) return;
    resolvendo.current = true;
    try {
      const unidade = await apiFetch<Unidade>("/portaria/qr-resolve", {
        method: "POST",
        body: { qrToken: data },
      });
      navigation.replace("Retirada", { unidadeInicial: unidade });
    } catch (e) {
      setErro(String((e as Error).message));
      setTimeout(() => {
        resolvendo.current = false;
        setErro(null);
      }, 2500);
    }
  }

  if (!permissao) return <View style={styles.tela} />;
  if (!permissao.granted) {
    return (
      <View style={[styles.tela, styles.centro]}>
        <Text style={styles.aviso}>A câmera é usada para ler o QR do morador.</Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
      </View>
    );
  }

  return (
    <View style={styles.tela}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => data && aoLerQr(data)}
      />
      <View style={[styles.topo, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.botaoRedondo} onPress={() => navigation.goBack()}>
          <Icone nome="fechar" tamanho={20} traco={2.2} />
        </Pressable>
        <Text style={styles.titulo}>Bipar QR do morador</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.centroTela}>
        <View style={styles.viewfinder}>
          <View style={[styles.canto, styles.cantoTL]} />
          <View style={[styles.canto, styles.cantoTR]} />
          <View style={[styles.canto, styles.cantoBL]} />
          <View style={[styles.canto, styles.cantoBR]} />
        </View>
      </View>

      <View style={[styles.rodape, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={erro ? styles.erro : styles.hint}>
          {erro ?? "Aponte para o QR na tela do morador"}
        </Text>
      </View>
    </View>
  );
}

const TAMANHO_CANTO = 34;
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
  centroTela: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewfinder: { width: 250, height: 250 },
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
  rodape: { alignItems: "center" },
  hint: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" },
  erro: { color: "#F09595", fontSize: 14, fontWeight: "600" },
});
