# Varredura de QA: 30 de julho de 2026

Primeira varredura sistemática de interface do Convivar, depois das cinco
ondas de módulos. O produto tinha 166 testes de lógica pura e uma suíte E2E de
borda HTTP, mas nada que clicasse em botão.

Foram percorridas as 11 visões do painel e as ~21 telas do app, nos três
perfis. Foram achados **31 defeitos**, todos corrigidos: 18 commits, 63
arquivos, e 66 testes novos (100 → 166).

---

## O que foi encontrado, do mais grave ao menos

### 1. O extrato de banco real não importava

`ImportarExtratoSchema` aceita 2 MB de OFX, mas o Express corta o corpo em
100 KB por padrão. Um extrato de 900 lançamentos (136 KB, um mês comum de
condomínio) morria com 413 antes de chegar ao validador.

A conciliação bancária tinha sido entregue três dias antes e **nunca havia
funcionado com um extrato de verdade** — só com os arquivos pequenos dos
testes. Confirmado gerando um OFX de 129 KB, que agora importa.

Corrigido em `apps/api/src/main.ts` (limite de 3 MB, um pouco acima do teto do
schema, para o erro vir do nosso validador e não do body-parser).

### 2. Toda mensagem de erro de formulário do produto era inútil

O painel e o app liam `data.message` da resposta de erro. A API devolve três
formatos diferentes, e o do zod (`{campo: ["erro"]}`) não tem `message`: o
usuário via **"Erro 400"** para qualquer validação errada, em todo formulário
dos dois clientes.

`mensagemDeErro` no shared entende os três formatos. Depois disso, "CPF
inválido" e "Placa inválida" começaram a aparecer de verdade.

### 3. Régua de cobrança perdia dias inteiros de lembretes

A busca casava o vencimento por **igualdade exata** com "daqui a três dias", e
esse dia era calculado em UTC. Das 21h à meia-noite no horário de Brasília o
alvo pulava para o dia seguinte, e aquele lote de moradores **nunca** recebia o
lembrete: no ciclo seguinte a data já era outra. O mesmo buraco se abria a cada
ciclo perdido por deploy ou reinício.

Virou uma janela (`gte hoje, lte daqui a três`), que se recupera sozinha. A
dedup por `COBRANCA_LEMBRETE` continua garantindo um aviso por cobrança.

### 4. "1.500,00" era recusado como se fosse texto

Os campos de dinheiro usavam `Number(texto.replace(",", "."))`:

```
Number("1.500,00".replace(",", "."))  ->  NaN
```

A forma como um brasileiro escreve mil e quinhentos reais era recusada. Na aba
Valor por unidade a linha não salvava; na despesa da conciliação a resposta era
"Preencha descrição e valor", a mesma mensagem de quem deixou o campo vazio. E
a função era generosa demais do outro lado: `"0x10"` entrava como 16 e `"1e5"`
como 100000, direto no valor de uma cobrança.

`lerValorEmReais` no shared, 12 casos de teste. Verificado no painel: "2.750,25"
grava 2750.25 no banco.

### 5. Morador no painel queimava o próprio código

O painel checava o perfil **depois** de verificar o OTP, e checava no cliente: o
servidor consumia o desafio e emitia o token, e o `Login.tsx` descartava. O
morador que digitasse o telefone ali por engano ficava sem o código. Com o
limite de três envios por hora, três tentativas o trancavam fora do próprio
aplicativo por uma hora.

Agora o painel manda `somenteEquipe` e a recusa acontece no servidor, antes de
encerrar o desafio. Provado com curl: 403 sem token, e o mesmo código entra no
app em seguida.

### 6. Unidade fantasma por espaço invisível

`bloco` e `identificacao` são chave de negócio (`@@unique`), mas eram texto
livre. Cadastrar "777", "777 " e "777 " (espaço não separável, colado de
planilha) criava **três unidades** que a tela desenha idênticas. A partir daí a
encomenda entra na errada e o síndico não vê diferença nenhuma.

`ChaveUnidadeSchema` normaliza na borda. Reproduzido antes e depois.

