-- Row-Level Security: isolamento por condomínio (tenant).
-- Aplicado a toda tabela que carrega condominio_id e é consultada
-- exclusivamente dentro de um tenant.
-- A API define o tenant por transação via:
--   SELECT set_config('app.condominio_id', '<uuid>', true);
-- FORCE garante que até o dono da tabela passa pelas policies.
--
-- Tabelas globais (sem RLS): condominios, usuarios, moradores, vinculos,
-- devices, otp_challenges. "usuarios" fica fora porque o login (OTP) precisa
-- localizar o usuário pelo telefone antes de existir tenant na sessão;
-- o isolamento desses dados é responsabilidade da API.

DO $$
DECLARE
  t text;
BEGIN
  EXECUTE 'ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE usuarios NO FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON usuarios';

  FOREACH t IN ARRAY ARRAY['unidades','pacotes','retiradas','notificacoes','convites']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (condominio_id = current_setting(''app.condominio_id'', true)::uuid) WITH CHECK (condominio_id = current_setting(''app.condominio_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;
