# Checklist do piloto — o que falta é só login seu

Todo o código e configuração dos 4 itens está pronto e commitado. O que
resta em cada um é criar a conta (não dá pra fazer por você) e colar
credenciais. Tempo estimado total: ~30–40 min.

## 1. SMS real (Twilio) — ~10 min

O código já envia SMS quando as variáveis existem; sem elas, roda em stub.

1. Crie a conta em twilio.com (trial gratuito, com créditos).
2. No console: **verifique seu número de celular** (trial só envia para
   números verificados — verifique também o do seu colega para a demo).
3. Pegue um número de envio (trial oferece um) e anote:
   `Account SID`, `Auth Token`, número (formato `+1...`).
4. Cole no `apps/api/.env`:
   ```
   TWILIO_ACCOUNT_SID="AC..."
   TWILIO_AUTH_TOKEN="..."
   TWILIO_FROM="+1..."
   ```
5. Reinicie a API. Teste: peça o código no app com seu número real —
   o SMS chega no celular. (`OTP_DEV_ECHO=1` pode continuar em dev;
   em produção, não configure.)

## 2. Hospedagem (Render) — ~10 min

O blueprint `render.yaml` na raiz cria API + PostgreSQL com HTTPS.

1. Crie a conta em render.com (pode entrar com o GitHub).
2. **New → Blueprint** → conecte o repo `BrunoSteinbruck/Guarita` → Apply.
3. Aguarde o primeiro deploy (build + migrations rodam sozinhos; o RLS
   entra via migration).
4. No serviço `guarita-api` → aba Shell, rode o bootstrap do condomínio:
   ```
   pnpm --filter @pacotes/api exec ts-node scripts/bootstrap.ts \
     "Residencial Aurora" residencial-aurora "Seu Nome" SEUTELEFONE
   ```
5. Anote a URL (ex.: `https://guarita-api.onrender.com`). Para os apps
   apontarem pra ela: `EXPO_PUBLIC_API_URL=https://.../v1` no
   `apps/guarita/.env`.
6. Cole também as variáveis do Twilio/Vision no dashboard (Environment).

Notas: plano free hiberna após inatividade (primeira chamada demora ~30s)
e o Postgres free expira em 30 dias — antes do piloto real, subir para o
plano pago (~US$7/mês cada).

## 3. Development build com push (EAS) — ~15 min (maioria é fila do build)

`eas.json` pronto, `expo-dev-client` instalado, push token já lê o
projectId. O EAS CLI já está instalado na máquina.

1. Crie a conta em expo.dev (gratuita).
2. No terminal:
   ```
   cd "apps/guarita"
   eas login
   eas init            # cria o projeto e grava o projectId no app.json
   eas build --profile development --platform ios
   ```
3. O build roda na nuvem (~10–20 min na fila free). Ao final, escaneie o
   QR do terminal com o iPhone para instalar o app.
4. Abra o app instalado (não o Expo Go) com o Metro rodando
   (`pnpm --filter @pacotes/guarita start`). Faça login como morador →
   o push token registra de verdade.
5. Ligue o worker: rode a API **sem** `PUSH_WORKER_DESLIGADO=1`. Registre
   uma entrada como porteiro → o push chega no aparelho.

Para Android é igual com `--platform android` (gera um APK instalável).

## 4. OCR real (Google Vision) — ~10 min

Provider pronto; basta a chave.

1. console.cloud.google.com → criar projeto → **ativar a API
   "Cloud Vision API"** (exige billing ativado; há cota gratuita de
   1.000 leituras/mês).
2. **APIs e serviços → Credenciais → Criar credencial → Chave de API.**
   (Recomendado: restringir a chave à Vision API.)
3. Cole no `apps/api/.env`: `GOOGLE_VISION_API_KEY="AIza..."`.
4. Teste imediato sem subir nada, com uma foto de etiqueta:
   ```
   pnpm --filter @pacotes/api exec ts-node scripts/testar-ocr.ts \
     /caminho/da/foto.jpg
   ```
   Deve imprimir o texto lido e os campos extraídos (transportadora,
   rastreio, bloco/unidade se houver).
5. Reinicie a API — a partir daí a entrada no app pré-preenche
   transportadora e sugere a unidade pela etiqueta.

## Ordem sugerida do teste conjunto

1. Vision (script → depois no app, foto da etiqueta preenchendo campos)
2. Twilio (login com SMS de verdade no seu número)
3. EAS build (instala o app real → push chegando)
4. Render (repetir o bootstrap + apontar o app pra URL pública e refazer
   o ciclo inteiro fora do seu Wi-Fi)
