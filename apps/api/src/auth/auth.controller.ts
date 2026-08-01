import { Body, Controller, Ip, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
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

/**
 * Teto apertado nas portas de credencial.
 *
 * O balde geral de 120/min é folgado demais para adivinhação: com ele, um
 * atacante tenta 120 senhas por minuto. Aqui a chave do balde inclui o alvo
 * (ver ChaveDeAlvoGuard), então o limite conta por par IP+conta: quem tenta
 * derrubar um síndico específico gasta o próprio teto antes de conseguir
 * manter o bloqueio de 15 minutos dele de pé.
 *
 * Fora de produção o teto é largo pela mesma razão do balde geral: a suíte
 * E2E exercita estas rotas dezenas de vezes seguidas.
 */
const TETO_CREDENCIAL = process.env.NODE_ENV === "production" ? 10 : 500;

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: TETO_CREDENCIAL } })
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

  @Throttle({ default: { ttl: 60_000, limit: TETO_CREDENCIAL } })
  @Post("otp/verify")
  verifyOtp(@Body(new ZodPipe(VerifyOtpSchema)) body: VerifyOtpDto) {
    return this.auth.verifyOtp(body.telefone, body.codigo, {
      nome: body.nome,
      convite: body.convite,
      somenteEquipe: body.somenteEquipe,
    });
  }

  // ---------- senha do painel ----------

  @Throttle({ default: { ttl: 60_000, limit: TETO_CREDENCIAL } })
  @Post("senha/login")
  loginComSenha(@Body(new ZodPipe(LoginSenhaSchema)) body: LoginSenhaDto) {
    return this.auth.loginComSenha(body.identificador, body.senha);
  }

  @Throttle({ default: { ttl: 60_000, limit: TETO_CREDENCIAL } })
  @Post("senha/esqueci")
  esqueciSenha(
    @Body(new ZodPipe(EsqueciSenhaSchema)) body: EsqueciSenhaDto,
    @Ip() ip: string,
  ) {
    return this.auth.esqueciSenha(body.email, ip);
  }

  @Throttle({ default: { ttl: 60_000, limit: TETO_CREDENCIAL } })
  @Post("senha/redefinir")
  redefinirSenha(
    @Body(new ZodPipe(RedefinirSenhaSchema)) body: RedefinirSenhaDto,
  ) {
    return this.auth.redefinirSenha(body.token, body.novaSenha);
  }
}
