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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  mesCurtoAno,
  type LeituraRegistrada,
  type TipoMedidor,
} from "@pacotes/shared";
import { apiFetch, NetworkError, uploadFoto } from "../api/client";
import {
  cacheEstado,
  competenciaAtual,
  limparEstado,
  registrarNoCache,
} from "../api/estadoLeituras";
import { lerLeituraDigitada } from "../api/medidorParser";
import { proximasPendentes } from "../api/rodada";
import { FotoPendente, postOuEnfileirar } from "../api/offlineQueue";
import { registrarLimpezaDeSessao } from "../api/session";
import { rotuloUnidade, type Unidade } from "../api/types";
import { BotaoCta, Chip, HeaderTela, Kicker, Tela } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { PortariaStackParamList } from "../navigation";

let cacheUnidades: Unidade[] | null = null;
// O zelador faz a rodada por tipo (toda a água, depois todo o gás): o toggle
// abre no último tipo usado.
let ultimoTipo: TipoMedidor = "AGUA";
// Última unidade registrada na sessão: as sugestões seguem a rodada a partir
// dela, e o próximo apartamento costuma ser o primeiro chip.
let ultimaUnidadeId: string | null = null;
registrarLimpezaDeSessao(() => {
  cacheUnidades = null;
  ultimoTipo = "AGUA";
  ultimaUnidadeId = null;
  limparEstado();
});

const NOMES: Record<TipoMedidor, string> = { AGUA: "Água", GAS: "Gás" };

type Props = NativeStackScreenProps<PortariaStackParamList, "LeituraConfirm">;

