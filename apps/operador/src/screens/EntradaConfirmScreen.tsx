import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch, NetworkError, uploadFoto } from "../api/client";
import { postOuEnfileirar } from "../api/offlineQueue";
import { rotuloUnidade, type Pacote, type Unidade } from "../api/types";
import { Botao, Chip, Rotulo } from "../components/ui";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

const TRANSPORTADORAS = ["Mercado Livre", "Amazon", "Shopee", "Correios"];
const PRATELEIRA_KEY = "@entrada/ultima-prateleira";
let cacheUnidades: Unidade[] | null = null;

type Props = NativeStackScreenProps<RootStackParamList, "EntradaConfirm">;

export function EntradaConfirmScreen({ navigation, route }: Props) {
  const { fotoUri, codigoRastreio } = route.params;
  const [unidades, setUnidades] = useState<Unidade[]>(cacheUnidades ?? []);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [transportadora, setTransportadora] = useState<string>("");
  const [rastreio, setRastreio] = useState(codigoRastreio ?? "");
  const [prateleira, setPrateleira] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PRATELEIRA_KEY).then((v) => v && setPrateleira(v));
    if (!cacheUnidades) {
      apiFetch<Unidade[]>("/cadastro/unidades")
        .then((lista) => {
          cacheUnidades = lista;
          setUnidades(lista);
        })
        .catch(() => {
          Alert.alert(
            "Sem lista de unidades",
            "Não foi possível carregar as unidades (offline?). Tente novamente.",
          );
        });
    }
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return unidades;
    return unidades.filter((u) =>
      `${u.bloco ?? ""} ${u.identificacao}`.toLowerCase().includes(q),
    );
  }, [busca, unidades]);

  async function confirmar() {
    if (!unidade) return;
    setSalvando(true);
    try {
      let fotoEntradaKey: string | undefined;
      if (fotoUri) {
        try {
          fotoEntradaKey = await uploadFoto(fotoUri);
        } catch (e) {
          if (!(e instanceof NetworkError)) throw e;
        }
      }
      const resultado = await postOuEnfileirar<Pacote>("/portaria/pacotes", {
        unidadeId: unidade.id,
        transportadora: transportadora || undefined,
        codigoRastreio: rastreio || undefined,
        fotoEntradaKey,
        localArmazenamento: prateleira || undefined,
      });
      if (prateleira) await AsyncStorage.setItem(PRATELEIRA_KEY, prateleira);
      Alert.alert(
        resultado.queued ? "Salvo offline" : "Pacote registrado",
        resultado.queued
          ? "Será enviado quando a conexão voltar."
          : `${rotuloUnidade(unidade)} — morador será notificado.`,
      );
      navigation.popToTop();
    } catch (e) {
      Alert.alert("Não foi possível registrar", String((e as Error).message));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={styles.tela} contentContainerStyle={{ padding: theme.spacing.md }}>
      <View style={{ flexDirection: "row", gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
        {fotoUri ? (
          <Image source={{ uri: fotoUri }} style={styles.foto} />
        ) : (
          <View style={[styles.foto, styles.fotoVazia]}>
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.font.sm }}>
              sem foto
            </Text>
          </View>
        )}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={styles.titulo}>
            {unidade ? rotuloUnidade(unidade) : "Escolha a unidade"}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.font.sm }}>
            {unidade
              ? "Confira e confirme — o morador será notificado."
              : "Única confirmação obrigatória."}
          </Text>
        </View>
      </View>

      {!unidade && (
        <View style={{ marginBottom: theme.spacing.md }}>
          <TextInput
            style={styles.campo}
            placeholder="Buscar: 302, B, 41..."
            placeholderTextColor={theme.colors.textMuted}
            value={busca}
            onChangeText={setBusca}
            autoFocus
          />
          <FlatList
            data={filtradas.slice(0, 30)}
            keyExtractor={(u) => u.id}
            scrollEnabled={false}
            numColumns={3}
            columnWrapperStyle={{ gap: theme.spacing.sm }}
            contentContainerStyle={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}
            renderItem={({ item }) => (
              <View style={{ flex: 1 / 3 }}>
                <Chip rotulo={rotuloUnidade(item)} onPress={() => setUnidade(item)} />
              </View>
            )}
          />
        </View>
      )}
      {unidade && (
        <Botao
          titulo="Trocar unidade"
          variante="secundario"
          onPress={() => setUnidade(null)}
          estilo={{ marginBottom: theme.spacing.md }}
        />
      )}

      <Rotulo>Transportadora</Rotulo>
      <View style={styles.linhaChips}>
        {TRANSPORTADORAS.map((t) => (
          <Chip
            key={t}
            rotulo={t}
            ativo={transportadora === t}
            onPress={() => setTransportadora(transportadora === t ? "" : t)}
          />
        ))}
      </View>

      <Rotulo>Código de rastreio</Rotulo>
      <TextInput
        style={[styles.campo, { marginBottom: theme.spacing.md }]}
        value={rastreio}
        onChangeText={setRastreio}
        placeholder="lido do código de barras"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="characters"
      />

      <Rotulo>Prateleira</Rotulo>
      <TextInput
        style={[styles.campo, { marginBottom: theme.spacing.lg }]}
        value={prateleira}
        onChangeText={setPrateleira}
        placeholder="ex.: C2 (lembra a última usada)"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="characters"
      />

      <Botao
        titulo="Confirmar e notificar"
        onPress={confirmar}
        carregando={salvando}
        desabilitado={!unidade}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  foto: { width: 96, height: 96, borderRadius: theme.radius.md },
  fotoVazia: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: theme.font.lg, fontWeight: "600", color: theme.colors.text },
  campo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.touch.min,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.font.md,
    color: theme.colors.text,
  },
  linhaChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
});
