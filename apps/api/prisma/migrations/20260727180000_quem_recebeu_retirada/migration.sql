-- Quem RECEBEU a encomenda.
--
-- Até aqui a retirada gravava só quem entregou (o porteiro), a foto e a hora:
-- o pacote saía sem constar para quem foi. O QR do morador não cobria isso,
-- porque resolvia a UNIDADE e não a pessoa.
--
-- Aditiva e nullable: retirada antiga continua válida sem o campo, e a versão
-- do app que está nas lojas segue registrando sem ele.
ALTER TABLE "retiradas" ADD COLUMN "recebido_por_morador_id" UUID;
ALTER TABLE "retiradas" ADD COLUMN "recebido_por_nome" TEXT;

ALTER TABLE "retiradas" ADD CONSTRAINT "retiradas_recebido_por_morador_id_fkey"
  FOREIGN KEY ("recebido_por_morador_id") REFERENCES "moradores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
