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
  constructor(private readonly portaria: PortariaService) {}

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

  @Get("pendencias")
  pendencias(@CurrentUser() user: JwtPayload) {
    return this.portaria.pendencias(user);
  }
}
