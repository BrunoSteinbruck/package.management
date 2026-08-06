import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  lerValorEmReais,
  mesAno,
  mesCurto,
  type ConsumoLinha,
  type ConsumosResposta,
  type HistoricoConsumoMes,
  type TarifaLinha,
  type TipoMedidor,
} from "@pacotes/shared";
import { apiFetch, API_URL, urlFoto } from "../api/client";
import { rotuloUnidade } from "../api/types";
import { competenciaAtual } from "../api/estadoLeituras";
import { Chip, HeaderTela, Nota, Selo, Tela, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Consumos">;

const NOMES: Record<TipoMedidor, string> = { AGUA: "Água", GAS: "Gás" };

function somarMeses(competencia: string, n: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + n;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}

function reais(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Painel de consumos do síndico: leitura anterior, atual, m³ e R$ por unidade. */
export function ConsumosScreen({ navigation }: Props) {
  const [tipo, setTipo] = useState<TipoMedidor>("AGUA");
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [dados, setDados] = useState<ConsumosResposta | null>(null);
  const [serie, setSerie] = useState<HistoricoConsumoMes[]>([]);
  const [tarifas, setTarifas] = useState<TarifaLinha[]>([]);
  const [editandoTarifa, setEditandoTarifa] = useState(false);
  const [valorTarifa, setValorTarifa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [fotoAberta, setFotoAberta] = useState<ConsumoLinha | null>(null);

  const carregar = useCallback(async () => {
    try {
      // O histórico e as tarifas falham sozinhos: sem eles a tabela do mês,
      // que é a razão da tela, continua de pé.
      const [consumos, historico, tarifa] = await Promise.allSettled([
        apiFetch<ConsumosResposta>(
          `/leituras/consumos?tipo=${tipo}&competencia=${competencia}`,
        ),
        apiFetch<HistoricoConsumoMes[]>(
          `/leituras/historico?tipo=${tipo}&competencia=${competencia}&meses=12`,
        ),
        apiFetch<TarifaLinha[]>("/leituras/tarifas"),
      ]);
      if (consumos.status === "rejected") throw consumos.reason;
      setDados(consumos.value);
      if (historico.status === "fulfilled") setSerie(historico.value);
      if (tarifa.status === "fulfilled") setTarifas(tarifa.value);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [tipo, competencia]);

  const tarifaAtual = tarifas.find((t) => t.tipo === tipo)?.valorPorM3 ?? null;

  /**
   * Salva a tarifa por m³ do tipo aberto.
   *
   * `lerValorEmReais` e não `Number(...)`: o síndico escreve "8,65" e
   * "1.500,00", que o Number recusa, e aceita "0x10" como 16, que iria
   * direto para o cálculo da conta de todo mundo.
   */
  async function salvarTarifa() {
    const valor = lerValorEmReais(valorTarifa);
    if (valor === null) {
      Alert.alert(
        "Valor não reconhecido",
        `Escreva como 8,65 ou 12,50. Recebido: "${valorTarifa}".`,
      );
      return;
    }
    try {
      await apiFetch("/leituras/tarifas", {
        method: "PUT",
        body: { tipo, valorPorM3: valor },
      });
      setEditandoTarifa(false);
      setValorTarifa("");
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    }
  }

  const maxSerie = Math.max(1, ...serie.map((m) => m.consumoTotal));

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

  /**
   * Dois passos de propósito, e não os quatro destinos num alerta só.
   *
   * `Alert.alert` do Android mostra no máximo TRÊS botões, e descarta o resto
   * em silêncio: com Cancelar mais quatro opções, "Excel geral" e "PDF geral"
   * simplesmente não apareciam nesse sistema, deixando a exportação do
   * histórico inalcançável para metade dos usuários. Quebrado em período e
   * depois formato, cada passo cabe no limite das duas plataformas.
   */
  function abrirExportar() {
    Alert.alert("Exportar relatório", `${NOMES[tipo]}: qual período?`, [
      { text: "Cancelar", style: "cancel" },
      { text: mesAno(competencia), onPress: () => escolherFormato("mes") },
      { text: "Todos os meses", onPress: () => escolherFormato("geral") },
    ]);
  }

  function escolherFormato(escopo: "mes" | "geral") {
    const periodo = escopo === "mes" ? mesAno(competencia) : "todos os meses";
    Alert.alert("Exportar relatório", `${NOMES[tipo]}, ${periodo}: qual formato?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excel", onPress: () => exportar("xlsx", escopo) },
      { text: "PDF", onPress: () => exportar("pdf", escopo) },
    ]);
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
      {/* FlatList, não ScrollView: com 624 unidades a lista precisa ser
          virtualizada; filtros e totais viram cabeçalho da lista. */}
      <FlatList
        data={dados && totais && totais.lidas === 0 ? [] : dados?.linhas ?? []}
        keyExtractor={(l) => l.unidadeId}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 6, paddingBottom: 40 }}
        renderItem={({ item: l }) => (
          <View style={styles.linha}>
            <View style={{ width: 62 }}>
              <Text style={styles.unidade}>{rotuloUnidade(l)}</Text>
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
        )}
        ListEmptyComponent={
          dados ? (
            <Vazio
              variante="hero"
              icone="medidor"
              titulo="Sem leituras neste mês"
              texto={`Nenhuma leitura de ${NOMES[tipo].toLowerCase()} em ${mesAno(competencia)}.`}
            />
          ) : null
        }
        ListHeaderComponent={
          <>
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
            <Text style={styles.mesTexto}>{mesAno(competencia)}</Text>
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

        {serie.length > 0 && (
          <View style={styles.cardHistorico}>
            <Text style={styles.tituloBloco}>12 meses</Text>
            <View style={styles.grafico}>
              {serie.map((m) => (
                <View key={m.competencia} style={styles.mes}>
                  <View style={styles.colunaTrilha}>
                    <View
                      style={[
                        styles.coluna,
                        { height: `${Math.max((m.consumoTotal / maxSerie) * 100, 2)}%` },
                        // O mês aberto acende; o resto fica de fundo. Sem
                        // isso não dá para situar a tabela na série.
                        m.competencia === competencia && styles.colunaAtual,
                      ]}
                    />
                  </View>
                  <Text style={styles.rotuloMes}>{mesCurto(m.competencia)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.cardTarifa}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tituloBloco}>Tarifa de {NOMES[tipo].toLowerCase()}</Text>
            {editandoTarifa ? (
              <TextInput
                style={styles.campoTarifa}
                placeholder="8,65"
                placeholderTextColor={theme.colors.textFaint}
                value={valorTarifa}
                onChangeText={setValorTarifa}
                keyboardType="decimal-pad"
                maxLength={12}
                autoFocus
              />
            ) : (
              <Text style={styles.tarifaValor}>
                {tarifaAtual !== null
                  ? `${reais(tarifaAtual)} por m³`
                  : "sem tarifa cadastrada"}
              </Text>
            )}
          </View>
          {editandoTarifa ? (
            <View style={styles.acoesTarifa}>
              <Pressable
                onPress={() => setEditandoTarifa(false)}
                style={styles.botaoTarifaSecundario}
              >
                <Text style={styles.botaoTarifaSecundarioTexto}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={salvarTarifa} style={styles.botaoTarifa}>
                <Text style={styles.botaoTarifaTexto}>Salvar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setValorTarifa(
                  tarifaAtual !== null
                    ? String(tarifaAtual).replace(".", ",")
                    : "",
                );
                setEditandoTarifa(true);
              }}
              style={styles.botaoTarifaSecundario}
            >
              <Text style={styles.botaoTarifaSecundarioTexto}>
                {tarifaAtual !== null ? "Alterar" : "Definir"}
              </Text>
            </Pressable>
          )}
        </View>
          </>
        }
        ListFooterComponent={
          dados && dados.linhas.length > 0 ? (
            <Nota
              texto="Leituras do zelador, com foto. A planilha completa sai pelo Exportar, aqui ou no painel web."
              estilo={{ marginTop: 18 }}
            />
          ) : null
        }
      />

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
                {rotuloUnidade(fotoAberta)}
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
  tituloBloco: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  cardHistorico: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginTop: 12,
  },
  grafico: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 96,
    marginTop: 12,
  },
  mes: { flex: 1, alignItems: "center", gap: 5, height: "100%" },
  colunaTrilha: { flex: 1, width: "100%", justifyContent: "flex-end" },
  coluna: {
    width: "100%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: theme.colors.acentoClaro,
    minHeight: 2,
  },
  colunaAtual: { backgroundColor: theme.colors.acao },
  rotuloMes: { fontSize: 10, color: theme.colors.textMuted, fontWeight: "500" },
  cardTarifa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginTop: 12,
  },
  tarifaValor: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  campoTarifa: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: 6,
  },
  acoesTarifa: { flexDirection: "row", gap: 8 },
  botaoTarifa: {
    backgroundColor: theme.colors.marca,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  botaoTarifaTexto: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  botaoTarifaSecundario: {
    borderWidth: 1.5,
    borderColor: theme.colors.chipBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  botaoTarifaSecundarioTexto: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
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
