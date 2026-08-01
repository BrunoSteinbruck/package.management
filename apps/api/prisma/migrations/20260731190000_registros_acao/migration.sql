-- Trilha de auditoria: quem fez o que no dinheiro e no cadastro.
--
-- Nasce da pergunta que ninguem conseguia responder: quem gerou aquelas
-- cobrancas, quem trocou o CPF do responsavel de uma unidade, quem cadastrou a
-- credencial do provedor. Nenhuma dessas acoes gravava autor, e numa disputa
-- ("eu nao alterei isso") nao havia resposta nenhuma.
--
-- `usuario_id` e NOT NULL de proposito: toda acao registrada aqui tem um humano
-- atras. O que roda sozinho (worker de push, regua de cobranca) nao passa por
-- este caminho.
--
-- O RLS desta tabela vem na migracao seguinte, como nas demais tabelas de
-- tenant do repo.

-- CreateTable
CREATE TABLE "registros_acao" (
    "id" UUID NOT NULL,
    "condominio_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhe" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_acao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_acao_condominio_id_criado_em_idx" ON "registros_acao"("condominio_id", "criado_em");

-- CreateIndex
CREATE INDEX "registros_acao_condominio_id_acao_idx" ON "registros_acao"("condominio_id", "acao");

-- AddForeignKey
ALTER TABLE "registros_acao" ADD CONSTRAINT "registros_acao_condominio_id_fkey" FOREIGN KEY ("condominio_id") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_acao" ADD CONSTRAINT "registros_acao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

