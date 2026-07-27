-- RLS das tabelas da Onda 1. Migração separada, no padrão já usado em
-- 20260724012459_rls_avisos e 20260726190000_rls_leituras: produção só roda
-- `migrate deploy`, então tabela com condominio_id que não recebe policy aqui
-- fica sem isolamento em produção mesmo com o rls.sql atualizado.
-- O teste apps/api/test/rls-consistencia.spec.ts falha se um dos lados faltar.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['comunicados','comunicado_leituras','documentos']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (condominio_id = NULLIF(current_setting(''app.condominio_id'', true), '''')::uuid) WITH CHECK (condominio_id = NULLIF(current_setting(''app.condominio_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END $$;
