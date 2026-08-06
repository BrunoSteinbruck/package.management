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
  type Adocao,
  type DiaSerie,
  type JwtPayload,
  type OcorrenciaGestor,
  type Resumo,
  type VinculoPendente,
} from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { excluirConta } from "../api/excluirConta";
import { limparSessao } from "../api/session";
import { iniciais } from "../api/types";
import { BotaoModulo } from "../components/ui";
import { Icone, type NomeIcone } from "../components/icones";
import { MODULOS_SINDICO, modulosDe } from "../modulos";
import { useModulos } from "../useModulos";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

/** Um número do topo da home, com o destino que o explica. */
function Stat(props: {
  numero: number | string | null | undefined;
  rotulo: string;
  sub?: string;
  icone: NomeIcone;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.statCard,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={styles.statLinhaNumero}>
        <Text style={styles.statNumero}>{props.numero ?? "-"}</Text>
        <View style={styles.statIcone}>
          <Icone nome={props.icone} tamanho={19} cor={theme.colors.marca} traco={2} />
        </View>
      </View>
      <View style={styles.statLinhaRotulo}>
        <Text style={styles.statRotulo}>{props.rotulo}</Text>
        <Icone nome="chevron" tamanho={16} cor={theme.colors.textFaint} />
      </View>
      {props.sub ? <Text style={styles.statSub}>{props.sub}</Text> : null}
    </Pressable>
  );
}

type Props = NativeStackScreenProps<SindicoStackParamList, "Home"> & {
  perfil: JwtPayload;
  aoSair: () => void;
};

export function SindicoHomeScreen({ navigation, perfil, aoSair }: Props) {
  const insets = useSafeAreaInsets();
  const ligados = useModulos();
  const [abertas, setAbertas] = useState<number | null>(null);
  const [pendentes, setPendentes] = useState<number | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [adocao, setAdocao] = useState<Adocao | null>(null);
  const [serie, setSerie] = useState<DiaSerie[]>([]);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    // Cada painel falha sozinho: um endpoint fora do ar não apaga a home.
    const [oc, vp, rs, ad, sr] = await Promise.allSettled([
      apiFetch<OcorrenciaGestor[]>("/cadastro/ocorrencias?status=ABERTO"),
      apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes"),
      apiFetch<Resumo>("/portaria/resumo"),
      apiFetch<Adocao>("/cadastro/adocao"),
      apiFetch<DiaSerie[]>("/portaria/serie-diaria?dias=14"),
    ]);
    if (oc.status === "fulfilled") setAbertas(oc.value.length);
    if (vp.status === "fulfilled") setPendentes(vp.value.length);
    if (rs.status === "fulfilled") setResumo(rs.value);
    if (ad.status === "fulfilled") setAdocao(ad.value);
    if (sr.status === "fulfilled") setSerie(sr.value);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  // Denominador comum às duas séries: barras com escalas diferentes não são
  // comparáveis, que é justamente o que o gráfico existe para permitir.
  const maxSerie = Math.max(1, ...serie.map((d) => Math.max(d.entradas, d.retiradas)));

  return (
    <LinearGradient
      colors={theme.gradiente.marca}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.logo}>convivar</Text>
        <View style={styles.linhaCondominio}>
          <View style={{ flex: 1 }}>
            <Text style={styles.condominio} numberOfLines={1}>
              {perfil.condominioNome ?? "Condomínio"}
            </Text>
            <Text style={styles.operador}>{perfil.nome} · Administração</Text>
          </View>
          <Pressable
            onPress={() =>
              // Vai direto para a tela. O Alert com Cancelar, Excluir e Sair
              // já estava no teto de três botões do Android: somar "Minha
              // conta" faria um deles sumir em silêncio.
              navigation.navigate("MinhaConta")
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

        {/* Grade 2x2: os dois primeiros são o que pede ação, os dois de
            baixo são acompanhamento. "Retiradas hoje" dá o ponto de entrada
            que faltava para RetiradasHoje, que existia na pilha sem ninguém
            conseguir chegar nela. */}
        <View style={styles.gradeStats}>
          <Stat
            numero={resumo?.naPortaria}
            rotulo="na portaria"
            icone="pacote"
            onPress={() => navigation.navigate("Armazenados")}
          />
          <Stat
            numero={pendentes}
            rotulo="a aprovar"
            icone="pessoa"
            onPress={() => navigation.navigate("Aprovacoes")}
          />
          <Stat
            numero={resumo?.retiradasHoje}
            rotulo="retiradas hoje"
            icone="check"
            onPress={() => navigation.navigate("RetiradasHoje")}
          />
          <Stat
            numero={adocao ? `${adocao.percentual}%` : undefined}
            rotulo="adoção do app"
            sub={
              adocao
                ? `${adocao.unidadesComApp} de ${adocao.totalUnidades} unidades`
                : undefined
            }
            icone="casa"
            onPress={() => navigation.navigate("Unidades")}
          />
        </View>

        {serie.length > 0 && (
          <View style={styles.cardSerie}>
            <Text style={styles.tituloSerie}>Entradas x retiradas: 14 dias</Text>
            <View style={styles.grafico}>
              {serie.map((d) => (
                <View key={d.dia} style={styles.dia}>
                  <View
                    style={[
                      styles.barra,
                      styles.barraEntrada,
                      { height: `${(d.entradas / maxSerie) * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.barra,
                      styles.barraRetirada,
                      { height: `${(d.retiradas / maxSerie) * 100}%` },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.legenda}>
              <View style={styles.legendaItem}>
                <View style={[styles.quadrado, { backgroundColor: theme.colors.acao }]} />
                <Text style={styles.legendaTexto}>entradas</Text>
              </View>
              <View style={styles.legendaItem}>
                <View style={[styles.quadrado, { backgroundColor: theme.colors.acentoClaro }]} />
                <Text style={styles.legendaTexto}>retiradas</Text>
              </View>
            </View>
          </View>
        )}

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

        {/* Rodapé do manifesto: o que é ocasional (configurar o condomínio)
            fica em pílula, separado da operação do dia acima. */}
        <View style={styles.linhaRodape}>
          {modulosDe(MODULOS_SINDICO, perfilDe(perfil), "rodape", ligados).map(
            (m) => (
              <BotaoModulo
                key={m.id}
                variante="pill"
                titulo={m.titulo}
                icone={m.icone}
                onPress={() => navigation.navigate(m.id)}
              />
            ),
          )}
        </View>
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
  linhaRodape: { flexDirection: "row", gap: 10, marginTop: 18 },
  gradeStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  statSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },
  cardSerie: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginTop: 14,
  },
  tituloSerie: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 12,
  },
  grafico: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    height: 92,
  },
  dia: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 2, height: "100%" },
  barra: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  barraEntrada: { backgroundColor: theme.colors.acao },
  barraRetirada: { backgroundColor: theme.colors.acentoClaro },
  legenda: { flexDirection: "row", gap: 16, marginTop: 10 },
  legendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  quadrado: { width: 10, height: 10, borderRadius: 3 },
  legendaTexto: { fontSize: 12.5, color: theme.colors.textSecondary, fontWeight: "500" },
  statCard: {
    // Duas colunas: `flex: 1` puro espremeria os quatro numa linha só.
    // O grow cobre a sobra do gap sem precisar calcular largura.
    flexBasis: "47%",
    flexGrow: 1,
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
