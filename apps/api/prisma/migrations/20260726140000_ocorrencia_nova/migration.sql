-- Relato novo do morador passa a notificar a administração. Ate aqui a Via 2
-- so avisava de volta o autor quando o status mudava, e ninguem era avisado da
-- chegada: o sindico precisava abrir o painel para descobrir.

ALTER TYPE "TipoNotificacao" ADD VALUE 'OCORRENCIA_NOVA';
