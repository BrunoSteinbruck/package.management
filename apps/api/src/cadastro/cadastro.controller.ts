import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CriarUnidadesDto,
  CriarUnidadesSchema,
  JwtPayload,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { CadastroService } from "./cadastro.service";

@Controller("cadastro")
@UseGuards(AuthGuard)
export class CadastroController {
  constructor(private readonly cadastro: CadastroService) {}

  @Get("unidades")
  listarUnidades(@CurrentUser() user: JwtPayload) {
    return this.cadastro.listarUnidades(user);
  }

  @Post("unidades")
  criarUnidades(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarUnidadesSchema)) dto: CriarUnidadesDto,
  ) {
    return this.cadastro.criarUnidades(user, dto);
  }

  @Get("vinculos/pendentes")
  vinculosPendentes(@CurrentUser() user: JwtPayload) {
    return this.cadastro.vinculosPendentes(user);
  }

  @Post("vinculos/:vinculoId/aprovar")
  aprovarVinculo(
    @CurrentUser() user: JwtPayload,
    @Param("vinculoId", ParseUUIDPipe) vinculoId: string,
  ) {
    return this.cadastro.aprovarVinculo(user, vinculoId);
  }
}
