-- CreateEnum
CREATE TYPE "ViaAviso" AS ENUM ('DIRECIONADO', 'OCORRENCIA');

-- CreateEnum
CREATE TYPE "StatusAviso" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'AVISO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'OCORRENCIA';

-- AlterTable
ALTER TABLE "notificacoes" ADD COLUMN     "aviso_id" UUID;

-- CreateTable
CREATE TABLE "vagas" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "identificacao" TEXT NOT NULL,
    "unidade_id" UUID NOT NULL,

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "placa" TEXT NOT NULL,
    "modelo" TEXT,
    "cor" TEXT,
    "unidade_id" UUID NOT NULL,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "via" "ViaAviso" NOT NULL,
    "unidade_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT,
    "foto_key" TEXT,
    "criado_por_usuario_id" UUID,
    "criado_por_morador_id" UUID,
    "status" "StatusAviso" NOT NULL DEFAULT 'ABERTO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvido_em" TIMESTAMP(3),

    CONSTRAINT "avisos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vagas_condominio_id_idx" ON "vagas"("condominio_id");

-- CreateIndex
CREATE UNIQUE INDEX "vagas_condominio_id_identificacao_key" ON "vagas"("condominio_id", "identificacao");

-- CreateIndex
CREATE INDEX "veiculos_condominio_id_idx" ON "veiculos"("condominio_id");

-- CreateIndex
CREATE UNIQUE INDEX "veiculos_condominio_id_placa_key" ON "veiculos"("condominio_id", "placa");

-- CreateIndex
CREATE INDEX "avisos_condominio_id_via_status_idx" ON "avisos"("condominio_id", "via", "status");

-- CreateIndex
CREATE INDEX "avisos_unidade_id_idx" ON "avisos"("unidade_id");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_aviso_id_fkey" FOREIGN KEY ("aviso_id") REFERENCES "avisos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_criado_por_morador_id_fkey" FOREIGN KEY ("criado_por_morador_id") REFERENCES "moradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
