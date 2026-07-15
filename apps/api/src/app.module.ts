import { Module, Controller, Get } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PortariaModule } from "./portaria/portaria.module";
import { CadastroModule } from "./cadastro/cadastro.module";

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
