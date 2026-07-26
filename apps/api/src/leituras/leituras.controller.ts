import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  ExportLeiturasDto,
  JwtPayload,
  RegistrarLeituraDto,
  SalvarTarifaDto,
} from "@pacotes/shared";
import {
  ExportLeiturasSchema,
  RegistrarLeituraSchema,
  SalvarTarifaSchema,
} from "@pacotes/shared";
import type { Response } from "express";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ExportTokenPayload, LeiturasService } from "./leituras.service";

@Controller("leituras")
export class LeiturasController {
  constructor(
    private readonly leituras: LeiturasService,
    private readonly jwt: JwtService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  registrar(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(RegistrarLeituraSchema)) dto: RegistrarLeituraDto,
  ) {
    return this.leituras.registrar(user, dto);
  }

  @Get("estado")
  @UseGuards(AuthGuard)
  estado(
    @CurrentUser() user: JwtPayload,
    @Query("tipo") tipo?: string,
    @Query("competencia") competencia?: string,
  ) {
    return this.leituras.estado(user, tipo, competencia);
  }

  @Get("consumos")
  @UseGuards(AuthGuard)
  consumos(
    @CurrentUser() user: JwtPayload,
    @Query("tipo") tipo?: string,
    @Query("competencia") competencia?: string,
  ) {
    return this.leituras.consumos(user, tipo, competencia);
  }

  @Get("historico")
  @UseGuards(AuthGuard)
  historico(
    @CurrentUser() user: JwtPayload,
    @Query("tipo") tipo?: string,
    @Query("competencia") competencia?: string,
    @Query("meses") meses?: string,
  ) {
    return this.leituras.historico(user, tipo, competencia, meses);
  }

  @Get("tarifas")
  @UseGuards(AuthGuard)
  tarifas(@CurrentUser() user: JwtPayload) {
    return this.leituras.tarifas(user);
  }

  @Put("tarifas")
  @UseGuards(AuthGuard)
  salvarTarifa(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(SalvarTarifaSchema)) dto: SalvarTarifaDto,
  ) {
    return this.leituras.salvarTarifa(user, dto);
  }

  @Post("export-token")
  @UseGuards(AuthGuard)
  exportToken(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(ExportLeiturasSchema)) dto: ExportLeiturasDto,
  ) {
    return this.leituras.exportToken(user, dto);
  }

  /**
   * Download do relatório. SEM AuthGuard de propósito: o navegador abre a URL
   * direto (window.open / Linking), então a autorização é o EXPORT-TOKEN
   * curto na query, nunca o JWT de sessão (que não pode aparecer em URL).
   */
  @Get("export")
  async baixar(@Query("t") t: string | undefined, @Res() res: Response) {
    if (!t) throw new UnauthorizedException("Token ausente");
    let payload: ExportTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<ExportTokenPayload>(t);
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado");
    }
    // Barra qualquer outro token assinado com o mesmo segredo (foto, sessão).
    if (payload.tipo !== "export") {
      throw new UnauthorizedException("Token não autoriza export");
    }
    const { buffer, filename, mime } = await this.leituras.gerarExport(payload);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
