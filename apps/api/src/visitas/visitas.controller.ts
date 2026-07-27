import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CriarVisitaDto, CriarVisitaSchema, JwtPayload } from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { VisitasService } from "./visitas.service";

@Controller()
@UseGuards(AuthGuard)
export class VisitasController {
  constructor(private readonly visitas: VisitasService) {}

  // Morador: autoriza e cancela.
  @Post("morador/visitas")
  criar(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarVisitaSchema)) dto: CriarVisitaDto,
  ) {
    return this.visitas.criar(user, dto);
  }

  @Get("morador/visitas")
  minhas(@CurrentUser() user: JwtPayload) {
    return this.visitas.minhas(user);
  }

  @Post("morador/visitas/:id/cancelar")
  cancelar(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.visitas.cancelar(user, id);
  }

  // Portaria: confere quem chega.
  @Get("portaria/visitas-hoje")
  doDia(@CurrentUser() user: JwtPayload) {
    return this.visitas.doDia(user);
  }

  @Post("portaria/visitas/:id/chegada")
  chegada(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.visitas.registrarChegada(user, id);
  }

  // Gestor: histórico (a equipe inteira enxerga, como em pacotes).
  @Get("cadastro/visitas")
  historico(
    @CurrentUser() user: JwtPayload,
    @Query("unidadeId") unidadeId?: string,
  ) {
    return this.visitas.historico(user, unidadeId);
  }
}
