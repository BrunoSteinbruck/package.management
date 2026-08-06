-- AlterTable
ALTER TABLE "moradores" ADD COLUMN     "sessoes_validas_apos" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "sessoes_validas_apos" TIMESTAMP(3);
