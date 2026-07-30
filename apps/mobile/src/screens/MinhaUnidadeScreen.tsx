import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { placaValida } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { excluirConta } from "../api/excluirConta";
import { limparSessao } from "../api/session";
import type { Veiculo, Vinculado } from "../api/types";
import { Botao, Card, HeaderTela, Kicker } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import { useModulos } from "../useModulos";
import type { MoradorStackParamList } from "../navigation";

/** GET /morador/preferencias */
interface Preferencias {
  aceitaWhatsapp: boolean;
  /** Com app instalado o canal é o push, e o WhatsApp não entra. */
  temApp: boolean;
}

type Props = NativeStackScreenProps<MoradorStackParamList, "MinhaUnidade"> & {
  aoSair: () => void;
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export function MinhaUnidadeScreen({ navigation, route, aoSair }: Props) {
  const insets = useSafeAreaInsets();
  const { unidadeId, rotulo, condominio } = route.params;
  const [vinculados, setVinculados] = useState<Vinculado[]>([]);
  const [convidando, setConvidando] = useState(false);
  const ligados = useModulos();
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [salvandoVeiculo, setSalvandoVeiculo] = useState(false);

  const carregarVeiculos = useCallback(() => {
    apiFetch<Veiculo[]>(`/morador/veiculos?unidadeId=${unidadeId}`)
      .then(setVeiculos)
      .catch(() => {});
  }, [unidadeId]);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Vinculado[]>(`/morador/unidades/${unidadeId}/vinculados`)
        .then(setVinculados)
        .catch(() => {});
      apiFetch<Preferencias>("/morador/preferencias")
        .then(setPrefs)
        .catch(() => {});
      carregarVeiculos();
    }, [unidadeId, carregarVeiculos]),
  );

  async function alternarWhatsapp() {
    if (!prefs) return;
    try {
      setPrefs(
        await apiFetch<Preferencias>("/morador/preferencias/whatsapp", {
          method: "POST",
          body: { aceita: !prefs.aceitaWhatsapp },
        }),
      );
    } catch (e) {
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    }
  }

  // A mesma regra do servidor, importada e não recopiada: o botão só acende
  // com uma placa que o `PlacaSchema` vai aceitar. Antes bastavam 6
  // caracteres, então "ABCDEF" ia ao servidor só para voltar recusado.
  const placaOk = placaValida(placa.trim());

  async function adicionarVeiculo() {
    if (!placaOk) return;
    setSalvandoVeiculo(true);
    try {
      await apiFetch("/morador/veiculos", {
        method: "POST",
        body: { unidadeId, placa: placa.trim(), modelo: modelo.trim() || undefined },
      });
      setPlaca("");
      setModelo("");
      carregarVeiculos();
    } catch (e) {
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    } finally {
      setSalvandoVeiculo(false);
    }
  }

  async function removerVeiculo(id: string) {
    try {
      await apiFetch(`/morador/veiculos/${id}`, { method: "DELETE" });
      carregarVeiculos();
    } catch (e) {
      // Antes era `catch {}`: a placa continuava na tela como se nada tivesse
      // acontecido, e o morador só descobria que não removeu ao reabrir a
      // tela. Falha de rede é o caso comum aqui.
      Alert.alert("Não foi possível remover", String((e as Error).message));
    }
  }

  async function convidar() {
    setConvidando(true);
    try {
      const convite = await apiFetch<{ codigo: string }>("/morador/convites", {
        method: "POST",
        body: { unidadeId },
      });
      await Share.share({
        message:
          `Você foi convidado para o Convivar, o app de encomendas do ${condominio}. ` +
          `Baixe o app, entre com seu celular e use o código ${convite.codigo} ` +
          `para se vincular à unidade ${rotulo}. O código vale por 7 dias.`,
      });
    } catch (e) {
      Alert.alert("Não foi possível gerar o convite", String((e as Error).message));
    } finally {
      setConvidando(false);
    }
  }

  return (
    <View style={[styles.tela, { paddingTop: insets.top }]}>
      <HeaderTela titulo="Minha unidade" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingTop: 6,
          // Sem o inset o último cartão encosta no indicador de home.
          paddingBottom: insets.bottom + 40,
        }}
      >
        <LinearGradient
          colors={theme.gradiente.marca}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardUnidade}
        >
          <Kicker cor={theme.colors.acentoClaro}>{condominio}</Kicker>
          <Text style={styles.unidadeValor}>{rotulo}</Text>
        </LinearGradient>

        <Text style={styles.tituloSecao}>Moradores</Text>
        <Card estilo={{ padding: 6 }}>
          {vinculados.map((v, i) => (
            <View
              key={v.telefone}
              style={[
                styles.itemMorador,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.divisor },
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: v.titular ? theme.colors.marca : theme.colors.textSecondary },
                ]}
              >
                <Text style={styles.avatarTexto}>{iniciais(v.nome)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nomeMorador}>
                  {v.nome}
                  {v.voce ? " (você)" : ""}
                </Text>
                <Text style={styles.telefoneMorador}>{v.telefone}</Text>
              </View>
              {v.titular && (
                <View style={styles.badgeTitular}>
                  <Text style={styles.badgeTitularTexto}>Titular</Text>
                </View>
              )}
            </View>
          ))}
        </Card>

        <Botao
          titulo="Convidar familiar"
          variante="outline"
          icone="mais"
          onPress={convidar}
          carregando={convidando}
          estilo={{ marginTop: 14, minHeight: 56 }}
        />

        <Text style={[styles.tituloSecao, { marginTop: 26 }]}>Veículos</Text>
        <Text style={styles.subVeiculos}>
          Cadastre a placa do seu veículo para a portaria te informar qualquer
          anormalidade (luz acesa, alarme...).
        </Text>
        <Card estilo={{ padding: 6 }}>
          {veiculos.length === 0 && (
            <Text style={styles.vazioVeiculo}>Nenhum veículo cadastrado.</Text>
          )}
          {veiculos.map((v, i) => (
            <View
              key={v.id}
              style={[
                styles.itemVeiculo,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.divisor },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.placaVeiculo}>{v.placa}</Text>
                {(v.modelo || v.cor) && (
                  <Text style={styles.modeloVeiculo}>
                    {[v.modelo, v.cor].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => removerVeiculo(v.id)} hitSlop={10}>
                <Icone nome="fechar" tamanho={18} cor={theme.colors.textFaint} />
              </Pressable>
            </View>
          ))}
          <View style={styles.formVeiculo}>
            <TextInput
              style={[styles.inputVeiculo, { flex: 1.2 }]}
              placeholder="Placa"
              maxLength={20}
              placeholderTextColor={theme.colors.textFaint}
              autoCapitalize="characters"
              value={placa}
              onChangeText={setPlaca}
            />
            <TextInput
              style={[styles.inputVeiculo, { flex: 1.5 }]}
              placeholder="Modelo (opcional)"
              maxLength={80}
              placeholderTextColor={theme.colors.textFaint}
              value={modelo}
              onChangeText={setModelo}
            />
            <Pressable
              style={[styles.addVeiculo, { opacity: placaOk ? 1 : 0.4 }]}
              onPress={adicionarVeiculo}
              disabled={salvandoVeiculo || !placaOk}
            >
              <Icone nome="mais" tamanho={20} cor="#FFF" traco={2.4} />
            </Pressable>
          </View>
        </Card>

        {/* Com o app instalado o aviso chega por push, e o WhatsApp não é
            usado: oferecer a opção aqui prometeria algo que não acontece.
            Por isso a linha só vira toggle para quem não tem device. */}
        <Pressable
          style={({ pressed }) => [styles.linhaNotif, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          onPress={ligados.includes("whatsapp") && prefs && !prefs.temApp
            ? alternarWhatsapp
            : () =>
                Alert.alert(
                  "Notificações",
                  "Todos os moradores vinculados recebem os avisos da unidade neste aparelho.",
                )}
        >
          <View style={styles.iconeNotif}>
            <Icone nome="sino" tamanho={20} cor={theme.colors.ok} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitulo}>Notificações</Text>
            <Text style={styles.notifSub}>
              {ligados.includes("whatsapp") && prefs && !prefs.temApp
                ? prefs.aceitaWhatsapp
                  ? "Recebendo comunicados e boletos por WhatsApp"
                  : "Toque para receber comunicados e boletos por WhatsApp"
                : "Todos os vinculados recebem os avisos"}
            </Text>
          </View>
          {ligados.includes("whatsapp") && prefs && !prefs.temApp ? (
            <Icone
              nome={prefs.aceitaWhatsapp ? "check" : "chevron"}
              tamanho={22}
              cor={prefs.aceitaWhatsapp ? theme.colors.ok : theme.colors.textFaint}
            />
          ) : (
            <Icone nome="chevron" tamanho={22} cor={theme.colors.textFaint} />
          )}
        </Pressable>

        <Botao
          titulo="Sair da conta"
          variante="outline"
          onPress={() =>
            Alert.alert("Sair da conta?", "Você vai voltar para a tela de login.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Sair",
                style: "destructive",
                onPress: async () => {
                  await limparSessao();
                  aoSair();
                },
              },
            ])
          }
          estilo={{ marginTop: 22 }}
        />

        <Pressable
          onPress={() => excluirConta(aoSair)}
          hitSlop={8}
          style={({ pressed }) => [styles.excluirConta, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.excluirContaTexto}>Excluir minha conta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: theme.colors.bg },
  cardUnidade: {
    borderRadius: theme.radius.card,
    padding: 22,
    marginBottom: 22,
  },
  unidadeValor: { color: "#FFF", fontSize: 34, fontWeight: "700", marginTop: 6 },
  tituloSecao: { fontSize: 17, fontWeight: "700", color: theme.colors.text, marginBottom: 10 },
  itemMorador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  nomeMorador: { fontSize: 15.5, fontWeight: "600", color: theme.colors.text },
  telefoneMorador: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 1 },
  badgeTitular: {
    backgroundColor: theme.colors.okBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeTitularTexto: { fontSize: 12, fontWeight: "600", color: theme.colors.ok },
  linhaNotif: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 14,
    marginTop: 14,
  },
  iconeNotif: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.okBg,
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitulo: { fontSize: 15.5, fontWeight: "600", color: theme.colors.text },
  notifSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 1 },
  subVeiculos: {
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    marginTop: -4,
    marginBottom: 10,
    lineHeight: 19,
  },
  vazioVeiculo: {
    fontSize: 14,
    color: theme.colors.textFaint,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  itemVeiculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  placaVeiculo: {
    fontSize: 15.5,
    fontWeight: "700",
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  modeloVeiculo: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 1 },
  formVeiculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divisor,
    marginTop: 2,
  },
  inputVeiculo: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    minHeight: 46,
    paddingHorizontal: 12,
    fontSize: 15,
    color: theme.colors.text,
  },
  addVeiculo: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.marca,
    alignItems: "center",
    justifyContent: "center",
  },
  // Discreto, mas não escondido: as lojas exigem que a exclusão seja
  // encontrável sem suporte, e esta é a tela de perfil do morador.
  excluirConta: { alignSelf: "center", marginTop: 18, padding: 8 },
  excluirContaTexto: { fontSize: 14, fontWeight: "600", color: theme.colors.notif },
});
