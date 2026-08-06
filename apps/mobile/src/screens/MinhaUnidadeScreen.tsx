import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { linkWhatsApp, placaValida } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { excluirConta } from "../api/excluirConta";
import { carregarAppDownloadUrl, limparSessao } from "../api/session";
import { iniciais, type Veiculo, type Vinculado } from "../api/types";
import { Botao, Card, HeaderTela, Kicker, Nota } from "../components/ui";
import { Icone } from "../components/icones";
import { theme } from "../theme";
import { useModulos } from "../useModulos";
import type { MoradorStackParamList } from "../navigation";

/** GET /morador/preferencias */
interface Preferencias {
  aceitaWhatsapp: boolean;
  /** Push do app. Nasce ligado; desligar não desinstala nem some da adoção. */
  aceitaPush: boolean;
  /** Com app instalado o canal é o push, e o WhatsApp não entra. */
  temApp: boolean;
}

type Props = NativeStackScreenProps<MoradorStackParamList, "MinhaUnidade"> & {
  aoSair: () => void;
};

export function MinhaUnidadeScreen({ navigation, route, aoSair }: Props) {
  const insets = useSafeAreaInsets();
  const { unidadeId, rotulo, condominio } = route.params;
  const [vinculados, setVinculados] = useState<Vinculado[]>([]);
  const [convidando, setConvidando] = useState(false);
  const [convidandoAberto, setConvidandoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  // Onde baixar o app, para o texto do convite. Vem do cache das capacidades.
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
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
      carregarAppDownloadUrl().then(setDownloadUrl);
    }, [unidadeId, carregarVeiculos]),
  );

  /**
   * Otimista, com desfazer: o interruptor tem que mexer no toque. Esperar a
   * resposta deixava a chave parada por meio segundo e a pessoa tocava de
   * novo, mandando duas requisições contrárias.
   */
  async function alternarPush(valor: boolean) {
    if (!prefs) return;
    setPrefs({ ...prefs, aceitaPush: valor });
    try {
      setPrefs(
        await apiFetch<Preferencias>("/morador/preferencias/push", {
          method: "POST",
          body: { aceita: valor },
        }),
      );
    } catch (e) {
      setPrefs({ ...prefs, aceitaPush: !valor });
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    }
  }

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

  /**
   * Convida pelo telefone. O pedido vai para a fila do síndico: o morador
   * indica quem entra na unidade, quem autoriza é a administração.
   *
   * Substituiu o código de 7 dias, que era compartilhado por qualquer canal e
   * servia para quem o recebesse encaminhado.
   */
  /**
   * Texto pessoal, não institucional: quem manda é o morador falando com a
   * própria família, e é isso que faz a mensagem não parecer propaganda.
   */
  async function avisarConvidado(nome: string, telefone: string) {
    const link = downloadUrl ? ` Baixa aqui: ${downloadUrl}` : "";
    const texto =
      `Oi, ${nome.split(" ")[0]}! Te convidei para o app do ${condominio}, ` +
      `onde a gente acompanha as encomendas e avisos da ${rotulo}. ` +
      `Baixa o Convivar e entra com o seu número: assim que a administração ` +
      `aprovar, você já entra na nossa unidade.${link}`;
    try {
      await Linking.openURL(linkWhatsApp(telefone, texto));
    } catch {
      Alert.alert(
        "WhatsApp não disponível",
        "Não foi possível abrir o WhatsApp neste aparelho.",
      );
    }
  }

  async function convidar() {
    const tel = novoTelefone.replace(/\D/g, "");
    if (novoNome.trim().length < 2 || tel.length < 10) return;
    setConvidando(true);
    try {
      await apiFetch("/morador/convidar", {
        method: "POST",
        body: { unidadeId, nome: novoNome.trim(), telefone: tel },
      });
      const nome = novoNome.trim();
      setNovoNome("");
      setNovoTelefone("");
      setConvidandoAberto(false);
      // O convidado não é notificado por nenhum canal automático: o pedido
      // vai para o síndico, não para ele. Sem este passo, ele só descobriria
      // que foi convidado se instalasse o app por conta própria.
      Alert.alert(
        "Pedido enviado ao síndico",
        `Quando a administração aprovar, ${nome.split(" ")[0]} entra no app com o próprio número e já cai em ${rotulo}.`,
        [
          { text: "Agora não", style: "cancel" },
          {
            text: "Avisar pelo WhatsApp",
            onPress: () => avisarConvidado(nome, tel),
          },
        ],
      );
    } catch (e) {
      Alert.alert("Não foi possível convidar", String((e as Error).message));
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

        {convidandoAberto ? (
          <Card estilo={{ marginTop: 14 }}>
            <Kicker>Convidar para esta unidade</Kicker>
            <TextInput
              style={styles.campoConvite}
              placeholder="Nome"
              placeholderTextColor={theme.colors.textFaint}
              value={novoNome}
              onChangeText={setNovoNome}
              maxLength={120}
              autoFocus
            />
            <TextInput
              style={styles.campoConvite}
              placeholder="Celular com DDD"
              placeholderTextColor={theme.colors.textFaint}
              value={novoTelefone}
              onChangeText={setNovoTelefone}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <Botao
              titulo="Enviar para aprovação"
              onPress={convidar}
              carregando={convidando}
              desabilitado={
                novoNome.trim().length < 2 ||
                novoTelefone.replace(/\D/g, "").length < 10
              }
              estilo={{ marginTop: 10 }}
            />
            <Botao
              titulo="Cancelar"
              variante="outline"
              onPress={() => setConvidandoAberto(false)}
              estilo={{ marginTop: 8 }}
            />
            <Nota
              texto="O síndico aprova antes de a pessoa ver as encomendas, boletos e documentos da unidade."
              estilo={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          <Botao
            titulo="Convidar familiar"
            variante="outline"
            icone="mais"
            onPress={() => setConvidandoAberto(true)}
            estilo={{ marginTop: 14, minHeight: 56 }}
          />
        )}

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

        <Text style={[styles.tituloSecao, { marginTop: 26 }]}>Notificações</Text>
        <Card estilo={{ padding: 6 }}>
          {/* Era uma linha com chevron que abria um alerta "OK" e não mudava
              nada: parecia ajuste e não era. Agora é o interruptor mesmo. */}
          <View style={styles.linhaNotif}>
            <View style={styles.iconeNotif}>
              <Icone nome="sino" tamanho={20} cor={theme.colors.ok} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitulo}>Avisos no app</Text>
              <Text style={styles.notifSub}>
                {prefs?.aceitaPush === false
                  ? "Desligado: nada de encomendas, avisos ou comunicados"
                  : "Encomendas, avisos da portaria e comunicados"}
              </Text>
            </View>
            <Switch
              value={prefs?.aceitaPush ?? true}
              disabled={!prefs}
              onValueChange={alternarPush}
              trackColor={{ false: theme.colors.toggleOff, true: theme.colors.acao }}
            />
          </View>

          {/* WhatsApp só para quem NÃO tem o app: com push instalado o aviso
              já chega, e oferecer o outro canal prometeria uma duplicata que
              não acontece. */}
          {ligados.includes("whatsapp") && prefs && !prefs.temApp && (
            <View style={[styles.linhaNotif, styles.linhaNotifDivisor]}>
              <View style={styles.iconeNotif}>
                <Icone nome="megafone" tamanho={20} cor={theme.colors.ok} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitulo}>WhatsApp</Text>
                <Text style={styles.notifSub}>
                  Comunicados e boletos, enquanto você não usa o app
                </Text>
              </View>
              <Switch
                value={prefs.aceitaWhatsapp}
                onValueChange={alternarWhatsapp}
                trackColor={{ false: theme.colors.toggleOff, true: theme.colors.acao }}
              />
            </View>
          )}
        </Card>

        {prefs?.aceitaPush === false && (
          <Nota
            icone="alerta"
            texto="Com os avisos desligados você não fica sabendo quando uma encomenda chega. A portaria continua recebendo normalmente."
            estilo={{ marginTop: 12 }}
          />
        )}

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
  campoConvite: {
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
  linhaNotif: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  linhaNotifDivisor: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divisor,
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
