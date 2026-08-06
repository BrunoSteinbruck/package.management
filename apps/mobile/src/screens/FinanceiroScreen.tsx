import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  cpfCnpjValido,
  formatarCpfCnpj,
  lerValorEmReais,
  mesAno,
  rotuloUnidade,
  type CobrancaGestor,
  type ConfigFinanceiro,
  type ResumoFinanceiro,
  type StatusCobranca,
  type TaxaLinha,
} from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { competenciaAtual } from "../api/estadoLeituras";
import {
  Botao,
  Card,
  Chip,
  HeaderTela,
  ItemLista,
  Kicker,
  Nota,
  Selo,
  Tela,
  Vazio,
} from "../components/ui";
import { Icone } from "../components/icones";
import { ConciliacaoAba } from "./ConciliacaoAba";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Financeiro">;

type Aba = "cobrancas" | "taxas" | "conciliacao" | "ajustes";

const STATUS: Record<
  StatusCobranca,
  { rotulo: string; tom: "ok" | "alerta" | "neutro" }
> = {
  PENDENTE: { rotulo: "em aberto", tom: "neutro" },
  PAGA: { rotulo: "paga", tom: "ok" },
  VENCIDA: { rotulo: "vencida", tom: "alerta" },
  CANCELADA: { rotulo: "cancelada", tom: "neutro" },
};

