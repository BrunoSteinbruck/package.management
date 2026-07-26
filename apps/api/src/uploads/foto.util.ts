/**
 * Extensão SEMPRE derivada do mimetype declarado: nunca do nome original,
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

/**
 * Caminho inverso, para servir a foto com o Content-Type certo quando o
 * backend de armazenamento não guarda o tipo (disco local). Sem isto o
 * navegador do painel recebe application/octet-stream e pode não renderizar.
 */
export function mimePorKey(key: string): string | undefined {
  const ponto = key.lastIndexOf(".");
  if (ponto < 0) return undefined;
  const ext = key.slice(ponto).toLowerCase();
  return Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0];
}

export const KEY_FOTO_SEGURA = /^[\w-]+\.(jpg|jpeg|png|webp)$/i;

export interface FotoTokenPayload {
  tipo: "foto";
  key: string;
}
