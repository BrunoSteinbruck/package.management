import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContaController } from "./conta.controller";
import { ContaService } from "./conta.service";

@Module({
  // Para reemitir a sessão de quem trocou a senha ou saiu dos outros
  // aparelhos. Não há ciclo: o auth não conhece a conta.
  imports: [AuthModule],
  controllers: [ContaController],
  providers: [ContaService],
})
export class ContaModule {}
