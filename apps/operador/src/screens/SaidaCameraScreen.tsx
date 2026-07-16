import React, { useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NetworkError, uploadFoto } from "../api/client";
import { postOuEnfileirar } from "../api/offlineQueue";
import type { ResultadoRetirada } from "../api/types";
import { Botao } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "SaidaCamera">;

export function SaidaCameraScreen({ navigation, route }: Props) {
  const { pacoteIds, unidadeLabel } = route.params;
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [enviando, setEnviando] = useState(false);

  async function concluir(comFoto: boolean) {
    if (enviando) return;
    setEnviando(true);
    try {
      let fotoSaidaKey: string | undefined;
      if (comFoto) {
        const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
        if (foto?.uri) {
          try {
            fotoSaidaKey = await uploadFoto(foto.uri);
          } catch (e) {
            if (!(e instanceof NetworkError)) throw e;
          }
        }
      }
      const resultado = await postOuEnfileirar<ResultadoRetirada>(
        "/portaria/retiradas",
        { pacoteIds, fotoSaidaKey },
      );
      if (resultado.queued) {
        Alert.alert("Salvo offline", "A retirada será registrada quando a conexão voltar.");
      } else {
        const restantes = resultado.data?.pendentesRestantes ?? 0;
        Alert.alert(
          "Entrega registrada",
          `${pacoteIds.length} pacote(s) de ${unidadeLabel} entregues.` +
            (restantes > 0 ? ` ${restantes} ainda na portaria.` : "") +
            " Morador notificado.",
        );
      }
      navigation.popToTop();
    } catch (e) {
      Alert.alert("Não foi possível registrar", String((e as Error).message));
    } finally {
      setEnviando(false);
    }
  }

  if (!permissao) return <View style={styles.tela} />;
  if (!permissao.granted) {
    return (
      <View style={[styles.tela, styles.centro]}>
        <Text style={styles.aviso}>
          Fotografe os pacotes na entrega — é o comprovante da retirada.
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
        <Botao
          titulo="Entregar sem foto"
          variante="secundario"
          onPress={() => concluir(false)}
          carregando={enviando}
          estilo={{ marginTop: theme.spacing.sm }}
        />
      </View>
    );
  }

  return (
    <View style={styles.tela}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View style={styles.rodape}>
        <Text style={styles.dica}>
          Fotografe os {pacoteIds.length} pacote(s) sendo entregues a {unidadeLabel}.
        </Text>
        <Botao
          titulo={`Foto e concluir entrega (${pacoteIds.length})`}
          onPress={() => concluir(true)}
          carregando={enviando}
        />
        <Botao
          titulo="Concluir sem foto"
          variante="secundario"
          onPress={() => concluir(false)}
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
});
