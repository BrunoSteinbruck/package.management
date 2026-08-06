import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PacoteMorador } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import {
  diasAtras,
  diasNaPortaria,
  horaCurta,
  quandoCurto,
  rotuloUnidade,
  type MinhaUnidade,
} from "../api/types";
import { BotaoCta, HeaderTela, Selo, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { useModulos } from "../useModulos";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Encomendas">;

/**
 * "Chegou ontem às 14h" enquanto é novidade; só o atraso vira contagem.
 *
 * A hora entra só em hoje e ontem: "Chegou há 2 dias às 14h32" mistura duas
 * réguas de tempo na mesma frase e ninguém lê a segunda.
 */
function chegada(p: PacoteMorador): string {
  const dias = diasNaPortaria(p.recebidoEm);
  if (dias >= 3) return `Há ${dias} dias`;
  if (dias >= 2) return `Chegou ${diasAtras(p.recebidoEm)}`;
  return `Chegou ${diasAtras(p.recebidoEm)} às ${horaCurta(p.recebidoEm)}`;
}

/**
 * As encomendas do morador: o que está na portaria e o que já foi retirado.
 *
 * Saiu da home, que listava tudo inline e crescia sem limite com o histórico.
 * A home virou lançador e esta tela é a lista; o histórico, que era um
 * bottom-sheet, virou a segunda seção daqui.
 */
export function EncomendasScreen({ navigation }: Props) {
  const ligados = useModulos();
  const [unidades, setUnidades] = useState<MinhaUnidade[] | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setUnidades(await apiFetch<MinhaUnidade[]>("/morador/pacotes"));
    } catch {
      // offline: mantém o que está na tela
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const totalPendentes = (unidades ?? []).reduce(
    (soma, u) => soma + u.pendentes.length,
    0,
  );
  // O histórico é achatado entre as unidades: quem tem duas quer a linha do
  // tempo das entregas, não duas listas para cruzar de cabeça.
  const historico = (unidades ?? [])
    .flatMap((u) =>
      u.historico.map((p) => ({ ...p, ondeRetirou: rotuloUnidade(u.unidade) })),
    )
    .sort(
      (a, b) =>
        new Date(b.retirada?.retiradoEm ?? b.recebidoEm).getTime() -
        new Date(a.retirada?.retiradoEm ?? a.recebidoEm).getTime(),
    );
  const multiplas = (unidades?.length ?? 0) > 1;

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Encomendas" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: 6,
          paddingBottom: 32,
        }}
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
        <View style={styles.linhaSecao}>
          <Text style={styles.tituloSecao}>Na portaria</Text>
          {totalPendentes > 0 && (
            <View style={styles.badgeContador}>
              <Text style={styles.badgeContadorTexto}>{totalPendentes}</Text>
            </View>
          )}
        </View>

        {unidades && totalPendentes === 0 && (
          <Vazio
            variante="hero"
            icone="check"
            titulo="Nada na portaria"
            texto="Avisaremos assim que uma encomenda chegar."
          />
        )}

        {unidades?.map(
          (minha) =>
            minha.pendentes.length > 0 && (
              <View key={minha.unidade.id} style={{ marginBottom: 6 }}>
                {multiplas && (
                  <Text style={styles.rotuloUnidade}>
                    {rotuloUnidade(minha.unidade)}
                  </Text>
                )}
                {minha.pendentes.map((p) => {
                  const dias = diasNaPortaria(p.recebidoEm);
                  return (
                    <Pressable
                      key={p.id}
                      style={({ pressed }) => [
                        styles.cardPacote,
                        { transform: [{ scale: pressed ? 0.98 : 1 }] },
                      ]}
                      onPress={() =>
                        navigation.navigate("Detalhe", { pacoteId: p.id })
                      }
                    >
                      <View style={styles.thumb} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.pacoteTitulo}>
                          {p.transportadora ?? "Encomenda"}
                        </Text>
                        <View style={styles.pacoteSubLinha}>
                          <Text
                            style={[
                              styles.pacoteSub,
                              dias >= 3 && styles.pacoteSubAtraso,
                            ]}
                          >
                            {chegada(p)}
                          </Text>
                          {dias >= 3 && <Selo texto="retire logo" tom="alerta" />}
                        </View>
                      </View>
                      <Icone
                        nome="chevron"
                        tamanho={20}
                        cor={theme.colors.textFaint}
                      />
                    </Pressable>
                  );
                })}
                {/* O QR é conferência opcional do condomínio. Desligado, o
                    morador vai à portaria e diz a unidade, que é o que ele já
                    fazia: sem o botão, a tela não promete um ritual que a
                    portaria não vai pedir. */}
                {ligados.includes("qr_retirada") && (
                  <BotaoCta
                    titulo="Retirar na portaria"
                    icone="qr"
                    altura={66}
                    onPress={() =>
                      navigation.navigate("Qr", {
                        unidadeId: minha.unidade.id,
                        rotulo: rotuloUnidade(minha.unidade),
                        pendentes: minha.pendentes.length,
                      })
                    }
                    estilo={{ marginTop: 12 }}
                  />
                )}
              </View>
            ),
        )}

        {historico.length > 0 && (
          <>
            <Text style={[styles.tituloSecao, { marginTop: 26 }]}>
              Histórico
            </Text>
            <View style={styles.listaHistorico}>
              {historico.map((item, i) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    navigation.navigate("Detalhe", { pacoteId: item.id })
                  }
                  style={({ pressed }) => [
                    styles.itemHistorico,
                    i < historico.length - 1 && styles.itemHistoricoDivisor,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={styles.checkCirculo}>
                    <Icone
                      nome="check"
                      tamanho={15}
                      cor={theme.colors.ok}
                      traco={2.6}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historicoTitulo}>
                      {item.transportadora ?? "Encomenda"}
                    </Text>
                    <Text style={styles.historicoSub}>
                      Entregue
                      {item.retirada
                        ? ` · ${quandoCurto(item.retirada.retiradoEm)}`
                        : ""}
                      {multiplas ? ` · ${item.ondeRetirou}` : ""}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  linhaSecao: { flexDirection: "row", alignItems: "center", gap: 9 },
  tituloSecao: { fontSize: 16.5, fontWeight: "700", color: theme.colors.text },
  badgeContador: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.acao,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeContadorTexto: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  rotuloUnidade: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    marginTop: 14,
  },
  cardPacote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginTop: 12,
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: theme.colors.placeholder,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    borderStyle: "dashed",
  },
  pacoteTitulo: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  pacoteSubLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
  pacoteSub: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500" },
  pacoteSubAtraso: { color: theme.colors.text, fontWeight: "600" },
  listaHistorico: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 12,
    overflow: "hidden",
  },
  itemHistorico: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemHistoricoDivisor: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divisor,
  },
  checkCirculo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.okBg,
    alignItems: "center",
    justifyContent: "center",
  },
  historicoTitulo: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  historicoSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 1 },
});
