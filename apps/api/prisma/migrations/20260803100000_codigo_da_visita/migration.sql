-- Código curto da visita, o que o morador passa para quem vem ("V-4821").
--
-- Anulável e sem UNIQUE de propósito. Não é credencial: a portaria já vê o
-- nome e a unidade, e o código só serve para achar a linha certa na lista do
-- dia. Um índice único obrigaria a tratar colisão na hora de autorizar, para
-- proteger algo que não protege nada.
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(12);
