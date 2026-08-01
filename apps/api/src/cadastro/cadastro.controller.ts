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
  CriarUsuarioDto,
  CriarUsuarioSchema,
  DefinirEmailDeMembroSchema,
  type DefinirEmailDeMembroDto,
  CriarVagasDto,
  CriarVagasSchema,
  ImportarMoradoresDto,
  ImportarMoradoresSchema,
  JwtPayload,
  SalvarModulosDto,
  SalvarModulosSchema,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { CadastroService } from "./cadastro.service";

@Controller("cadastro")
@UseGuards(AuthGuard)
export class CadastroController {
  constructor(private readonly cadastro: CadastroService) {}

  @Get("modulos")
  listarModulos(@CurrentUser() user: JwtPayload) {
    return this.cadastro.listarModulos(user);
  }

  @Post("modulos")
  salvarModulos(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(SalvarModulosSchema)) dto: SalvarModulosDto,
  ) {
    return this.cadastro.salvarModulos(user, dto);
  }

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

  @Post("moradores/importar")
  importarMoradores(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(ImportarMoradoresSchema)) dto: ImportarMoradoresDto,
  ) {
    return this.cadastro.importarMoradores(user, dto);
  }

  @Get("vagas")
  listarVagas(@CurrentUser() user: JwtPayload) {
    return this.cadastro.listarVagas(user);
  }

  @Post("vagas")
  criarVagas(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarVagasSchema)) dto: CriarVagasDto,
  ) {
    return this.cadastro.criarVagas(user, dto);
  }

  @Get("adocao")
  adocao(@CurrentUser() user: JwtPayload) {
    return this.cadastro.adocao(user);
  }

  @Get("equipe")
  listarEquipe(@CurrentUser() user: JwtPayload) {
    return this.cadastro.listarEquipe(user);
  }

  @Post("equipe")
  criarUsuario(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarUsuarioSchema)) dto: CriarUsuarioDto,
  ) {
    return this.cadastro.criarUsuario(user, dto);
  }

  @Post("equipe/:usuarioId/email")
  definirEmailDeMembro(
    @CurrentUser() user: JwtPayload,
    @Param("usuarioId", ParseUUIDPipe) usuarioId: string,
    @Body(new ZodPipe(DefinirEmailDeMembroSchema)) body: DefinirEmailDeMembroDto,
  ) {
    return this.cadastro.definirEmailDeMembro(user, usuarioId, body.email);
  }

  @Post("equipe/:usuarioId/alternar-ativo")
  alternarAtivoUsuario(
    @CurrentUser() user: JwtPayload,
    @Param("usuarioId", ParseUUIDPipe) usuarioId: string,
  ) {
    return this.cadastro.alternarAtivoUsuario(user, usuarioId);
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
