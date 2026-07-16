import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";
import { Icone, NomeIcone } from "./icones";

/** CTA no padrão Guarita: gradiente verde-ação, sombra, pressed scale 0.98. */
export function BotaoCta(props: {
  titulo: string;
  onPress: () => void;
  icone?: NomeIcone;
  altura?: number;
  desabilitado?: boolean;
  carregando?: boolean;
  estilo?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.desabilitado || props.carregando}
      style={({ pressed }) => [
        { transform: [{ scale: pressed ? 0.98 : 1 }], opacity: props.desabilitado ? 0.45 : 1 },
        theme.sombraCta,
        props.estilo,
      ]}
    >
      <LinearGradient
        colors={theme.gradiente.acao}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cta, { minHeight: props.altura ?? 64 }]}
      >
        {props.carregando ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <View style={styles.ctaConteudo}>
            {props.icone && <Icone nome={props.icone} tamanho={24} traco={2.2} />}
            <Text style={styles.ctaTexto}>{props.titulo}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** Botão secundário: sólido verde-marca ou outline. */
export function Botao(props: {
  titulo: string;
  onPress: () => void;
  variante?: "marca" | "outline";
  icone?: NomeIcone;
  desabilitado?: boolean;
  carregando?: boolean;
  estilo?: ViewStyle;
}) {
  const outline = props.variante === "outline";
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.desabilitado || props.carregando}
      style={({ pressed }) => [
        styles.botao,
        outline
          ? { backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.marca }
          : { backgroundColor: theme.colors.marca },
        { transform: [{ scale: pressed ? 0.98 : 1 }], opacity: props.desabilitado ? 0.45 : 1 },
        props.estilo,
      ]}
    >
      {props.carregando ? (
        <ActivityIndicator color={outline ? theme.colors.marca : "#FFF"} />
      ) : (
        <View style={styles.ctaConteudo}>
          {props.icone && (
            <Icone
              nome={props.icone}
              tamanho={20}
              traco={2.2}
              cor={outline ? theme.colors.marca : "#FFF"}
            />
          )}
          <Text
            style={[
              styles.botaoTexto,
              { color: outline ? theme.colors.marca : "#FFF" },
            ]}
          >
            {props.titulo}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Chip pill: inativo borda 1.5 #C7D2C9; ativo verde-marca com check. */
export function Chip(props: {
  rotulo: string;
  ativo?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        props.ativo
          ? { backgroundColor: theme.colors.marca }
          : { borderWidth: 1.5, borderColor: theme.colors.chipBorder, backgroundColor: theme.colors.surface },
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {props.ativo && <Icone nome="check" tamanho={15} traco={2.6} />}
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: props.ativo ? "#FFF" : theme.colors.text,
        }}
      >
        {props.rotulo}
      </Text>
    </Pressable>
  );
}

export function Card(props: { children: React.ReactNode; estilo?: ViewStyle }) {
  return <View style={[styles.card, props.estilo]}>{props.children}</View>;
}

export function Rotulo(props: { children: React.ReactNode; estilo?: TextStyle }) {
  return <Text style={[styles.rotulo, props.estilo]}>{props.children}</Text>;
}

/** Kicker uppercase com letter-spacing (títulos de campo). */
export function Kicker(props: { children: React.ReactNode; cor?: string }) {
  return (
    <Text
      style={{
        fontSize: theme.font.kicker,
        fontWeight: "600",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: props.cor ?? theme.colors.textMuted,
      }}
    >
      {props.children}
    </Text>
  );
}

/** Header de tela interna: seta de voltar + título (fora do header nativo). */
export function HeaderTela(props: {
  titulo: string;
  aoVoltar: () => void;
  direita?: React.ReactNode;
  escuro?: boolean;
}) {
  const cor = props.escuro ? "#FFF" : theme.colors.text;
  return (
    <View style={styles.headerTela}>
      <Pressable
        onPress={props.aoVoltar}
        style={[
          styles.botaoVoltar,
          props.escuro
            ? { backgroundColor: "rgba(255,255,255,0.14)" }
            : { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
        ]}
      >
        <Icone nome="voltar" tamanho={22} cor={cor} traco={2.2} />
      </Pressable>
      <Text style={[styles.headerTitulo, { color: cor }]}>{props.titulo}</Text>
      <View style={{ minWidth: 44, alignItems: "flex-end" }}>{props.direita}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  cta: {
    borderRadius: theme.radius.tile,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  ctaConteudo: { flexDirection: "row", alignItems: "center", gap: 10 },
  ctaTexto: { fontSize: theme.font.cta, fontWeight: "700", color: "#FFF" },
  botao: {
    minHeight: 56,
    borderRadius: theme.radius.tile,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  botaoTexto: { fontSize: 17, fontWeight: "600" },
  chip: {
    minHeight: 44,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  rotulo: {
    fontSize: theme.font.apoio,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    fontWeight: "500",
  },
  headerTela: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  botaoVoltar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitulo: { flex: 1, fontSize: theme.font.titulo, fontWeight: "700" },
});
