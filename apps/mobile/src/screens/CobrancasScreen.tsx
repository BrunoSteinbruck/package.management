import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  mesCapitalizado,
  mesDeAno,
  rotuloUnidade,
  type CobrancaMorador,
  type StatusCobranca,
} from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { Botao, HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Cobrancas">;

const ROTULO: Record<StatusCobranca, { texto: string; tom: "ok" | "alerta" | "neutro" }> = {
  PENDENTE: { texto: "pendente", tom: "neutro" },
  PAGA: { texto: "paga", tom: "ok" },
  VENCIDA: { texto: "vencida", tom: "alerta" },
  CANCELADA: { texto: "cancelada", tom: "neutro" },
};

/** No ano corrente basta "Julho"; fora dele o ano precisa aparecer. */
function mesCompetencia(c: string): string {
  const doAnoCorrente = c.startsWith(`${new Date().getFullYear()}-`);
  return doAnoCorrente ? mesCapitalizado(c) : mesDeAno(c);
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CobrancasScreen({ navigation }: Props) {
  const [itens, setItens] = useState<CobrancaMorador[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<CobrancaMorador[]>("/morador/cobrancas"));
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

  async function copiar(c: CobrancaMorador) {
    const codigo = c.pixCopiaCola ?? c.linhaDigitavel;
    if (!codigo) {
      Alert.alert("Sem código", "Este boleto ainda não tem código para copiar.");
      return;
    }
    // Share em vez de Clipboard: já existe no React Native, então não custa
    // dependência nova, e ainda deixa o morador mandar o código para quem
    // paga a conta da casa.
    await Share.share({ message: codigo });
  }

  // A cobrança corrente ganha card próprio no topo: era uma linha igual às
  // outras, e quem abria a tela no dia 9 tinha que caçar qual vencia amanhã.
  // Vence primeiro entre as abertas; se houver vencida, ela é a primeira.
  const abertas = itens
    .filter((c) => c.status === "PENDENTE" || c.status === "VENCIDA")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const corrente = abertas[0];
  const anteriores = itens.filter((c) => c.id !== corrente?.id);

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Boletos" aoVoltar={() => navigation.goBack()} />
      <FlatList
        data={anteriores}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
        ListHeaderComponent={
          corrente ? (
            <View style={styles.cardCorrente}>
              <View style={styles.linhaTopo}>
                <Text style={styles.tituloCorrente}>
                  Taxa condominial · {mesCompetencia(corrente.competencia)}
                </Text>
                <Selo
                  texto={ROTULO[corrente.status].texto}
                  tom={ROTULO[corrente.status].tom}
                />
              </View>
              <Text style={styles.valorCorrente}>{reais(corrente.valor)}</Text>
              <Text style={styles.subCorrente}>
                vence em {diaCurto(corrente.vencimento)} ·{" "}
                {rotuloUnidade(corrente.unidade)}
              </Text>
              {(corrente.pixCopiaCola || corrente.linhaDigitavel) && (
                <Botao
                  titulo={
                    corrente.pixCopiaCola ? "Copiar PIX" : "Copiar linha digitável"
                  }
                  variante="marca"
                  onPress={() => copiar(corrente)}
                  estilo={{ marginTop: 14 }}
                />
              )}
              {corrente.urlBoleto && (
                <Botao
                  titulo="Abrir boleto"
                  variante="outline"
                  onPress={() => Linking.openURL(corrente.urlBoleto!)}
                  estilo={{ marginTop: 8 }}
                />
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !carregando && !corrente ? (
            <Vazio
              variante="hero"
              icone="boleto"
              titulo="Nenhum boleto"
              texto="Quando a administração emitir a taxa condominial, ela aparece aqui."
            />
          ) : null
        }
        renderItem={({ item, index }) => {
          const status = ROTULO[item.status];
          return (
            <>
              {index === 0 && <Text style={styles.secao}>Anteriores</Text>}
              <ItemLista
                titulo={mesCompetencia(item.competencia)}
                sub={
                  item.pagoEm
                    ? `paga em ${diaCurto(item.pagoEm)}`
                    : `vence em ${diaCurto(item.vencimento)}`
                }
                media={{
                  icone: "boleto",
                  corFundo:
                    item.status === "VENCIDA"
                      ? theme.colors.alertaBg
                      : theme.colors.okBg,
                  corIcone:
                    item.status === "VENCIDA"
                      ? theme.colors.alerta
                      : theme.colors.marca,
                }}
                direita={
                  <View style={styles.direita}>
                    <Text style={styles.valorLinha}>{reais(item.valor)}</Text>
                    <Selo texto={status.texto} tom={status.tom} />
                  </View>
                }
              />
            </>
          );
        }}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  cardCorrente: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 2,
    borderColor: theme.colors.acao,
    padding: 18,
    marginBottom: 6,
  },
  linhaTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  tituloCorrente: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  valorCorrente: {
    fontSize: theme.font.hero,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 8,
  },
  subCorrente: {
    fontSize: 13.5,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  secao: {
    fontSize: 16.5,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 18,
    marginBottom: 2,
  },
  direita: { alignItems: "flex-end", gap: 4 },
  valorLinha: { fontSize: 14.5, fontWeight: "700", color: theme.colors.text },
});
