import { Module, Controller, Get } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PortariaModule } from "./portaria/portaria.module";
import { CadastroModule } from "./cadastro/cadastro.module";
import { UploadsModule } from "./uploads/uploads.module";
import { MoradorModule } from "./morador/morador.module";
import { NotificacoesModule } from "./notificacoes/notificacoes.module";
import { AvisosModule } from "./avisos/avisos.module";

@Controller("health")
class HealthController {
  @Get()
  health() {
    return { status: "ok", ts: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PortariaModule,
    CadastroModule,
    UploadsModule,
    MoradorModule,
    NotificacoesModule,
    AvisosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