export function LeituraConfirmScreen({ navigation, route }: Props) {
  const { fotoUri, sugestao } = route.params;
  const [unidades, setUnidades] = useState<Unidade[]>(cacheUnidades ?? []);
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  // Se a unidade escolhida veio da fila de pendentes ou de uma busca. Sem
  // isso a dica dizia "próxima da lista" também para quem buscou outra.
  const [veioDaFila, setVeioDaFila] = useState(false);
  const [tipo, setTipo] = useState<TipoMedidor>(ultimoTipo);
  const [valorTexto, setValorTexto] = useState(
    sugestao !== null ? String(sugestao) : "",
  );
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!cacheUnidades) {
      apiFetch<Unidade[]>("/cadastro/unidades")
        .then((lista) => {
          cacheUnidades = lista;
          setUnidades(lista);
        })
        .catch(() => {
          Alert.alert(
            "Sem lista de unidades",
            "Não foi possível carregar as unidades (offline?). Abra esta tela uma vez com internet para trabalhar offline depois.",
          );
        });
    }
  }, []);

  const { filtradas, sugerindoPendentes } = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q) {
      // Busca vale para TODAS as unidades: refazer uma já lida é legítimo.
      const achadas = unidades.filter((u) =>
        `${u.bloco ?? ""} ${u.identificacao}`.toLowerCase().includes(q),
      );
      return { filtradas: achadas.slice(0, 12), sugerindoPendentes: false };
    }
    // Sem busca, os chips são as PENDENTES do tipo, na ordem da rodada a
    // partir da última registrada: o apartamento seguinte vira o primeiro
    // chip e o zelador não digita nada.
    const estado = cacheEstado[tipo];
    if (estado) {
      const pendentes = proximasPendentes(estado, ultimaUnidadeId);
      if (pendentes.length > 0) {
        return { filtradas: pendentes, sugerindoPendentes: true };
      }
    }
    return { filtradas: unidades.slice(0, 12), sugerindoPendentes: false };
  }, [busca, unidades, tipo]);

  const valor = useMemo(() => lerLeituraDigitada(valorTexto), [valorTexto]);

  // Anterior e "já lida" vêm do cache do estado carregado na tela Leituras:
  // funciona no subsolo sem sinal.
  const infoUnidade = useMemo(() => {
    if (!unidade) return null;
    return (
      cacheEstado[tipo]?.unidades.find((u) => u.unidadeId === unidade.id) ?? null
    );
  }, [unidade, tipo]);

  const consumoPrevisto =
    valor !== null && infoUnidade?.anterior
      ? Math.round((valor - infoUnidade.anterior.valor) * 1000) / 1000
      : null;

  async function enviar() {
    if (!unidade || valor === null) return;
    setSalvando(true);
    try {
      let fotoKey: string | undefined;
      let fotoPendente: FotoPendente | undefined;
      if (fotoUri) {
        try {
          fotoKey = await uploadFoto(fotoUri);
        } catch (e) {
          if (!(e instanceof NetworkError)) throw e;
          // Offline: a foto sobe junto com a leitura no flush da fila.
          fotoPendente = { uri: fotoUri, campo: "fotoKey" };
        }
      }
      const resultado = await postOuEnfileirar<LeituraRegistrada>(
        "/leituras",
        {
          unidadeId: unidade.id,
          tipo,
          competencia: competenciaAtual(),
          valor,
          fotoKey,
        },
        fotoPendente,
      );
      ultimoTipo = tipo;
      ultimaUnidadeId = unidade.id;
      registrarNoCache(tipo, unidade.id, valor);

      const consumo = resultado.data?.consumo ?? consumoPrevisto;
      const detalhe = resultado.queued
        ? "Sem conexão agora: a leitura envia sozinha quando a rede voltar."
        : consumo !== null
          ? `Consumo de ${NOMES[tipo].toLowerCase()}: ${consumo.toLocaleString("pt-BR")} m³.`
          : "Primeira leitura desta unidade registrada.";
      const estado = cacheEstado[tipo];
      const faltam = estado ? estado.total - estado.lidas : null;
      const progresso =
        faltam === null
          ? ""
          : faltam === 0
            ? `\n\nEra a última: as ${estado!.total} unidades de ${NOMES[tipo].toLowerCase()} estão lidas este mês.`
            : `\n\nFaltam ${faltam} de ${NOMES[tipo].toLowerCase()} este mês.`;
      const alertaNegativo =
        (resultado.data?.alerta ?? (consumo !== null && consumo < 0 ? "NEGATIVO" : null)) ===
        "NEGATIVO"
          ? "\n\nAtenção: deu menor que a leitura anterior. Confira depois no painel."
          : "";
      Alert.alert(
        resultado.queued ? "Salvo offline" : "Leitura registrada",
        `${rotuloUnidade(unidade)}: ${detalhe}${alertaNegativo}${progresso}`,
        [
          { text: "Ver progresso", onPress: () => navigation.navigate("Leituras") },
          {
            text: "Próximo medidor",
            onPress: () => navigation.replace("LeituraCamera"),
          },
        ],
      );
    } catch (e) {
      Alert.alert("Não foi possível registrar", String((e as Error).message));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo="Confirmar leitura"
        aoVoltar={() => navigation.navigate("Leituras")}
        direita={<Text style={styles.passo}>2 de 2</Text>}
      />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.cardFoto}>
          <Pressable
            onPress={() => navigation.replace("LeituraCamera")}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbVazia]}>
                <Icone nome="camera" tamanho={22} cor={theme.colors.textFaint} />
              </View>
            )}
            <Text style={styles.trocarFoto}>{fotoUri ? "Refazer" : "Tirar foto"}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Kicker>Leitura</Kicker>
            <TextInput
              style={styles.campoValor}
              value={valorTexto}
              onChangeText={setValorTexto}
              placeholder="0000"
              placeholderTextColor={theme.colors.textFaint}
              keyboardType="decimal-pad"
              // O servidor aceita até 999.999.999: nenhum hidrômetro tem mais
              // dígitos que isso, e sem teto o campo aceitava um número que só
              // era recusado no envio, depois da foto tirada.
              maxLength={13}
              autoFocus={sugestao === null}
            />
            <Text style={styles.hintValor}>
              {sugestao !== null
                ? "sugerida pela foto · toque para corrigir"
                : "digite o número do medidor"}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <Kicker>Medidor</Kicker>
          <View style={styles.linhaChips}>
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

        <View style={styles.cardUnidade}>
          <Kicker cor={theme.colors.ok}>Unidade</Kicker>
          {unidade ? (
            <>
              <View style={styles.linhaUnidade}>
                <Text style={styles.unidadeValor}>{rotuloUnidade(unidade)}</Text>
                <Icone nome="chevron" tamanho={26} cor={theme.colors.textFaint} />
              </View>
              <Text style={styles.unidadeHint} onPress={() => setUnidade(null)}>
                {veioDaFila
                  ? "próxima da lista · toque para trocar"
                  : "toque para trocar"}
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
              />
              <View style={styles.gradeUnidades}>
                {filtradas.map((u) => (
                  <Chip
                    key={u.id}
                    rotulo={rotuloUnidade(u)}
                    onPress={() => {
                      setUnidade(u);
                      setVeioDaFila(sugerindoPendentes);
                    }}
                  />
                ))}
              </View>
              {sugerindoPendentes && (
                <Text style={styles.hintPendentes}>
                  Pendentes de {NOMES[tipo].toLowerCase()}, na ordem da rodada
                </Text>
              )}
            </>
          )}
        </View>

        {infoUnidade?.anterior && (
          <View style={styles.cardAnterior}>
            <Text style={styles.anteriorTexto}>
              Anterior ({mesCurtoAno(infoUnidade.anterior.competencia)}):{" "}
              {infoUnidade.anterior.valor.toLocaleString("pt-BR")}
            </Text>
            {consumoPrevisto !== null && (
              <Text
                style={[
                  styles.anteriorConsumo,
                  consumoPrevisto < 0 && { color: theme.colors.notif },
                ]}
              >
                Consumo: {consumoPrevisto.toLocaleString("pt-BR")} m³
                {consumoPrevisto < 0 ? " (menor que a anterior, confira)" : ""}
              </Text>
            )}
          </View>
        )}
        {infoUnidade && infoUnidade.atual !== null && (
          <Text style={styles.jaLida}>
            Esta unidade já tem leitura de {NOMES[tipo].toLowerCase()} este mês
            ({infoUnidade.atual.toLocaleString("pt-BR")}). Enviar substitui.
          </Text>
        )}

        <BotaoCta
          titulo="Salvar leitura"
          icone="check"
          altura={72}
          onPress={enviar}
          carregando={salvando}
          desabilitado={!unidade || valor === null}
          estilo={{ marginTop: 22 }}
        />
        <Text style={styles.microcopy}>
          A foto fica guardada como comprovante da leitura
        </Text>
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
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
  thumbVazia: {
    backgroundColor: theme.colors.placeholder,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  trocarFoto: {
    textAlign: "center",
    color: theme.colors.marca,
    fontWeight: "600",
    fontSize: 13,
    marginTop: 6,
  },
  campoValor: {
    fontSize: theme.font.hero,
    fontWeight: "700",
    color: theme.colors.text,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divisor,
    fontVariant: ["tabular-nums"],
  },
  hintValor: { fontSize: 13, color: theme.colors.textMuted, marginTop: 6 },
  linhaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  cardUnidade: {
    marginTop: 18,
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
  unidadeValor: {
    fontSize: theme.font.heroMaior,
    fontWeight: "700",
    color: theme.colors.text,
  },
  unidadeHint: {
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
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
  gradeUnidades: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  hintPendentes: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 10,
  },
  cardAnterior: {
    marginTop: 14,
    backgroundColor: theme.colors.notaBg,
    borderRadius: theme.radius.card,
    padding: 14,
    gap: 4,
  },
  anteriorTexto: { fontSize: 14.5, color: theme.colors.textSecondary, fontWeight: "500" },
  anteriorConsumo: { fontSize: 16.5, color: theme.colors.text, fontWeight: "700" },
  jaLida: {
    marginTop: 10,
    backgroundColor: theme.colors.alertaBg,
    color: theme.colors.alerta,
    borderRadius: theme.radius.card,
    padding: 12,
    fontSize: 13.5,
    fontWeight: "600",
  },
  microcopy: {
    textAlign: "center",
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
});
