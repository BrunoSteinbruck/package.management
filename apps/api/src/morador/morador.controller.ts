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
  AlternarPushDto,
  ConvidarMoradorDto,
  AlternarWhatsappDto,
  AlternarPushSchema,
  ConvidarMoradorSchema,
  AlternarWhatsappSchema,
  CriarVeiculoDto,
  CriarVeiculoSchema,
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

  /**
   * @deprecated Substituído por GET morador/feed, junto com morador/avisos e
   * morador/ocorrencias. Segue de pé pelo mesmo motivo das duas irmãs: há app
   * instalado que ainda chama, e elas só saem quando a versão nova estiver
   * nas lojas. Faltava a marca só aqui.
   */
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

  /**
   * Convidar familiar pelo telefone. Cria pedido PENDENTE para o síndico
   * aprovar; substituiu o código de 7 dias, que era transferível.
   */
  @Post("convidar")
  convidarMorador(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(ConvidarMoradorSchema)) dto: ConvidarMoradorDto,
  ) {
    return this.morador.convidarMorador(user, dto);
  }

  /**
   * Preferência de WhatsApp. Consentimento LGPD é ato positivo do titular,
   * então só o próprio morador liga ou desliga, pelo app.
   */
  @Get("preferencias")
  preferencias(@CurrentUser() user: JwtPayload) {
    return this.morador.preferencias(user);
  }

  @Post("preferencias/whatsapp")
  alternarWhatsapp(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(AlternarWhatsappSchema)) dto: AlternarWhatsappDto,
  ) {
    return this.morador.alternarWhatsapp(user, dto.aceita);
  }

  @Post("preferencias/push")
  alternarPush(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(AlternarPushSchema)) dto: AlternarPushDto,
  ) {
    return this.morador.alternarPush(user, dto.aceita);
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
