import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { analisarEtiqueta, apiFetch, NetworkError, uploadFoto } from "../api/client";
import { lerTextoLocal, ocrLocalDisponivel } from "../api/ocrLocal";
import { FotoPendente, postOuEnfileirar } from "../api/offlineQueue";
import { registrarLimpezaDeSessao } from "../api/session";
import {
  rotuloUnidade,
  type Pacote,
  type RespostaOcr,
  type Unidade,
} from "../api/types";
import { BotaoCta, Chip, HeaderTela, Kicker } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

const PRATELEIRAS = ["A1", "A2", "B1", "B2", "C1"];
const PRATELEIRA_KEY = "@entrada/ultima-prateleira";
let cacheUnidades: Unidade[] | null = null;
registrarLimpezaDeSessao(() => {
  cacheUnidades = null;
});

type Props = NativeStackScreenProps<PortariaStackParamList, "EntradaConfirm">;

export function EntradaConfirmScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { fotoUri, codigoRastreio } = route.params;
  const [unidades, setUnidades] = useState<Unidade[]>(cacheUnidades ?? []);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [transportadora, setTransportadora] = useState("");
  const [rastreio, setRastreio] = useState(codigoRastreio ?? "");
  const [prateleira, setPrateleira] = useState("");
  const [ultimaPrateleira, setUltimaPrateleira] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [fotoKeyOcr, setFotoKeyOcr] = useState<string | null>(null);
  const [dicaOcr, setDicaOcr] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PRATELEIRA_KEY).then((v) => {
      if (v) {
        setUltimaPrateleira(v);
        setPrateleira((atual) => atual || v);
      }
    });
    if (!cacheUnidades) {
      apiFetch<Unidade[]>("/cadastro/unidades")
        .then((lista) => {
          cacheUnidades = lista;
          setUnidades(lista);
        })
        .catch(() => {
          Alert.alert(
            "Sem lista de unidades",
            "Não foi possível carregar as unidades (offline?). Tente novamente.",
          );
        });
    }
  }, []);

  useEffect(() => {
    if (!fotoUri) return;

    const aplicar = (res: {
      extraido: RespostaOcr["extraido"];
      sugestoes: RespostaOcr["sugestoes"];
    }) => {
      setTransportadora((atual) => atual || (res.extraido.transportadora ?? ""));
      setRastreio((atual) => atual || (res.extraido.rastreio ?? ""));
      const melhor = res.sugestoes[0];
      if (melhor && melhor.score >= 0.7) {
        setUnidade(
          (atual) =>
            atual ?? {
              id: melhor.id,
              bloco: melhor.bloco,
              identificacao: melhor.identificacao,
            },
        );
        setDicaOcr(true);
      }
    };

    (async () => {
      try {
        if (ocrLocalDisponivel) {
          // Dev/production build: ML Kit lê a etiqueta NO aparelho (grátis,
          // offline); a foto sobe em paralelo só como comprovante.
          const [key, texto] = await Promise.all([
            uploadFoto(fotoUri).catch(() => undefined),
            lerTextoLocal(fotoUri),
          ]);
          if (key) setFotoKeyOcr(key);
          if (texto.trim()) {
            aplicar(
              await apiFetch<{
                extraido: RespostaOcr["extraido"];
                sugestoes: RespostaOcr["sugestoes"];
              }>("/portaria/ocr-texto", { method: "POST", body: { texto } }),
            );
          }
        } else {
          // Expo Go: servidor guarda a foto e roda o OCR (Vision, se houver chave).
          const res = await analisarEtiqueta<RespostaOcr>(fotoUri);
          setFotoKeyOcr(res.fotoKey);
          aplicar(res);
        }
      } catch {
        // Sem OCR (offline ou falha): fluxo manual segue normal.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoUri]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? unidades.filter((u) =>
          `${u.bloco ?? ""} ${u.identificacao}`.toLowerCase().includes(q),
        )
      : unidades;
    return base.slice(0, 12);
  }, [busca, unidades]);

  async function confirmar() {
    if (!unidade) return;
    setSalvando(true);
    try {
      let fotoEntradaKey: string | undefined = fotoKeyOcr ?? undefined;
      let fotoPendente: FotoPendente | undefined;
      if (fotoUri && !fotoEntradaKey) {
        try {
          fotoEntradaKey = await uploadFoto(fotoUri);
        } catch (e) {
          if (!(e instanceof NetworkError)) throw e;
          // Offline: guarda o URI para a foto subir no flush (não perde o comprovante).
          fotoPendente = { uri: fotoUri, campo: "fotoEntradaKey" };
        }
      }
      const resultado = await postOuEnfileirar<Pacote>(
        "/portaria/pacotes",
        {
          unidadeId: unidade.id,
          transportadora: transportadora || undefined,
          codigoRastreio: rastreio || undefined,
          fotoEntradaKey,
          localArmazenamento: prateleira || undefined,
        },
        fotoPendente,
      );
      if (prateleira) await AsyncStorage.setItem(PRATELEIRA_KEY, prateleira);
      Alert.alert(
        resultado.queued ? "Salvo offline" : "Entrada registrada",
        resultado.queued
          ? "Será enviado quando a conexão voltar. Pronto para o próximo."
          : `${rotuloUnidade(unidade)}: morador avisado. Pronto para o próximo.`,
        [{ text: "Próximo pacote", onPress: () => navigation.replace("EntradaCamera") }],
      );
    } catch (e) {
      Alert.alert("Não foi possível registrar", String((e as Error).message));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela
        titulo="Confirmar entrada"
        // Voltar sai do fluxo. Antes reabria a câmera, e como a câmera também
        // é a tela anterior, não havia saída óbvia: quem quer refazer a foto
        // toca na miniatura.
        aoVoltar={() => navigation.popToTop()}
        direita={<Text style={styles.passo}>2 de 2</Text>}
      />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.cardFoto}>
          <Pressable
            onPress={() => navigation.replace("EntradaCamera")}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbVazia]}>
                <Icone nome="camera" tamanho={22} cor={theme.colors.textFaint} />
              </View>
            )}
            <Text style={styles.trocarFoto}>
              {fotoUri ? "Trocar" : "Tirar foto"}
            </Text>
          </Pressable>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Kicker>Transportadora</Kicker>
              <TextInput
                style={styles.campoInline}
                value={transportadora}
                onChangeText={setTransportadora}
                placeholder="ex.: Amazon"
                maxLength={120}
                placeholderTextColor={theme.colors.textFaint}
              />
            </View>
            <View>
              <Kicker>Código de barras</Kicker>
              <TextInput
                style={[styles.campoInline, styles.mono]}
                value={rastreio}
                onChangeText={setRastreio}
                placeholder="lido pela câmera"
                maxLength={120}
                placeholderTextColor={theme.colors.textFaint}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <View style={styles.cardUnidade}>
          <Kicker cor={theme.colors.ok}>Unidade</Kicker>
          {unidade ? (
            <>
              <View style={styles.linhaUnidade}>
                <Text style={styles.unidadeValor}>
                  {unidade.bloco ? `${unidade.bloco} · ${unidade.identificacao}` : unidade.identificacao}
                </Text>
                <Icone nome="chevron" tamanho={26} cor={theme.colors.textFaint} />
              </View>
              <Text style={styles.unidadeHint} onPress={() => setUnidade(null)}>
                {dicaOcr ? "Sugerida pela etiqueta · toque para trocar" : "Toque para trocar"}
              </Text>
            </>
          ) : (
            <>
              <TextInput
                style={styles.campoBusca}
                placeholder="Buscar: 302, B..."
                maxLength={60}
                placeholderTextColor={theme.colors.textFaint}
                value={busca}
                onChangeText={setBusca}
                autoFocus={!fotoUri}
              />
              <View style={styles.gradeUnidades}>
                {filtradas.map((u) => (
                  <Chip
                    key={u.id}
                    rotulo={rotuloUnidade(u)}
                    onPress={() => {
                      setUnidade(u);
                      setDicaOcr(false);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        <View style={{ marginTop: 18 }}>
          <Kicker>Prateleira</Kicker>
          <View style={styles.linhaChips}>
            {PRATELEIRAS.map((p) => (
              <Chip
                key={p}
                rotulo={p}
                ativo={prateleira === p}
                onPress={() => setPrateleira(prateleira === p ? "" : p)}
              />
            ))}
          </View>
          {ultimaPrateleira && (
            <Text style={styles.hintPrateleira}>
              {ultimaPrateleira} foi a última usada
            </Text>
          )}
        </View>

        <BotaoCta
          titulo="Confirmar e notificar"
          icone="check"
          altura={72}
          onPress={confirmar}
          carregando={salvando}
          desabilitado={!unidade}
          estilo={{ marginTop: 22 }}
        />
        <Text style={styles.microcopy}>O morador recebe o aviso na hora</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  passo: { fontSize: 13.5, color: theme.colors.textMuted, fontWeight: "600" },
  cardFoto: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  thumb: { width: 92, height: 92, borderRadius: theme.radius.foto },
  trocarFoto: {
    textAlign: "center",
    color: theme.colors.marca,
    fontWeight: "600",
    fontSize: 13,
    marginTop: 6,
  },
  thumbVazia: {
    backgroundColor: theme.colors.placeholder,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  campoInline: {
    fontSize: 16.5,
    fontWeight: "600",
    color: theme.colors.text,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divisor,
  },
  mono: { fontFamily: "monospace", fontWeight: "400", fontSize: 14.5 },
  cardUnidade: {
    marginTop: 14,
    backgroundColor: theme.colors.unidadeBg,
    borderRadius: theme.radius.card,
    borderWidth: 2.5,
    borderColor: theme.colors.acao,
    padding: 16,
  },
  linhaUnidade: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unidadeValor: { fontSize: theme.font.heroMaior, fontWeight: "700", color: theme.colors.text },
  unidadeHint: { fontSize: 13.5, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  campoBusca: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 18,
    color: theme.colors.text,
    marginTop: 8,
  },
  gradeUnidades: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  linhaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  hintPrateleira: { fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
  microcopy: {
    textAlign: "center",
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
});
