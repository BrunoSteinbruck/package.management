-- Row-Level Security: isolamento por condomínio (tenant).
-- Aplicado a toda tabela que carrega condominio_id e é consultada
-- exclusivamente dentro de um tenant.
-- A API define o tenant por transação via:
--   SELECT set_config('app.condominio_id', '<uuid>', true);
-- FORCE garante que até o dono da tabela passa pelas policies.
-- NULLIF: em conexão de pool, current_setting fora de transação com tenant
-- retorna '' (não NULL): sem o NULLIF o cast ::uuid explode a query.
--
-- Tabelas globais (sem RLS): condominios, usuarios, moradores, vinculos,
-- devices, otp_challenges, convites, eventos_webhook_financeiro.
--   usuarios: o login (OTP) localiza pelo telefone antes de existir tenant.
--   convites: o resgate acontece no onboarding, antes da autenticação,
--     protegido por código único não-adivinhável, expiração e uso único.
--   eventos_webhook_financeiro: o webhook do provedor chega antes de sabermos
--     o tenant, e é do payload dele que o tenant é descoberto.
--   Isolamento dessas tabelas é responsabilidade da API.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios','convites']
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['unidades','pacotes','retiradas','notificacoes','vagas','veiculos','avisos','leituras_medidor','tarifas_consumo','comunicados','comunicado_leituras','documentos','despesas','extrato_itens','visitas','integracoes_financeiras','config_financeiro','taxas_unidade','cobrancas']
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
