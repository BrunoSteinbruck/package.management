/**
 * Testa o pipeline de OCR com uma imagem local, sem subir a API:
 * provider (Vision se GOOGLE_VISION_API_KEY estiver no ambiente; senão stub)
 * → parser da etiqueta → campos extraídos.
 *
 * Uso:
 *   GOOGLE_VISION_API_KEY=... pnpm --filter @pacotes/api exec ts-node \
 *     scripts/testar-ocr.ts /caminho/da/foto.jpg
 */
import { readFileSync } from "node:fs";
import { criarOcrProvider } from "../src/ocr/ocr.provider";
import { parsearEtiqueta } from "../src/ocr/etiqueta.parser";

async function main() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("Uso: ts-node scripts/testar-ocr.ts /caminho/da/foto.jpg");
    process.exit(1);
  }
  const arquivo = readFileSync(caminho);
  const mime = caminho.endsWith(".png")
    ? "image/png"
    : caminho.endsWith(".txt")
      ? "text/plain"
      : "image/jpeg";

  const provider = criarOcrProvider();
  console.log(
    `Provider: ${process.env.GOOGLE_VISION_API_KEY ? "Google Vision" : "stub (sem chave)"}`,
  );
  const inicio = Date.now();
  const texto = await provider.extrairTexto(arquivo, mime);
  console.log(`Tempo: ${Date.now() - inicio}ms · ${texto.length} caracteres lidos`);
  if (texto) {
    console.log("--- primeiras linhas do texto ---");
    console.log(texto.split("\n").slice(0, 8).join("\n"));
  }
  console.log("--- campos extraídos ---");
  console.log(parsearEtiqueta(texto));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
