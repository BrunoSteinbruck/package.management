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
  CriarComunicadoDto,
  CriarComunicadoSchema,
  JwtPayload,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ComunicadosService } from "./comunicados.service";

/**
 * Um controller, prefixos por perfil: mesmo desenho de `AvisosController`.
 * O que separa gestor de morador é o serviço, não a rota.
 */
@Controller()
@UseGuards(AuthGuard)
export class ComunicadosController {
  constructor(private readonly comunicados: ComunicadosService) {}

  @Post("cadastro/comunicados")
  criar(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarComunicadoSchema)) dto: CriarComunicadoDto,
  ) {
    return this.comunicados.criar(user, dto);
  }

  @Get("cadastro/comunicados")
  listar(@CurrentUser() user: JwtPayload) {
    return this.comunicados.listarGestor(user);
  }

  @Get("cadastro/comunicados/:id/leituras")
  leituras(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.comunicados.leituras(user, id);
  }

  /** Abrir é ler: o recibo de leitura é gravado aqui. */
  @Get("morador/comunicados/:id")
  detalhe(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.comunicados.detalhe(user, id);
  }
}