/** Aritmética de competência fica local, como nas outras telas do app. */
function somarMeses(competencia: string, n: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Só cobra quem tem valor E pagador: o provedor exige nome e documento. */
function prontaParaCobrar(t: TaxaLinha): boolean {
  return (
    (t.valorMensal ?? 0) > 0 && !!t.responsavelNome && !!t.responsavelCpfCnpj
  );
}

/** O que a edição de uma taxa tem em tela; vazio quer dizer "não informado". */
interface RascunhoTaxa {
  valor: string;
  nome: string;
  documento: string;
  email: string;
}

export function FinanceiroScreen({ navigation }: Props) {
  const [aba, setAba] = useState<Aba>("cobrancas");
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [cobrancas, setCobrancas] = useState<CobrancaGestor[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [config, setConfig] = useState<ConfigFinanceiro | null>(null);
  const [taxas, setTaxas] = useState<TaxaLinha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [editando, setEditando] = useState<TaxaLinha | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoTaxa>({
    valor: "",
    nome: "",
    documento: "",
    email: "",
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [c, r, cfg, t] = await Promise.allSettled([
        apiFetch<CobrancaGestor[]>(
          `/cadastro/financeiro/cobrancas?competencia=${competencia}`,
        ),
        apiFetch<ResumoFinanceiro>(
          `/cadastro/financeiro/resumo?competencia=${competencia}`,
        ),
        apiFetch<ConfigFinanceiro>("/cadastro/financeiro/config"),
        apiFetch<TaxaLinha[]>("/cadastro/financeiro/taxas"),
      ]);
      if (c.status === "fulfilled") setCobrancas(c.value);
      if (r.status === "fulfilled") setResumo(r.value);
      if (cfg.status === "fulfilled") setConfig(cfg.value);
      if (t.status === "fulfilled") setTaxas(t.value);
    } finally {
      setCarregando(false);
    }
  }, [competencia]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  /**
   * Gera as cobranças do mês.
   *
   * O alerta de resultado repete o do painel, inclusive as unidades que
   * ficaram DE FORA: sem isso o síndico lê "3 criadas" e não descobre que 13
   * não foram cobradas. A lista é truncada porque o Alert nativo não rola,
   * diferente do `alert()` do navegador.
   */
  function gerar() {
    if (gerando) return;
    Alert.alert(
      "Gerar cobranças",
      `Gerar as cobranças de ${mesAno(competencia)}? Unidades que já têm cobrança neste mês são puladas.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Gerar", onPress: enviarGeracao },
      ],
    );
  }

  async function enviarGeracao() {
    setGerando(true);
    try {
      const r = await apiFetch<{
        criadas: number;
        puladas: number;
        naoCobradas: string[];
      }>("/cadastro/financeiro/gerar", {
        method: "POST",
        body: { competencia },
      });
      const fora = r.naoCobradas ?? [];
      const lista = fora.slice(0, 8).join(", ");
      const resto = fora.length > 8 ? ` e mais ${fora.length - 8}` : "";
      const faltando = fora.length
        ? `\n\nSEM COBRANÇA (${fora.length}): ${lista}${resto}.` +
          "\nOu falta nome/CPF do responsável em Valor por unidade, ou a" +
          " credencial do provedor foi recusada. Corrija e gere de novo: o" +
          " que já foi criado não duplica."
        : "";
      Alert.alert(
        "Cobranças geradas",
        `${r.criadas} criada(s), ${r.puladas} já existiam.${faltando}`,
      );
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível gerar", String((e as Error).message));
    } finally {
      setGerando(false);
    }
  }

  function abrirEdicao(t: TaxaLinha) {
    setRascunho({
      valor: t.valorMensal != null ? String(t.valorMensal).replace(".", ",") : "",
      nome: t.responsavelNome ?? "",
      documento: t.responsavelCpfCnpj ?? "",
      email: t.responsavelEmail ?? "",
    });
    setEditando(t);
  }

  /**
   * Salva a linha INTEIRA, sempre.
   *
   * O endpoint faz upsert: omitir um campo o apagaria. Quem edita só o valor
   * perderia o CPF do responsável, e a unidade deixaria de ser cobrável sem
   * ninguém perceber até o mês virar.
   */
  async function salvarTaxa() {
    if (!editando) return;
    const valor = lerValorEmReais(rascunho.valor);
    if (valor === null) {
      Alert.alert(
        "Valor não reconhecido",
        `Escreva como 450,50 ou 1.500,00. Recebido: "${rascunho.valor}".`,
      );
      return;
    }
    const documento = rascunho.documento.trim();
    // Barra aqui o documento inválido: o servidor também recusa, mas com uma
    // mensagem do zod que fala de "taxas.0.responsavelCpfCnpj", que não diz
    // nada para quem está preenchendo.
    if (documento && !cpfCnpjValido(documento)) {
      Alert.alert("CPF/CNPJ inválido", "Confira o número do responsável.");
      return;
    }
    const nome = rascunho.nome.trim();
    const email = rascunho.email.trim();
    try {
      await apiFetch("/cadastro/financeiro/taxas", {
        method: "POST",
        body: {
          taxas: [
            {
              unidadeId: editando.unidadeId,
              valorMensal: valor,
              ...(nome ? { responsavelNome: nome } : {}),
              ...(documento ? { responsavelCpfCnpj: documento } : {}),
              ...(email ? { responsavelEmail: email } : {}),
            },
          ],
        },
      });
      setEditando(null);
      // Recarrega em vez de remendar o estado: trocar o pagador zera o
      // cliente do provedor no servidor, e o selo "pronta" tem que refletir.
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    }
  }

  /**
   * Manda a configuração inteira, como as taxas: o schema exige os três
   * campos, e o upsert grava o que chegar.
   */
  async function salvarConfig(mudanca: Partial<ConfigFinanceiro>) {
    if (!config) return;
    const anterior = config;
    // Otimista: o Switch tem que mexer no toque. Se o servidor recusar, volta.
    setConfig({ ...config, ...mudanca });
    setSalvandoConfig(true);
    try {
      const salva = await apiFetch<ConfigFinanceiro>(
        "/cadastro/financeiro/config",
        {
          method: "POST",
          body: {
            diaVencimento: anterior.diaVencimento,
            geracaoAutomatica: anterior.geracaoAutomatica,
            reguaAtiva: anterior.reguaAtiva,
            ...mudanca,
          },
        },
      );
      setConfig(salva);
    } catch (e) {
      setConfig(anterior);
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    } finally {
      setSalvandoConfig(false);
    }
  }

  const podeAvancar = competencia < competenciaAtual();

  const cabecalho = (
    <>
      <View style={styles.abas}>
        {(
          [
            ["cobrancas", "Cobranças"],
            ["taxas", "Valor por unidade"],
            ["conciliacao", "Conciliação"],
            ["ajustes", "Ajustes"],
          ] as const
        ).map(([valor, rotulo]) => (
          <Chip
            key={valor}
            rotulo={rotulo}
            ativo={aba === valor}
            onPress={() => setAba(valor)}
          />
        ))}
      </View>

      {config && !config.emissaoReal && (
        <Nota
          icone="alerta"
          texto="Modo de teste: nenhum boleto é emitido de verdade. Configure a conta do provedor antes de usar com moradores."
          estilo={{ marginTop: 12 }}
        />
      )}
      {config && config.emissaoReal && !config.integrado && (
        <Nota
          texto="Sem subconta no provedor. As cobranças ficam registradas aqui, mas sem boleto para o morador pagar."
          estilo={{ marginTop: 12 }}
        />
      )}

      {aba === "cobrancas" && (
        <>
          <View style={styles.seletorMes}>
            <Pressable
              style={styles.seta}
              onPress={() => setCompetencia((c) => somarMeses(c, -1))}
            >
              <Icone nome="voltar" tamanho={18} cor={theme.colors.text} traco={2.2} />
            </Pressable>
            <Text style={styles.mesTexto}>{mesAno(competencia)}</Text>
            <Pressable
              style={[styles.seta, !podeAvancar && { opacity: 0.3 }]}
              disabled={!podeAvancar}
              onPress={() => setCompetencia((c) => somarMeses(c, 1))}
            >
              <Icone nome="chevron" tamanho={18} cor={theme.colors.text} traco={2.2} />
            </Pressable>
          </View>

          <View style={styles.metricas}>
            <Card estilo={styles.metrica}>
              <Text style={styles.valor}>
                {resumo ? reais(resumo.totalCobrado) : "-"}
              </Text>
              <Text style={styles.rotulo}>cobrado no mês</Text>
            </Card>
            <Card estilo={styles.metrica}>
              <Text style={[styles.valor, { color: theme.colors.ok }]}>
                {resumo ? reais(resumo.totalPago) : "-"}
              </Text>
              <Text style={styles.rotulo}>recebido</Text>
              {resumo && (
                <Text style={styles.sub}>
                  {resumo.unidadesPagas} de {resumo.unidadesCobradas} unidades
                </Text>
              )}
            </Card>
          </View>
          <Card estilo={{ marginTop: 12 }}>
            <Text
              style={[
                styles.valor,
                (resumo?.inadimplencia ?? 0) > 0 && { color: theme.colors.alerta },
              ]}
            >
              {resumo ? reais(resumo.inadimplencia) : "-"}
            </Text>
            <Text style={styles.rotulo}>em aberto</Text>
          </Card>

          <Botao
            titulo="Gerar cobranças do mês"
            onPress={gerar}
            carregando={gerando}
            estilo={{ marginTop: 12 }}
          />
        </>
      )}

      {aba === "taxas" && (
        <Nota
          texto="O valor mensal de cada unidade e quem paga. Sem valor a unidade não é cobrada, e sem nome e CPF/CNPJ do responsável o banco não emite o boleto: é o proprietário, que na unidade alugada não é quem mora."
          estilo={{ marginTop: 12, marginBottom: 4 }}
        />
      )}
    </>
  );

  if (aba === "conciliacao") {
    return (
      <Tela comInsetTop>
        <HeaderTela titulo="Financeiro" aoVoltar={() => navigation.goBack()} />
        <ConciliacaoAba cabecalho={cabecalho} />
      </Tela>
    );
  }

  if (aba === "ajustes") {
    return (
      <Tela comInsetTop>
        <HeaderTela titulo="Financeiro" aoVoltar={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={carregando} onRefresh={carregar} />
          }
        >
          {cabecalho}
          <Kicker>Como as cobranças saem</Kicker>
          <Card estilo={{ padding: 6 }}>
            <View style={styles.linhaAjuste}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloAjuste}>Dia do vencimento</Text>
                <Text style={styles.subAjuste}>
                  Vale para as cobranças geradas daqui em diante. Mês sem esse
                  dia usa o último: 31 em fevereiro vence no dia 28.
                </Text>
              </View>
              <TextInput
                style={styles.campoDia}
                keyboardType="number-pad"
                maxLength={2}
                editable={!salvandoConfig}
                defaultValue={String(config?.diaVencimento ?? 10)}
                selectTextOnFocus
                // Salva ao sair do campo e não a cada tecla: digitar "25"
                // passa por "2", que é um dia de vencimento válido e seria
                // gravado no caminho.
                onEndEditing={(e) => {
                  const dia = Number(e.nativeEvent.text);
                  if (
                    !Number.isInteger(dia) ||
                    dia < 1 ||
                    dia > 31 ||
                    dia === config?.diaVencimento
                  ) {
                    return;
                  }
                  salvarConfig({ diaVencimento: dia });
                }}
              />
            </View>

            <View style={[styles.linhaAjuste, styles.divisorAjuste]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloAjuste}>Gerar sozinho todo mês</Text>
                <Text style={styles.subAjuste}>
                  As cobranças do mês são criadas sem ninguém clicar, enquanto
                  o vencimento ainda estiver no futuro. Unidade que já tem
                  cobrança no mês é pulada, e unidade sem valor ou sem
                  responsável fica de fora.
                </Text>
              </View>
              <Switch
                value={config?.geracaoAutomatica ?? false}
                disabled={!config || salvandoConfig}
                onValueChange={(v) => salvarConfig({ geracaoAutomatica: v })}
                trackColor={{
                  false: theme.colors.toggleOff,
                  true: theme.colors.acao,
                }}
              />
            </View>

            <View style={[styles.linhaAjuste, styles.divisorAjuste]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tituloAjuste}>Lembrar o morador</Text>
                <Text style={styles.subAjuste}>
                  Um aviso no app três dias antes do vencimento e outro quando
                  a cobrança vence. Um de cada por cobrança, nunca repetido.
                </Text>
              </View>
              <Switch
                value={config?.reguaAtiva ?? false}
                disabled={!config || salvandoConfig}
                onValueChange={(v) => salvarConfig({ reguaAtiva: v })}
                trackColor={{
                  false: theme.colors.toggleOff,
                  true: theme.colors.acao,
                }}
              />
            </View>
          </Card>
          <Nota
            texto="A credencial do provedor de cobrança e o extrato OFX do banco são cadastrados pelo painel, no computador."
            estilo={{ marginTop: 12 }}
          />
        </ScrollView>
      </Tela>
    );
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Financeiro" aoVoltar={() => navigation.goBack()} />
      {aba === "cobrancas" ? (
        <FlatList
          data={cobrancas}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={carregando} onRefresh={carregar} />
          }
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={
            !carregando ? (
              <Vazio
                titulo={`Nenhuma cobrança em ${mesAno(competencia)}.`}
                texto="Defina o valor por unidade e gere as cobranças do mês."
              />
            ) : null
          }
          renderItem={({ item }) => (
            <ItemLista
              titulo={rotuloUnidade(item.unidade)}
              sub={
                item.diasAtraso > 0
                  ? `vence ${diaCurto(item.vencimento)} · ${item.diasAtraso} dia${item.diasAtraso === 1 ? "" : "s"} de atraso`
                  : `vence ${diaCurto(item.vencimento)}`
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
                  <Selo
                    texto={STATUS[item.status].rotulo}
                    tom={STATUS[item.status].tom}
                  />
                </View>
              }
            />
          )}
        />
      ) : (
        <FlatList
          data={taxas}
          keyExtractor={(t) => t.unidadeId}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={carregando} onRefresh={carregar} />
          }
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={
            !carregando ? (
              <Vazio titulo="Nenhuma unidade cadastrada." />
            ) : null
          }
          renderItem={({ item }) => (
            <ItemLista
              titulo={rotuloUnidade(item.unidade)}
              sub={
                item.valorMensal
                  ? `${reais(item.valorMensal)} · ${item.responsavelNome ?? "sem responsável"}`
                  : "sem valor definido"
              }
              detalhe={
                item.responsavelCpfCnpj
                  ? formatarCpfCnpj(item.responsavelCpfCnpj)
                  : undefined
              }
              media={{
                icone: "casa",
                corFundo: prontaParaCobrar(item)
                  ? theme.colors.okBg
                  : theme.colors.divisor,
                corIcone: prontaParaCobrar(item)
                  ? theme.colors.marca
                  : theme.colors.textSecondary,
              }}
              direita={
                <Selo
                  texto={prontaParaCobrar(item) ? "pronta" : "faltam dados"}
                  tom={prontaParaCobrar(item) ? "ok" : "neutro"}
                />
              }
              chevron
              onPress={() => abrirEdicao(item)}
            />
          )}
        />
      )}

      <Modal
        visible={editando !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditando(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditando(null)} />
        <View style={styles.sheet}>
          <View style={styles.alca} />
          <Text style={styles.sheetTitulo}>
            {editando ? rotuloUnidade(editando.unidade) : ""}
          </Text>
          <Kicker>Valor mensal</Kicker>
          <TextInput
            style={styles.campo}
            placeholder="450,00"
            placeholderTextColor={theme.colors.textFaint}
            value={rascunho.valor}
            onChangeText={(valor) => setRascunho((r) => ({ ...r, valor }))}
            keyboardType="decimal-pad"
            maxLength={14}
          />
          <Kicker>Responsável (quem paga)</Kicker>
          <TextInput
            style={styles.campo}
            placeholder="Nome do proprietário"
            placeholderTextColor={theme.colors.textFaint}
            value={rascunho.nome}
            onChangeText={(nome) => setRascunho((r) => ({ ...r, nome }))}
            maxLength={120}
          />
          <TextInput
            style={styles.campo}
            placeholder="CPF ou CNPJ"
            placeholderTextColor={theme.colors.textFaint}
            value={rascunho.documento}
            onChangeText={(documento) =>
              setRascunho((r) => ({ ...r, documento }))
            }
            keyboardType="numbers-and-punctuation"
            maxLength={20}
          />
          <TextInput
            style={styles.campo}
            placeholder="E-mail (opcional)"
            placeholderTextColor={theme.colors.textFaint}
            value={rascunho.email}
            onChangeText={(email) => setRascunho((r) => ({ ...r, email }))}
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={160}
          />
          <Botao titulo="Salvar" onPress={salvarTaxa} estilo={{ marginTop: 12 }} />
          <Botao
            titulo="Cancelar"
            variante="outline"
            onPress={() => setEditando(null)}
            estilo={{ marginTop: 8 }}
          />
        </View>
      </Modal>
    </Tela>
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 32,
    gap: 10,
  },
  abas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linhaAjuste: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  divisorAjuste: { borderTopWidth: 1, borderTopColor: theme.colors.divisor },
  tituloAjuste: { fontSize: 15.5, fontWeight: "700", color: theme.colors.text },
  subAjuste: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  campoDia: {
    width: 56,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingVertical: 10,
  },
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
    marginTop: 12,
  },
  seta: { padding: 8 },
  mesTexto: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  metricas: { flexDirection: "row", gap: 12, marginTop: 12 },
  metrica: { flex: 1 },
  valor: { fontSize: 22, fontWeight: "700", color: theme.colors.text },
  rotulo: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  direita: { alignItems: "flex-end", gap: 4 },
  valorLinha: { fontSize: 14.5, fontWeight: "700", color: theme.colors.text },
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
  sheetTitulo: {
    fontSize: 19,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  campo: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    marginTop: 6,
  },
});
