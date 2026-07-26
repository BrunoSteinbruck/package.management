-- Device deixa de ser exclusivo de morador: passa a aceitar membro da equipe.
-- Enquanto morador_id era NOT NULL e a FK apontava só para moradores, não
-- existia caminho físico para notificar um síndico, o que bloqueia qualquer
-- feature de comunicação que envolva a administração.

ALTER TABLE "devices" ALTER COLUMN "morador_id" DROP NOT NULL;
ALTER TABLE "devices" ADD COLUMN "usuario_id" UUID;

ALTER TABLE "devices" ADD CONSTRAINT "devices_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "devices_usuario_id_idx" ON "devices"("usuario_id");

-- Exatamente um dono. As linhas existentes têm morador_id preenchido e
-- usuario_id nulo, então a restrição já vale para todas elas.
ALTER TABLE "devices" ADD CONSTRAINT "devices_dono_unico" CHECK (
  ("morador_id" IS NOT NULL AND "usuario_id" IS NULL)
  OR ("morador_id" IS NULL AND "usuario_id" IS NOT NULL)
);
