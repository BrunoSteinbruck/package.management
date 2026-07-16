import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Botao } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "EntradaCamera">;

export function EntradaCameraScreen({ navigation }: Props) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);

  if (!permissao) return <View style={styles.tela} />;
  if (!permissao.granted) {
    return (
      <View style={[styles.tela, styles.centro]}>
        <Text style={styles.aviso}>
          Precisamos da câmera para fotografar a etiqueta do pacote.
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
        <Botao
          titulo="Registrar sem foto"
          variante="secundario"
          onPress={() =>
            navigation.replace("EntradaConfirm", { fotoUri: null, codigoRastreio: null })
          }
          estilo={{ marginTop: theme.spacing.sm }}
        />
      </View>
    );
  }

  async function fotografar() {
    if (capturando) return;
    setCapturando(true);
    try {
      const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      navigation.replace("EntradaConfirm", {
        fotoUri: foto?.uri ?? null,
        codigoRastreio: codigo,
      });
    } finally {
      setCapturando(false);
    }
  }

  return (
    <View style={styles.tela}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["code128", "code39", "ean13", "itf14", "qr", "datamatrix", "pdf417"],
        }}
        onBarcodeScanned={({ data }) => {
          if (!codigo && data) setCodigo(data);
        }}
      />
      <View style={styles.rodape}>
        {codigo ? (
          <Text style={styles.codigoLido} numberOfLines={1}>
            Código lido: {codigo}
          </Text>
        ) : (
          <Text style={styles.dica}>
            Aponte para a etiqueta — o código de barras é lido sozinho.
          </Text>
        )}
        <Botao
          titulo={codigo ? "Fotografar etiqueta e continuar" : "Fotografar etiqueta"}
          onPress={fotografar}
          carregando={capturando}
        />
        <Botao
          titulo="Digitar sem foto"
          variante="secundario"
          onPress={() =>
            navigation.replace("EntradaConfirm", { fotoUri: null, codigoRastreio: codigo })
          }
          estilo={{ marginTop: theme.spacing.sm }}
        />
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
  dica: {
    color: "#FFF",
    fontSize: theme.font.sm,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  codigoLido: {
    color: "#8FE3B0",
    fontSize: theme.font.sm,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
});
