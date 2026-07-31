import { Body, Controller, Ip, Post, UseGuards } from "@nestjs/common";
import {
  EsqueciSenhaDto,
  EsqueciSenhaSchema,
  JwtPayload,
  LoginSenhaDto,
  LoginSenhaSchema,
  RedefinirSenhaDto,
  RedefinirSenhaSchema,
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
      somenteEquipe: body.somenteEquipe,
    });
  }

  // ---------- senha do painel ----------

  @Post("senha/login")
  loginComSenha(@Body(new ZodPipe(LoginSenhaSchema)) body: LoginSenhaDto) {
    return this.auth.loginComSenha(body.identificador, body.senha);
  }

  @Post("senha/esqueci")
  esqueciSenha(
    @Body(new ZodPipe(EsqueciSenhaSchema)) body: EsqueciSenhaDto,
    @Ip() ip: string,
  ) {
    return this.auth.esqueciSenha(body.email, ip);
  }

  @Post("senha/redefinir")
  redefinirSenha(
    @Body(new ZodPipe(RedefinirSenhaSchema)) body: RedefinirSenhaDto,
  ) {
    return this.auth.redefinirSenha(body.token, body.novaSenha);
  }
}
