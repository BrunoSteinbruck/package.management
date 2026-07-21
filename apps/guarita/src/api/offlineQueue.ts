import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch, NetworkError, uploadFoto } from "./client";

const QUEUE_KEY = "@fila/pendentes";

/**
 * Foto que ainda não subiu (operação criada offline). Guardamos o URI local
 * (arquivo em disco no cache do app) e o campo do body onde a key entra depois
 * do upload. Assim o comprovante NÃO se perde quando a portaria está sem rede.
 */
export interface FotoPendente {
  uri: string;
  campo: "fotoEntradaKey" | "fotoSaidaKey";
}

export interface OperacaoPendente {
  id: string;
  path: string;
  body: Record<string, unknown>;
  foto?: FotoPendente;
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

export async function enfileirar(
  path: string,
  body: Record<string, unknown>,
  foto?: FotoPendente,
): Promise<void> {
  const fila = await lerFila();
  fila.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path,
    body,
    foto,
    criadaEm: new Date().toISOString(),
  });
  await gravarFila(fila);
}

export async function tamanhoFila(): Promise<number> {
  return (await lerFila()).length;
}

/**
 * Tenta enviar as operações pendentes em ordem. Para cada uma, sobe a foto
 * pendente primeiro (se houver) e injeta a key no body antes do POST.
 * Para no primeiro erro de rede (continua offline, tenta de novo depois);
 * erros de negócio (4xx) descartam a operação para não travar a fila.
 */
export async function drenarFila(): Promise<{ enviadas: number; restantes: number }> {
  let fila = await lerFila();
  let enviadas = 0;
  while (fila.length > 0) {
    const op = fila[0];
    try {
      let body = op.body;
      if (op.foto) {
        try {
          const key = await uploadFoto(op.foto.uri);
          body = { ...op.body, [op.foto.campo]: key };
        } catch (e) {
          if (e instanceof NetworkError) break; // ainda offline: tenta no próximo flush
          // Falha não-rede ao subir a foto (URI expirou, arquivo sumiu):
          // registra a operação sem a foto em vez de travar a fila para sempre.
        }
      }
      await apiFetch(op.path, { method: "POST", body });
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

/**
 * POST com fallback offline. Se a rede falhar, enfileira o body + a foto
 * pendente (que sobe no flush). Passe `foto` quando houver comprovante cujo
 * upload ainda não foi confirmado.
 */
export async function postOuEnfileirar<T>(
  path: string,
  body: Record<string, unknown>,
  foto?: FotoPendente,
): Promise<{ data?: T; queued: boolean }> {
  try {
    const data = await apiFetch<T>(path, { method: "POST", body });
    return { data, queued: false };
  } catch (e) {
    if (e instanceof NetworkError) {
      await enfileirar(path, body, foto);
      return { queued: true };
    }
    throw e;
  }
}
