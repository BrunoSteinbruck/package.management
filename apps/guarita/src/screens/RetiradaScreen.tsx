import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import {
  diasAtras,
  rotuloUnidade,
  type Pacote,
  type Unidade,
} from "../api/types";
import { BotaoCta, Chip, HeaderTela } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

let cacheUnidades: Unidade[] | null = null;

function diasArmazenado(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

type Props = NativeStackScreenProps<PortariaStackParamList, "Retirada">;

export function RetiradaScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [unidades, setUnidades] = useState<Unidade[]>(cacheUnidades ?? []);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [pendentes, setPendentes] = useState<Pacote[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    const inicial = route.params?.unidadeInicial;
    if (inicial) abrirUnidade(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.unidadeInicial]);

  useEffect(() => {
    if (!cacheUnidades) {
      apiFetch<Unidade[]>("/cadastro/unidades")
        .then((lista) => {
          cacheUnidades = lista;
          setUnidades(lista);
        })
        .catch(() =>
          Alert.alert("Offline", "A retirada exige conexão para listar os pendentes."),
        );
    }
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return unidades
      .filter((u) => `${u.bloco ?? ""} ${u.identificacao}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [busca, unidades]);

  async function abrirUnidade(u: Unidade) {
    setUnidade(u);
    setPendentes(null);
    setSelecionados(new Set());
    try {
      const lista = await apiFetch<Pacote[]>(`/portaria/unidades/${u.id}/pendentes`);
      setPendentes(lista);
      setSelecionados(new Set(lista.map((p) => p.id)));
    } catch (e) {
      Alert.alert("Não foi possível listar", String((e as Error).message));
      setUnidade(null);
    }
  }

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const restantes = (pendentes?.length ?? 0) - selecionados.size;

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Retirada" aoVoltar={() => navigation.goBack()} />

      <View style={{ paddingHorizontal: theme.spacing.lg, flex: 1 }}>
        {!unidade && (
          <>
            <View style={styles.linhaBusca}>
              <View style={styles.campoBusca}>
                <Icone nome="busca" tamanho={20} cor={theme.colors.textMuted} />
                <TextInput
                  style={styles.inputBusca}
                  placeholder="Unidade (ex.: 302)"
                  placeholderTextColor={theme.colors.textFaint}
                  value={busca}
                  onChangeText={setBusca}
                  keyboardType="numbers-and-punctuation"
                  autoFocus
                />
              </View>
              <Pressable
                style={styles.botaoQr}
                onPress={() => navigation.navigate("QrScan")}
              >
                <Icone nome="qr" tamanho={20} traco={2} />
                <Text style={styles.botaoQrTexto}>Bipar QR</Text>
              </Pressable>
            </View>
            <View style={styles.gradeUnidades}>
              {filtradas.map((u) => (
                <Chip key={u.id} rotulo={rotuloUnidade(u)} onPress={() => abrirUnidade(u)} />
              ))}
            </View>
          </>
        )}

        {unidade && (
          <>
            <View style={styles.cabecalhoUnidade}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloUnidade}>
                  {unidade.bloco ? `${unidade.bloco} · ${unidade.identificacao}` : unidade.identificacao}
                </Text>
                <Text style={styles.subUnidade}>
                  {pendentes
                    ? `${pendentes.length} encomenda${pendentes.length !== 1 ? "s" : ""} na portaria`
                    : "carregando..."}
                </Text>
              </View>
              <Pressable style={styles.trocar} onPress={() => setUnidade(null)}>
                <Text style={styles.trocarTexto}>Trocar</Text>
              </Pressable>
            </View>

            <FlatList
              data={pendentes ?? []}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
              ListEmptyComponent={
                pendentes ? (
                  <Text style={styles.vazio}>Nenhuma encomenda na portaria.</Text>
                ) : null
              }
              ListFooterComponent={
                pendentes && pendentes.length > 0 && restantes > 0 ? (
                  <View style={styles.nota}>
                    <Text style={styles.notaTexto}>
                      {restantes} encomenda{restantes !== 1 ? "s" : ""} permanece
                      {restantes === 1 ? "" : "m"} na portaria
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const marcado = selecionados.has(item.id);
                const dias = diasArmazenado(item.recebidoEm);
                return (
                  <Pressable
                    onPress={() => alternar(item.id)}
                    style={({ pressed }) => [
                      styles.cardPacote,
                      marcado
                        ? { borderWidth: 2, borderColor: theme.colors.acao }
                        : { borderWidth: 1, borderColor: theme.colors.border },
                      { transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                  >
                    <View style={[styles.thumb]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pacoteTitulo}>
                        {item.transportadora ?? "Sem transportadora"}
                      </Text>
                      <View style={styles.pacoteSubLinha}>
                        <Text style={styles.pacoteSub}>
                          {item.localArmazenamento ? `Prateleira ${item.localArmazenamento} · ` : ""}
                        </Text>
                        {dias >= 3 ? (
                          <View style={styles.badgeAtraso}>
                            <Text style={styles.badgeAtrasoTexto}>há {dias} dias</Text>
                          </View>
                        ) : (
                          <Text style={styles.pacoteSub}>{diasAtras(item.recebidoEm)}</Text>
                        )}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        marcado
                          ? { backgroundColor: theme.colors.acao }
                          : { borderWidth: 2, borderColor: theme.colors.chipBorder },
                      ]}
                    >
                      {marcado && <Icone nome="check" tamanho={18} traco={3} />}
                    </View>
                  </Pressable>
                );
              }}
            />
          </>
        )}
      </View>

      {unidade && pendentes && pendentes.length > 0 && (
        <View style={[styles.rodape, { paddingBottom: insets.bottom + 12 }]}>
          <BotaoCta
            titulo={`Foto e entregar (${selecionados.size})`}
            icone="camera"
            altura={66}
            desabilitado={selecionados.size === 0}
            onPress={() =>
              navigation.navigate("SaidaCamera", {
                pacoteIds: [...selecionados],
                unidadeLabel: rotuloUnidade(unidade),
              })
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  linhaBusca: { flexDirection: "row", gap: 10 },
  campoBusca: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.marca,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  inputBusca: { flex: 1, fontSize: 18, fontWeight: "600", color: theme.colors.text },
  botaoQr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: theme.colors.marca,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  botaoQrTexto: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  gradeUnidades: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  cabecalhoUnidade: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  tituloUnidade: { fontSize: 28, fontWeight: "700", color: theme.colors.text },
  subUnidade: { fontSize: 14.5, color: theme.colors.textSecondary, fontWeight: "500" },
  trocar: {
    borderWidth: 1.5,
    borderColor: theme.colors.chipBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  trocarTexto: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  vazio: { color: theme.colors.textSecondary, fontSize: theme.font.corpo },
  cardPacote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: 14,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: theme.colors.placeholder,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    borderStyle: "dashed",
  },
  pacoteTitulo: { fontSize: 17.5, fontWeight: "700", color: theme.colors.text },
  pacoteSubLinha: { flexDirection: "row", alignItems: "center", marginTop: 3, gap: 4 },
  pacoteSub: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500" },
  badgeAtraso: {
    backgroundColor: theme.colors.alertaBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeAtrasoTexto: { fontSize: 12.5, fontWeight: "600", color: theme.colors.alerta },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  nota: {
    backgroundColor: theme.colors.notaBg,
    borderRadius: theme.radius.card,
    padding: 14,
    marginTop: 4,
  },
  notaTexto: {
    textAlign: "center",
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  rodape: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    backgroundColor: theme.colors.bg,
  },
});
