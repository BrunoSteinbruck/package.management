import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Share,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CobrancaMorador, StatusCobranca } from "@pacotes/shared";
import { apiFetch } from "../api/client";
import { Botao, HeaderTela, ItemLista, Selo, Tela, Vazio } from "../components/ui";
import { theme } from "../theme";
import type { MoradorStackParamList } from "../navigation";

type Props = NativeStackScreenProps<MoradorStackParamList, "Cobrancas">;

const ROTULO: Record<StatusCobranca, { texto: string; tom: "ok" | "alerta" | "neutro" }> = {
  PENDENTE: { texto: "em aberto", tom: "neutro" },
  PAGA: { texto: "paga", tom: "ok" },
  VENCIDA: { texto: "vencida", tom: "alerta" },
  CANCELADA: { texto: "cancelada", tom: "neutro" },
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-07" vira "julho de 2026" sem passar por Date. */
function nomeCompetencia(c: string): string {
  const [ano, mes] = c.split("-");
  return `${MESES[Number(mes) - 1]} de ${ano}`;
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CobrancasScreen({ navigation }: Props) {
  const [itens, setItens] = useState<CobrancaMorador[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await apiFetch<CobrancaMorador[]>("/morador/cobrancas"));
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

  async function copiar(c: CobrancaMorador) {
    const codigo = c.pixCopiaCola ?? c.linhaDigitavel;
    if (!codigo) {
      Alert.alert("Sem código", "Este boleto ainda não tem código para copiar.");
      return;
    }
    // Share em vez de Clipboard: já existe no React Native, então não custa
    // dependência nova, e ainda deixa o morador mandar o código para quem
    // paga a conta da casa.
    await Share.share({ message: codigo });
  }

  return (
    <Tela comInsetTop>
      <HeaderTela titulo="Boletos" aoVoltar={() => navigation.goBack()} />
      <FlatList
        data={itens}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 24,
          gap: 10,
        }}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregar} />
        }
        ListEmptyComponent={
          !carregando ? (
            <Vazio
              variante="hero"
              icone="pacote"
              titulo="Nenhum boleto"
              texto="Quando a administração emitir a taxa condominial, ela aparece aqui."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const status = ROTULO[item.status];
          const emAberto = item.status === "PENDENTE" || item.status === "VENCIDA";
          return (
            <>
              <ItemLista
                titulo={nomeCompetencia(item.competencia)}
                sub={`${reais(item.valor)} · vence ${diaCurto(item.vencimento)}`}
                media={{
                  icone: "pacote",
                  corFundo:
                    item.status === "VENCIDA"
                      ? theme.colors.alertaBg
                      : theme.colors.okBg,
                  corIcone:
                    item.status === "VENCIDA"
                      ? theme.colors.alerta
                      : theme.colors.marca,
                }}
                direita={<Selo texto={status.texto} tom={status.tom} />}
              />
              {emAberto && (item.pixCopiaCola || item.linhaDigitavel) && (
                <Botao
                  titulo={item.pixCopiaCola ? "Copiar PIX" : "Copiar código de barras"}
                  variante="outline"
                  onPress={() => copiar(item)}
                />
              )}
              {emAberto && item.urlBoleto && (
                <Botao
                  titulo="Abrir boleto"
                  variante="outline"
                  onPress={() => Linking.openURL(item.urlBoleto!)}
                />
              )}
            </>
          );
        }}
      />
    </Tela>
  );
}