### 7. Sessão expirada virava um beco

Com o token vencido, o painel pintava "Token inválido ou expirado" em Pacotes,
Relatórios e Ocorrências, e ficava ali: nenhuma das três oferecia saída, e a
única forma de voltar era adivinhar que "Sair" resolvia.

No app era pior: a validade só era conferida na abertura. Na portaria, onde o
aparelho fica ligado o turno inteiro, o token vencia com o app aberto e dali em
diante toda tela falhava.

O primeiro 401 agora derruba a sessão e devolve o login, nos dois. Verificado no
navegador e no simulador (rodando a chave JWT do servidor, que é o cenário real
de token que deixa de ser aceito).

### 8. Fila offline descartava recusas em silêncio

O porteiro registrava a encomenda no subsolo sem sinal, subia, o app
sincronizava, e o registro **simplesmente não existia**: a fila jogava fora a
operação recusada pelo servidor sem avisar ninguém. O morador ficava esperando
uma encomenda que não estava no sistema.

`drenarFila` devolve o que descartou, e a home conta: qual operação, de que
hora, por quê, e que precisa refazer. O texto é uma função pura com sete testes.

### 9. Caches de módulo sobreviviam ao logout

Cinco variáveis de módulo (a lista de unidades em quatro telas, mais o progresso
de leituras) viviam enquanto o processo existisse. Na portaria, que é aparelho
compartilhado, **o porteiro seguinte abria a tela de entrada e via as unidades do
condomínio anterior**. O servidor recusaria o POST, mas a lista errada já estava
na tela.

`registrarLimpezaDeSessao` zera todas em `limparSessao`.

### 10. A página que não existia

A barra de paginação era `Array.from({length: Math.min(total, 8)})`. Com 12 por
página, tudo além da 96ª encomenda não tinha botão que chegasse lá: o histórico
de um condomínio movimentado era inalcançável pelo painel.

Verificado com 113 encomendas: antes parava na 8, agora vai até a 10.
`janelaDePaginas` tem dez testes, entre eles "a última página sempre tem botão"
e "nunca se esconde uma página só atrás de reticências".

### 11. Seis endpoints devolviam 500 no lugar de 400

Querystring é texto livre do cliente e ia sem validação para o `where` do Prisma
ou para `new Date()`: `?status=DROP`, `?unidadeId=nao-e-uuid`,
`?competencia=2026-99`, `data: "2026-99-99"`. 500 é o servidor dizendo "a culpa
é minha" quando a culpa é do pedido, e mascara falha real no monitoramento.

Todos viraram 400, com caso na suíte E2E.

### 12. `_` na busca procurava qualquer coisa

O `contains` do Prisma vira `ILIKE '%' || termo || '%'`, e o `%` e o `_`
digitados pelo porteiro continuavam sendo curinga do Postgres. Medido contra a
demo: buscar `_` devolvia as 78 encomendas, e `A_a` casava com cinco que não
tinham `A_a` nenhum.

Não era injeção (o valor sempre foi parametrizado); era semântica de padrão
vazando. `termoLiteral` escapa. Verificado: `BR_99` acha só o literal, sem
arrastar o `BRX99`.

### 13. Relatório mostrava duas linhas "Outras"

O console do painel repetia o aviso de chave duplicada do React, cujo efeito
documentado é omitir ou duplicar filhos. O servidor chamava duas coisas
diferentes pelo mesmo nome: o grupo de `transportadora = null` e o balde da
cauda depois do top 4. Quando o grupo nulo caía no top, o relatório mostrava
duas linhas "Outras" com percentuais diferentes.

Agora são "Não informada" e "Outras".

### 14. Encomenda com transportadora em branco ficava sem título

As telas escrevem `transportadora ?? "Encomenda"`, que cobre null e não cobre
string vazia. A API aceitava `"   "` e devolvia os três espaços intactos: o
cartão da encomenda aparecia sem título, só com a data.

`textoOpcional(max)` apara e trata branco como ausência, em oito campos.

### 15. Alert de cinco botões inalcançável no Android

