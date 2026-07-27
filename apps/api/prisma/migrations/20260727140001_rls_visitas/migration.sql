-- RLS da tabela de visitas. Migração separada, no padrão das ondas
-- anteriores: produção só roda `migrate deploy`, e o teste
-- apps/api/test/rls-consistencia.spec.ts falha se este arquivo faltar.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['visitas']
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
