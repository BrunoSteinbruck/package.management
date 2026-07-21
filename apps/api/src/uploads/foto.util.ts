/**
 * Extensão SEMPRE derivada do mimetype declarado — nunca do nome original,
 * que é controlado pelo cliente (path traversal / extensão arbitrária).
 */
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function extPorMime(mimeType: string): string | null {
  return MIME_EXT[mimeType.toLowerCase()] ?? null;
}

export const KEY_FOTO_SEGURA = /^[\w-]+\.(jpg|jpeg|png|webp)$/i;

export interface FotoTokenPayload {
  tipo: "foto";
  key: string;
}
