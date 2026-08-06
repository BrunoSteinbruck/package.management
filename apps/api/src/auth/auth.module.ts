import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EmailService } from "../email/email.service";
import { SmsService } from "../sms/sms.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === "production") {
          throw new Error(
            "JWT_SECRET é obrigatório em produção. A API não sobe sem ele.",
          );
        }
        return {
          secret: secret || "dev-secret",
          signOptions: { expiresIn: "30d" },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SmsService, EmailService],
  // Exportado para a conta poder reemitir a sessão de quem acabou de revogar
  // as outras. Assinar continua acontecendo num lugar só.
  exports: [AuthService],
})
export class AuthModule {}
