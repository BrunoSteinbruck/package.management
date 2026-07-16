import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
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
}
