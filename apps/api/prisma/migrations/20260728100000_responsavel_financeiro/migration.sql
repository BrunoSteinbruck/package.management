-- Responsável financeiro da unidade.
--
-- O provedor de cobrança (Asaas) não cria cliente sem nome E CPF/CNPJ, e não
-- emite boleto sem cliente. Até aqui o código mandava o UUID interno da
-- unidade como cliente, o que só passava porque o stub aceita qualquer coisa:
-- contra a API real, toda cobrança falharia.
--
-- Fica na taxa e não no morador porque quem paga é o proprietário, que na
-- unidade alugada não é quem mora e pode nunca usar o app.
--
-- Tudo nullable: o módulo financeiro é opcional e a maioria dos condomínios
-- não tem nada disso preenchido.
ALTER TABLE "taxas_unidade" ADD COLUMN "responsavel_nome" TEXT;
ALTER TABLE "taxas_unidade" ADD COLUMN "responsavel_cpf_cnpj" TEXT;
ALTER TABLE "taxas_unidade" ADD COLUMN "responsavel_email" TEXT;
-- Id do cliente na subconta do provedor: sem guardar, cada geração criaria
-- um cliente duplicado (o Asaas permite duplicatas).
ALTER TABLE "taxas_unidade" ADD COLUMN "cliente_externo_id" TEXT;
