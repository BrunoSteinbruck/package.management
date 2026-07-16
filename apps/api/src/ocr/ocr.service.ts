import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { JwtPayload } from "@pacotes/shared";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { parsearEtiqueta, sugerirUnidades } from "./etiqueta.parser";
import { criarOcrProvider, OcrProvider } from "./ocr.provider";

const UPLOADS_DIR = join(process.cwd(), "uploads");

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly provider: OcrProvider = criarOcrProvider();

  constructor(private readonly prisma: PrismaService) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  /**
   * Analisa a foto da etiqueta: salva o arquivo (evita segundo upload),
   * extrai texto via provider e sugere unidades do condomínio do operador.
   * Nunca lança por falha de OCR — sem sugestão, o fluxo manual segue.
   */
  async analisarEtiqueta(
    user: JwtPayload,
    arquivo: Buffer,
    mimeType: string,
    nomeOriginal: string,
  ) {
    if (user.tipo !== "usuario" || !user.condominioId) {
      throw new ForbiddenException("Apenas operadores do condomínio");
    }

    const ext = nomeOriginal.includes(".")
      ? nomeOriginal.slice(nomeOriginal.lastIndexOf("."))
      : ".jpg";
    const fotoKey = `${randomUUID()}${ext}`;
    writeFileSync(join(UPLOADS_DIR, fotoKey), arquivo);

    let texto = "";
    try {
      texto = await this.provider.extrairTexto(arquivo, mimeType);
    } catch (e) {
      this.logger.warn(`OCR falhou: ${(e as Error).message}`);
    }

    const extraido = parsearEtiqueta(texto);
    const unidades = await this.prisma.withTenant(user.condominioId, (tx) =>
      tx.unidade.findMany(),
    );
    const sugestoes = sugerirUnidades(extraido, unidades).map((s) => ({
      id: s.unidade.id,
      bloco: s.unidade.bloco,
      identificacao: s.unidade.identificacao,
      score: s.score,
    }));

    return { fotoKey, extraido, sugestoes };
  }
}
