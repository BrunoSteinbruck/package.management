# Plano de testes dos módulos

Como garantir que os módulos das cinco ondas (fundação, comunicados,
documentos, visitantes, financeiro, WhatsApp) continuam funcionando a cada
mudança. Quatro camadas automatizadas rodam em qualquer máquina de dev; o que
depende de conta externa ou aparelho fica na seção de testes pendentes, com o
passo a passo pronto.

## Camada 1: o compilador como teste de contrato

`pnpm typecheck` não é só estilo: o repo foi desenhado para que esquecer um
passo obrigatório **não compile**. Ao mexer nestes pontos, o erro de
compilação é o teste:

| Se você adicionar... | Não compila até... |
|---|---|
| um tipo em `ItemFeed` (shared/feed.ts) | dar um ramo em `apresentar()` no app E declarar a versão mínima em `VERSAO_MINIMA_ITEM` |
| um valor em `TipoNotificacao` (schema.prisma) | dar uma entrada em `DESPACHOS` (mensagens.ts) |
| uma audiência em `Audiencia` | tratar o caso em `tokensDa()` no worker |
| um valor em `MODULOS_CONDOMINIO` | descrever o módulo em `DESCRICOES` (ConfiguracoesView) |
| uma rota no manifesto `modulos.ts` | a rota existir no ParamList do perfil certo |

## Camada 2: unidade (vitest, sem banco nem rede)

```bash
pnpm test
```

O que cada spec protege:

- `packages/shared/src/feed.spec.ts`: o versionamento do feed. App v1 nunca
  recebe COMUNICADO; tipo novo sem versão mínima não passa.
- `apps/mobile/src/modulos.spec.ts`: o filtro de flags da home. Módulo pago
  não aparece sem a flag; a base nunca some; cada módulo das ondas está atrás
  da flag certa.
- `apps/mobile/src/nomes.spec.ts`: o rótulo do chip de "quem recebeu". Dois
  moradores com o mesmo primeiro nome na unidade (pai e filho, ou cadastro
  duplicado) não podem virar dois chips idênticos: o registro de custódia
  viraria um chute.
- `apps/api/src/notificacoes/mensagens.spec.ts`: o registry aguenta relação
  nula (FK SET NULL não pode derrubar o worker e parar a fila de todos os
  condomínios); só comunicado e cobranças usam o canal pago; encomenda segue
  como motor de adoção.
- `apps/api/src/financeiro/competencia.util.spec.ts`: vencimento dia 31 em
  fevereiro, virada de ano, fuso do condomínio.
- `apps/api/src/financeiro/cripto.util.spec.ts`: a cifra das credenciais
  decifra o que cifrou, recusa valor adulterado e falha fechado sem a
  chave-mestra.
- `apps/api/test/rls-consistencia.spec.ts`: **toda tabela nova com
  `condominio_id` precisa estar no rls.sql E numa migração.** É a rede que
  impede subir tabela sem isolamento; falha no commit em que alguém esquecer.

## Camada 3: E2E local (a suíte principal)

Exercita a API real pela borda HTTP, com o banco conferido por dentro quando
a resposta não basta como prova. São ~60 checagens cobrindo as cinco ondas:
autorização por papel (síndico/porteiro/morador), isolamento entre
condomínios e blocos, idempotência (recibo de leitura, geração de cobrança,
reentrega de webhook), as defesas do webhook (token, UUID, tenant), a cifra
no banco e as três portas do WhatsApp.

```bash
# Terminal 1: a API de dev
OTP_DEV_ECHO=1 PUSH_DEV_SIMULAR=1 \
  FINANCEIRO_CRIPTO_CHAVE=qualquer-frase pnpm dev:api

# Terminal 2: a suíte (~2 min; espera o worker de push nos passos que dependem dele)
pnpm --filter @pacotes/api test:e2e
```

Pré-requisitos: Postgres local com o seed de demo (contas 51900000001/2/3,
código 246810). A suíte zera o estado dos módulos no começo e no fim e não
toca em pacotes nem moradores do seed. O rate limit de OTP é em memória (3
envios por telefone por hora): depois de 3 rodadas seguidas, reinicie a API.

## Camada 4: painel no navegador

Depois de mudança visual no painel, conferir logado como síndico
(`pnpm --filter @pacotes/web dev`, porta 3002):

1. Configurações: ligar um módulo muda o selo na hora; a aba dele aparece ao
   trocar de visão, sem F5.
