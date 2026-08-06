import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MembroEquipe } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { formatarTelefone, iniciais } from "../api/types";
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
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Equipe">;

const PAPEIS = [
  { valor: "PORTEIRO", rotulo: "Porteiro" },
  { valor: "APOIO", rotulo: "Apoio" },
  { valor: "SINDICO", rotulo: "Síndico" },
] as const;

/**
 * Quem opera a portaria: porteiros, apoio e outros síndicos.
 *
 * Espelha a seção do painel, inclusive as duas regras que o servidor cobra:
 * e-mail é obrigatório só para SINDICO (é por ele que a senha do painel é
 * criada e recuperada), e o e-mail de quem já tem um não é editável aqui
 * (trocar o endereço de recuperação de outra pessoa é tomar a conta dela).
 */
export function EquipeScreen({ navigation }: Props) {
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [emVoo, setEmVoo] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<string>("PORTEIRO");
  // Preenchimento do e-mail de quem foi cadastrado antes da senha existir.
  const [completando, setCompletando] = useState<string | null>(null);
  const [emailDoMembro, setEmailDoMembro] = useState("");

  const exigeEmail = papel === "SINDICO";

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setEquipe(await apiFetch<MembroEquipe[]>("/cadastro/equipe"));
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const podeAdicionar =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    (!exigeEmail || email.includes("@"));

  async function adicionar() {
    if (!podeAdicionar || emVoo) return;
    setEmVoo(true);
    try {
      await apiFetch("/cadastro/equipe", {
        method: "POST",
        body: {
          nome: nome.trim(),
          telefone: telefone.replace(/\D/g, ""),
          papel,
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      });
      setNome("");
      setTelefone("");
      setEmail("");
      setPapel("PORTEIRO");
      setFormAberto(false);
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível adicionar", String((e as Error).message));
    } finally {
      setEmVoo(false);
    }
  }

  async function completarEmail(id: string) {
    if (!emailDoMembro.includes("@")) return;
    try {
      await apiFetch(`/cadastro/equipe/${id}/email`, {
        method: "POST",
        body: { email: emailDoMembro.trim() },
      });
      setCompletando(null);
      setEmailDoMembro("");
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    }
  }

  /** Desativar tira o acesso na hora: o guard confere `ativo` a cada request. */
  function alternar(m: MembroEquipe) {
    Alert.alert(
      m.ativo ? "Desativar acesso" : "Reativar acesso",
      m.ativo
        ? `${m.nome} perde o acesso ao app e ao painel imediatamente.`
        : `${m.nome} volta a entrar no app e no painel.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: m.ativo ? "Desativar" : "Reativar",
          style: m.ativo ? "destructive" : "default",
          onPress: async () => {
            try {
              await apiFetch(`/cadastro/equipe/${m.id}/alternar-ativo`, {
                method: "POST",
              });
              await carregar();
            } catch (e) {
              Alert.alert("Não foi possível", String((e as Error).message));
            }
          },
        },
      ],
    );
  }

  return (
    <Tela comInsetTop>
      <HeaderTela
        titulo="Equipe da portaria"
        aoVoltar={() => navigation.goBack()}
        direita={
          !formAberto ? (
            <Botao
              titulo="Novo"
              icone="mais"
              onPress={() => setFormAberto(true)}
              estilo={{ minHeight: 40, paddingHorizontal: 14 }}
            />
          ) : undefined
        }
      />
      <FlatList
        data={equipe}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
        ListHeaderComponent={
          formAberto ? (
            <Card estilo={{ marginBottom: 6 }}>
              <Kicker>Novo membro</Kicker>
              <TextInput
                style={styles.campo}
                placeholder="Nome"
                placeholderTextColor={theme.colors.textFaint}
                value={nome}
                onChangeText={setNome}
                maxLength={120}
                autoFocus
              />
              <TextInput
                style={styles.campo}
                placeholder="Celular com DDD"
                placeholderTextColor={theme.colors.textFaint}
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <Kicker>Papel</Kicker>
              <View style={styles.chips}>
                {PAPEIS.map((p) => (
                  <Chip
                    key={p.valor}
                    rotulo={p.rotulo}
                    ativo={papel === p.valor}
                    onPress={() => setPapel(p.valor)}
                  />
                ))}
              </View>
              <TextInput
                style={styles.campo}
                placeholder={
                  exigeEmail ? "E-mail (obrigatório)" : "E-mail (opcional)"
                }
                placeholderTextColor={theme.colors.textFaint}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={160}
              />
              <Botao
                titulo="Adicionar à equipe"
                onPress={adicionar}
                carregando={emVoo}
                desabilitado={!podeAdicionar}
                estilo={{ marginTop: 10 }}
              />
              <Botao
                titulo="Cancelar"
                variante="outline"
                onPress={() => setFormAberto(false)}
                estilo={{ marginTop: 8 }}
              />
              <Nota
                texto="Porteiro e apoio entram pelo código por SMS. Síndico entra no painel por e-mail e senha, e cria a dele no primeiro acesso pelo “Esqueci a senha”."
                estilo={{ marginTop: 12 }}
              />
            </Card>
          ) : null
        }
        ListEmptyComponent={
          !carregando ? (
            <Vazio
              variante="hero"
              icone="pessoa"
              titulo="Nenhum membro"
              texto="Cadastre os porteiros para eles entrarem no app com o próprio celular."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View>
            <ItemLista
              titulo={item.nome}
              sub={`${formatarTelefone(item.telefone)} · ${String(item.papel).toLowerCase()}`}
              detalhe={item.email ?? undefined}
              media={{ iniciais: iniciais(item.nome) }}
              direita={
                <Selo
                  texto={item.ativo ? "ativo" : "desativado"}
                  tom={item.ativo ? "ok" : "alerta"}
                />
              }
            />
            {completando === item.id ? (
              <View style={styles.acoes}>
                <TextInput
                  style={[styles.campo, { flex: 1, marginTop: 0 }]}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={theme.colors.textFaint}
                  value={emailDoMembro}
                  onChangeText={setEmailDoMembro}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={160}
                  autoFocus
                />
                <Botao
                  titulo="Salvar"
                  desabilitado={!emailDoMembro.includes("@")}
                  onPress={() => completarEmail(item.id)}
                  estilo={{ minHeight: 44, paddingHorizontal: 16 }}
                />
              </View>
            ) : (
              <View style={styles.acoes}>
                {/* Só para quem NÃO tem e-mail: trocar o de quem já tem
                    redireciona o "esqueci a senha" para outra caixa, e o
                    servidor recusa. */}
                {!item.email && (
                  <Botao
                    titulo="Adicionar e-mail"
                    variante="outline"
                    onPress={() => {
                      setCompletando(item.id);
                      setEmailDoMembro("");
                    }}
                    estilo={{ flex: 1, minHeight: 44 }}
                  />
                )}
                <Botao
                  titulo={item.ativo ? "Desativar" : "Reativar"}
                  variante="outline"
                  onPress={() => alternar(item)}
                  estilo={{ flex: 1, minHeight: 44 }}
                />
              </View>
            )}
          </View>
        )}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  acoes: { flexDirection: "row", gap: 10, marginTop: 8 },
});
