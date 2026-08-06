# Pacotes: gestão de encomendas de condomínio

SaaS multi-condomínio para portarias: registro de entrada de pacotes com foto/OCR,
retirada com baixa individual e notificação ao morador. Push no app é o canal;
unidade sem app recebe um convite por SMS quando chega encomenda, e boleto vai
por email do provedor de cobrança.

## Estrutura (monorepo pnpm)

- `apps/api`: API NestJS + Prisma/PostgreSQL (multi-tenant com RLS), worker
  de push (Expo Push) e OCR de etiquetas (stub em dev; Google Vision via
  `GOOGLE_VISION_API_KEY`)
- `apps/mobile`: app Expo único: o login roteia por papel, em três pilhas.
  **Portaria**: entrada com câmera/scanner + OCR, retirada parcial com foto,
  scan do QR do morador, leitura de medidores, fila offline. **Morador**:
  push, encomendas e histórico, visitas, boletos, documentos, comunicados.
  **Síndico**: gestão completa, em paridade com o painel (ver abaixo)
- `apps/web`: painel Next.js do síndico (`pnpm --filter @pacotes/web dev`,
  porta 3002). Gestor entra com e-mail + senha; OTP por SMS é só do app e da
  portaria

### Síndico: app e painel fazem a mesma coisa

A gestão inteira existe nos dois: encomendas com filtros, relatórios,
consumos com tarifas, moradores e unidades, equipe, visitantes, comunicados,
documentos, financeiro (cobranças, taxas, conciliação), módulos e conta.

Ficam **só no painel**, de propósito, as operações de arquivo — importar CSV
de moradores e de vagas, importar o OFX do banco, enviar PDF de documento e
exportar a planilha de pacotes: são tarefas de mesa, feitas onde o arquivo
já está. O app lê tudo e executa todas as ações.

Fica **só no app**: avisar morador (com foto e OCR de placa/vaga), que
depende da câmera.
- `packages/shared`: tipos e schemas zod compartilhados

## Rodando local

Requisitos: Node 20+, pnpm, PostgreSQL 17 (via Homebrew ou `docker compose up -d`).

```sh
pnpm install
pnpm --filter @pacotes/shared build
cp apps/api/.env.example apps/api/.env   # ajuste DATABASE_URL se preciso
pnpm db:migrate      # cria as tabelas
pnpm db:rls          # aplica as policies de Row-Level Security
pnpm db:seed         # base mínima: condomínio, unidades, equipe, moradores
pnpm db:seed-demo    # demo cheia por cima: encomendas, leituras, tarifas
pnpm dev:api         # API em http://localhost:3001/v1
```

Login de teste no app (o código OTP aparece no log da API em dev):

```sh
curl -X POST localhost:3001/v1/auth/otp/request -H 'content-type: application/json' \
  -d '{"telefone":"41999990001"}'
curl -X POST localhost:3001/v1/auth/otp/verify -H 'content-type: application/json' \
  -d '{"telefone":"41999990001","codigo":"<código do log>"}'
```

No painel o gestor entra com email + senha; o `db:seed-demo` deixa
`sindico@convivar.demo` / `convivar246810` prontos. O "esqueci a senha" envia
email via Resend em produção; em dev, suba a API com `EMAIL_DEV_ECHO=1` que o
link aparece na resposta.

## Testes

```sh
pnpm typecheck
pnpm test                             # unitários (vitest, monorepo inteiro)
pnpm --filter @pacotes/api test:e2e   # exige a API de dev no ar com EMAIL_DEV_ECHO=1
```

A suíte E2E roda contra o condomínio da demo e APAGA comunicados, documentos,
visitas e cobranças dele (as encomendas dela mesma são marcadas e poupadas).
Depois de rodar, reponha com `pnpm db:seed-demo`. O orçamento de OTP é 3 por
telefone/hora, em memória: reiniciar a API zera.

## Multi-tenancy

Toda tabela com `condominio_id` tem policy de RLS (`prisma/sql/rls.sql`). A API
define o tenant por transação (`PrismaService.withTenant`): queries fora do
tenant não retornam linhas de outros condomínios, mesmo com bug de aplicação.
