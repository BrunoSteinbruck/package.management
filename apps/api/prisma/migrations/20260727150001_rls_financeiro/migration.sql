-- RLS das tabelas do financeiro. Migração separada, no padrão das ondas
-- anteriores; o teste apps/api/test/rls-consistencia.spec.ts falha se faltar.
--
-- eventos_webhook_financeiro fica FORA: não tem condominio_id de propósito,
-- porque o webhook chega antes de sabermos o tenant e é pelo payload dele que
-- o tenant é descoberto. O isolamento dessa tabela é da API, como já vale para
-- usuarios e convites.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['integracoes_financeiras','config_financeiro','taxas_unidade','cobrancas']
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
