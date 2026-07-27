-- Onda 1: comunicados (broadcast do síndico com recibo de leitura) e
-- documentos (ata, regimento, convenção no app do morador).
--
-- Tudo aditivo: tabela nova, coluna nullable e valor novo de enum. Produção
-- roda `migrate deploy` com app publicado nas lojas, então nada aqui pode
-- renomear ou remover o que a versão instalada já usa.

-- Valor novo no enum de notificação. ADD VALUE é aditivo e seguro.
ALTER TYPE "TipoNotificacao" ADD VALUE IF NOT EXISTS 'COMUNICADO';

CREATE TYPE "CategoriaDocumento" AS ENUM ('ATA', 'REGIMENTO', 'CONVENCAO', 'OUTRO');

CREATE TABLE "comunicados" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "blocos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comunicados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comunicados_condominio_id_criado_em_idx" ON "comunicados"("condominio_id", "criado_em");

ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_criado_por_usuario_id_fkey"
  FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "comunicado_leituras" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "comunicado_id" UUID NOT NULL,
    "morador_id" UUID NOT NULL,
    "lido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comunicado_leituras_pkey" PRIMARY KEY ("id")
);

-- O par é único: reler não cria recibo novo, e é o que deixa marcar como
-- lido ser idempotente sem o cliente precisar saber se já marcou.
CREATE UNIQUE INDEX "comunicado_leituras_comunicado_id_morador_id_key"
  ON "comunicado_leituras"("comunicado_id", "morador_id");
CREATE INDEX "comunicado_leituras_condominio_id_idx" ON "comunicado_leituras"("condominio_id");

ALTER TABLE "comunicado_leituras" ADD CONSTRAINT "comunicado_leituras_comunicado_id_fkey"
  FOREIGN KEY ("comunicado_id") REFERENCES "comunicados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comunicado_leituras" ADD CONSTRAINT "comunicado_leituras_morador_id_fkey"
  FOREIGN KEY ("morador_id") REFERENCES "moradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" "CategoriaDocumento" NOT NULL,
    "arquivo_key" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removido_em" TIMESTAMP(3),
    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documentos_condominio_id_categoria_idx" ON "documentos"("condominio_id", "categoria");

ALTER TABLE "documentos" ADD CONSTRAINT "documentos_condominio_id_fkey"
  FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_criado_por_usuario_id_fkey"
  FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK do comunicado na notificação (nullable, no padrão de pacote_id/aviso_id).
ALTER TABLE "notificacoes" ADD COLUMN "comunicado_id" UUID;
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_comunicado_id_fkey"
  FOREIGN KEY ("comunicado_id") REFERENCES "comunicados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
