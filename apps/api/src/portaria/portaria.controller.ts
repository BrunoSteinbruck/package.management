import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { OcrService } from "../ocr/ocr.service";
import {
  JwtPayload,
  RegistrarPacoteDto,
  RegistrarPacoteSchema,
  RegistrarRetiradaDto,
  RegistrarRetiradaSchema,
  ResolverQrDto,
  ResolverQrSchema,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { PortariaService } from "./portaria.service";

@Controller("portaria")
@UseGuards(AuthGuard)
export class PortariaController {
  constructor(
    private readonly portaria: PortariaService,
    private readonly ocr: OcrService,
  ) {}

  @Post("ocr")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  analisarEtiqueta(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Arquivo ausente (campo 'file')");
    return this.ocr.analisarEtiqueta(
      user,
      file.buffer,
      file.mimetype,
      file.originalname ?? "foto.jpg",
    );
  }

  @Post("pacotes")
  registrarEntrada(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(RegistrarPacoteSchema)) dto: RegistrarPacoteDto,
  ) {
    return this.portaria.registrarEntrada(user, dto);
  }

  @Get("unidades/:unidadeId/pendentes")
  pendentesDaUnidade(
    @CurrentUser() user: JwtPayload,
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
  ) {
    return this.portaria.pendentesDaUnidade(user, unidadeId);
  }

  @Post("retiradas")
  registrarRetirada(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(RegistrarRetiradaSchema)) dto: RegistrarRetiradaDto,
  ) {
    return this.portaria.registrarRetirada(user, dto);
  }

  @Post("qr-resolve")
  resolverQr(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(ResolverQrSchema)) dto: ResolverQrDto,
  ) {
    return this.portaria.resolverQr(user, dto);
  }

  @Get("resumo")
  resumo(@CurrentUser() user: JwtPayload) {
    return this.portaria.resumo(user);
  }

  @Get("pendencias")
  pendencias(@CurrentUser() user: JwtPayload) {
    return this.portaria.pendencias(user);
  }
}
