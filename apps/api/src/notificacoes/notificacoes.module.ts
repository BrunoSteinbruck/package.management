import { Module } from "@nestjs/common";
import { FinanceiroModule } from "../financeiro/financeiro.module";
import { SmsService } from "../sms/sms.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { PushWorker } from "./push.worker";

@Module({
  // O worker gera as cobranças de quem ligou a geração automática. Não há
  // ciclo: o financeiro não conhece o módulo de notificações, ele enfileira
  // Notificacao direto pelo Prisma.
  imports: [FinanceiroModule],
  providers: [PushWorker, SmsService, WhatsAppService],
})
export class NotificacoesModule {}
