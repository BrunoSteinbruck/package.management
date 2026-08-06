import React, { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NetworkError, uploadFoto } from "../api/client";
import { FotoPendente, postOuEnfileirar } from "../api/offlineQueue";
import type { ResultadoRetirada } from "../api/types";
import { Botao } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

type Props = NativeStackScreenProps<PortariaStackParamList, "SaidaCamera">;

export function SaidaCameraScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const {
    pacoteIds,
    unidadeLabel,
    recebidoPorMoradorId,
    recebidoPorNome,
    recebedorRotulo,
  } = route.params;
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [enviando, setEnviando] = useState(false);

  async function concluir(comFoto: boolean) {
    if (enviando) return;
    setEnviando(true);
    try {
      let fotoSaidaKey: string | undefined;
      let fotoPendente: FotoPendente | undefined;
      if (comFoto) {
        const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
        if (foto?.uri) {
          try {
            fotoSaidaKey = await uploadFoto(foto.uri);
          } catch (e) {
            if (!(e instanceof NetworkError)) throw e;
            // Offline: o comprovante de saída sobe no flush.
            fotoPendente = { uri: foto.uri, campo: "fotoSaidaKey" };
          }
        }
      }
      const resultado = await postOuEnfileirar<ResultadoRetirada>(
        "/portaria/retiradas",
        { pacoteIds, fotoSaidaKey, recebidoPorMoradorId, recebidoPorNome },
        fotoPendente,
      );
      if (resultado.queued) {
        Alert.alert("Salvo offline", "A saída será registrada quando a conexão voltar.");
      } else {
        const restantes = resultado.data?.pendentesRestantes ?? 0;
        Alert.alert(
          "Saída registrada",
          `${pacoteIds.length} encomenda(s) de ${unidadeLabel} entregues.` +
            (restantes > 0 ? ` ${restantes} ainda na portaria.` : "") +
            " Morador avisado.",
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
          Fotografe os pacotes na entrega: é o comprovante da retirada.
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
        <Botao
          titulo="Entregar sem foto"
          variante="outline"
          onPress={() => concluir(false)}
          carregando={enviando}
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
        <Text style={styles.titulo}>Foto de comprovação</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.centroTela}>
        <Text style={styles.contexto}>
          {pacoteIds.length} pacote{pacoteIds.length === 1 ? "" : "s"} ·{" "}
          {unidadeLabel}
          {recebedorRotulo ? ` · recebe ${recebedorRotulo}` : ""}
        </Text>
      </View>

      <View style={[styles.rodape, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.hint}>Enquadre os pacotes</Text>
        <View style={styles.linhaAcoes}>
          <Pressable style={styles.piloAcao} onPress={() => concluir(false)}>
            <Text style={styles.piloAcaoTexto}>Sem foto</Text>
          </Pressable>
          <Pressable style={styles.shutterAnel} onPress={() => concluir(true)}>
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
  hint: { color: "rgba(255,255,255,0.8)", fontSize: 13.5, textAlign: "center", fontWeight: "500" },
  centroTela: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: 18 },
  contexto: {
    color: "#FFF",
    fontSize: 14.5,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    overflow: "hidden",
  },
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
