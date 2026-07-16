import { Body, Controller, Ip, Post, UseGuards } from "@nestjs/common";
import {
  JwtPayload,
  RequestOtpDto,
  RequestOtpSchema,
  VerifyOtpDto,
  VerifyOtpSchema,
} from "@pacotes/shared";
import { ZodPipe } from "../common/zod.pipe";
import { AuthGuard, CurrentUser } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("otp/request")
  requestOtp(
    @Body(new ZodPipe(RequestOtpSchema)) body: RequestOtpDto,
    @Ip() ip: string,
  ) {
    return this.auth.requestOtp(body.telefone, ip);
  }

  @Post("refresh")
  @UseGuards(AuthGuard)
  refresh(@CurrentUser() user: JwtPayload) {
    return this.auth.refresh(user);
  }

  @Post("otp/verify")
  verifyOtp(@Body(new ZodPipe(VerifyOtpSchema)) body: VerifyOtpDto) {
    return this.auth.verifyOtp(body.telefone, body.codigo, {
      nome: body.nome,
      convite: body.convite,
    });
  }
}
