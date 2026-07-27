-- Módulos opcionais ligados por condomínio (vocabulário em MODULOS_CONDOMINIO).
-- Aditiva com default: condomínio existente continua só com a base
-- (encomendas, avisos, leituras) até o síndico ligar algo.
ALTER TABLE "condominios" ADD COLUMN "modulos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
