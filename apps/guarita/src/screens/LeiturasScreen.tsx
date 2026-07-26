import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoLeituras, TipoMedidor } from "@pacotes/shared";
import { cacheEstado, carregarEstado } from "../api/estadoLeituras";
import { BotaoCta, Chip, HeaderTela, Kicker, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

type Props = NativeStackScreenProps<PortariaStackParamList, "Leituras">;

const NOMES: Record<TipoMedidor, string> = { AGUA: "Água", GAS: "Gás" };

export function LeiturasScreen({ navigation }: Props) {
  const [estados, setEstados] = useState<
    Partial<Record<TipoMedidor, EstadoLeituras>>
  >({ ...cacheEstado });
  const [tipo, setTipo] = useState<TipoMedidor>("AGUA");
  const [offline, setOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Cada tipo falha sozinho; offline, o cache de módulo segue valendo.
      Promise.allSettled([carregarEstado("AGUA"), carregarEstado("GAS")]).then(
        (resultados) => {
          setEstados({ ...cacheEstado });
          setOffline(resultados.every((r) => r.status === "rejected"));
        },
      );
    }, []),
  );

  const estado = estados[tipo];
  const pendentes = estado?.unidades.filter((u) => u.atual === null) ?? [];

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Leituras de medidores" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
      >
        {offline && (
          <Text style={styles.avisoOffline}>
            Sem conexão: mostrando o último progresso conhecido. Dá para
            registrar leituras normalmente, elas sincronizam depois.
          </Text>
        )}

        <View style={styles.linhaProgresso}>
          {(["AGUA", "GAS"] as const).map((t) => {
            const e = estados[t];
            const ativo = tipo === t;
            return (
              <Pressable
                key={t}
                style={({ pressed }) => [
                  styles.cardProgresso,
                  ativo && styles.cardProgressoAtivo,
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
                onPress={() => setTipo(t)}
              >
                <View style={styles.linhaTipoIcone}>
                  <Icone
                    nome={t === "AGUA" ? "gota" : "chama"}
                    tamanho={20}
                    cor={theme.colors.marca}
                    traco={2}
                  />
                  <Kicker>{NOMES[t]}</Kicker>
                </View>
                <Text style={styles.progressoNumero}>
                  {e ? `${e.lidas}/${e.total}` : "-"}
                </Text>
                <Text style={styles.progressoRotulo}>lidas este mês</Text>
              </Pressable>
            );
          })}
        </View>

        <BotaoCta
          titulo="Ler medidor"
          icone="camera"
          altura={72}
          onPress={() => navigation.navigate("LeituraCamera")}
          estilo={{ marginTop: 18 }}
        />
        <Text style={styles.microcopy}>
          Fotografe o medidor: o número é lido da foto e você confirma
        </Text>

        <View style={{ marginTop: 24 }}>
          <View style={styles.linhaPendentes}>
            <Kicker>Faltam em {NOMES[tipo].toLowerCase()}</Kicker>
            <View style={styles.chipsTipo}>
              {(["AGUA", "GAS"] as const).map((t) => (
                <Chip
                  key={t}
                  rotulo={NOMES[t]}
                  ativo={tipo === t}
                  onPress={() => setTipo(t)}
                />
              ))}
            </View>
          </View>
          {estado && pendentes.length === 0 ? (
            <Vazio
              variante="hero"
              icone="check"
              titulo="Tudo lido este mês"
              texto={`As ${estado.total} unidades já têm leitura de ${NOMES[tipo].toLowerCase()}.`}
            />
          ) : (
            <View style={styles.gradePendentes}>
              {pendentes.map((u) => (
                <View key={u.unidadeId} style={styles.piloPendente}>
                  <Text style={styles.piloPendenteTexto}>
                    {u.bloco ? `${u.bloco} ${u.identificacao}` : u.identificacao}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  avisoOffline: {
    backgroundColor: theme.colors.alertaBg,
    color: theme.colors.alerta,
    borderRadius: theme.radius.card,
    padding: 12,
    fontSize: 13.5,
    fontWeight: "600",
    marginBottom: 14,
  },
  linhaProgresso: { flexDirection: "row", gap: 12 },
  cardProgresso: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  cardProgressoAtivo: { borderWidth: 2, borderColor: theme.colors.acao },
  linhaTipoIcone: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressoNumero: {
    fontSize: theme.font.hero,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 6,
  },
  progressoRotulo: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500" },
  microcopy: {
    textAlign: "center",
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  linhaPendentes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chipsTipo: { flexDirection: "row", gap: 8 },
  gradePendentes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  piloPendente: {
    borderWidth: 1.5,
    borderColor: theme.colors.chipBorder,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  piloPendenteTexto: { fontSize: 14.5, fontWeight: "600", color: theme.colors.text },
});
