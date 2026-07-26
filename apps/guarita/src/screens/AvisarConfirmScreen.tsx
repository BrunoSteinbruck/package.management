import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch, NetworkError, uploadFoto } from "../api/client";
import { FotoPendente, postOuEnfileirar } from "../api/offlineQueue";
import { lerTextoLocal, ocrLocalDisponivel } from "../api/ocrLocal";
import {
  MOTIVOS_AVISO,
  rotuloUnidade,
  type AlvoIdentificado,
  type Unidade,
} from "../api/types";
import { BotaoCta, Chip, HeaderTela, Kicker } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

let cacheUnidades: Unidade[] | null = null;

type Props = NativeStackScreenProps<PortariaStackParamList, "AvisarConfirm">;

export function AvisarConfirmScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { fotoUri } = route.params;
  const [unidades, setUnidades] = useState<Unidade[]>(cacheUnidades ?? []);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

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

  async function enviar() {
    if (!unidade || !motivo) return;
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
        { unidadeId: unidade.id, motivo, descricao: descricao || undefined, fotoKey },
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

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Avisar morador" aoVoltar={() => navigation.replace("AvisarCamera")} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {fotoUri && <Image source={{ uri: fotoUri }} style={styles.foto} />}

        <View style={styles.cardUnidade}>
          <Kicker cor={theme.colors.ok}>Unidade</Kicker>
          {unidade ? (
            <>
              <Text style={styles.unidadeValor}>
                {unidade.bloco ? `${unidade.bloco} · ${unidade.identificacao}` : unidade.identificacao}
              </Text>
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
        </View>

        <Kicker>Detalhe (opcional)</Kicker>
        <TextInput
          style={styles.campo}
          placeholder="Ex.: farol aceso, vaga 42"
          placeholderTextColor={theme.colors.textFaint}
          value={descricao}
          onChangeText={setDescricao}
        />

        <BotaoCta
          titulo="Enviar aviso"
          icone="sino"
          altura={66}
          onPress={enviar}
          carregando={salvando}
          desabilitado={!unidade || !motivo}
          estilo={{ marginTop: 22 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  foto: { width: "100%", height: 200, borderRadius: theme.radius.card, marginBottom: 14 },
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
