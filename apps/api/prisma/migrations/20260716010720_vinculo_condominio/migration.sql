-- Adiciona condominio_id denormalizado ao vínculo (permite descobrir o tenant
-- a partir da tabela global antes de abrir a transação com RLS).

ALTER TABLE "vinculos" ADD COLUMN "condominio_id" UUID;

-- Backfill a partir das unidades. A migração roda como a role dona das
-- tabelas; suspendemos o FORCE RLS de unidades só durante o backfill.
ALTER TABLE "unidades" NO FORCE ROW LEVEL SECURITY;

UPDATE "vinculos" v
SET "condominio_id" = u."condominio_id"
FROM "unidades" u
WHERE u."id" = v."unidade_id";

ALTER TABLE "unidades" FORCE ROW LEVEL SECURITY;

ALTER TABLE "vinculos" ALTER COLUMN "condominio_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "vinculos_condominio_id_idx" ON "vinculos"("condominio_id");
