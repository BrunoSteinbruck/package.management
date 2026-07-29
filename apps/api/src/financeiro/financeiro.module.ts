import { Module } from "@nestjs/common";
import { CobrancaProviderService } from "./cobranca.provider";
import { ConciliacaoService } from "./conciliacao.service";
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
    ConciliacaoService,
    WebhookFinanceiroService,
    CobrancaProviderService,
  ],
  exports: [FinanceiroService],
})
export class FinanceiroModule {}
