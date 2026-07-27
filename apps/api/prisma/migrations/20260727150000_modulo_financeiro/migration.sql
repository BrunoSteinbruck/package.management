-- Onda 3: cobranca da taxa condominial (boleto/PIX, regua, inadimplencia).
-- Aditiva: tabelas novas, coluna nullable e valores novos de enum.

ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'COBRANCA_GERADA';
ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'COBRANCA_LEMBRETE';
ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'COBRANCA_VENCIDA';
ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'COBRANCA_PAGA';

CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PAGA', 'VENCIDA', 'CANCELADA');

CREATE TABLE "integracoes_financeiras" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'asaas',
    "conta_externa_id" TEXT NOT NULL,
    "api_key_cifrada" TEXT NOT NULL,
    "webhook_segredo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integracoes_financeiras_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integracoes_financeiras_condominio_id_key"
  ON "integracoes_financeiras"("condominio_id");
ALTER TABLE "integracoes_financeiras" ADD CONSTRAINT "integracoes_financeiras_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "config_financeiro" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "dia_vencimento" INTEGER NOT NULL DEFAULT 10,
    "geracao_automatica" BOOLEAN NOT NULL DEFAULT false,
    "regua_ativa" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "config_financeiro_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "config_financeiro_condominio_id_key"
  ON "config_financeiro"("condominio_id");
ALTER TABLE "config_financeiro" ADD CONSTRAINT "config_financeiro_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "taxas_unidade" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "valor_mensal" DECIMAL(12,2) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "taxas_unidade_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "taxas_unidade_unidade_id_key" ON "taxas_unidade"("unidade_id");
CREATE INDEX "taxas_unidade_condominio_id_idx" ON "taxas_unidade"("condominio_id");
ALTER TABLE "taxas_unidade" ADD CONSTRAINT "taxas_unidade_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "taxas_unidade" ADD CONSTRAINT "taxas_unidade_unidade_id_fkey"
  FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cobrancas" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "competencia" DATE NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "provedor_cobranca_id" TEXT,
    "linha_digitavel" TEXT,
    "url_boleto" TEXT,
    "pix_copia_cola" TEXT,
    "pago_em" TIMESTAMP(3),
    "valor_pago" DECIMAL(12,2),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- A trava que impede cobrar a mesma unidade duas vezes pelo mesmo mes.
CREATE UNIQUE INDEX "cobrancas_unidade_id_competencia_key"
  ON "cobrancas"("unidade_id", "competencia");
CREATE INDEX "cobrancas_condominio_id_status_idx" ON "cobrancas"("condominio_id", "status");
CREATE INDEX "cobrancas_condominio_id_competencia_idx" ON "cobrancas"("condominio_id", "competencia");

ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_unidade_id_fkey"
  FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sem condominio_id: o webhook chega ANTES de sabermos o tenant, e e
-- justamente pelo payload que ele e descoberto. Isolamento e da API.
CREATE TABLE "eventos_webhook_financeiro" (
    "id" UUID NOT NULL,
    "evento_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processado_em" TIMESTAMP(3),
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventos_webhook_financeiro_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "eventos_webhook_financeiro_evento_id_key"
  ON "eventos_webhook_financeiro"("evento_id");

ALTER TABLE "notificacoes" ADD COLUMN "cobranca_id" UUID;
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_cobranca_id_fkey"
  FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
