/**
 * OCR no aparelho via ML Kit (Google, gratuito, offline).
 * Módulo NATIVO: existe só em development/production build, no Expo Go o
 * require falha e caímos no fluxo de servidor. Por isso o require defensivo.
 */
interface ModuloTextRecognition {
  recognize(uri: string): Promise<{ text?: string } | null>;
}

let TextRecognition: ModuloTextRecognition | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TextRecognition = require("@react-native-ml-kit/text-recognition").default;
} catch {
  TextRecognition = null;
}

export const ocrLocalDisponivel = TextRecognition !== null;

export async function lerTextoLocal(uri: string): Promise<string> {
  if (!TextRecognition) return "";
  try {
    const resultado = await TextRecognition.recognize(uri);
    return resultado?.text ?? "";
  } catch {
    return "";
  }
}
