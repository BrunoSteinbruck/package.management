import { Module } from "@nestjs/common";
import { CobrancaProviderService } from "./cobranca.provider";
import {
  FinanceiroController,
  WebhookFinanceiroController,
} from "./financeiro.controller";
import { FinanceiroService } from "./financeiro.service";
import { WebhookFinanceiroService } from "./webhook.service";

@Module({
  controllers: [FinanceiroController, WebhookFinanceiroController],
  providers: [
    FinanceiroService,
    WebhookFinanceiroService,
    CobrancaProviderService,
  ],
  exports: [FinanceiroService],
})
export class FinanceiroModule {}
