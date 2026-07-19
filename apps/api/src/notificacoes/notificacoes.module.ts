import { Module } from "@nestjs/common";
import { SmsService } from "../sms/sms.service";
import { PushWorker } from "./push.worker";

@Module({
  providers: [PushWorker, SmsService],
})
export class NotificacoesModule {}
