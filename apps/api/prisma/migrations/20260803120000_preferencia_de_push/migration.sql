-- Preferência de push do morador.
--
-- LIGADO por padrão, ao contrário de aceita_whatsapp: o push é o serviço que
-- o condomínio contratou (avisar que a encomenda chegou), não abordagem de
-- terceiro, e a permissão do sistema já foi concedida na instalação. Quem
-- desliga é o morador, na tela da unidade.
--
-- moradores é tabela GLOBAL (sem RLS): a coluna não entra em rls.sql.
ALTER TABLE "moradores"
  ADD COLUMN IF NOT EXISTS "aceita_push" BOOLEAN NOT NULL DEFAULT true;
