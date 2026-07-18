import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch, NetworkError } from "./client";

const QUEUE_KEY = "@fila/pendentes";

export interface OperacaoPendente {
  id: string;
  path: string;
  body: unknown;
  criadaEm: string;
}

async function lerFila(): Promise<OperacaoPendente[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OperacaoPendente[];
  } catch {
    return [];
  }
}

async function gravarFila(fila: OperacaoPendente[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(fila));
}

export async function enfileirar(path: string, body: unknown): Promise<void> {
  const fila = await lerFila();
  fila.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path,
    body,
    criadaEm: new Date().toISOString(),
  });
  await gravarFila(fila);
}

export async function tamanhoFila(): Promise<number> {
  return (await lerFila()).length;
}

/**
 * Tenta enviar as operações pendentes em ordem. Para no primeiro erro de rede
 * (continua offline); erros de negócio (4xx) descartam a operação para não
 * travar a fila — o registro problemático é raro e o operador é avisado.
 */
export async function drenarFila(): Promise<{ enviadas: number; restantes: number }> {
  let fila = await lerFila();
  let enviadas = 0;
  while (fila.length > 0) {
    const op = fila[0];
    try {
      await apiFetch(op.path, { method: "POST", body: op.body });
      enviadas++;
      fila = fila.slice(1);
      await gravarFila(fila);
    } catch (e) {
      if (e instanceof NetworkError) break;
      fila = fila.slice(1);
      await gravarFila(fila);
    }
  }
  return { enviadas, restantes: fila.length };
}

/** POST com fallback offline: se a rede falhar, enfileira e retorna queued. */
export async function postOuEnfileirar<T>(
  path: string,
  body: unknown,
): Promise<{ data?: T; queued: boolean }> {
  try {
    const data = await apiFetch<T>(path, { method: "POST", body });
    return { data, queued: false };
  } catch (e) {
    if (e instanceof NetworkError) {
      await enfileirar(path, body);
      return { queued: true };
    }
    throw e;
  }
}
