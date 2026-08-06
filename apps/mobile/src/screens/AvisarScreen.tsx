import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { FotoPendente, postOuEnfileirar } from "../api/offlineQueue";
import { lerTextoLocal, ocrLocalDisponivel } from "../api/ocrLocal";
import { registrarLimpezaDeSessao } from "../api/session";
import {
  MOTIVOS_AVISO,
  rotuloUnidade,
  type AlvoIdentificado,
  type Unidade,
} from "../api/types";
import { BotaoCta, Chip, HeaderTela, Kicker, Nota } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

let cacheUnidades: Unidade[] | null = null;
registrarLimpezaDeSessao(() => {
  cacheUnidades = null;
});

type Props = NativeStackScreenProps<PortariaStackParamList, "Avisar">;

export function AvisarScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  // A foto é um campo do formulário, não a porta de entrada: quem abre o
  // aviso já cai no preenchimento e fotografa só se quiser.
  const [fase, setFase] = useState<"form" | "camera">("form");
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const capturando = useRef(false);
  const [unidades, setUnidades] = useState<Unidade[]>(cacheUnidades ?? []);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function abrirCamera() {
    if (!permissao?.granted) {
      const r = await pedirPermissao();
      if (!r.granted) return;
    }
    setFase("camera");
  }

  async function capturar() {
    if (capturando.current) return;
    capturando.current = true;
    try {
      const foto = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      if (foto?.uri) setFotoUri(foto.uri);
      setFase("form");
    } finally {
      capturando.current = false;
    }
  }

  useEffect(() => {
    if (!cacheUnidades) {
      apiFetch<Unidade[]>("/cadastro/unidades")
        .then((l) => {
          cacheUnidades = l;
          setUnidades(l);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!fotoUri || !ocrLocalDisponivel) return;
    (async () => {
      try {
        const texto = await lerTextoLocal(fotoUri);
        if (!texto.trim()) return;
        const alvo = await apiFetch<AlvoIdentificado>("/portaria/identificar-alvo", {
          method: "POST",
          body: { texto: texto.slice(0, 200) },
        });
        if (alvo.unidade) {
          setUnidade(alvo.unidade);
          setOrigem(alvo.origem);
        }
      } catch {
        // sem OCR/alvo: seleção manual segue
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoUri]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? unidades.filter((u) => `${u.bloco ?? ""} ${u.identificacao}`.toLowerCase().includes(q))
      : unidades;
    return base.slice(0, 12);
  }, [busca, unidades]);

  // Sem pílula marcada, o texto livre É o motivo. O desenho põe o campo logo
  // abaixo das pílulas dizendo "Outro motivo", e antes disso quem digitava lá
  // sem escolher pílula ficava com o botão desligado e nenhuma explicação.
  const textoLivre = descricao.trim();
  const motivoEnviado = motivo || textoLivre.slice(0, 120);

  async function enviar() {
    if (!unidade || !motivoEnviado) return;
    setSalvando(true);
    try {
      let fotoKey: string | undefined;
      let fotoPendente: FotoPendente | undefined;
      if (fotoUri) {
        try {
          fotoKey = await uploadFoto(fotoUri);
        } catch (e) {
          if (!(e instanceof NetworkError)) throw e;
          // Offline: guarda o URI para a foto subir junto no flush da fila.
          fotoPendente = { uri: fotoUri, campo: "fotoKey" };
        }
      }
      const resultado = await postOuEnfileirar<{ temApp: boolean }>(
        "/portaria/avisos",
        {
          unidadeId: unidade.id,
          motivo: motivoEnviado,
          // Só manda a descrição quando ela não é o próprio motivo. A exceção
          // é o texto longo, que o motivo corta em 120 e perderia o resto.
          descricao: motivo
            ? textoLivre || undefined
            : textoLivre.length > 120
              ? textoLivre
              : undefined,
          fotoKey,
        },
        fotoPendente,
      );
      if (resultado.queued) {
        Alert.alert(
          "Salvo offline",
          `Aviso para ${rotuloUnidade(unidade)} será enviado quando a conexão voltar.`,
          [{ text: "OK", onPress: () => navigation.popToTop() }],
        );
      } else {
        const temApp = resultado.data?.temApp ?? false;
        Alert.alert(
          temApp ? "Aviso enviado" : "Unidade sem app",
          temApp
            ? `${rotuloUnidade(unidade)}: morador notificado.`
            : `${rotuloUnidade(unidade)} não tem o app. Avise pelo interfone.`,
          [{ text: "OK", onPress: () => navigation.popToTop() }],
        );
      }
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
        <View style={[styles.topoCamera, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.botaoRedondo} onPress={() => setFase("form")}>
            <Icone nome="fechar" tamanho={20} traco={2.2} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[styles.rodapeCamera, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.dicaCamera}>
            Fotografe a placa, a vaga ou a situação: o app tenta achar a unidade.
          </Text>
          <Pressable style={styles.shutterAnel} onPress={capturar}>
            <View style={styles.shutter} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Avisar morador" aoVoltar={() => navigation.popToTop()} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* A foto vem antes do resto porque é ela que identifica a unidade:
            o OCR lê a placa ou a vaga e sugere o apartamento. */}
        <Kicker>Foto (opcional)</Kicker>
        {fotoUri ? (
          <Pressable onPress={abrirCamera}>
            <Image source={{ uri: fotoUri }} style={styles.foto} />
            <Text style={styles.trocarFoto}>Trocar foto</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.addFoto} onPress={abrirCamera}>
            <Icone nome="camera" tamanho={22} cor={theme.colors.marca} />
            <Text style={styles.addFotoTexto}>Tirar foto</Text>
          </Pressable>
        )}

        <View style={styles.cardUnidade}>
          <Kicker cor={theme.colors.ok}>Unidade</Kicker>
          {unidade ? (
            <>
              <Text style={styles.unidadeValor}>{rotuloUnidade(unidade)}</Text>
              <Text style={styles.unidadeHint} onPress={() => { setUnidade(null); setOrigem(null); }}>
                {origem === "placa"
                  ? "Identificada pela placa · toque para trocar"
                  : origem === "vaga"
                    ? "Identificada pela vaga · toque para trocar"
                    : "Toque para trocar"}
              </Text>
            </>
          ) : (
            <>
              <TextInput
                style={styles.campoBusca}
                placeholder="Buscar: 302, B..."
                maxLength={60}
                placeholderTextColor={theme.colors.textFaint}
                value={busca}
                onChangeText={setBusca}
                autoFocus={!fotoUri}
              />
              <View style={styles.grade}>
                {filtradas.map((u) => (
                  <Chip key={u.id} rotulo={rotuloUnidade(u)} onPress={() => setUnidade(u)} />
                ))}
              </View>
            </>
          )}
        </View>

        <View style={{ marginTop: 18 }}>
          <Kicker>Motivo</Kicker>
          <View style={styles.grade}>
            {MOTIVOS_AVISO.map((m) => (
              <Chip key={m} rotulo={m} ativo={motivo === m} onPress={() => setMotivo(m)} />
            ))}
          </View>
          <TextInput
            style={styles.campo}
            placeholder="Outro motivo — digite aqui…"
            maxLength={500}
            placeholderTextColor={theme.colors.textFaint}
            value={descricao}
            onChangeText={setDescricao}
          />
        </View>

        <BotaoCta
          titulo="Enviar aviso"
          icone="sino"
          altura={66}
          onPress={enviar}
          carregando={salvando}
          desabilitado={!unidade || !motivoEnviado}
          estilo={{ marginTop: 22 }}
        />
        <Nota
          texto={
            unidade
              ? `Notificará todos os vinculados de ${rotuloUnidade(unidade)}`
              : "Notificará todos os vinculados desta unidade"
          }
          estilo={{ marginTop: 12 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  foto: { width: "100%", height: 200, borderRadius: theme.radius.card, marginBottom: 8 },
  trocarFoto: {
    textAlign: "center",
    color: theme.colors.marca,
    fontWeight: "600",
    marginBottom: 14,
  },
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
    marginBottom: 14,
  },
  addFotoTexto: { fontSize: 15, fontWeight: "600", color: theme.colors.marca },
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
  rodapeCamera: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: theme.spacing.lg,
  },
  dicaCamera: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13.5,
    textAlign: "center",
    fontWeight: "500",
  },
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
  cardUnidade: {
    backgroundColor: theme.colors.unidadeBg,
    borderRadius: theme.radius.card,
    borderWidth: 2.5,
    borderColor: theme.colors.acao,
    padding: 16,
  },
  unidadeValor: { fontSize: theme.font.heroMaior, fontWeight: "700", color: theme.colors.text },
  unidadeHint: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  campoBusca: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 18,
    color: theme.colors.text,
    marginTop: 8,
  },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  campo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: 8,
  },
});
