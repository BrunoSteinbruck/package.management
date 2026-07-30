import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch, NetworkError, uploadFoto } from "../api/client";
import {
  CATEGORIAS_OCORRENCIA,
  rotuloUnidade,
  type MinhaUnidade,
} from "../api/types";
import { BotaoCta, Chip, HeaderTela, Kicker } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Reportar">;

export function ReportarScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [fase, setFase] = useState<"form" | "camera">("form");
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<MinhaUnidade[]>([]);
  const [unidadeId, setUnidadeId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // A tela carrega o próprio contexto: é o que a deixa ser um ponto de entrada
  // do manifesto, e o que permite relatar por qualquer unidade e não só pela
  // primeira, que era o que a home mandava.
  useEffect(() => {
    apiFetch<MinhaUnidade[]>("/morador/pacotes")
      .then((lista) => {
        setUnidades(lista);
        if (lista.length === 1) setUnidadeId(lista[0].unidade.id);
      })
      .catch(() => {});
  }, []);

  const escolhida = unidades.find((u) => u.unidade.id === unidadeId);

  async function capturar() {
    const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
    if (foto?.uri) setFotoUri(foto.uri);
    setFase("form");
  }

  async function abrirCamera() {
    if (!permissao?.granted) {
      const r = await pedirPermissao();
      if (!r.granted) return;
    }
    setFase("camera");
  }

  async function enviar() {
    if (!categoria || !unidadeId) return;
    setSalvando(true);
    try {
      let fotoKey: string | undefined;
      if (fotoUri) {
        try {
          fotoKey = await uploadFoto(fotoUri);
        } catch (e) {
          if (!(e instanceof NetworkError)) throw e;
        }
      }
      await apiFetch("/morador/ocorrencias", {
        method: "POST",
        body: { unidadeId, categoria, descricao: descricao || undefined, fotoKey },
      });
      Alert.alert(
        "Relato enviado",
        "A administração foi avisada. Você acompanha o status nos Avisos.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert("Não foi possível enviar", String((e as Error).message));
    } finally {
      setSalvando(false);
    }
  }

  if (fase === "camera") {
    return (
      <View style={styles.telaCamera}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        {/* Sem este botão não havia como sair da câmera: a foto é opcional,
            mas quem abrisse sem querer só escapava tirando uma (ou matando o
            app), porque no iOS não há voltar do sistema e a fase é estado
            local, não rota. Mesmo desenho da AvisarScreen. */}
        <View style={[styles.topoCamera, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.botaoRedondo} onPress={() => setFase("form")}>
            <Icone nome="fechar" tamanho={20} traco={2.2} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[styles.rodapeCamera, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.shutterAnel} onPress={capturar}>
            <View style={styles.shutter} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Relatar desvio" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sub}>
          {escolhida
            ? `Um problema do condomínio em ${rotuloUnidade(escolhida.unidade)}. Vai para a administração.`
            : "Um problema do condomínio. Vai para a administração."}
        </Text>

        {unidades.length > 1 && (
          <>
            <Kicker>Unidade</Kicker>
            <View style={styles.grade}>
              {unidades.map((u) => (
                <Chip
                  key={u.unidade.id}
                  rotulo={rotuloUnidade(u.unidade)}
                  ativo={unidadeId === u.unidade.id}
                  onPress={() => setUnidadeId(u.unidade.id)}
                />
              ))}
            </View>
          </>
        )}

        <Kicker>Categoria</Kicker>
        <View style={styles.grade}>
          {CATEGORIAS_OCORRENCIA.map((c) => (
            <Chip key={c} rotulo={c} ativo={categoria === c} onPress={() => setCategoria(c)} />
          ))}
        </View>

        <Kicker>Descrição (opcional)</Kicker>
        <TextInput
          style={styles.campo}
          placeholder="Ex.: extintor do 3º andar fora do suporte"
          placeholderTextColor={theme.colors.textFaint}
          value={descricao}
          onChangeText={setDescricao}
          multiline
        />

        {fotoUri ? (
          <Pressable onPress={abrirCamera}>
            <Image source={{ uri: fotoUri }} style={styles.foto} />
            <Text style={styles.trocarFoto}>Trocar foto</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.addFoto} onPress={abrirCamera}>
            <Icone nome="camera" tamanho={22} cor={theme.colors.marca} />
            <Text style={styles.addFotoTexto}>Adicionar foto</Text>
          </Pressable>
        )}

        <BotaoCta
          titulo="Enviar relato"
          altura={66}
          onPress={enviar}
          carregando={salvando}
          desabilitado={!categoria || !unidadeId}
          estilo={{ marginTop: 22 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  telaCamera: { flex: 1, backgroundColor: theme.colors.cameraBg },
  topoCamera: { flexDirection: "row", paddingHorizontal: theme.spacing.md },
  botaoRedondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  rodapeCamera: { alignItems: "center", marginTop: "auto" },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 14 },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 4 },
  campo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: 8,
    textAlignVertical: "top",
  },
  foto: { width: "100%", height: 180, borderRadius: theme.radius.card, marginTop: 16 },
  trocarFoto: { textAlign: "center", color: theme.colors.marca, fontWeight: "600", marginTop: 8 },
  addFoto: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
    borderRadius: theme.radius.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: theme.colors.chipBorder,
    marginTop: 16,
  },
  addFotoTexto: { fontSize: 15, fontWeight: "600", color: theme.colors.marca },
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
