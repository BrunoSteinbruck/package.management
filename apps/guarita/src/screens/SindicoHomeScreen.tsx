import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  perfilDe,
  type JwtPayload,
  type OcorrenciaGestor,
  type Resumo,
  type VinculoPendente,
} from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { excluirConta } from "../api/excluirConta";
import { limparSessao } from "../api/session";
import { BotaoModulo } from "../components/ui";
import { Icone } from "../components/icones";
import { MODULOS_SINDICO, modulosDe } from "../modulos";
import { useModulos } from "../useModulos";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Home"> & {
  perfil: JwtPayload;
  aoSair: () => void;
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export function SindicoHomeScreen({ navigation, perfil, aoSair }: Props) {
  const insets = useSafeAreaInsets();
  const ligados = useModulos();
  const [abertas, setAbertas] = useState<number | null>(null);
  const [pendentes, setPendentes] = useState<number | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    // Cada painel falha sozinho: um endpoint fora do ar não apaga a home.
    const [oc, vp, rs] = await Promise.allSettled([
      apiFetch<OcorrenciaGestor[]>("/cadastro/ocorrencias?status=ABERTO"),
      apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes"),
      apiFetch<Resumo>("/portaria/resumo"),
    ]);
    if (oc.status === "fulfilled") setAbertas(oc.value.length);
    if (vp.status === "fulfilled") setPendentes(vp.value.length);
    if (rs.status === "fulfilled") setResumo(rs.value);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  return (
    <LinearGradient
      colors={theme.gradiente.marca}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.logo}>guarita</Text>
        <View style={styles.linhaCondominio}>
          <View style={{ flex: 1 }}>
            <Text style={styles.condominio} numberOfLines={1}>
              {perfil.condominioNome ?? "Condomínio"}
            </Text>
            <Text style={styles.operador}>{perfil.nome} · Administração</Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert("Conta", `Conectado como ${perfil.nome}.`, [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Excluir minha conta",
                  style: "destructive",
                  onPress: () => excluirConta(aoSair),
                },
                {
                  text: "Sair",
                  onPress: async () => {
                    await limparSessao();
                    aoSair();
                  },
                },
              ])
            }
            style={({ pressed }) => [
              styles.avatar,
              { transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}
          >
            <Text style={styles.avatarTexto}>{iniciais(perfil.nome)}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.corpo}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar();
              setAtualizando(false);
            }}
          />
        }
      >
        {/* Ação principal do síndico: a fila de relatos. Layout próprio, como
            manda o "uma ação principal por tela". */}
        <Pressable
          onPress={() => navigation.navigate("Ocorrencias")}
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
            theme.sombraCta,
          ]}
        >
          <LinearGradient
            colors={theme.gradiente.acao}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tilePrincipal}
          >
            <Icone nome="escudo" tamanho={44} traco={1.8} />
            <Text style={styles.tileTitulo}>
              {abertas === null
                ? "Relatos"
                : abertas === 0
                  ? "Nenhum relato aberto"
                  : `${abertas} relato${abertas > 1 ? "s" : ""} aberto${abertas > 1 ? "s" : ""}`}
            </Text>
            <Text style={styles.tileSub}>O que os moradores reportaram</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.linhaStats}>
          <Pressable
            onPress={() => navigation.navigate("Armazenados")}
            style={({ pressed }) => [
              styles.statCard,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <View style={styles.statLinhaNumero}>
              <Text style={styles.statNumero}>{resumo?.naPortaria ?? "-"}</Text>
              <View style={styles.statIcone}>
                <Icone
                  nome="pacote"
                  tamanho={19}
                  cor={theme.colors.marca}
                  traco={2}
                />
              </View>
            </View>
            <View style={styles.statLinhaRotulo}>
              <Text style={styles.statRotulo}>na portaria</Text>
              <Icone nome="chevron" tamanho={16} cor={theme.colors.textFaint} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("Aprovacoes")}
            style={({ pressed }) => [
              styles.statCard,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <View style={styles.statLinhaNumero}>
              <Text style={styles.statNumero}>{pendentes ?? "-"}</Text>
              <View style={styles.statIcone}>
                <Icone
                  nome="pessoa"
                  tamanho={19}
                  cor={theme.colors.marca}
                  traco={2}
                />
              </View>
            </View>
            <View style={styles.statLinhaRotulo}>
              <Text style={styles.statRotulo}>a aprovar</Text>
              <Icone nome="chevron" tamanho={16} cor={theme.colors.textFaint} />
            </View>
          </Pressable>
        </View>

        {(resumo?.paradas3Dias ?? 0) > 0 && (
          <View style={styles.avisoParadas}>
            <View style={styles.dot} />
            <Text style={styles.avisoParadasTexto}>
              {resumo!.paradas3Dias} encomendas paradas há 3+ dias
            </Text>
          </View>
        )}

        {/* Prateleira do manifesto: gestão e portaria entram aqui. */}
        {modulosDe(
          MODULOS_SINDICO,
          perfilDe(perfil),
          "secundario",
          ligados,
        ).map((m) => (
          <BotaoModulo
            key={m.id}
            titulo={m.titulo}
            icone={m.icone}
            onPress={() => navigation.navigate(m.id)}
            estilo={{ marginTop: 12 }}
          />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.lg, paddingBottom: 22 },
  logo: { color: "#FFF", fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  linhaCondominio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  condominio: {
    color: "#FFF",
    fontSize: theme.font.tituloGrande,
    fontWeight: "700",
  },
  operador: {
    color: theme.colors.acentoClaro,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  corpo: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
  },
  tilePrincipal: {
    minHeight: 175,
    borderRadius: theme.radius.tile + 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: theme.spacing.lg,
  },
  tileTitulo: {
    color: "#FFF",
    fontSize: 27,
    fontWeight: "700",
    textAlign: "center",
  },
  tileSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14.5,
    fontWeight: "500",
  },
  linhaStats: { flexDirection: "row", gap: 12, marginTop: 14 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  // O número sozinho não diz o que conta. O ícone ao lado resolve isso antes
  // da leitura do rótulo.
  statLinhaNumero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statNumero: {
    fontSize: theme.font.hero,
    fontWeight: "700",
    color: theme.colors.text,
  },
  statIcone: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.unidadeBg,
    alignItems: "center",
    justifyContent: "center",
  },
  statRotulo: {
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  statLinhaRotulo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.aviso },
  avisoParadas: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  avisoParadasTexto: {
    color: theme.colors.textSecondary,
    fontSize: 13.5,
    fontWeight: "500",
  },
});
