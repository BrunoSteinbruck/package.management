import { Module, Controller, Get } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PortariaModule } from "./portaria/portaria.module";
import { CadastroModule } from "./cadastro/cadastro.module";
import { UploadsModule } from "./uploads/uploads.module";
import { MoradorModule } from "./morador/morador.module";
import { NotificacoesModule } from "./notificacoes/notificacoes.module";
import { AvisosModule } from "./avisos/avisos.module";
import { ContaModule } from "./conta/conta.module";
import { LeiturasModule } from "./leituras/leituras.module";

@Controller("health")
class HealthController {
  @Get()
  health() {
    return { status: "ok", ts: new Date().toISOString() };
  }
}

@Module({
  imports: [
    // Sem SENTRY_DSN o SDK não foi inicializado (ver instrument.ts) e este
    // módulo/filtro ficam inertes: não custa nada deixá-los sempre montados.
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PortariaModule,
    CadastroModule,
    UploadsModule,
    MoradorModule,
    NotificacoesModule,
    AvisosModule,
    ContaModule,
    LeiturasModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}
