import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  lerValorEmReais,
  type DespesaLinha,
  type PainelConciliacao,
} from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { Botao, Card, Kicker, Nota, Selo, Vazio } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

/**
 * Hoje no fuso de quem está olhando, não em UTC.
 *
 * `toISOString()` converte para UTC antes de cortar: no Brasil, a despesa
 * lançada depois das 21h vinha com a data do dia seguinte já preenchida. O
 * síndico não repara, e a competência fecha com o lançamento no mês errado
 * na virada do mês.
 */
function hojeIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Conciliação bancária no app.
 *
 * O motor casa cada linha do extrato com uma cobrança paga ou uma despesa e
 * explica o porquê; o síndico confere e aceita em lote. Importar o OFX fica
 * no painel: escolher arquivo do banco é tarefa de mesa, e o app ganharia um
 * seletor nativo só para isso.
 */
export function ConciliacaoAba({ cabecalho }: { cabecalho: React.ReactNode }) {
  const [painel, setPainel] = useState<PainelConciliacao | null>(null);
  const [despesas, setDespesas] = useState<DespesaLinha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  // Todas marcadas por padrão: o motor só sugere o que tem explicação, e o
  // trabalho do síndico deve ser desmarcar a exceção, não marcar 40 caixas.
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set());
  const [ignorando, setIgnorando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [formDespesa, setFormDespesa] = useState(false);
  const [descNova, setDescNova] = useState("");
  const [valorNovo, setValorNovo] = useState("");
  const [dataNova, setDataNova] = useState(hojeIso());

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [p, d] = await Promise.allSettled([
        apiFetch<PainelConciliacao>("/cadastro/financeiro/conciliacao"),
        apiFetch<DespesaLinha[]>("/cadastro/financeiro/despesas"),
      ]);
      if (p.status === "fulfilled") setPainel(p.value);
      if (d.status === "fulfilled") setDespesas(d.value);
      setDesmarcadas(new Set());
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  function alternar(id: string) {
    setDesmarcadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function aceitarSelecionadas() {
    if (!painel || aceitando) return;
    const itens = painel.sugestoes
      .filter((s) => !desmarcadas.has(s.extrato.id))
      .map((s) => ({
        extratoItemId: s.extrato.id,
        alvoTipo: s.alvoTipo,
        alvoId: s.alvoId,
        motivo: s.motivo,
      }));
    if (itens.length === 0) return;
    setAceitando(true);
    try {
      const r = await apiFetch<{ aceitas: number }>(
        "/cadastro/financeiro/conciliacao/aceitar",
        { method: "POST", body: { itens } },
      );
      Alert.alert(
        "Conciliação registrada",
        `${r.aceitas} lançamento(s) conciliado(s), com o motivo gravado.`,
      );
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível aceitar", String((e as Error).message));
    } finally {
      setAceitando(false);
    }
  }

  /**
   * Ignorar exige justificativa escrita, e por isso é Modal e não Alert:
   * `Alert.prompt` só existe no iOS, e o painel usa `prompt()` do navegador,
   * que não tem equivalente aqui.
   */
  async function confirmarIgnorar() {
    if (!ignorando || motivo.trim().length < 3) return;
    try {
      await apiFetch(`/cadastro/financeiro/conciliacao/${ignorando}/ignorar`, {
        method: "POST",
        body: { motivo: motivo.trim() },
      });
      setIgnorando(null);
      setMotivo("");
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível ignorar", String((e as Error).message));
    }
  }

  async function criarDespesa() {
    // Mensagens separadas: "preencha descrição e valor" para todos os casos
    // escondia o motivo de quem escreveu o valor certo em formato brasileiro.
    if (descNova.trim().length < 2) {
      Alert.alert("Descrição curta", "Escreva pelo menos duas letras.");
      return;
    }
    const valor = lerValorEmReais(valorNovo);
    if (valor === null) {
      Alert.alert(
        "Valor não reconhecido",
        `Escreva como 1.500,00. Recebido: "${valorNovo}".`,
      );
      return;
    }
    if (valor <= 0) {
      Alert.alert("Valor inválido", "A despesa precisa ser maior que zero.");
      return;
    }
    try {
      await apiFetch("/cadastro/financeiro/despesas", {
        method: "POST",
        body: { descricao: descNova.trim(), valor, data: dataNova },
      });
      setDescNova("");
      setValorNovo("");
      setFormDespesa(false);
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    }
  }

  function removerDespesa(d: DespesaLinha) {
    Alert.alert("Remover despesa", `Remover "${d.descricao}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/cadastro/financeiro/despesas/${d.id}`, {
              method: "DELETE",
            });
            await carregar();
          } catch (e) {
            Alert.alert("Não foi possível remover", String((e as Error).message));
          }
        },
      },
    ]);
  }

  const selecionadas =
    painel?.sugestoes.filter((s) => !desmarcadas.has(s.extrato.id)).length ?? 0;

  return (
    <ScrollView
      contentContainerStyle={styles.conteudo}
      refreshControl={
        <RefreshControl refreshing={carregando} onRefresh={carregar} />
      }
    >
      {cabecalho}

      <Nota
        texto="O extrato OFX do banco é importado pelo painel, no computador. Aqui você confere, aceita e lança despesas."
        estilo={{ marginTop: 12 }}
      />

      {painel && (painel.conciliadas > 0 || painel.ignoradas > 0) && (
        <Text style={styles.resumo}>
          {painel.conciliadas} já conciliada(s) · {painel.ignoradas} ignorada(s)
        </Text>
      )}

      <Kicker>O motor explicou ({painel?.sugestoes.length ?? 0})</Kicker>
      {painel?.sugestoes.length === 0 && (
        <Vazio titulo="Nada esperando conferência." />
      )}
      {painel?.sugestoes.map((s) => {
        const marcada = !desmarcadas.has(s.extrato.id);
        return (
          <Pressable
            key={s.extrato.id}
            onPress={() => alternar(s.extrato.id)}
            style={({ pressed }) => [
              styles.cardSugestao,
              marcada && styles.cardMarcado,
              { transform: [{ scale: pressed ? 0.99 : 1 }] },
            ]}
          >
            <View
              style={[styles.checkbox, marcada && styles.checkboxMarcado]}
            >
              {marcada && <Icone nome="check" tamanho={16} traco={3} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.linhaTopo}>
                <Text style={styles.descricao} numberOfLines={1}>
                  {s.extrato.descricao}
                </Text>
                <Selo
                  texto={s.confianca === "exata" ? "bate exato" : "provável"}
                  tom={s.confianca === "exata" ? "ok" : "neutro"}
                />
              </View>
              <Text style={styles.valorLinha}>
                {reais(s.extrato.valor)} · {dataCurta(s.extrato.data)}
              </Text>
              <Text style={styles.alvo}>{s.alvoRotulo}</Text>
              <Text style={styles.motivo}>{s.motivo}</Text>
            </View>
          </Pressable>
        );
      })}
      {selecionadas > 0 && (
        <Botao
          titulo={`Aceitar selecionadas (${selecionadas})`}
          onPress={aceitarSelecionadas}
          carregando={aceitando}
          estilo={{ marginTop: 12 }}
        />
      )}

      {painel && painel.semPar.length > 0 && (
        <>
          <Kicker>Precisam de você ({painel.semPar.length})</Kicker>
          {painel.semPar.map((l) => (
            <Card key={l.id} estilo={{ marginTop: 8 }}>
              <Text style={styles.descricao} numberOfLines={2}>
                {l.descricao}
              </Text>
              <Text style={styles.valorLinha}>
                {reais(l.valor)} · {dataCurta(l.data)}
              </Text>
              <Botao
                titulo="Ignorar com motivo"
                variante="outline"
                onPress={() => {
                  setIgnorando(l.id);
                  setMotivo("");
                }}
                estilo={{ alignSelf: "flex-end", marginTop: 8, minHeight: 38, paddingHorizontal: 14 }}
              />
            </Card>
          ))}
        </>
      )}

      {painel && painel.alvosSemExtrato.length > 0 && (
        <>
          <Kicker>Esperado e não encontrado ({painel.alvosSemExtrato.length})</Kicker>
          <Card>
            {painel.alvosSemExtrato.map((a, i) => (
              <View
                key={`${a.tipo}-${i}`}
                style={[styles.linhaSimples, i > 0 && styles.divisor]}
              >
                <Text style={styles.descricao} numberOfLines={1}>
                  {a.rotulo}
                </Text>
                <Text style={styles.valorLinha}>
                  {reais(a.valor)} · {dataCurta(a.data)}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <View style={styles.linhaSecao}>
        <Kicker>Despesas ({despesas.length})</Kicker>
        {!formDespesa && (
          <Botao
            titulo="Nova"
            icone="mais"
            onPress={() => setFormDespesa(true)}
            estilo={{ minHeight: 38, paddingHorizontal: 14 }}
          />
        )}
      </View>
      {formDespesa && (
        <Card>
          <TextInput
            style={styles.campo}
            placeholder="Descrição (ex.: manutenção do elevador)"
            placeholderTextColor={theme.colors.textFaint}
            value={descNova}
            onChangeText={setDescNova}
            maxLength={200}
            autoFocus
          />
          <TextInput
            style={styles.campo}
            placeholder="1.500,00"
            placeholderTextColor={theme.colors.textFaint}
            value={valorNovo}
            onChangeText={setValorNovo}
            keyboardType="decimal-pad"
            maxLength={14}
          />
          <TextInput
            style={styles.campo}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.colors.textFaint}
            value={dataNova}
            onChangeText={setDataNova}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <Botao titulo="Lançar despesa" onPress={criarDespesa} estilo={{ marginTop: 10 }} />
          <Botao
            titulo="Cancelar"
            variante="outline"
            onPress={() => setFormDespesa(false)}
            estilo={{ marginTop: 8 }}
          />
        </Card>
      )}
      {despesas.length === 0 && !formDespesa && (
        <Vazio titulo="Nenhuma despesa lançada." />
      )}
      {despesas.length > 0 && (
        <Card>
          {despesas.map((d, i) => (
            <View key={d.id} style={[styles.linhaDespesa, i > 0 && styles.divisor]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.descricao} numberOfLines={1}>
                  {d.descricao}
                </Text>
                <Text style={styles.valorLinha}>
                  {reais(d.valor)} · {dataCurta(d.data)}
                </Text>
              </View>
              {d.conciliada ? (
                // Despesa conciliada é parte da prestação de contas: apagar
                // deixaria uma linha do extrato apontando para o nada.
                <Selo texto="conciliada" tom="ok" />
              ) : (
                <Pressable onPress={() => removerDespesa(d)} hitSlop={10}>
                  <Icone nome="fechar" tamanho={18} cor={theme.colors.textFaint} />
                </Pressable>
              )}
            </View>
          ))}
        </Card>
      )}

      <Modal
        visible={ignorando !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setIgnorando(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIgnorando(null)} />
        <View style={styles.sheet}>
          <View style={styles.alca} />
          <Text style={styles.sheetTitulo}>Ignorar lançamento</Text>
          <Text style={styles.sheetSub}>
            Por que esta linha não entra na prestação de contas? O motivo fica
            gravado com o seu nome.
          </Text>
          <TextInput
            style={styles.campo}
            placeholder="ex.: rendimento da aplicação"
            placeholderTextColor={theme.colors.textFaint}
            value={motivo}
            onChangeText={setMotivo}
            maxLength={200}
            autoFocus
          />
          <Botao
            titulo="Ignorar"
            onPress={confirmarIgnorar}
            desabilitado={motivo.trim().length < 3}
            estilo={{ marginTop: 12 }}
          />
          <Botao
            titulo="Cancelar"
            variante="outline"
            onPress={() => setIgnorando(null)}
            estilo={{ marginTop: 8 }}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 32,
  },
  resumo: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 10,
  },
  cardSugestao: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginTop: 8,
  },
  cardMarcado: { borderWidth: 2, borderColor: theme.colors.acao },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.colors.chipBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxMarcado: {
    backgroundColor: theme.colors.acao,
    borderColor: theme.colors.acao,
  },
  linhaTopo: { flexDirection: "row", alignItems: "center", gap: 8 },
  descricao: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.text },
  valorLinha: {
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  alvo: { fontSize: 13.5, fontWeight: "600", color: theme.colors.marca, marginTop: 6 },
  motivo: { fontSize: 12.5, color: theme.colors.textMuted, marginTop: 2, lineHeight: 17 },
  linhaSimples: { paddingVertical: 10 },
  linhaDespesa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  divisor: { borderTopWidth: 1, borderTopColor: theme.colors.divisor },
  linhaSecao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  campo: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    marginTop: 8,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 32,
  },
  alca: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.toggleOff,
    marginBottom: 12,
  },
  sheetTitulo: { fontSize: 19, fontWeight: "700", color: theme.colors.text },
  sheetSub: {
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 19,
  },
});
