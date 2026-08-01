-- RLS da trilha de auditoria, no padrão de migração dupla do repo: produção só
-- roda `migrate deploy`, e tabela com condominio_id sem policy aqui ficaria sem
-- isolamento. O rls-consistencia.spec.ts vigia os dois lados.
--
-- Aqui o isolamento pesa mais que na média: o `detalhe` guarda o que mudou em
-- taxa, despesa e conciliação de um condomínio, e vazar isso entre tenants
-- seria entregar a movimentação financeira de um prédio para o síndico de
-- outro.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['registros_acao']
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
