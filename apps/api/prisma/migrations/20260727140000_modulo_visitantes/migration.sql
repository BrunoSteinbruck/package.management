-- Onda 2: visitas pré-autorizadas pelo morador, conferidas pela portaria.
-- Aditiva: tabela nova, coluna nullable e valor novo de enum.

ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'VISITA_CHEGOU';

CREATE TYPE "StatusVisita" AS ENUM ('AUTORIZADA', 'CHEGOU', 'CANCELADA');

CREATE TABLE "visitas" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "morador_id" UUID NOT NULL,
    "nome_visitante" TEXT NOT NULL,
    "documento" TEXT,
    "data_prevista" DATE NOT NULL,
    "janela_inicio" TEXT,
    "janela_fim" TEXT,
    "status" "StatusVisita" NOT NULL DEFAULT 'AUTORIZADA',
    "chegada_em" TIMESTAMP(3),
    "baixa_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

-- A consulta quente é "quem chega hoje": filtra por dia e status.
CREATE INDEX "visitas_condominio_id_data_prevista_status_idx"
  ON "visitas"("condominio_id", "data_prevista", "status");
CREATE INDEX "visitas_unidade_id_idx" ON "visitas"("unidade_id");

ALTER TABLE "visitas" ADD CONSTRAINT "visitas_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_unidade_id_fkey"
  FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_morador_id_fkey"
  FOREIGN KEY ("morador_id") REFERENCES "moradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_baixa_por_id_fkey"
  FOREIGN KEY ("baixa_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notificacoes" ADD COLUMN "visita_id" UUID;
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_visita_id_fkey"
  FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
