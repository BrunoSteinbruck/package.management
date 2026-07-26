import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  ConsumoLinha,
  ConsumosResposta,
  TipoMedidor,
} from "@pacotes/shared";
import { apiFetch, API_URL, urlFoto } from "../api/client";
import { competenciaAtual } from "../api/estadoLeituras";
import { Chip, HeaderTela, Selo, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Consumos">;

const NOMES: Record<TipoMedidor, string> = { AGUA: "Água", GAS: "Gás" };
const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function somarMeses(competencia: string, n: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + n;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}

function nomeCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES_PT[mes - 1]}/${ano}`;
}

function reais(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Painel de consumos do síndico: leitura anterior, atual, m³ e R$ por unidade. */
export function ConsumosScreen({ navigation }: Props) {
  const [tipo, setTipo] = useState<TipoMedidor>("AGUA");
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [dados, setDados] = useState<ConsumosResposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fotoAberta, setFotoAberta] = useState<ConsumoLinha | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(
        await apiFetch<ConsumosResposta>(
          `/leituras/consumos?tipo=${tipo}&competencia=${competencia}`,
        ),
      );
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [tipo, competencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportar(formato: "xlsx" | "pdf", escopo: "mes" | "geral") {
    try {
      const { token } = await apiFetch<{ token: string }>(
        "/leituras/export-token",
        { method: "POST", body: { formato, escopo, tipo, competencia } },
      );
      await Linking.openURL(
        `${API_URL}/leituras/export?t=${encodeURIComponent(token)}`,
      );
    } catch (e) {
      Alert.alert("Não foi possível exportar", String((e as Error).message));
    }
  }

  function abrirExportar() {
    Alert.alert(
      "Exportar relatório",
      `${NOMES[tipo]}: escolha o formato e o período.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: `Excel de ${nomeCompetencia(competencia)}`, onPress: () => exportar("xlsx", "mes") },
        { text: `PDF de ${nomeCompetencia(competencia)}`, onPress: () => exportar("pdf", "mes") },
        { text: "Excel geral (todos os meses)", onPress: () => exportar("xlsx", "geral") },
        { text: "PDF geral (todos os meses)", onPress: () => exportar("pdf", "geral") },
      ],
    );
  }

  const podeAvancar = competencia < competenciaAtual();
  const totais = dados?.totais;

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo="Consumos"
        aoVoltar={() => navigation.goBack()}
        direita={
          <Pressable onPress={abrirExportar} style={styles.botaoExportar}>
            <Text style={styles.botaoExportarTexto}>Exportar</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
      >
        <View style={styles.linhaFiltros}>
          <View style={styles.chips}>
            {(["AGUA", "GAS"] as const).map((t) => (
              <Chip key={t} rotulo={NOMES[t]} ativo={tipo === t} onPress={() => setTipo(t)} />
            ))}
          </View>
          <View style={styles.seletorMes}>
            <Pressable
              style={styles.setaMes}
              onPress={() => setCompetencia((c) => somarMeses(c, -1))}
            >
              <Icone nome="voltar" tamanho={18} cor={theme.colors.text} traco={2.2} />
            </Pressable>
            <Text style={styles.mesTexto}>{nomeCompetencia(competencia)}</Text>
            <Pressable
              style={[styles.setaMes, !podeAvancar && { opacity: 0.3 }]}
              disabled={!podeAvancar}
              onPress={() => setCompetencia((c) => somarMeses(c, 1))}
            >
              <Icone nome="chevron" tamanho={18} cor={theme.colors.text} traco={2.2} />
            </Pressable>
          </View>
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <View style={styles.linhaTotais}>
          <View style={styles.cardTotal}>
            <Text style={styles.totalNumero}>
              {totais ? totais.consumo.toLocaleString("pt-BR") : "-"}
            </Text>
            <Text style={styles.totalRotulo}>m³ no mês</Text>
          </View>
          <View style={styles.cardTotal}>
            <Text style={styles.totalNumero}>
              {totais?.valorReais != null ? reais(totais.valorReais) : "-"}
            </Text>
            <Text style={styles.totalRotulo}>
              {dados?.tarifa != null
                ? `tarifa ${reais(dados.tarifa)}/m³`
                : "sem tarifa cadastrada"}
            </Text>
          </View>
          <View style={styles.cardTotal}>
            <Text style={styles.totalNumero}>
              {totais ? `${totais.lidas}/${totais.totalUnidades}` : "-"}
            </Text>
            <Text style={styles.totalRotulo}>unidades lidas</Text>
          </View>
        </View>

        {dados && totais && totais.lidas === 0 ? (
          <Vazio
            variante="hero"
            icone="medidor"
            titulo="Sem leituras neste mês"
            texto={`Nenhuma leitura de ${NOMES[tipo].toLowerCase()} em ${nomeCompetencia(competencia)}.`}
          />
        ) : (
          dados?.linhas.map((l) => (
            <View key={l.unidadeId} style={styles.linha}>
              <View style={{ width: 62 }}>
                <Text style={styles.unidade}>
                  {l.bloco ? `${l.bloco} ${l.identificacao}` : l.identificacao}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.leituras}>
                  {l.anterior ? l.anterior.valor.toLocaleString("pt-BR") : "-"}
                  {"  >  "}
                  {l.atual ? l.atual.valor.toLocaleString("pt-BR") : "-"}
                </Text>
                <Text style={styles.consumo}>
                  {l.consumo !== null
                    ? `${l.consumo.toLocaleString("pt-BR")} m³${l.valorReais !== null ? ` · ${reais(l.valorReais)}` : ""}`
                    : l.atual
                      ? "primeira leitura"
                      : "sem leitura no mês"}
                </Text>
              </View>
              {l.alerta && (
                <Selo
                  texto={l.alerta === "NEGATIVO" ? "conferir" : "acima da média"}
                  tom="alerta"
                />
              )}
              {l.atual?.fotoRef && (
                <Pressable onPress={() => setFotoAberta(l)}>
                  <Image
                    source={{ uri: urlFoto(l.atual.fotoRef) }}
                    style={styles.thumbFoto}
                  />
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={fotoAberta !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoAberta(null)}
      >
        <Pressable style={styles.modalFundo} onPress={() => setFotoAberta(null)}>
          {fotoAberta?.atual?.fotoRef && (
            <>
              <Image
                source={{ uri: urlFoto(fotoAberta.atual.fotoRef) }}
                style={styles.fotoGrande}
                resizeMode="contain"
              />
              <Text style={styles.fotoLegenda}>
                {fotoAberta.bloco
                  ? `${fotoAberta.bloco} ${fotoAberta.identificacao}`
                  : fotoAberta.identificacao}
                {" · "}
                {NOMES[tipo]} {fotoAberta.atual.valor.toLocaleString("pt-BR")}
                {" · lida por "}
                {fotoAberta.atual.lidoPor}
              </Text>
            </>
          )}
        </Pressable>
      </Modal>
    </Tela>
  );
}

const styles = StyleSheet.create({
  botaoExportar: {
    backgroundColor: theme.colors.marca,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  botaoExportarTexto: { color: "#FFF", fontSize: 13.5, fontWeight: "700" },
  linhaFiltros: { gap: 12 },
  chips: { flexDirection: "row", gap: 8 },
  seletorMes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  setaMes: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mesTexto: { fontSize: theme.font.subtitulo, fontWeight: "700", color: theme.colors.text },
  erro: { color: theme.colors.notif, marginTop: 12, fontWeight: "600" },
  linhaTotais: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 16 },
  cardTotal: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  totalNumero: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  totalRotulo: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: "500", marginTop: 2 },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 12,
    marginBottom: 8,
  },
  unidade: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  leituras: {
    fontSize: 14.5,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  consumo: { fontSize: 14.5, color: theme.colors.text, fontWeight: "700", marginTop: 2 },
  thumbFoto: { width: 44, height: 44, borderRadius: theme.radius.foto },
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fotoGrande: { width: "100%", height: "70%" },
  fotoLegenda: { color: "#FFF", fontSize: 14.5, fontWeight: "600", marginTop: 14 },
});
