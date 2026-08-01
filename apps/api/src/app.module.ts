import { Module, Controller, Get } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { SkipThrottle, ThrottlerModule } from "@nestjs/throttler";
import { ChaveDeAlvoGuard } from "./common/throttler.guard";
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
import { ComunicadosModule } from "./comunicados/comunicados.module";
import { DocumentosModule } from "./documentos/documentos.module";
import { VisitasModule } from "./visitas/visitas.module";
import { FinanceiroModule } from "./financeiro/financeiro.module";

/**
 * Fora do limite de propósito: é o endpoint que o Render usa como health check
 * e que um monitor externo pinga sem parar. Contá-lo gastaria o balde do IP do
 * próprio monitoramento e derrubaria o serviço por excesso de vigilância.
 */
@SkipThrottle()
@Controller("health")
class HealthController {
  @Get()
  health() {
    return { status: "ok", ts: new Date().toISOString() };
  }
}

/**
 * Teto de requisições por minuto.
 *
 * Fora de produção o teto é largo porque a suíte E2E faz centenas de chamadas
 * em dois minutos: apertá-lo aqui transformaria o limite numa fonte de teste
 * vermelho intermitente, e ninguém confia num teste que falha sozinho.
 *
 * Em memória por processo, como o contador de OTP. Com mais de uma instância
 * na Render o teto efetivo se multiplica pelo número de processos; mover os
 * dois para Redis é a mesma tarefa, e vale quando houver segunda instância.
 */
const producao = process.env.NODE_ENV === "production";
const TETO_GERAL = producao ? 120 : 3000;

@Module({
  imports: [
    // Sem SENTRY_DSN o SDK não foi inicializado (ver instrument.ts) e este
    // módulo/filtro ficam inertes: não custa nada deixá-los sempre montados.
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: TETO_GERAL }]),
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
    ComunicadosModule,
    DocumentosModule,
    VisitasModule,
    FinanceiroModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ChaveDeAlvoGuard },
  ],
})
export class AppModule {}
