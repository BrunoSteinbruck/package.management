-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('ESSENCIAL', 'PROFISSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('PORTEIRO', 'APOIO', 'SINDICO', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusPacote" AS ENUM ('ARMAZENADO', 'ENTREGUE', 'EXTRAVIADO');

-- CreateEnum
CREATE TYPE "StatusVinculo" AS ENUM ('PENDENTE', 'ATIVO', 'REMOVIDO');

-- CreateEnum
CREATE TYPE "CanalNotificacao" AS ENUM ('PUSH', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('ENTRADA', 'RETIRADA', 'CONVITE');

-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('FILA', 'ENVIADA', 'ENTREGUE', 'FALHA');

-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "CanalConvite" AS ENUM ('SMS', 'POSTER', 'PORTARIA');

-- CreateTable
CREATE TABLE "condominios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "plano" "Plano" NOT NULL DEFAULT 'ESSENCIAL',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condominios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "bloco" TEXT,
    "identificacao" TEXT NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moradores" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculos" (
    "id" UUID NOT NULL,
    "morador_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "status" "StatusVinculo" NOT NULL DEFAULT 'PENDENTE',
    "contato_preferencial" BOOLEAN NOT NULL DEFAULT false,
    "aprovado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacotes" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "transportadora" TEXT,
    "codigo_rastreio" TEXT,
    "nota_fiscal" TEXT,
    "foto_entrada_key" TEXT,
    "local_armazenamento" TEXT,
    "status" "StatusPacote" NOT NULL DEFAULT 'ARMAZENADO',
    "recebido_por_id" UUID NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retiradas" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "entregue_por_id" UUID NOT NULL,
    "foto_saida_key" TEXT,
    "retirado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retiradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "pacote_id" UUID,
    "canal" "CanalNotificacao" NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'FILA',
    "provider_msg_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "unidade_id" UUID,
    "codigo" TEXT NOT NULL,
    "canal" "CanalConvite" NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "morador_id" UUID NOT NULL,
    "push_token" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "ultimo_uso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "condominios_slug_key" ON "condominios"("slug");

-- CreateIndex
CREATE INDEX "unidades_condominio_id_idx" ON "unidades"("condominio_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_condominio_id_bloco_identificacao_key" ON "unidades"("condominio_id", "bloco", "identificacao");

-- CreateIndex
CREATE UNIQUE INDEX "moradores_telefone_key" ON "moradores"("telefone");

-- CreateIndex
CREATE INDEX "vinculos_unidade_id_idx" ON "vinculos"("unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinculos_morador_id_unidade_id_key" ON "vinculos"("morador_id", "unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_telefone_key" ON "usuarios"("telefone");

-- CreateIndex
CREATE INDEX "usuarios_condominio_id_idx" ON "usuarios"("condominio_id");

-- CreateIndex
CREATE INDEX "pacotes_condominio_id_status_idx" ON "pacotes"("condominio_id", "status");

-- CreateIndex
CREATE INDEX "pacotes_unidade_id_status_idx" ON "pacotes"("unidade_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "retiradas_pacote_id_key" ON "retiradas"("pacote_id");

-- CreateIndex
CREATE INDEX "retiradas_condominio_id_idx" ON "retiradas"("condominio_id");

-- CreateIndex
CREATE INDEX "notificacoes_condominio_id_status_idx" ON "notificacoes"("condominio_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "convites_codigo_key" ON "convites"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "devices_push_token_key" ON "devices"("push_token");

-- CreateIndex
CREATE UNIQUE INDEX "otp_challenges_telefone_key" ON "otp_challenges"("telefone");

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_morador_id_fkey" FOREIGN KEY ("morador_id") REFERENCES "moradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_aprovado_por_id_fkey" FOREIGN KEY ("aprovado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacotes" ADD CONSTRAINT "pacotes_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacotes" ADD CONSTRAINT "pacotes_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacotes" ADD CONSTRAINT "pacotes_recebido_por_id_fkey" FOREIGN KEY ("recebido_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiradas" ADD CONSTRAINT "retiradas_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiradas" ADD CONSTRAINT "retiradas_entregue_por_id_fkey" FOREIGN KEY ("entregue_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_morador_id_fkey" FOREIGN KEY ("morador_id") REFERENCES "moradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
