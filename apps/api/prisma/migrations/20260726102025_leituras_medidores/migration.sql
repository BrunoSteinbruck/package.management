-- CreateEnum
CREATE TYPE "TipoMedidor" AS ENUM ('AGUA', 'GAS');

-- DropForeignKey
ALTER TABLE "devices" DROP CONSTRAINT "devices_morador_id_fkey";

-- DropForeignKey
ALTER TABLE "devices" DROP CONSTRAINT "devices_usuario_id_fkey";

-- CreateTable
CREATE TABLE "leituras_medidor" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "tipo" "TipoMedidor" NOT NULL,
    "competencia" DATE NOT NULL,
    "valor" DECIMAL(12,3) NOT NULL,
    "foto_key" TEXT,
    "lido_por_id" UUID NOT NULL,
    "lido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leituras_medidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_consumo" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "tipo" "TipoMedidor" NOT NULL,
    "valor_por_m3" DECIMAL(10,2) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarifas_consumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leituras_medidor_condominio_id_competencia_idx" ON "leituras_medidor"("condominio_id", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "leituras_medidor_unidade_id_tipo_competencia_key" ON "leituras_medidor"("unidade_id", "tipo", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_consumo_condominio_id_tipo_key" ON "tarifas_consumo"("condominio_id", "tipo");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_morador_id_fkey" FOREIGN KEY ("morador_id") REFERENCES "moradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leituras_medidor" ADD CONSTRAINT "leituras_medidor_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leituras_medidor" ADD CONSTRAINT "leituras_medidor_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leituras_medidor" ADD CONSTRAINT "leituras_medidor_lido_por_id_fkey" FOREIGN KEY ("lido_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_consumo" ADD CONSTRAINT "tarifas_consumo_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
