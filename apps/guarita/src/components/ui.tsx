import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StatusAviso } from "@pacotes/shared";
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

/** Fundo de tela. O par `flex:1 + backgroundColor` se repetia em toda tela. */
export function Tela(props: {
  children: React.ReactNode;
  variante?: "clara" | "camera";
  comInsetTop?: boolean;
  estilo?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const fundo =
    props.variante === "camera" ? theme.colors.cameraBg : theme.colors.bg;
  return (
    <View
      style={[
        { flex: 1, backgroundColor: fundo },
        props.comInsetTop ? { paddingTop: insets.top } : null,
        props.estilo,
      ]}
    >
      {props.children}
    </View>
  );
}

export type TomSelo = "ok" | "alerta" | "neutro" | "marca";

const TONS: Record<TomSelo, { bg: string; fg: string }> = {
  ok: { bg: theme.colors.okBg, fg: theme.colors.ok },
  alerta: { bg: theme.colors.alertaBg, fg: theme.colors.alerta },
  neutro: { bg: theme.colors.divisor, fg: theme.colors.textSecondary },
  marca: { bg: theme.colors.unidadeBg, fg: theme.colors.marca },
};

/** Pill de status. Único lugar que decide cor de estado. */
export function Selo(props: { texto: string; tom?: TomSelo }) {
  const cor = TONS[props.tom ?? "neutro"];
  return (
    <View style={[styles.selo, { backgroundColor: cor.bg }]}>
      <Text style={[styles.seloTexto, { color: cor.fg }]}>{props.texto}</Text>
    </View>
  );
}

export function tomDoStatus(s: StatusAviso): TomSelo {
  return s === "RESOLVIDO" ? "ok" : "alerta";
}

/** Miniatura do item: foto real ou ícone em círculo colorido. */
export type MediaItem =
  | { fotoUri: string }
  | { icone: NomeIcone; corFundo: string; corIcone: string };

/**
 * A linha de lista do produto: miniatura, título, apoio e um espaço à direita
 * para selo ou hora. Era reescrita em cada tela que mostra lista.
 */
export function ItemLista(props: {
  titulo: string;
  sub?: string;
  /** Texto secundário em monoespaçada, para código de rastreio. */
  detalhe?: string;
  media?: MediaItem;
  direita?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) {
  const conteudo = (
    <>
      {props.media &&
        ("fotoUri" in props.media ? (
          <Image source={{ uri: props.media.fotoUri }} style={styles.itemFoto} />
        ) : (
          <View
            style={[
              styles.itemCirculo,
              { backgroundColor: props.media.corFundo },
            ]}
          >
            <Icone
              nome={props.media.icone}
              tamanho={18}
              cor={props.media.corIcone}
              traco={2.2}
            />
          </View>
        ))}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitulo}>{props.titulo}</Text>
        {props.sub ? <Text style={styles.itemSub}>{props.sub}</Text> : null}
        {props.detalhe ? (
          <Text style={styles.itemDetalhe} numberOfLines={1}>
            {props.detalhe}
          </Text>
        ) : null}
      </View>
      {props.direita}
      {props.chevron && (
        <Icone nome="chevron" tamanho={20} cor={theme.colors.textFaint} />
      )}
    </>
  );

  if (!props.onPress) {
    return <View style={styles.item}>{conteudo}</View>;
  }
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.item,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {conteudo}
    </Pressable>
  );
}

/**
 * Ponto de entrada secundário na home: ícone, rótulo e uma contagem opcional.
 * É a prateleira onde funcionalidade nova entra sem cirurgia no layout.
 *
 * `card` é a linha larga do porteiro; `pill` é o botão do rodapé do morador,
 * que divide a largura com os vizinhos.
 */
export function BotaoModulo(props: {
  titulo: string;
  icone: NomeIcone;
  onPress: () => void;
  variante?: "card" | "pill";
  contagem?: number;
  estilo?: ViewStyle;
}) {
  const pill = props.variante === "pill";
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.moduloBase,
        pill ? styles.moduloPill : styles.moduloCard,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
        props.estilo,
      ]}
    >
      <Icone
        nome={props.icone}
        tamanho={pill ? 19 : 20}
        cor={theme.colors.marca}
        traco={2.2}
      />
      <Text style={styles.moduloTexto}>{props.titulo}</Text>
      {props.contagem !== undefined && (
        <Text style={styles.moduloContagem}>{props.contagem}</Text>
      )}
    </Pressable>
  );
}

/**
 * Estado vazio. `linha` é a frase discreta no fim de uma lista; `hero` é o
 * bloco centrado de quando a tela inteira não tem o que mostrar.
 */
export function Vazio(props: {
  titulo: string;
  texto?: string;
  icone?: NomeIcone;
  variante?: "linha" | "hero";
}) {
  if (props.variante !== "hero") {
    return (
      <Text style={styles.vazioLinha}>
        {props.texto ? `${props.titulo} ${props.texto}` : props.titulo}
      </Text>
    );
  }
  return (
    <View style={styles.vazioHero}>
      {props.icone && (
        <View style={styles.vazioIcone}>
          <Icone
            nome={props.icone}
            tamanho={30}
            cor={theme.colors.textFaint}
            traco={1.8}
          />
        </View>
      )}
      <Text style={styles.vazioTitulo}>{props.titulo}</Text>
      {props.texto ? <Text style={styles.vazioTexto}>{props.texto}</Text> : null}
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
  selo: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seloTexto: { fontSize: 12.5, fontWeight: "600" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 14,
  },
  itemFoto: { width: 48, height: 48, borderRadius: theme.radius.foto },
  itemCirculo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitulo: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  itemSub: {
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  itemDetalhe: {
    fontFamily: "monospace",
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  moduloBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: theme.colors.surface,
  },
  moduloCard: {
    minHeight: 56,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  moduloPill: {
    flex: 1,
    minHeight: 54,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.chipBorder,
  },
  moduloTexto: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
  moduloContagem: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ok,
    backgroundColor: theme.colors.okBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
    overflow: "hidden",
  },
  vazioLinha: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.corpo,
    marginTop: 8,
    lineHeight: 22,
  },
  vazioHero: { alignItems: "center", paddingVertical: 36, gap: 6 },
  vazioIcone: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.placeholder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  vazioTitulo: {
    fontSize: theme.font.subtitulo,
    fontWeight: "700",
    color: theme.colors.text,
  },
  vazioTexto: {
    fontSize: theme.font.corpo,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
