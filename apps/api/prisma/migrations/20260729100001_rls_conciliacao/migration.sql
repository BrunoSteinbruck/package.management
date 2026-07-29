-- RLS das tabelas de conciliação, no padrão de migração dupla do repo:
-- produção só roda `migrate deploy`, e tabela com condominio_id sem policy
-- aqui ficaria sem isolamento. O rls-consistencia.spec.ts vigia os dois lados.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['despesas','extrato_itens']
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
