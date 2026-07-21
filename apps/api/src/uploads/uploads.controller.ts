import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@pacotes/shared";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { diskStorage } from "multer";
import { join } from "node:path";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { extPorMime, FotoTokenPayload, KEY_FOTO_SEGURA } from "./foto.util";

// Armazenamento em disco local para desenvolvimento.
// TODO(produção): trocar por R2/S3 com URLs assinadas.
const UPLOADS_DIR = join(process.cwd(), "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

@Controller("uploads")
export class UploadsController {
  constructor(private readonly jwt: JwtService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const ext = extPorMime(file.mimetype);
          if (!ext) return cb(new BadRequestException("Apenas imagens JPEG/PNG/WebP"), "");
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!extPorMime(file.mimetype)) {
          return cb(new BadRequestException("Apenas imagens JPEG/PNG/WebP"), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Só a equipe da portaria fotografa pacotes; morador nunca sobe arquivo.
    if (user.tipo !== "usuario") {
      throw new ForbiddenException("Apenas operadores do condomínio");
    }
    if (!file) throw new BadRequestException("Arquivo ausente (campo 'file')");
    return { key: file.filename };
  }

  /**
   * Serve a foto para os apps. Exige um FOTO-TOKEN dedicado (curto, preso à
   * key, emitido pela API junto do recurso) — nunca o JWT de sessão, que não
   * pode aparecer em URLs (logs, proxies, histórico).
   */
  @Get(":key")
  async servir(
    @Param("key") key: string,
    @Query("t") token: string | undefined,
    @Res() res: Response,
  ) {
    if (!token) throw new UnauthorizedException("Token ausente");
    let payload: FotoTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<FotoTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }
    if (payload.tipo !== "foto" || payload.key !== key) {
      throw new UnauthorizedException("Token não autoriza esta foto");
    }
    if (!KEY_FOTO_SEGURA.test(key)) throw new BadRequestException("Key inválida");
    const caminho = join(UPLOADS_DIR, key);
    if (!existsSync(caminho)) throw new NotFoundException("Foto não encontrada");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(caminho);
  }
}
