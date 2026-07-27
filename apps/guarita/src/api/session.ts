import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JwtPayload, ModuloCondominio } from "@pacotes/shared";

const TOKEN_KEY = "@sessao/token";
const PERFIL_KEY = "@sessao/perfil";
const MODULOS_KEY = "@sessao/modulos";

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
  await AsyncStorage.multiRemove([TOKEN_KEY, PERFIL_KEY, MODULOS_KEY]);
}

/**
 * Módulos ligados no condomínio, guardados localmente.
 *
 * Ficam em cache porque a home não pode esperar a rede para saber o que
 * desenhar: sem o último valor conhecido, abrir o app sem sinal esconderia
 * módulos que o condomínio tem. O servidor continua sendo quem autoriza cada
 * rota; isto decide só o que aparece.
 */
export async function salvarModulos(
  modulos: readonly ModuloCondominio[],
): Promise<void> {
  await AsyncStorage.setItem(MODULOS_KEY, JSON.stringify(modulos));
}

export async function carregarModulos(): Promise<ModuloCondominio[]> {
  const bruto = await AsyncStorage.getItem(MODULOS_KEY);
  if (!bruto) return [];
  try {
    const lido = JSON.parse(bruto);
    return Array.isArray(lido) ? (lido as ModuloCondominio[]) : [];
  } catch {
    return [];
  }
}
