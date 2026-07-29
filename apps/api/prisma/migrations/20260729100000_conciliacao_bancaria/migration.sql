-- Conciliação bancária: despesas (o que se espera ver sair) e itens do
-- extrato importado (o que de fato entrou e saiu). O par conciliado é a
-- prestação de contas. Tudo aditivo.

CREATE TABLE "despesas" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" DATE NOT NULL,
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "despesas_condominio_id_data_idx" ON "despesas"("condominio_id", "data");
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_criado_por_usuario_id_fkey"
  FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "extrato_itens" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "fitid" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT NOT NULL,
    "cobranca_id" UUID,
    "despesa_id" UUID,
    "conciliado_em" TIMESTAMP(3),
    "conciliado_obs" TEXT,
    "ignorado_em" TIMESTAMP(3),
    "ignorado_obs" TEXT,
    "importado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "extrato_itens_pkey" PRIMARY KEY ("id")
);
-- FITID é o id da transação no banco: reimportar o mesmo OFX não duplica.
CREATE UNIQUE INDEX "extrato_itens_condominio_id_fitid_key" ON "extrato_itens"("condominio_id", "fitid");
CREATE INDEX "extrato_itens_condominio_id_data_idx" ON "extrato_itens"("condominio_id", "data");
ALTER TABLE "extrato_itens" ADD CONSTRAINT "extrato_itens_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "extrato_itens" ADD CONSTRAINT "extrato_itens_cobranca_id_fkey"
  FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "extrato_itens" ADD CONSTRAINT "extrato_itens_despesa_id_fkey"
  FOREIGN KEY ("despesa_id") REFERENCES "despesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
