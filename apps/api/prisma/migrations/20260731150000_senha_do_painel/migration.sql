-- Senha para o painel: só a equipe gestora tem, e o e-mail é o caminho de volta.
--
-- Síndico e administrador vêm de uCondo/Superlógica, onde o login é usuário e
-- senha; o app segue com OTP por SMS, onde digitar senha no corredor não se
-- paga. `usuarios` é tabela GLOBAL (sem RLS), então nada aqui toca o rls.sql.
--
-- `email` é único pelo mesmo motivo do telefone, mais um: se duas contas
-- compartilhassem o e-mail, o "esqueci a senha" escolheria uma por ordem de
-- tabela e mandaria o link para a conta errada. Nulo não colide no índice
-- único do Postgres, que é o que deixa o porteiro existir sem e-mail.
ALTER TABLE "usuarios" ADD COLUMN     "email" TEXT,
ADD COLUMN     "redefinicao_expira_em" TIMESTAMP(3),
ADD COLUMN     "redefinicao_token_hash" TEXT,
ADD COLUMN     "senha_bloqueada_ate" TIMESTAMP(3),
ADD COLUMN     "senha_hash" TEXT,
ADD COLUMN     "senha_tentativas" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- O lookup do "esqueci a senha" e do login por e-mail passa por aqui; o índice
-- único acima já serve de índice de busca, então não há um segundo.
