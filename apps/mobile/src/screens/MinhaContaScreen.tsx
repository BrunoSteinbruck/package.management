import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  contatoDeMembro,
  type JwtPayload,
  type MinhaConta,
} from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { excluirConta } from "../api/excluirConta";
import { sairDosOutrosAparelhos } from "../api/sairOutrosAparelhos";
import { limparSessao, salvarSessao } from "../api/session";
import { Botao, Card, HeaderTela, Kicker, Nota, Tela } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "MinhaConta"> & {
  aoSair: () => void;
};

/**
 * A conta de quem está logado: o e-mail que recupera a senha, e a senha.
 *
 * A senha atual é cobrada nas duas operações, por motivos diferentes. Na
 * troca de senha, porque um aparelho esquecido desbloqueado não pode expulsar
 * o dono da conta. Na troca de e-mail, porque redirecionar a recuperação para
 * outra caixa é tomar a conta em definitivo. Quem ainda não tem senha é a
 * exceção: cobrar dele uma senha que nunca teve seria trancá-lo do lado de
 * fora.
 */
export function MinhaContaScreen({ navigation, aoSair }: Props) {
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [email, setEmail] = useState("");
  const [senhaDoEmail, setSenhaDoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const c = await apiFetch<MinhaConta>("/conta/perfil");
      setConta(c);
      setEmail(c.email ?? "");
    } catch {
      // offline: mantém o que está na tela
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function salvarEmail() {
    setSalvandoEmail(true);
    try {
      await apiFetch("/conta/email", {
        method: "POST",
        body: {
          email: email.trim(),
          ...(conta?.temSenha ? { senhaAtual: senhaDoEmail } : {}),
        },
      });
      setSenhaDoEmail("");
      Alert.alert("E-mail salvo", "É por ele que a senha é recuperada.");
      await carregar();
    } catch (e) {
      // O servidor devolve 400 para senha errada, não 401: o apiFetch só
      // derruba a sessão em 401, então o erro aparece aqui em vez de jogar
      // o síndico na tela de login.
      Alert.alert("Não foi possível salvar", String((e as Error).message));
    } finally {
      setSalvandoEmail(false);
    }
  }

  async function salvarSenha() {
    if (novaSenha !== confirmacao) {
      Alert.alert("Senhas diferentes", "A confirmação não bate com a nova senha.");
      return;
    }
    setSalvandoSenha(true);
    try {
      // `perfil` é o payload da sessão, não o da tela: quem descreve a conta
      // é `MinhaConta`, que vem do GET e não desta resposta.
      const r = await apiFetch<{ token: string; perfil: JwtPayload }>(
        "/conta/senha",
        { method: "POST", body: { senhaAtual, novaSenha } },
      );
      // Trocar a senha derruba as sessões anteriores, e a que está aqui é
      // uma delas: sem guardar o token novo, o próximo request levaria 401 e
      // a pessoa cairia no login logo depois de trocar a própria senha.
      await salvarSessao({ token: r.token, perfil: r.perfil });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      Alert.alert(
        "Senha alterada",
        "As sessões nos outros aparelhos foram encerradas. Você continua conectado aqui.",
      );
      await carregar();
    } catch (e) {
      Alert.alert("Não foi possível alterar", String((e as Error).message));
    } finally {
      setSalvandoSenha(false);
    }
  }

  function sair() {
    Alert.alert("Sair da conta", "Você vai precisar entrar de novo.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        onPress: async () => {
          await limparSessao();
          aoSair();
        },
      },
    ]);
  }

  const emailMudou = email.trim().toLowerCase() !== (conta?.email ?? "");
  const podeSalvarEmail =
    email.includes("@") &&
    emailMudou &&
    (!conta?.temSenha || senhaDoEmail.length >= 8);
  const podeSalvarSenha =
    senhaAtual.length >= 1 && novaSenha.length >= 8 && confirmacao.length >= 8;

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Minha conta" aoVoltar={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {conta && (
            <Card>
              <Text style={styles.nome}>{conta.nome}</Text>
              <Text style={styles.sub}>
                {contatoDeMembro(conta.telefone)} ·{" "}
                {String(conta.papel).toLowerCase() === "sindico"
                  ? "síndico"
                  : String(conta.papel).toLowerCase()}
              </Text>
              <Text style={styles.sub}>{conta.condominioNome}</Text>
            </Card>
          )}

          <Kicker>E-mail de acesso</Kicker>
          <Card>
            <TextInput
              style={styles.campo}
              placeholder="email@exemplo.com"
              placeholderTextColor={theme.colors.textFaint}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={160}
            />
            {conta?.temSenha && emailMudou && (
              <TextInput
                style={styles.campo}
                placeholder="Sua senha atual"
                placeholderTextColor={theme.colors.textFaint}
                value={senhaDoEmail}
                onChangeText={setSenhaDoEmail}
                secureTextEntry
                maxLength={100}
              />
            )}
            <Botao
              titulo="Salvar e-mail"
              onPress={salvarEmail}
              carregando={salvandoEmail}
              desabilitado={!podeSalvarEmail}
              estilo={{ marginTop: 10 }}
            />
          </Card>

          <Kicker>Senha do painel</Kicker>
          <Card>
            <TextInput
              style={styles.campo}
              placeholder="Senha atual"
              placeholderTextColor={theme.colors.textFaint}
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              secureTextEntry
              maxLength={100}
            />
            <TextInput
              style={styles.campo}
              placeholder="Nova senha (mínimo 8)"
              placeholderTextColor={theme.colors.textFaint}
              value={novaSenha}
              onChangeText={setNovaSenha}
              secureTextEntry
              maxLength={100}
            />
            <TextInput
              style={styles.campo}
              placeholder="Repita a nova senha"
              placeholderTextColor={theme.colors.textFaint}
              value={confirmacao}
              onChangeText={setConfirmacao}
              secureTextEntry
              maxLength={100}
            />
            <Botao
              titulo="Alterar senha"
              onPress={salvarSenha}
              carregando={salvandoSenha}
              desabilitado={!podeSalvarSenha}
              estilo={{ marginTop: 10 }}
            />
            <Nota
              texto="A senha vale para entrar no painel web. No app, a portaria continua entrando pelo código por SMS."
              estilo={{ marginTop: 12 }}
            />
          </Card>

          <Kicker>Segurança</Kicker>
          <Card>
            <Botao
              titulo="Sair dos outros aparelhos"
              variante="outline"
              onPress={sairDosOutrosAparelhos}
            />
            <Nota
              texto="Use se perder o celular ou se achar que alguém entrou na sua conta: os outros aparelhos saem e param de receber avisos. Você continua conectado neste."
              estilo={{ marginTop: 12 }}
            />
          </Card>

          {/* Sair e excluir vieram para cá porque o Alert do avatar na home
              já estava no teto de três botões do Android: com "Minha conta"
              somando quatro, um deles sumiria em silêncio. */}
          <Botao
            titulo="Sair da conta"
            variante="outline"
            onPress={sair}
            estilo={{ marginTop: 22 }}
          />
          <View style={styles.zonaPerigo}>
            <Botao
              titulo="Excluir minha conta"
              variante="outline"
              onPress={() => excluirConta(aoSair)}
              estilo={{ borderColor: theme.colors.notif }}
              corTexto={theme.colors.notif}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  nome: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  sub: {
    fontSize: 13.5,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
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
  zonaPerigo: { marginTop: 10 },
});
