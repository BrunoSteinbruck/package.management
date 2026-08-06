import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Relatorios } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { Card, HeaderTela, Kicker, Nota, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Relatorios">;

const DIAS = 30;

/**
 * Os números do mês da portaria: o mesmo recorte do painel.
 *
 * Sem biblioteca de gráfico: as barras são Views com largura ou altura em
 * porcentagem, que é o que o painel faz com CSS. Duas séries pequenas não
 * pagam uma dependência nativa nova, que custaria um build.
 */
export function RelatoriosScreen({ navigation }: Props) {
  const [dados, setDados] = useState<Relatorios | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(
        await apiFetch<Relatorios>(`/portaria/relatorios?dias=${DIAS}`),
      );
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

  const pico = dados?.porHorario.reduce(
    (melhor, f) => (f.qtd > melhor.qtd ? f : melhor),
    { faixa: "", qtd: 0, pct: 0 },
  );

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo="Relatórios"
        aoVoltar={() => navigation.goBack()}
        direita={<Selo texto={`${DIAS} dias`} tom="marca" />}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
      >
        <View style={styles.metricas}>
          <Card estilo={styles.metrica}>
            <Text style={styles.valor}>
              {dados
                ? `${dados.tempoMedioDias.toLocaleString("pt-BR")}`
                : "-"}
            </Text>
            <Text style={styles.rotulo}>
              dia{dados?.tempoMedioDias === 1 ? "" : "s"} até a retirada
            </Text>
            <Text style={styles.sub}>tempo médio</Text>
          </Card>
          <Card estilo={styles.metrica}>
            <Text style={styles.valor}>
              {dados?.volume.toLocaleString("pt-BR") ?? "-"}
            </Text>
            <Text style={styles.rotulo}>volume no período</Text>
            <Text style={styles.sub}>pacotes recebidos</Text>
          </Card>
        </View>

        <Card estilo={{ marginTop: 12 }}>
          <Text style={[styles.valor, { color: theme.colors.ok }]}>
            {dados
              ? `${dados.notificacoesPct.toLocaleString("pt-BR")}%`
              : "-"}
          </Text>
          <Text style={styles.rotulo}>notificações entregues</Text>
          <Text style={styles.sub}>push · WhatsApp fallback em breve</Text>
        </Card>

        <Kicker>Volume por transportadora</Kicker>
        <Card>
          {dados?.porTransportadora.length === 0 && (
            <Vazio titulo="Sem dados no período." />
          )}
          {dados?.porTransportadora.map((t, i) => (
            // Índice na chave: o nome vem do banco e já colidiu uma vez.
            <View key={`${i}-${t.nome}`} style={styles.linhaBarra}>
              <Text style={styles.nomeBarra} numberOfLines={1}>
                {t.nome}
              </Text>
              <View style={styles.trilha}>
                <View style={[styles.preenchimento, { width: `${t.pct}%` }]} />
              </View>
              <Text style={styles.pct}>{t.pct}%</Text>
            </View>
          ))}
        </Card>

        <Kicker>Retiradas por horário</Kicker>
        <Card>
          <View style={styles.grafico}>
            {dados?.porHorario.map((f) => (
              <View key={f.faixa} style={styles.faixa}>
                <View style={styles.colunaTrilha}>
                  <View
                    style={[
                      styles.coluna,
                      {
                        height: `${Math.max(f.pct, 2)}%`,
                        // Faixa vazia fica visível como traço, não some: uma
                        // coluna ausente lê como dado faltando, não como zero.
                        opacity: 0.35 + (f.pct / 100) * 0.65,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.rotuloFaixa}>
                  {f.faixa.replace(" a ", "-")}
                </Text>
              </View>
            ))}
          </View>
          {pico && pico.qtd > 0 && (
            <Nota
              texto={`Pico entre ${pico.faixa.replace(" a ", "h e ")}: reforce a portaria nesse turno.`}
              estilo={{ marginTop: 12 }}
            />
          )}
        </Card>
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  metricas: { flexDirection: "row", gap: 12, marginTop: 6 },
  metrica: { flex: 1 },
  valor: {
    fontSize: theme.font.hero,
    fontWeight: "700",
    color: theme.colors.text,
  },
  rotulo: {
    fontSize: 13.5,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sub: { fontSize: 12.5, color: theme.colors.textMuted, marginTop: 2 },
  linhaBarra: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  nomeBarra: { width: 96, fontSize: 14, fontWeight: "600", color: theme.colors.text },
  trilha: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.divisor,
    overflow: "hidden",
  },
  preenchimento: { height: "100%", borderRadius: 5, backgroundColor: theme.colors.acao },
  pct: { width: 40, textAlign: "right", fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary },
  grafico: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 140 },
  faixa: { flex: 1, alignItems: "center", gap: 6 },
  colunaTrilha: { flex: 1, width: "100%", justifyContent: "flex-end" },
  coluna: { width: "100%", borderRadius: 6, backgroundColor: theme.colors.acao },
  rotuloFaixa: { fontSize: 11, color: theme.colors.textMuted, fontWeight: "500" },
});
