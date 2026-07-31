-- Telefone gravado com o código do país volta ao formato do resto do cadastro.
--
-- O telefone é chave de busca EXATA no login: "5551900000009" não encontra o
-- cadastro que o dono digita como "51900000009". Quem foi gravado com o 55 na
-- frente só conseguia entrar repetindo o país toda vez, e quem tentava o
-- formato normal recebia "Código expirado", que manda pedir outro código e
-- falhar de novo.
--
-- A borda passou a normalizar (`normalizarTelefone` no shared), e esta
-- migração alinha o que já estava gravado, senão os dois passam a divergir: a
-- busca normalizada nunca mais acharia a linha não normalizada.
--
-- Só 12 ou 13 dígitos começando com 55, que é o tamanho de "55 + DDD +
-- número". O DDD 55 (Santa Maria) tem 10 ou 11 dígitos no total e fica
-- intacto: sem essa condição, "5599999999" perderia o próprio DDD.
--
-- O WHERE NOT EXISTS evita colidir com o índice único quando as duas formas
-- do mesmo número já existem como linhas separadas. Nesse caso a linha com o
-- país fica como está, para a limpeza ser uma decisão de quem conhece os
-- dados, e não um DELETE silencioso numa migração.

UPDATE moradores m
SET telefone = substring(m.telefone from 3)
WHERE length(m.telefone) IN (12, 13)
  AND m.telefone ~ '^55[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM moradores outro
    WHERE outro.telefone = substring(m.telefone from 3)
  );

UPDATE usuarios u
SET telefone = substring(u.telefone from 3)
WHERE length(u.telefone) IN (12, 13)
  AND u.telefone ~ '^55[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM usuarios outro
    WHERE outro.telefone = substring(u.telefone from 3)
  );
