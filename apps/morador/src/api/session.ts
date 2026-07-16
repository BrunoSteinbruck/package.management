import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JwtPayload } from "@pacotes/shared";

const TOKEN_KEY = "@sessao/token";
const PERFIL_KEY = "@sessao/perfil";

export interface Sessao {
  token: string;
  perfil: JwtPayload;
}

export async function salvarSessao(sessao: Sessao): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, sessao.token],
    [PERFIL_KEY, JSON.stringify(sessao.perfil)],
  ]);
}

export async function carregarSessao(): Promise<Sessao | null> {
  const [[, token], [, perfilJson]] = await AsyncStorage.multiGet([
    TOKEN_KEY,
    PERFIL_KEY,
  ]);
  if (!token || !perfilJson) return null;
  try {
    return { token, perfil: JSON.parse(perfilJson) as JwtPayload };
  } catch {
    return null;
  }
}

export async function limparSessao(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, PERFIL_KEY]);
}
