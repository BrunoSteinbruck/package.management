import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  AceitarConciliacaoDto,
  AceitarConciliacaoSchema,
  CriarDespesaDto,
  CriarDespesaSchema,
  GerarCobrancasDto,
  GerarCobrancasSchema,
  IgnorarExtratoItemDto,
  IgnorarExtratoItemSchema,
  ImportarExtratoDto,
  ImportarExtratoSchema,
  JwtPayload,
  SalvarConfigFinanceiroDto,
  SalvarConfigFinanceiroSchema,
  SalvarIntegracaoDto,
  SalvarIntegracaoSchema,
  SalvarTaxasDto,
  SalvarTaxasSchema,
} from "@pacotes/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ConciliacaoService } from "./conciliacao.service";
import { FinanceiroService } from "./financeiro.service";
import { WebhookFinanceiroService } from "./webhook.service";

@Controller()
@UseGuards(AuthGuard)
export class FinanceiroController {
  constructor(
    private readonly financeiro: FinanceiroService,
    private readonly conciliacao: ConciliacaoService,
  ) {}

  // ---------- Conciliação bancária ----------

  @Post("cadastro/financeiro/despesas")
  criarDespesa(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(CriarDespesaSchema)) dto: CriarDespesaDto,
  ) {
    return this.conciliacao.criarDespesa(user, dto);
  }

  @Get("cadastro/financeiro/despesas")
  listarDespesas(@CurrentUser() user: JwtPayload) {
    return this.conciliacao.listarDespesas(user);
  }

  @Delete("cadastro/financeiro/despesas/:id")
  removerDespesa(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.conciliacao.removerDespesa(user, id);
  }

  @Post("cadastro/financeiro/extrato")
  importarExtrato(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(ImportarExtratoSchema)) dto: ImportarExtratoDto,
  ) {
    return this.conciliacao.importarExtrato(user, dto);
  }

  @Get("cadastro/financeiro/conciliacao")
  painelConciliacao(@CurrentUser() user: JwtPayload) {
    return this.conciliacao.painel(user);
  }

  @Post("cadastro/financeiro/conciliacao/aceitar")
  aceitarConciliacao(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(AceitarConciliacaoSchema)) dto: AceitarConciliacaoDto,
  ) {
    return this.conciliacao.aceitar(user, dto);
  }

  @Post("cadastro/financeiro/conciliacao/:id/ignorar")
  ignorarExtratoItem(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(IgnorarExtratoItemSchema)) dto: IgnorarExtratoItemDto,
  ) {
    return this.conciliacao.ignorar(user, id, dto);
  }

  @Post("cadastro/financeiro/conciliacao/:id/desfazer")
  desfazerConciliacao(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.conciliacao.desfazer(user, id);
  }

  @Get("cadastro/financeiro/config")
  config(@CurrentUser() user: JwtPayload) {
    return this.financeiro.config(user);
  }

  @Post("cadastro/financeiro/config")
  salvarConfig(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(SalvarConfigFinanceiroSchema))
    dto: SalvarConfigFinanceiroDto,
  ) {
    return this.financeiro.salvarConfig(user, dto);
  }

  /** Devolve o segredo do webhook uma única vez; a apiKey nunca volta. */
  @Post("cadastro/financeiro/integracao")
  salvarIntegracao(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(SalvarIntegracaoSchema)) dto: SalvarIntegracaoDto,
  ) {
    return this.financeiro.salvarIntegracao(user, dto);
  }

  @Get("cadastro/financeiro/taxas")
  taxas(@CurrentUser() user: JwtPayload) {
    return this.financeiro.taxas(user);
  }

  @Post("cadastro/financeiro/taxas")
  salvarTaxas(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(SalvarTaxasSchema)) dto: SalvarTaxasDto,
  ) {
    return this.financeiro.salvarTaxas(user, dto);
  }

  @Post("cadastro/financeiro/gerar")
  gerar(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(GerarCobrancasSchema)) dto: GerarCobrancasDto,
  ) {
    return this.financeiro.gerar(user, dto);
  }

  @Get("cadastro/financeiro/cobrancas")
  cobrancas(
    @CurrentUser() user: JwtPayload,
    @Query("competencia") competencia?: string,
  ) {
    return this.financeiro.doGestor(user, competencia);
  }

  @Get("cadastro/financeiro/resumo")
  resumo(
    @CurrentUser() user: JwtPayload,
    @Query("competencia") competencia?: string,
  ) {
    return this.financeiro.resumo(user, competencia);
  }

  /** Segunda via no app do morador. */
  @Get("morador/cobrancas")
  minhas(@CurrentUser() user: JwtPayload) {
    return this.financeiro.doMorador(user);
  }
}

/**
 * Webhook do provedor: PÚBLICO de propósito, sem AuthGuard.
 *
 * Quem chama é o Asaas, que não tem sessão. A autenticação é o token no
 * header, conferido contra o segredo da integração do condomínio. Fica em
 * controller separado justamente para o `@UseGuards` do outro não valer aqui
 * por descuido, e para a exceção ficar visível em vez de escondida.
 */
@Controller("webhooks")
export class WebhookFinanceiroController {
  constructor(private readonly webhook: WebhookFinanceiroService) {}

  @Post("asaas")
  asaas(
    @Headers("asaas-access-token") token: string | undefined,
    @Body() corpo: Record<string, unknown>,
  ) {
    return this.webhook.receber(token, corpo);
  }
}
