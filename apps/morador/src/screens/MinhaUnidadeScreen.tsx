import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import type { Vinculado } from "../api/types";
import { Botao, Card, HeaderTela, Kicker } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MinhaUnidade">;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export function MinhaUnidadeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { unidadeId, rotulo, condominio } = route.params;
  const [vinculados, setVinculados] = useState<Vinculado[]>([]);
  const [convidando, setConvidando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Vinculado[]>(`/morador/unidades/${unidadeId}/vinculados`)
        .then(setVinculados)
        .catch(() => {});
    }, [unidadeId]),
  );

  async function convidar() {
    setConvidando(true);
    try {
      const convite = await apiFetch<{ codigo: string }>("/morador/convites", {
        method: "POST",
        body: { unidadeId },
      });
      await Share.share({
        message:
          `Você foi convidado para o Guarita — o app de encomendas do ${condominio}. ` +
          `Baixe o app, entre com seu celular e use o código ${convite.codigo} ` +
          `para se vincular à unidade ${rotulo}. O código vale por 7 dias.`,
      });
    } catch (e) {
      Alert.alert("Não foi possível gerar o convite", String((e as Error).message));
    } finally {
      setConvidando(false);
    }
  }

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Minha unidade" aoVoltar={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}>
        <LinearGradient
          colors={theme.gradiente.marca}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardUnidade}
        >
          <Kicker cor={theme.colors.acentoClaro}>{condominio}</Kicker>
          <Text style={styles.unidadeValor}>{rotulo}</Text>
        </LinearGradient>

        <Text style={styles.tituloSecao}>Moradores</Text>
        <Card estilo={{ padding: 6 }}>
          {vinculados.map((v, i) => (
            <View
              key={v.telefone}
              style={[
                styles.itemMorador,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.divisor },
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: v.titular ? theme.colors.marca : theme.colors.textSecondary },
                ]}
              >
                <Text style={styles.avatarTexto}>{iniciais(v.nome)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nomeMorador}>
                  {v.nome}
                  {v.voce ? " (você)" : ""}
                </Text>
                <Text style={styles.telefoneMorador}>{v.telefone}</Text>
              </View>
              {v.titular && (
                <View style={styles.badgeTitular}>
                  <Text style={styles.badgeTitularTexto}>Titular</Text>
                </View>
              )}
            </View>
          ))}
        </Card>

        <Botao
          titulo="Convidar familiar"
          variante="outline"
          icone="mais"
          onPress={convidar}
          carregando={convidando}
          estilo={{ marginTop: 14, minHeight: 56 }}
        />

        <Pressable
          style={({ pressed }) => [styles.linhaNotif, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          onPress={() =>
            Alert.alert(
              "Notificações",
              "Hoje todos os moradores vinculados recebem os avisos de encomenda. Preferências individuais chegam em breve.",
            )
          }
        >
          <View style={styles.iconeNotif}>
            <Icone nome="sino" tamanho={20} cor={theme.colors.ok} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitulo}>Notificações</Text>
            <Text style={styles.notifSub}>Todos os vinculados recebem os avisos</Text>
          </View>
          <Icone nome="chevron" tamanho={22} cor={theme.colors.textFaint} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  cardUnidade: {
    borderRadius: theme.radius.card,
    padding: 22,
    marginBottom: 22,
  },
  unidadeValor: { color: "#FFF", fontSize: 34, fontWeight: "700", marginTop: 6 },
  tituloSecao: { fontSize: 17, fontWeight: "700", color: theme.colors.text, marginBottom: 10 },
  itemMorador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  nomeMorador: { fontSize: 15.5, fontWeight: "600", color: theme.colors.text },
  telefoneMorador: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 1 },
  badgeTitular: {
    backgroundColor: theme.colors.okBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeTitularTexto: { fontSize: 12, fontWeight: "600", color: theme.colors.ok },
  linhaNotif: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 14,
    marginTop: 14,
  },
  iconeNotif: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.okBg,
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitulo: { fontSize: 15.5, fontWeight: "600", color: theme.colors.text },
  notifSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 1 },
});
