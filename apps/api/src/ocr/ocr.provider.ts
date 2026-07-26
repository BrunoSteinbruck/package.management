export interface OcrProvider {
  extrairTexto(arquivo: Buffer, mimeType: string): Promise<string>;
}

/**
 * Provider de desenvolvimento: arquivos text/* são lidos como o "texto da
 * etiqueta": permite testar o parser e o match sem OCR real nem credencial.
 * Imagens retornam vazio (sem sugestão, fluxo manual segue normal).
 */
export class StubOcrProvider implements OcrProvider {
  async extrairTexto(arquivo: Buffer, mimeType: string): Promise<string> {
    if (mimeType.startsWith("text/")) return arquivo.toString("utf8");
    return "";
  }
}

export class GoogleVisionProvider implements OcrProvider {
  constructor(private readonly apiKey: string) {}

  async extrairTexto(arquivo: Buffer): Promise<string> {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: arquivo.toString("base64") },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }),
      },
    );
    if (!res.ok) throw new Error(`Google Vision: HTTP ${res.status}`);
    const json = (await res.json()) as {
      responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
    };
    return json.responses?.[0]?.fullTextAnnotation?.text ?? "";
  }
}

export function criarOcrProvider(): OcrProvider {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  return apiKey ? new GoogleVisionProvider(apiKey) : new StubOcrProvider();
}
