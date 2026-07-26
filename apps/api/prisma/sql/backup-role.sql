-- Role dedicada ao backup.
--
-- POR QUE ELA EXISTE: as tabelas com dados de condomínio usam
-- FORCE ROW LEVEL SECURITY, e o pg_dump roda com `row_security = off`.
-- Sem uma role que ignore RLS, o pg_dump não dumpa quieto uma tabela vazia:
-- ele FALHA com "query would be affected by row-level security policy".
-- Ou seja, sem isto não existe backup nenhum.
--
-- POR QUE É UMA ROLE SEPARADA (e não BYPASSRLS na role da API): BYPASSRLS
-- vale para TODAS as conexões daquela role. Concedida à role que a API usa,
-- o isolamento por condomínio morre: a API passa a enxergar todos os
-- tenants mesmo sem definir app.condominio_id. Verificado na prática: com
-- BYPASSRLS, um SELECT sem tenant devolveu os pacotes de todo mundo.
--
-- Portanto: a API continua com RLS aplicado; só esta role, usada
-- exclusivamente pelo cron de backup, enxerga tudo: e só para leitura.
--
-- Exige superusuário para rodar. No Render: painel do banco → PSQL Command
-- (o usuário de lá tem permissão para criar roles).
--
--   psql "$DATABASE_URL_ADMIN" -f backup-role.sql
--
-- A senha é GERADA na hora e impressa uma única vez (RAISE NOTICE): copie
-- na hora, ela não fica em lugar nenhum. Nada de senha comitada no repo:
-- este arquivo é público e a role tem BYPASSRLS. Depois, no cron job:
--   BACKUP_DATABASE_URL=postgresql://backup_ro:SENHA@host:5432/banco
-- Para trocar a senha depois: ALTER ROLE backup_ro PASSWORD 'nova';

DO $$
DECLARE
  senha text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backup_ro') THEN
    EXECUTE format('CREATE ROLE backup_ro LOGIN BYPASSRLS PASSWORD %L', senha);
    RAISE NOTICE 'Role backup_ro criada. SENHA (copie agora, não é recuperável): %', senha;
  ELSE
    ALTER ROLE backup_ro BYPASSRLS;
    RAISE NOTICE 'Role backup_ro já existia (senha mantida). Para trocar: ALTER ROLE backup_ro PASSWORD ''nova'';';
  END IF;
END $$;

-- Somente leitura: o backup nunca precisa escrever.
-- GRANT ... ON DATABASE não aceita expressão no nome, daí o SQL dinâmico.
DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO backup_ro',
    current_database()
  );
END $$;

GRANT USAGE ON SCHEMA public TO backup_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_ro;

-- Tabelas de migrations futuras: ALTER DEFAULT PRIVILEGES sem FOR ROLE só
-- vale para tabelas criadas pela role que executa ESTE script (o
-- superusuário). As migrations rodam com a role da API, então o default que
-- importa é o DELA: sem o bloco abaixo, cada tabela nova nasceria sem SELECT
-- para backup_ro e o pg_dump inteiro passaria a FALHAR no mês seguinte.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_ro;
DO $$
DECLARE
  dono text;
BEGIN
  SELECT tableowner INTO dono
  FROM pg_tables
  WHERE schemaname = 'public'
  LIMIT 1;
  IF dono IS NOT NULL THEN
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON TABLES TO backup_ro',
      dono
    );
  END IF;
END $$;
