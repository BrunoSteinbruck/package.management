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

  /**
   * Morador: a caixa de entrada inteira em uma resposta.
   *
   * `v` é a versão do contrato de feed que o app entende. Ausente significa
   * app anterior ao versionamento (vale 1). Ver `itensParaVersao` no shared:
   * mandar um tipo que a versão instalada não conhece derruba a tela dela.
   */
  @Get("morador/feed")
  meuFeed(@CurrentUser() user: JwtPayload, @Query("v") v?: string) {
    // Piso em 1: versão não existe abaixo disso, então ausente, zero e lixo
    // caem todos no mesmo lugar, que é o app anterior ao versionamento.
    const pedida = Number.parseInt(v ?? "", 10);
    return this.avisos.meuFeed(user, Number.isNaN(pedida) ? 1 : Math.max(1, pedida));
  }

  // Morador (Via 2 reporte + Via 1 recebe)
  @Post("morador/ocorrencias")
  criarOcorrencia(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarOcorrenciaSchema)) dto: CriarOcorrenciaDto,
  ) {
    return this.avisos.criarOcorrencia(user, dto);
  }

  /** @deprecated Substituído por GET morador/feed. Ver AvisosService. */
  @Get("morador/ocorrencias")
  minhasOcorrencias(@CurrentUser() user: JwtPayload) {
    return this.avisos.minhasOcorrencias(user);
  }

  /** @deprecated Substituído por GET morador/feed. Ver AvisosService. */
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
