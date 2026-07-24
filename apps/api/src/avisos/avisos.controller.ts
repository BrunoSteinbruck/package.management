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
import {
  CriarAvisoDto,
  CriarAvisoSchema,
  CriarOcorrenciaDto,
  CriarOcorrenciaSchema,
  IdentificarAlvoDto,
  IdentificarAlvoSchema,
  JwtPayload,
  MudarStatusAvisoDto,
  MudarStatusAvisoSchema,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { AvisosService } from "./avisos.service";

@Controller()
@UseGuards(AuthGuard)
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  // Equipe (Via 1)
  @Post("portaria/identificar-alvo")
  identificarAlvo(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(IdentificarAlvoSchema)) dto: IdentificarAlvoDto,
  ) {
    return this.avisos.identificarAlvo(user, dto.texto);
  }

  @Post("portaria/avisos")
  criarAviso(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarAvisoSchema)) dto: CriarAvisoDto,
  ) {
    return this.avisos.criarAviso(user, dto);
  }

  @Get("portaria/avisos")
  listarAvisosEquipe(@CurrentUser() user: JwtPayload, @Query("status") status?: string) {
    return this.avisos.listarAvisosEquipe(user, status);
  }

  // Gestor (Via 2)
  @Get("cadastro/ocorrencias")
  listarOcorrencias(@CurrentUser() user: JwtPayload, @Query("status") status?: string) {
    return this.avisos.listarOcorrenciasGestor(user, status);
  }

  @Post("cadastro/ocorrencias/:id/status")
  mudarStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(MudarStatusAvisoSchema)) dto: MudarStatusAvisoDto,
  ) {
    return this.avisos.mudarStatus(user, id, dto.status);
  }

  // Morador (Via 2 reporte + Via 1 recebe)
  @Post("morador/ocorrencias")
  criarOcorrencia(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarOcorrenciaSchema)) dto: CriarOcorrenciaDto,
  ) {
    return this.avisos.criarOcorrencia(user, dto);
  }

  @Get("morador/ocorrencias")
  minhasOcorrencias(@CurrentUser() user: JwtPayload) {
    return this.avisos.minhasOcorrencias(user);
  }

  @Get("morador/avisos")
  meusAvisos(@CurrentUser() user: JwtPayload) {
    return this.avisos.meusAvisos(user);
  }

  @Post("morador/avisos/:id/resolver")
  resolverAviso(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.avisos.resolverAviso(user, id);
  }
}
