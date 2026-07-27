-- Onda 4: consentimento de WhatsApp por morador.
-- Default false de propósito: consentimento LGPD é ato positivo do titular,
-- não silêncio. Morador existente começa sem receber nada por este canal.
ALTER TABLE "moradores" ADD COLUMN "aceita_whatsapp" BOOLEAN NOT NULL DEFAULT false;
