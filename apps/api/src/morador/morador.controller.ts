import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CriarVeiculoDto,
  CriarVeiculoSchema,
  EmitirConviteDto,
  EmitirConviteSchema,
  EmitirQrDto,
  EmitirQrSchema,
  JwtPayload,
  RegistrarDeviceDto,
  RegistrarDeviceSchema,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { MoradorService } from "./morador.service";

@Controller("morador")
@UseGuards(AuthGuard)
export class MoradorController {
  constructor(private readonly morador: MoradorService) {}

  @Get("pacotes")
  meusPacotes(@CurrentUser() user: JwtPayload) {
    return this.morador.meusPacotes(user);
  }

  @Get("notificacoes")
  minhasNotificacoes(@CurrentUser() user: JwtPayload) {
    return this.morador.minhasNotificacoes(user);
  }

  @Get("veiculos")
  listarVeiculos(
    @CurrentUser() user: JwtPayload,
    @Query("unidadeId", ParseUUIDPipe) unidadeId: string,
  ) {
    return this.morador.listarVeiculos(user, unidadeId);
  }

  @Post("veiculos")
  criarVeiculo(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarVeiculoSchema)) dto: CriarVeiculoDto,
  ) {
    return this.morador.criarVeiculo(user, dto);
  }

  @Delete("veiculos/:id")
  removerVeiculo(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.morador.removerVeiculo(user, id);
  }

  @Post("devices")
  registrarDevice(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(RegistrarDeviceSchema)) dto: RegistrarDeviceDto,
  ) {
    return this.morador.registrarDevice(user, dto);
  }

  @Post("qr")
  emitirQr(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(EmitirQrSchema)) dto: EmitirQrDto,
  ) {
    return this.morador.emitirQr(user, dto);
  }

  @Post("convites")
  emitirConvite(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(EmitirConviteSchema)) dto: EmitirConviteDto,
  ) {
    return this.morador.emitirConvite(user, dto);
  }

  @Get("unidades/:unidadeId/vinculados")
  vinculados(
    @CurrentUser() user: JwtPayload,
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
  ) {
    return this.morador.vinculadosDaUnidade(user, unidadeId);
  }

  @Get("pacotes/:pacoteId")
  detalhePacote(
    @CurrentUser() user: JwtPayload,
    @Param("pacoteId", ParseUUIDPipe) pacoteId: string,
  ) {
    return this.morador.detalhePacote(user, pacoteId);
  }
}
