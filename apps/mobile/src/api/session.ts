import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JwtPayload, ModuloCondominio } from "@pacotes/shared";

const TOKEN_KEY = "@sessao/token";
const PERFIL_KEY = "@sessao/perfil";
const MODULOS_KEY = "@sessao/modulos";
/**
 * Chave PRÓPRIA, e não um campo dentro de `@sessao/modulos`.
 *
 * `carregarModulos` faz `Array.isArray(lido) ? ... : []` sobre o conteúdo
 * dessa chave: guardar um objeto lá dentro faria todo aparelho já instalado
 * ler `[]` na primeira abertura depois da atualização, e a home do síndico
 * perderia as prateleiras até a rede responder.
 */
const APP_DOWNLOAD_KEY = "@sessao/appDownloadUrl";

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

/**
 * Caches em memória que morrem junto com a sessão.
 *
 * As telas do porteiro guardam a lista de unidades e o progresso do mês em
 * variáveis de módulo, que o JS mantém vivas enquanto o processo existir. Sair
 * do app só apagava o token: na portaria, que é um aparelho compartilhado, o
 * porteiro seguinte abria a tela de entrada e via as unidades do condomínio
 * anterior. O servidor recusaria o POST, mas a lista errada já estava na tela.
 */
const limpezas = new Set<() => void>();

export function registrarLimpezaDeSessao(fn: () => void): void {
  limpezas.add(fn);
}

export async function limparSessao(): Promise<void> {
  await AsyncStorage.multiRemove([
    TOKEN_KEY,
    PERFIL_KEY,
    MODULOS_KEY,
    APP_DOWNLOAD_KEY,
  ]);
  for (const fn of limpezas) fn();
  for (const fn of ouvintes) fn([]);
}

/**
 * Módulos ligados no condomínio, guardados localmente.
 *
 * Ficam em cache porque a home não pode esperar a rede para saber o que
 * desenhar: sem o último valor conhecido, abrir o app sem sinal esconderia
 * módulos que o condomínio tem. O servidor continua sendo quem autoriza cada
 * rota; isto decide só o que aparece.
 */
/**
 * Quem quer saber quando os módulos mudam.
 *
 * Existe porque o cache é escrito por uma função assíncrona (a sincronização
 * na abertura e no login) e lido por telas que já montaram. Sem o aviso, a
 * tela que leu antes da escrita ficava com a lista velha até ser remontada,
 * que foi exatamente o bug do menu vazio depois do login.
 */
const ouvintes = new Set<(m: ModuloCondominio[]) => void>();

export function assinarModulos(fn: (m: ModuloCondominio[]) => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export async function salvarModulos(
  modulos: readonly ModuloCondominio[],
): Promise<void> {
  await AsyncStorage.setItem(MODULOS_KEY, JSON.stringify(modulos));
  for (const fn of ouvintes) fn([...modulos]);
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

/**
 * Onde baixar o app, para os convites por WhatsApp.
 *
 * Vem das capacidades e fica em cache pelo mesmo motivo dos módulos: quem
 * convida quer o texto pronto na hora, não depois de uma ida à rede. Null
 * quando o servidor não tem o env: o convite sai sem link.
 */
export async function salvarAppDownloadUrl(url: string | null): Promise<void> {
  if (url) await AsyncStorage.setItem(APP_DOWNLOAD_KEY, url);
  else await AsyncStorage.removeItem(APP_DOWNLOAD_KEY);
}

export function carregarAppDownloadUrl(): Promise<string | null> {
  return AsyncStorage.getItem(APP_DOWNLOAD_KEY);
}
