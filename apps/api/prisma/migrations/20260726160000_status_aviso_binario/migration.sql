-- Relato ou esta aberto, ou esta resolvido. EM_ANDAMENTO nao dizia nada util
-- para quem le: o morador so quer saber se a administracao ja resolveu, e o
-- sindico so precisa saber o que ainda esta na fila dele.

-- Postgres nao remove valor de enum: o tipo precisa ser recriado.
ALTER TYPE "StatusAviso" RENAME TO "StatusAviso_old";
CREATE TYPE "StatusAviso" AS ENUM ('ABERTO', 'RESOLVIDO');

ALTER TABLE "avisos" ALTER COLUMN "status" DROP DEFAULT;

-- O que estava em andamento nao foi concluido, entao volta para a fila. A
-- conversao acontece dentro do ALTER, e nao num UPDATE antes: avisos tem FORCE
-- RLS e a conexao da migracao nao define app.condominio_id, entao um UPDATE
-- aqui nao alcancaria linha nenhuma e o cast falharia ao encontrar o valor
-- antigo. DDL nao passa por RLS.
ALTER TABLE "avisos"
  ALTER COLUMN "status" TYPE "StatusAviso"
  USING (
    CASE
      WHEN "status"::text = 'EM_ANDAMENTO' THEN 'ABERTO'
      ELSE "status"::text
    END
  )::"StatusAviso";

ALTER TABLE "avisos" ALTER COLUMN "status" SET DEFAULT 'ABERTO';

DROP TYPE "StatusAviso_old";
