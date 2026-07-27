import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
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
import { memoryStorage } from "multer";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import {
  ArquivoTokenPayload,
  extPorMime,
  keyCombinaComTipo,
  mimePorKey,
} from "./foto.util";
import { StorageService } from "./storage.service";

@Controller("uploads")
export class UploadsController {
  constructor(
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    // Memória, não disco: o destino final pode ser o R2, e o limite de 10 MB
    // por arquivo (1 por request) mantém o custo previsível.
    FileInterceptor("file", {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!extPorMime(file.mimetype)) {
          return cb(new BadRequestException("Apenas imagens JPEG/PNG/WebP"), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Equipe (fotos de pacote/aviso) e morador (fotos de ocorrência) sobem
    // arquivo; qualquer outro tipo de token é barrado.
    if (user.tipo !== "usuario" && user.tipo !== "morador") {
      throw new ForbiddenException("Sessão inválida para upload");
    }
    if (!file) throw new BadRequestException("Arquivo ausente (campo 'file')");
    // Nome SEMPRE derivado do mimetype validado: nunca do nome original,
    // que é controlado pelo cliente.
    const ext = extPorMime(file.mimetype);
    if (!ext) throw new BadRequestException("Apenas imagens JPEG/PNG/WebP");
    const key = `${randomUUID()}${ext}`;
    await this.storage.salvar(key, file.buffer, file.mimetype);
    return { key };
  }

  /**
   * Documento do condomínio (ata, regimento, convenção): só PDF, só gestor,
   * até 20 MB. Separado do upload de foto porque as restrições são outras e
   * misturá-las abriria PDF para quem só pode mandar imagem.
   */
  @Post("documento")
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.toLowerCase() !== "application/pdf") {
          return cb(new BadRequestException("Apenas PDF"), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadDocumento(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (
      user.tipo !== "usuario" ||
      (user.papel !== "SINDICO" && user.papel !== "ADMIN")
    ) {
      throw new ForbiddenException("Apenas síndico ou admin");
    }
    if (!file) throw new BadRequestException("Arquivo ausente (campo 'file')");
    // Assinatura do PDF ("%PDF-") conferida no conteúdo: o mimetype vem do
    // cliente, e sem isso qualquer coisa renomeada passaria pelo filtro.
    if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new BadRequestException("Arquivo não é um PDF");
    }
    const key = `${randomUUID()}.pdf`;
    await this.storage.salvar(key, file.buffer, "application/pdf");
    return { key, tamanhoBytes: file.size };
  }

  /**
   * Serve foto e documento para os apps. Exige um token dedicado (curto,
   * preso à key, emitido pela API junto do recurso): nunca o JWT de sessão,
   * que não pode aparecer em URLs (logs, proxies, histórico).
   */
  @Get(":key")
  async servir(
    @Param("key") key: string,
    @Query("t") token: string | undefined,
    @Res() res: Response,
  ) {
    if (!token) throw new UnauthorizedException("Token ausente");
    let payload: ArquivoTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<ArquivoTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }
    if (
      (payload.tipo !== "foto" && payload.tipo !== "documento") ||
      payload.key !== key
    ) {
      throw new UnauthorizedException("Token não autoriza este arquivo");
    }
    if (!keyCombinaComTipo(payload.tipo, key)) {
      throw new BadRequestException("Key inválida");
    }
    const { corpo, mimetype } = await this.storage.ler(key);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (payload.tipo === "documento") {
      res.setHeader("Content-Type", "application/pdf");
      // inline: o morador abre a ata no visualizador, não baixa um arquivo
      // solto para procurar depois.
      res.setHeader("Content-Disposition", "inline");
    } else {
      res.setHeader("Content-Type", mimetype ?? mimePorKey(key) ?? "image/jpeg");
    }
    res.send(corpo);
  }
}
