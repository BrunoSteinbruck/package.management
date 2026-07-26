import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch, urlFoto } from "../api/client";
import {
  dataCurta,
  rotuloStatusAviso,
  type AvisoMorador,
  type OcorrenciaMorador,
} from "../api/types";
import { HeaderTela } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

interface NotifPacote {
  id: string;
  tipo: "ENTRADA" | "RETIRADA" | "CONVITE";
  criadoEm: string;
  transportadora: string | null;
  pacoteId: string | null;
}

type Props = NativeStackScreenProps<MoradorStackParamList, "Avisos">;

function corStatus(s: string) {
  return s === "RESOLVIDO"
    ? { bg: theme.colors.okBg, fg: theme.colors.ok }
    : s === "EM_ANDAMENTO"
      ? { bg: theme.colors.unidadeBg, fg: theme.colors.marca }
      : { bg: theme.colors.alertaBg, fg: theme.colors.alerta };
}

export function AvisosScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [avisos, setAvisos] = useState<AvisoMorador[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaMorador[]>([]);
  const [notifs, setNotifs] = useState<NotifPacote[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [av, oc, nt] = await Promise.all([
        apiFetch<AvisoMorador[]>("/morador/avisos"),
        apiFetch<OcorrenciaMorador[]>("/morador/ocorrencias"),
        apiFetch<NotifPacote[]>("/morador/notificacoes"),
      ]);
      setAvisos(av);
      setOcorrencias(oc);
      setNotifs(nt);
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function resolver(id: string) {
    try {
      await apiFetch(`/morador/avisos/${id}/resolver`, { method: "POST" });
      carregar();
    } catch (e) {
      Alert.alert("Não foi possível", String((e as Error).message));
    }
  }

  const vazio =
    avisos.length === 0 && ocorrencias.length === 0 && notifs.length === 0;

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Avisos" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
      >
        {vazio && !carregando && (
          <Text style={styles.vazio}>
            Nada por aqui: você verá avisos da portaria e o status dos seus
            relatos.
          </Text>
        )}

        {avisos.length > 0 && <Text style={styles.secao}>Da portaria</Text>}
        {avisos.map((a) => {
          const cor = corStatus(a.status);
          const foto = a.foto ? urlFoto(a.foto) : null;
          return (
            <View key={a.id} style={styles.card}>
              <View style={styles.linhaCard}>
                {foto ? (
                  <Image source={{ uri: foto }} style={styles.thumb} />
                ) : (
                  <View style={[styles.circulo, { backgroundColor: theme.colors.alertaBg }]}>
                    <Icone nome="sino" tamanho={18} cor={theme.colors.alerta} traco={2.2} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo}>{a.motivo}</Text>
                  {a.descricao ? <Text style={styles.sub}>{a.descricao}</Text> : null}
                  <Text style={styles.sub}>{dataCurta(a.criadoEm)}</Text>
                </View>
                <View style={[styles.selo, { backgroundColor: cor.bg }]}>
                  <Text style={[styles.seloTexto, { color: cor.fg }]}>
                    {rotuloStatusAviso(a.status)}
                  </Text>
                </View>
              </View>
              {a.status !== "RESOLVIDO" && (
                <Pressable style={styles.botaoResolver} onPress={() => resolver(a.id)}>
                  <Icone nome="check" tamanho={16} cor={theme.colors.marca} traco={2.6} />
                  <Text style={styles.botaoResolverTexto}>OK, resolvido</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {ocorrencias.length > 0 && <Text style={styles.secao}>Meus relatos</Text>}
        {ocorrencias.map((o) => {
          const cor = corStatus(o.status);
          return (
            <View key={o.id} style={styles.card}>
              <View style={styles.linhaCard}>
                <View style={[styles.circulo, { backgroundColor: theme.colors.divisor }]}>
                  <Icone nome="escudo" tamanho={18} cor={theme.colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo}>{o.categoria}</Text>
                  {o.descricao ? <Text style={styles.sub}>{o.descricao}</Text> : null}
                  <Text style={styles.sub}>{dataCurta(o.criadoEm)}</Text>
                </View>
                <View style={[styles.selo, { backgroundColor: cor.bg }]}>
                  <Text style={[styles.seloTexto, { color: cor.fg }]}>
                    {rotuloStatusAviso(o.status)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {notifs.length > 0 && <Text style={styles.secao}>Encomendas</Text>}
        {notifs.map((n) => {
          const entrada = n.tipo === "ENTRADA";
          return (
            <Pressable
              key={n.id}
              onPress={() => n.pacoteId && navigation.navigate("Detalhe", { pacoteId: n.pacoteId })}
              style={({ pressed }) => [
                styles.card,
                styles.linhaCard,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <View
                style={[
                  styles.circulo,
                  { backgroundColor: entrada ? theme.colors.okBg : theme.colors.divisor },
                ]}
              >
                <Icone
                  nome={entrada ? "sino" : "check"}
                  tamanho={18}
                  cor={entrada ? theme.colors.ok : theme.colors.textSecondary}
                  traco={2.2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>
                  {entrada ? "Encomenda chegou" : "Encomenda retirada"}
                </Text>
                <Text style={styles.sub}>
                  {n.transportadora ?? "Encomenda"} · {dataCurta(n.criadoEm)}
                </Text>
              </View>
              {n.pacoteId && <Icone nome="chevron" tamanho={20} cor={theme.colors.textFaint} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  vazio: { color: theme.colors.textSecondary, fontSize: theme.font.corpo, marginTop: 8, lineHeight: 22 },
  secao: { fontSize: 15, fontWeight: "700", color: theme.colors.textSecondary, marginTop: 18, marginBottom: 8 },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 14,
    marginBottom: 10,
  },
  linhaCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  circulo: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 15.5, fontWeight: "700", color: theme.colors.text },
  sub: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  selo: { borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  seloTexto: { fontSize: 12, fontWeight: "600" },
  botaoResolver: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    minHeight: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.marca,
  },
  botaoResolverTexto: { fontSize: 14, fontWeight: "600", color: theme.colors.marca },
});
