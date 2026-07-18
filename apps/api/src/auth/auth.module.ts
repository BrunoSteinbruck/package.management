import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
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
            "JWT_SECRET é obrigatório em produção — a API não sobe sem ele.",
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
  providers: [AuthService, SmsService],
})
export class AuthModule {}
