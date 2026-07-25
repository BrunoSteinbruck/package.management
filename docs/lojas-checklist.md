# Publicar nas lojas — o que falta

Estado em 2026-07-25. O que estava em código foi feito; o que resta é conta,
credencial e decisão. Marque conforme avançar.

## Bloqueio 0 — duas decisões que definem o cronograma

### Nome
O bundle ID é **permanente depois da primeira publicação** — não dá para
trocar, só criar outro app do zero. Hoje é `br.com.pacotes.guarita`.
Decidir o nome ANTES de submeter. Ao decidir: bateria INPI (classes 9 e 42) +
domínios + busca nas duas lojas, e então trocar bundle ID, `app.json`, marca
lowercase no app/painel e o projeto EAS.

### Pessoa física ou empresa

| | CPF | CNPJ |
|---|---|---|
| Apple | Seu nome aparece como desenvolvedor | Exige **D-U-N-S Number** (grátis, ~1-2 semanas) |
| Play | **Teste fechado: 12 testadores por 14 dias corridos** antes de publicar | Sem essa exigência |

O teste fechado do Google vale para contas pessoais criadas depois de
nov/2023 e são 14 dias **corridos e ininterruptos** — na prática, conta
pessoal = 2 semanas até a loja mesmo com tudo pronto. Com CNPJ, o gargalo
vira o D-U-N-S.

## Contas

- [ ] Apple Developer — US$ 99/ano, 24-48h de aprovação
- [ ] Google Play Console — US$ 25, pagamento único
- [ ] Firebase (grátis) → `google-services.json` em `apps/guarita/`
      **sem isso não há push no Android**

## Credenciais no Render (Environment)

- [ ] `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
      — **obrigatório**: o disco do Render é efêmero e as fotos de
      comprovação somem a cada deploy. Bucket **privado** (quem serve a foto
      é a API, com foto-token).
- [ ] `TWILIO_*` com conta paga (o trial só envia para números verificados)
- [ ] Twilio → Geo Permissions restrito ao **Brasil** (defesa contra SMS pumping)
- [ ] `CORS_ORIGINS` com a URL do painel quando hospedar
- [ ] `DEMO_TELEFONES` e `DEMO_CODIGO` (ver abaixo)
- [ ] **Rotacionar** o Auth Token do Twilio e a chave do Google Vision — foram
      colados no chat durante o setup
- [ ] Backup do Postgres — o cron job já existe no `render.yaml`, mas precisa
      de dois passos manuais antes de ligar:
      1. rodar `apps/api/prisma/sql/backup-role.sql` (precisa de superusuário;
         use o PSQL Command no painel do banco) para criar a role `backup_ro`
      2. preencher `BACKUP_DATABASE_URL` + as variáveis `R2_*` no cron job

      ⚠️ Sem a role dedicada **não há backup nenhum**: as tabelas usam FORCE
      RLS e o `pg_dump` aborta. E não resolva dando `BYPASSRLS` à role da API
      — verificado que isso derruba o isolamento entre condomínios.
      Confirme a primeira execução no log do cron (o upload ao R2 ainda não
      foi exercitado com credencial real).

## Conta de demonstração para o review

O login é OTP por SMS e o revisor não tem o nosso chip. A API aceita telefones
de demo com **código fixo**, sem disparar SMS:

```
DEMO_TELEFONES="<telefone_portaria>,<telefone_morador>"
DEMO_CODIGO="<6 dígitos>"
```

- Liste **dois** números: o app roteia por papel e o revisor precisa ver a
  experiência da portaria e a do morador.
- As contas precisam existir no banco — semeie com
  `prisma/seed-demo.ts` (`PORTEIRO_TELEFONE`, `MORADOR_DEMO_TELEFONE`).
- Informe o par telefone/código nas notas de review das duas lojas.
- Deixar as duas variáveis em branco desativa o desvio.

⚠️ O revisor pode **testar a exclusão de conta** e apagar a conta de demo. O
seed é idempotente: rode de novo antes da próxima submissão.

## Apple — itens do review

- [ ] Política de privacidade publicada em URL pública
      (rascunho: `docs/legal/politica-de-privacidade.md`)
- [ ] Termos de uso publicados (rascunho: `docs/legal/termos-de-uso.md`)
- [ ] `EXPO_PUBLIC_URL_TERMOS` e `EXPO_PUBLIC_URL_PRIVACIDADE` no build —
      sem elas o texto do login fica sem link
- [ ] Privacy Nutrition Labels: declarar telefone, nome, fotos e identificador
      de notificação; vinculados à identidade; **não** usados para rastreamento
- [ ] Screenshots iPhone 6.9" (1290×2796)
- [ ] Classificação etária
- [x] `ITSAppUsesNonExemptEncryption: false` (só HTTPS) — já em `app.json`
- [x] Exclusão de conta dentro do app — *Minha unidade* (morador) e avatar da
      home (equipe)
- [x] Ícone 1024×1024

## Google Play — itens do review

- [ ] Data Safety form (mesma declaração das nutrition labels)
- [ ] Caminho de exclusão de conta **fora do app** (URL web) — exigência do
      Play, além do botão in-app
- [ ] `google-services.json` no build
- [ ] Feature graphic 1024×500 + screenshots
- [ ] Questionário de classificação (IARC)
- [ ] Teste fechado 12×14 dias, se conta pessoal
- [x] Permissão `RECORD_AUDIO` removida — o app não grava áudio, e permissão
      sensível sem uso é bandeira no review (`recordAudioAndroid: false`)

## Ainda sem dono

- [ ] `SENTRY_DSN` no Render — a API já está instrumentada; basta criar o
      projeto no Sentry e colar o DSN. Sem ele, fica inerte.
- [ ] **Sentry no app — deliberadamente adiado para DEPOIS do primeiro build
      aprovado.** Não é copiar um pacote: `@sentry/react-native` é módulo
      nativo (rebuild obrigatório), tem postinstall que baixa binário, precisa
      de auth token no EAS para subir source maps e o Expo prende o SDK 54 na
      série `~7.2.0` enquanto o upstream já está na 8.x. Nada disso dá para
      validar sem rodar um build de verdade na EAS — e um build quebrado bem na
      hora de submeter custa mais do que ficar sem crash report no piloto.
      Fazer quando houver um build aprovado como ponto de retorno.
- [ ] Hospedar o painel web (Vercel) e apontar `CORS_ORIGINS`
- [x] Página web de exclusão de conta (exigida pelo Play) — `/excluir-conta`
      no painel. Informar a URL no Play Console quando o painel estiver no ar.