`Alert.alert` do Android mostra no máximo três botões e descarta o resto em
silêncio. Com Cancelar mais quatro opções de exportação, "Excel geral" e "PDF
geral" não existiam naquele sistema. Quebrado em dois passos.

### 16. Sem saída da câmera em Relatar desvio

A foto é opcional, mas quem abrisse a câmera sem querer só escapava tirando uma
ou matando o app: no iOS não há voltar do sistema, e a fase é estado local, não
rota.

### Os menores, corrigidos junto

- `removerVeiculo` com `catch {}`: a placa continuava na tela como se tivesse
  sido removida, e o morador só descobria ao reabrir.
- `aprovar` sem `try`: o síndico clicava, a linha ficava, nada explicava.
  Ganhou também confirmação (nomeando pessoa e unidade, porque o painel não tem
  como revogar) e trava contra clique duplo.
- `exportarCsv` sem `try`: 42 requisições, uma falha no meio e o navegador
  ficava parado sem baixar nada.
- Publicar comunicado manda push para todo mundo e não tem desfazer: passou a
  confirmar dizendo o alcance.
- Os três chips de status de Pacotes eram excludentes e nenhum desmarcava:
  procurar uma encomenda entregue a partir da tela padrão não devolvia nada.
  Agora há "Todos".
- Visão de módulo desligado deixava o `main` vazio (barra lateral e um retângulo
  branco). Encontrado ao vivo. Agora volta para a Visão geral.
- Os quatro cards de ação da Visão geral eram `div onClick`: funcionavam no
  mouse e não existiam para o teclado nem para leitor de tela. Viraram `button`.
- Doze campos do app e oito do painel sem `maxLength`, agora alinhados ao
  contrato do servidor.
- A leitura do medidor aceitava `"0x10"` como 16 e recusava `"1.234,5"`, que é o
  que o próprio OCR sugere. Unificado com o parser da foto.
- A placa era validada com `length >= 6`: "ABCDEF" ia ao servidor só para voltar
  recusada. `placaValida` exportada do shared, mesma regra nas duas pontas.
- Nome de quem retirou pede duas letras no servidor: com uma inicial o porteiro
  seguia, tirava a foto, e só então a retirada era recusada.
- Datas em UTC no atraso do morador e na data padrão da despesa (que à noite
  lançava no dia seguinte, e na virada do mês na competência errada).
- "Gerar boletos" devolvia 500 com texto de biblioteca de cripto quando a chave
  do servidor mudava. Agora é 503 explicando que a credencial precisa ser
  cadastrada de novo.
- Sem teto: `qrToken` ia inteiro ao JWT, `PlacaSchema` e `responsavelCpfCnpj`
  normalizavam antes de checar o tamanho, arrays sem `max`.
- O texto da primeira tela do app prometia "Você retira com um QR", depois do QR
  ter sido rebaixado a conferência opcional.

---

## Código morto

**Removido** (commit `6f37d31`, separado das correções):

- `AvisarCameraScreen.tsx` e `AvisarConfirmScreen.tsx`: órfãos que voltaram por
  um `git add -A` meu no commit `bacf63a`, depois de o usuário os ter apagado
  deliberadamente. Eram a causa dos sete erros do typecheck do mobile.
- Seis re-exports mortos de `api/types.ts`, quatro estilos órfãos, quatro tokens
  de tema mortos.
- `Vinculo.contatoPreferencial` (zero usos), `CanalNotificacao.SMS`
  (inalcançável), `CanalConvite.POSTER/PORTARIA` (zero escritas). O valor fica no
  enum do Postgres com comentário: remover valor de enum é DDL destrutivo.
- `GET /portaria/avisos`, sem chamador vivo.

**Mantido de propósito**: endpoints `@deprecated` do app antigo (versões nas
lojas ainda os chamam), listas `STATUS_*` de simetria do vocabulário,
`StatusNotificacao.ENTREGUE` (vaga do recibo de push),
`IntegracaoFinanceira.provedor` (gancho multi-provedor), `Visita.baixaPorId` e
`ExtratoItem.importadoEm` (auditoria write-only).

