import { Module } from "@nestjs/common";
import { SmsService } from "../sms/sms.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { PushWorker } from "./push.worker";

@Module({
  providers: [PushWorker, SmsService, WhatsAppService],
})
export class NotificacoesModule {}
