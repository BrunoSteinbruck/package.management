# Pacotes — gestão de encomendas de condomínio

SaaS multi-condomínio para portarias: registro de entrada de pacotes com foto/OCR,
retirada com baixa individual e notificação ao morador (push no app; WhatsApp como
fallback para quem ainda não aderiu).

## Estrutura (monorepo pnpm)

- `apps/api` — API NestJS + Prisma/PostgreSQL (multi-tenant com RLS), worker
  de push (Expo Push) e OCR de etiquetas (stub em dev; Google Vision via
  `GOOGLE_VISION_API_KEY`)
- `apps/guarita` — app Expo único: o login roteia por papel. Equipe da
  portaria: entrada com câmera/scanner + OCR, retirada parcial com foto,
  scan do QR do morador, fila offline. Morador: push, pendentes/histórico,
  QR de retirada, convite de familiar
- `apps/web` — painel Next.js do síndico: pendências, adoção, aprovação de
  vínculos, import de moradores (`pnpm --filter @pacotes/web dev`, porta 3002)
- `packages/shared` — tipos e schemas zod compartilhados

## Rodando local

Requisitos: Node 20+, pnpm, PostgreSQL 17 (via Homebrew ou `docker compose up -d`).

```sh
pnpm install
pnpm --filter @pacotes/shared build
cp apps/api/.env.example apps/api/.env   # ajuste DATABASE_URL se preciso
pnpm db:migrate      # cria as tabelas
pnpm db:rls          # aplica as policies de Row-Level Security
pnpm db:seed         # dados de demonstração (Residencial Aurora)
pnpm dev:api         # API em http://localhost:3001/v1
```

Login de teste (o código OTP aparece no log da API em dev):

```sh
curl -X POST localhost:3001/v1/auth/otp/request -H 'content-type: application/json' \
  -d '{"telefone":"41999990001"}'
curl -X POST localhost:3001/v1/auth/otp/verify -H 'content-type: application/json' \
  -d '{"telefone":"41999990001","codigo":"<código do log>"}'
```

## Multi-tenancy

Toda tabela com `condominio_id` tem policy de RLS (`prisma/sql/rls.sql`). A API
define o tenant por transação (`PrismaService.withTenant`) — queries fora do
tenant não retornam linhas de outros condomínios, mesmo com bug de aplicação.
