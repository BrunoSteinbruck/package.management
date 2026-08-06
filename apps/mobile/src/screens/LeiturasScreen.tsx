import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoLeituras, TipoMedidor } from "@pacotes/shared";
import { cacheEstado, carregarEstado } from "../api/estadoLeituras";
import { mesPorExtenso } from "../api/types";
import { BotaoCta, Chip, HeaderTela, Kicker, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

type Props = NativeStackScreenProps<PortariaStackParamList, "Leituras">;

const NOMES: Record<TipoMedidor, string> = { AGUA: "Água", GAS: "Gás" };

type GrupoPendente = { bloco: string | null; restantes: number };

/**
 * Quantas faltam por bloco, em ordem alfabética.
 *
 * Antes a tela listava uma pílula por unidade pendente, cortada em 60. Num
 * prédio de 300 unidades isso era uma parede de números que não cabia na tela
 * e não respondia a pergunta do zelador, que é para qual bloco ele sobe agora.
 */
function agruparPorBloco(
  unidades: EstadoLeituras["unidades"],
): GrupoPendente[] {
  const contagem = new Map<string | null, number>();
  for (const u of unidades) {
    contagem.set(u.bloco, (contagem.get(u.bloco) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([bloco, restantes]) => ({ bloco, restantes }))
    .sort((a, b) => (a.bloco ?? "").localeCompare(b.bloco ?? "", "pt-BR"));
}

export function LeiturasScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
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
  const grupos = agruparPorBloco(pendentes);
  // Condomínio sem blocos cai numa linha só ("120 restantes"), que não informa
  // nada. Nesse caso a lista de unidades continua sendo a resposta útil.
  const temBlocos = grupos.some((g) => g.bloco !== null);
  const unidadesVisiveis = pendentes.slice(0, 60);
  const progresso =
    estado && estado.total > 0 ? estado.lidas / estado.total : 0;

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo="Leituras de água e gás"
        aoVoltar={() => navigation.goBack()}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: 6,
          paddingBottom: 20,
        }}
      >
        {offline && (
          <Text style={styles.avisoOffline}>
            Sem conexão: mostrando o último progresso conhecido. Dá para
            registrar leituras normalmente, elas sincronizam depois.
          </Text>
        )}

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

        <View style={styles.cardProgresso}>
          <View style={styles.linhaProgresso}>
            <Icone
              nome={tipo === "AGUA" ? "gota" : "chama"}
              tamanho={20}
              cor={theme.colors.marca}
              traco={2}
            />
            <Text style={styles.progressoNumero}>{estado?.lidas ?? "-"}</Text>
            <Text style={styles.progressoRotulo}>
              {estado
                ? `de ${estado.total} unidades lidas em ${mesPorExtenso(estado.competencia)}`
                : "carregando o progresso do mês"}
            </Text>
          </View>
          <View style={styles.trilho}>
            <View
              style={[styles.trilhoCheio, { width: `${progresso * 100}%` }]}
            />
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <Kicker>Pendente leitura</Kicker>
          {estado && pendentes.length === 0 ? (
            <Vazio
              variante="hero"
              icone="check"
              titulo="Tudo lido este mês"
              texto={`As ${estado.total} unidades já têm leitura de ${NOMES[tipo].toLowerCase()}.`}
            />
          ) : temBlocos ? (
            <View style={styles.listaBlocos}>
              {grupos.map((g, i) => (
                <View
                  key={g.bloco ?? "sem-bloco"}
                  style={[
                    styles.linhaBloco,
                    i < grupos.length - 1 && styles.linhaBlocoDivisor,
                  ]}
                >
                  <Text style={styles.blocoNome}>
                    {g.bloco ? `Bloco ${g.bloco}` : "Sem bloco"}
                  </Text>
                  <Text style={styles.blocoRestantes}>
                    {g.restantes} restante{g.restantes > 1 ? "s" : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.gradePendentes}>
              {unidadesVisiveis.map((u) => (
                <View key={u.unidadeId} style={styles.piloPendente}>
                  <Text style={styles.piloPendenteTexto}>
                    {u.identificacao}
                  </Text>
                </View>
              ))}
              {pendentes.length > unidadesVisiveis.length && (
                <View style={styles.piloPendente}>
                  <Text style={styles.piloPendenteTexto}>
                    e mais {pendentes.length - unidadesVisiveis.length}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fora do scroll: com centenas de pendentes o botão principal ficava
          abaixo da lista, e o zelador tinha que rolar tudo para chegar nele. */}
      <View
        style={[styles.rodape, { paddingBottom: Math.max(insets.bottom, 14) }]}
      >
        <BotaoCta
          titulo="Ler medidor"
          icone="camera"
          altura={66}
          onPress={() => navigation.navigate("LeituraCamera")}
        />
        <Text style={styles.microcopy}>
          Fotografe o medidor: o número é lido da foto e você confirma
        </Text>
      </View>
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
  chipsTipo: { flexDirection: "row", gap: 9 },
  cardProgresso: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    marginTop: 12,
    gap: 10,
  },
  linhaProgresso: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  progressoNumero: {
    fontSize: theme.font.hero,
    fontWeight: "700",
    color: theme.colors.text,
  },
  progressoRotulo: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  trilho: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.divisor,
    overflow: "hidden",
  },
  trilhoCheio: { height: "100%", borderRadius: 4, backgroundColor: theme.colors.acao },
  listaBlocos: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 10,
    overflow: "hidden",
  },
  linhaBloco: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  linhaBlocoDivisor: { borderBottomWidth: 1, borderBottomColor: theme.colors.divisor },
  blocoNome: { flex: 1, fontSize: 15.5, fontWeight: "600", color: theme.colors.text },
  blocoRestantes: { fontSize: 13.5, fontWeight: "500", color: theme.colors.textSecondary },
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
  rodape: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  microcopy: {
    textAlign: "center",
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
});
