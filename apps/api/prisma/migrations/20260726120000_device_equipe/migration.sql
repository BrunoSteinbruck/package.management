-- Device deixa de ser exclusivo de morador: passa a aceitar membro da equipe.
-- Enquanto morador_id era NOT NULL e a FK apontava só para moradores, não
-- existia caminho físico para notificar um síndico, o que bloqueia qualquer
-- feature de comunicação que envolva a administração.

ALTER TABLE "devices" ALTER COLUMN "morador_id" DROP NOT NULL;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "usuario_id" UUID;

-- ON DELETE SET NULL, e não RESTRICT como estava aqui originalmente: é o que
-- o schema do Prisma declara para uma relação opcional, e é o estado em que
-- os bancos existentes ficaram depois da 20260726102025 (que foi APLICADA
-- depois desta, apesar do nome ordenar antes). Sem esta troca, um banco novo
-- terminaria com RESTRICT e um banco antigo com SET NULL: o mesmo código
-- rodando sobre esquemas diferentes.
--
-- DROP antes do ADD para o caso de a 102025 já ter criado a constraint, o que
-- acontece em qualquer banco que tenha a coluna desde antes.
ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_usuario_id_fkey";
ALTER TABLE "devices" ADD CONSTRAINT "devices_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "devices_usuario_id_idx" ON "devices"("usuario_id");

-- Exatamente um dono. As linhas existentes têm morador_id preenchido e
-- usuario_id nulo, então a restrição já vale para todas elas.
ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_dono_unico";
ALTER TABLE "devices" ADD CONSTRAINT "devices_dono_unico" CHECK (
  ("morador_id" IS NOT NULL AND "usuario_id" IS NULL)
  OR ("morador_id" IS NULL AND "usuario_id" IS NOT NULL)
);
