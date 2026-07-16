import React, { useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import type { Unidade } from "../api/types";
import { Botao } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "QrScan">;

export function QrScanScreen({ navigation }: Props) {
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
        <Text style={styles.aviso}>
          A câmera é usada para ler o QR do morador.
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
      </View>
    );
  }

  return (
    <View style={styles.tela}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => data && aoLerQr(data)}
      />
      <View style={styles.rodape}>
        <Text style={erro ? styles.erro : styles.dica}>
          {erro ?? "Aponte para o QR na tela do morador."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: "#000" },
  centro: {
    alignItems: "stretch",
    justifyContent: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.bg,
  },
  aviso: {
    fontSize: theme.font.md,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  rodape: { padding: theme.spacing.md, backgroundColor: "#000" },
  dica: { color: "#FFF", fontSize: theme.font.sm, textAlign: "center" },
  erro: { color: "#F09595", fontSize: theme.font.sm, textAlign: "center" },
});
