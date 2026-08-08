import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  soAConvivarLiga,
  type Capacidades,
  type ModuloCondominio,
} from "@pacotes/shared";
import { apiFetch, sincronizarModulos } from "../api/client";
import { Card, HeaderTela, Nota, Tela } from "../components/ui";
import { theme } from "../theme";
import type { SindicoStackParamList } from "../navigation";

type Props = NativeStackScreenProps<SindicoStackParamList, "Configuracoes">;

/**
 * O que cada módulo é, na língua do síndico.
 *
 * `Record` sobre a união: módulo novo em `MODULOS_CONDOMINIO` não compila até
 * ganhar uma descrição aqui, o que impede a tela de oferecer um item sem
 * explicar o que ele faz.
 */
const DESCRICOES: Record<ModuloCondominio, { titulo: string; sub: string }> = {
  comunicados: {
    titulo: "Comunicados",
    sub: "Avisos do síndico para o condomínio inteiro, com quem leu.",
  },
  documentos: {
    titulo: "Documentos",
    sub: "Atas, regimento e convenção disponíveis no app do morador.",
  },
  visitantes: {
    titulo: "Visitantes",
    sub: "Morador pré-autoriza a visita e a portaria dá baixa na chegada.",
  },
  financeiro: {
    titulo: "Financeiro",
    sub: "Boleto da taxa condominial, segunda via no app e inadimplência.",
  },
  whatsapp: {
    titulo: "Avisos por WhatsApp",
    sub: "Alcança quem ainda não instalou o app. Tem custo por mensagem.",
  },
  qr_retirada: {
    titulo: "QR na retirada",
    sub: "Conferência extra: o morador mostra um QR no app em vez de dizer a unidade. A entrega já é registrada com foto e o nome de quem recebeu.",
  },
};

interface LinhaModulo {
  id: ModuloCondominio;
  ativo: boolean;
}

export function ConfiguracoesScreen({ navigation }: Props) {
  const [modulos, setModulos] = useState<LinhaModulo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  /** Onde pedir os módulos que só a Convivar liga. Null sem o env. */
  const [suporteUrl, setSuporteUrl] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setModulos(await apiFetch<LinhaModulo[]>("/cadastro/modulos"));
      // Falha sozinho: sem o link, o pedido ao suporte vira uma instrução em
      // texto, e a lista de módulos continua de pé.
      apiFetch<Capacidades>("/conta/capacidades")
        .then((c) => setSuporteUrl(c.suporteUrl ?? null))
        .catch(() => {});
    } catch {
      // offline: mantém o que está na tela
    } finally {
      setCarregando(false);
    }
  }, []);

  function pedirAoSuporte() {
    if (suporteUrl) {
      Linking.openURL(suporteUrl).catch(() => {});
      return;
    }
    Alert.alert(
      "Ativado pela Convivar",
      "Este recurso é combinado com a gente antes de ligar. Fale com o suporte Convivar.",
    );
  }

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  /**
   * Manda a lista inteira, não o item alternado: o que o servidor grava é o
   * estado que o síndico está vendo. Dois gestores editando ao mesmo tempo
   * produzem o estado de um dos dois, nunca uma combinação de ambos.
   */
  async function alternar(id: ModuloCondominio) {
    if (!modulos || salvando) return;
    const otimista = modulos.map((m) =>
      m.id === id ? { ...m, ativo: !m.ativo } : m,
    );
    setModulos(otimista);
    setSalvando(true);
    try {
      await apiFetch("/cadastro/modulos", {
        method: "POST",
        body: { modulos: otimista.filter((m) => m.ativo).map((m) => m.id) },
      });
      // Sem isto, a prateleira da PRÓPRIA home só refletiria no próximo
      // cold start: o cache de módulos só é preenchido na abertura e no
      // login. O síndico ligaria Financeiro e não veria a entrada aparecer.
      await sincronizarModulos();
    } catch (e) {
      Alert.alert("Não foi possível salvar", String((e as Error).message));
      // Volta ao que o servidor tem: o toggle não pode mentir sobre o que
      // está contratado.
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Configurações" aoVoltar={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
      >
        <Nota
          texto="Encomendas, avisos e leituras são a base e estão sempre ligados. Os módulos abaixo entram quando o condomínio quiser: ao ligar, eles aparecem no app de todo mundo na próxima abertura."
          estilo={{ marginBottom: 12 }}
        />
        <Card estilo={{ padding: 6 }}>
          {modulos?.map((m, i) => (
            <View
              key={m.id}
              style={[styles.linha, i > 0 && styles.divisor]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>{DESCRICOES[m.id].titulo}</Text>
                <Text style={styles.sub}>{DESCRICOES[m.id].sub}</Text>
              </View>
              {soAConvivarLiga(m.id) ? (
                /* Sem interruptor: estes dois são combinados com a gente. O
                   servidor preserva o estado deles de qualquer jeito; aqui
                   só se mostra como está e por onde pedir. */
                <Pressable
                  onPress={pedirAoSuporte}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.pedir,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={styles.pedirTexto}>
                    {m.ativo ? "ligado" : "solicitar"}
                  </Text>
                </Pressable>
              ) : (
                <Switch
                  value={m.ativo}
                  disabled={salvando}
                  onValueChange={() => alternar(m.id)}
                  trackColor={{
                    false: theme.colors.toggleOff,
                    true: theme.colors.acao,
                  }}
                />
              )}
            </View>
          ))}
        </Card>
        {(modulos ?? []).some((m) => soAConvivarLiga(m.id)) && (
          <Nota
            texto="Avisos por WhatsApp e QR na retirada são ativados pela Convivar: um tem custo por mensagem e o outro muda o procedimento da portaria, então combinamos os dois antes de ligar."
            estilo={{ marginTop: 12 }}
          />
        )}
      </ScrollView>
    </Tela>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  divisor: { borderTopWidth: 1, borderTopColor: theme.colors.divisor },
  pedir: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pedirTexto: { fontSize: 13, fontWeight: "700", color: theme.colors.marca },
  titulo: { fontSize: 15.5, fontWeight: "700", color: theme.colors.text },
  sub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
});
