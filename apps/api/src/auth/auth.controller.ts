import { Body, Controller, Post } from "@nestjs/common";
import {
  RequestOtpDto,
  RequestOtpSchema,
  VerifyOtpDto,
  VerifyOtpSchema,
} from "@pacotes/shared";
import { ZodPipe } from "../common/zod.pipe";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("otp/request")
  requestOtp(@Body(new ZodPipe(RequestOtpSchema)) body: RequestOtpDto) {
    return this.auth.requestOtp(body.telefone);
  }

  @Post("otp/verify")
  verifyOtp(@Body(new ZodPipe(VerifyOtpSchema)) body: VerifyOtpDto) {
    return this.auth.verifyOtp(body.telefone, body.codigo);
  }
}