2. Comunicados: publicar, ver a taxa de leitura e expandir "Quem leu".
3. Financeiro: o aviso vermelho de modo de teste aparece sempre que
   `ASAAS_API_URL` não estiver configurada. **Se não aparecer em dev,
   investigue antes de qualquer outra coisa.**
4. Com ~11 visões, a barra lateral rola e o rodapé continua alcançável.

## O que a automação NÃO cobre (e como testar quando chegar a hora)

**Push real em aparelho.** `PUSH_DEV_SIMULAR=1` valida o pipeline, não a
entrega. No development build: registrar o device, gerar um comunicado e uma
visita, conferir as duas notificações na tela bloqueada e o toque abrindo a
tela certa (o `data` do push carrega o id do recurso).

**Asaas sandbox** (quando a conta existir):
0. Antes de tudo, preencher **nome e CPF/CNPJ do responsável** de pelo menos
   uma unidade (Financeiro → Valor por unidade). Sem isso o provedor real não
   cria o cliente e nenhum boleto sai: a unidade aparece em `naoCobradas` na
   resposta da geração.
1. Criar conta em sandbox.asaas.com; anotar a apiKey da subconta de teste.
2. Na API: `ASAAS_API_URL=https://api-sandbox.asaas.com/v3` e uma
   `FINANCEIRO_CRIPTO_CHAVE` própria. O aviso vermelho do painel some.
3. Painel: informar a apiKey em Financeiro; guardar o segredo de webhook
   exibido (aparece uma única vez).
4. Túnel local (`cloudflared tunnel --url http://localhost:3001`) e registrar
   `https://SEU-TUNEL/v1/webhooks/asaas` no sandbox com o segredo.
5. Gerar cobrança de uma unidade de teste, pagar no simulador do sandbox e
   conferir: cobrança PAGA, push de recibo, inadimplência abatida no painel.
6. Repetir a entrega do webhook no painel do Asaas: a segunda tem que voltar
   `repetido` sem duplicar nada.

**Twilio WhatsApp sandbox** (antes da verificação Meta): configurar
`TWILIO_WHATSAPP_FROM` com o número do sandbox, aderir ao sandbox no celular
de teste, marcar o opt-in do morador de teste e publicar um comunicado. A
mensagem chega no WhatsApp e a notificação fica `WHATSAPP | ENVIADA`.

**Compatibilidade com app publicado.** Antes de subir a API com tipo novo de
feed: a versão da loja continua mandando `?v=` antigo e não pode receber o
tipo novo. A suíte E2E cobre v1 vs v2; ao criar v3, adicionar o caso.

## Checklist antes de ligar um módulo para condomínio real

- [ ] `pnpm typecheck && pnpm test` limpos
- [ ] Suíte E2E completa passando
- [ ] Migrações aplicadas em produção (`migrate deploy`) ANTES do deploy da API
- [ ] Módulo desligado por padrão; ligar só no condomínio combinado
- [ ] Financeiro: `ASAAS_API_URL` de produção, `FINANCEIRO_CRIPTO_CHAVE`
      definitiva (trocá-la depois invalida credenciais gravadas), webhook
      registrado com o segredo, e UMA cobrança de teste paga de verdade antes
      de gerar o mês inteiro
- [ ] WhatsApp: templates aprovados no Meta antes de ligar a flag

## Bugs que esta suíte já pegou (por que ela existe)

1. `include: { unidade: true }` em tabela global fora de `withTenant`
   devolvia nulo e quebrava em 500 (Onda 1) ou lia configuração vazia em
   silêncio, descartando webhooks legítimos (Onda 3).
2. O fallback de WhatsApp só rodava quando NINGUÉM tinha o app: um vizinho
   com o app instalado silenciava o comunicado de todos os outros.
3. `"whatsapp-desligado"` passava numa heurística de prefixo e marcava como
   ENVIADA uma notificação que não saiu. Pego pelo detalhe do triplo
   `canal|status|marcador` que a suíte imprime.
4. O código mandava o UUID interno da unidade como cliente do provedor. O
   stub aceita qualquer coisa, então a suíte passava e **toda cobrança
   falharia contra a API real**: o Asaas exige um cliente criado nele, com
   nome e CPF/CNPJ. Este não foi pego por teste nenhum, e sim lendo a
   documentação do provedor antes de abrir a conta. Lição: stub que aceita
   tudo esconde contrato de terceiro; ao ligar um provedor real pela
   primeira vez, conferir os campos obrigatórios na documentação dele.

Padrão dos três: falha silenciosa que nenhum typecheck pegaria. É o buraco
que só E2E com olhar no banco cobre.