---

## Quatro decisões que são suas

Encontrei estes e **não** mexi, porque a resposta certa depende do que você
quer do produto:

1. **`StatusPacote.EXTRAVIADO`**: existe o filtro "Extraviados" no painel, e
   nenhuma ação em lugar nenhum grava esse status. Ou falta a feature (o
   porteiro marcar uma encomenda como extraviada) ou sobra o filtro.

2. **`Pacote.notaFiscal`**: coletado na entrada, nunca exibido em tela nenhuma.
   Pela LGPD, dado que se coleta é dado que se justifica: ou aparece para
   alguém, ou para de ser coletado.

3. **`POST /conciliacao/:id/desfazer`**: o endpoint existe e funciona, e não há
   botão para ele. Uma conciliação aceita por engano não tem como ser desfeita
   pela interface.

4. **`enum Plano`**: placeholder comercial sem nenhum uso. Vale quando houver
   cobrança por plano; hoje é ruído no schema.

E um achado de dados: existe um condomínio **"Perf 624"** no banco, criado em
26/07, aparentemente de um teste de carga. Não apaguei porque é anterior a esta
varredura e não é meu. Ele entra no laço do worker de push a cada ciclo.

---

## O que NÃO foi testado, e por quê

Isto precisa ficar escrito para o relatório não valer mais do que vale.

**Não houve toque de dedo no app.** A integração nativa do simulador recusa
nesta máquina com "Xcode is installed but not selected", apesar de
`xcode-select -p` apontar corretamente para `/Applications/Xcode.app/...`. O
`idb` também não instalou (o `brew install facebook/fb/idb-companion` pede
reinstalar as Command Line Tools via sudo). As duas correções precisam da senha
do usuário.

No lugar do toque, o app foi exercitado por três caminhos:

- **Ponte com o depurador Hermes** (`Runtime.evaluate` via websocket do Metro):
  avalia JS dentro do app, o que permite ler estado real e disparar as mesmas
  chamadas que os botões disparam.
- **Sessão escrita direto no AsyncStorage do simulador**, para trocar de perfil
  sem gastar o limite de 3 OTP por hora.
- **Screenshots por `xcrun simctl`** das três homes, conferidas visualmente.

Fica de fora, e não foi verificado: **o gesto físico em si** (o toque, o
scroll, o swipe), **os diálogos de permissão de câmera e de push**, e
**regressão visual**. Os defeitos de app corrigidos aqui foram encontrados por
leitura de código e confirmados pelo comportamento observável, não por alguém
tocando na tela.

O painel, esse sim, foi clicado de verdade: botão a botão, com o console lido
depois de cada visão.

---

## Verificação final

```
pnpm typecheck   ->  4 projetos, limpo
pnpm test        ->  23 arquivos, 166 testes (eram 100)
suíte E2E        ->  TODOS OS TESTES PASSARAM
```

O banco de demo foi limpo e re-semeado: das 78 encomendas que estavam lá, 69
eram resíduo da própria suíte E2E (que não devolvia o que criava, agora
devolve) e três eram artefato desta varredura. Voltou para as 14 do seed, 8 na
portaria e 6 entregues.

---

## O que ficou pendente

- **`FINANCEIRO_CRIPTO_CHAVE` só falha no primeiro uso.** Um deploy sem ela
  sobe normalmente e só quebra quando o síndico salva a primeira credencial do
  provedor. Uma checagem na subida evitaria descobrir isso em produção.
- **A suíte E2E gasta 1 de 3 OTP por telefone por hora.** Roda duas vezes
  seguidas; a terceira exige reiniciar a API. Um modo de teste que dispense o
  desafio resolveria.
- **O app não tem `scheme` no `app.json`.** Sem ele não há deep link, e o toque
  na notificação push não leva a uma tela específica. Relevante para as lojas.
- **"Avisar morador" e "Comunicados" usam o mesmo ícone de sino** na home do
  síndico, sendo ações bem diferentes (individual e broadcast).
