export interface EtiquetaExtraida {
  rastreio?: string;
  transportadora?: string;
  bloco?: string;
  identificacao?: string;
}

const TRANSPORTADORAS: Array<[string, string]> = [
  ["mercado livre", "Mercado Livre"],
  ["mercadolivre", "Mercado Livre"],
  ["amazon", "Amazon"],
  ["shopee", "Shopee"],
  ["correios", "Correios"],
  ["sedex", "Correios"],
  ["jadlog", "Jadlog"],
  ["loggi", "Loggi"],
  ["total express", "Total Express"],
  ["magazine luiza", "Magalu"],
  ["magalu", "Magalu"],
];

export function parsearEtiqueta(texto: string): EtiquetaExtraida {
  const out: EtiquetaExtraida = {};
  const lower = texto.toLowerCase();

  for (const [chave, nome] of TRANSPORTADORAS) {
    if (lower.includes(chave)) {
      out.transportadora = nome;
      break;
    }
  }

  // Padrão Correios (AA123456789BR) ou código alfanumérico longo com dígitos.
  const rastreio =
    texto.match(/\b[A-Z]{2}\d{9}[A-Z]{2}\b/)?.[0] ??
    texto.match(/\b(?=[A-Z0-9]*\d)[A-Z0-9]{10,20}\b/)?.[0];
  if (rastreio) out.rastreio = rastreio;

  const apto = texto.match(/(?:ap(?:to|t)?\.?\s*|apartamento\s*|unidade\s*)(\d{1,4})/i);
  if (apto) out.identificacao = apto[1];

  const bloco = texto.match(/(?:bl(?:oco)?\.?\s*|torre\s*)([a-z0-9]{1,3})\b/i);
  if (bloco) out.bloco = bloco[1];

  // Formato compacto "302-B" ou "302/B" quando não achou pelos rótulos.
  if (!out.identificacao) {
    const compacto = texto.match(/\b(\d{2,4})\s*[-\/]\s*([a-z])\b/i);
    if (compacto) {
      out.identificacao = compacto[1];
      out.bloco = out.bloco ?? compacto[2];
    }
  }

  return out;
}

export interface UnidadeCandidata {
  id: string;
  bloco: string | null;
  identificacao: string;
}

export function sugerirUnidades(
  extraido: EtiquetaExtraida,
  unidades: UnidadeCandidata[],
): Array<{ unidade: UnidadeCandidata; score: number }> {
  if (!extraido.identificacao) return [];
  const alvoIdent = extraido.identificacao.toUpperCase();
  const alvoBloco = extraido.bloco?.toUpperCase();

  const candidatas = unidades
    .filter((u) => u.identificacao.toUpperCase() === alvoIdent)
    .map((unidade) => {
      const blocoUnidade = (unidade.bloco ?? "").toUpperCase();
      let score = 0.7;
      if (alvoBloco) score = blocoUnidade === alvoBloco ? 1.0 : 0.4;
      return { unidade, score };
    });

  return candidatas.sort((a, b) => b.score - a.score).slice(0, 3);
}
