# Brief de design — app de encomendas de condomínio (nome em aberto)

## O produto

SaaS multi-condomínio para gestão de encomendas na portaria, nascendo em um
condomínio grande (~300 pacotes/dia) e desenhado para escalar como plataforma:
a encomenda é o gancho de adoção; no futuro o app engloba outros módulos do
condomínio (reservas, comunicados, ocorrências, visitantes). O design deve
nascer com essa ambição: uma identidade que funcione para "o app do
condomínio", não só para pacotes.

**Nome:** em aberto. Candidatos considerados: Chegou, Guarita, Praça, Condô.
O design system não deve depender do nome (logo entra depois).

## Três clientes, dois agora

1. **App do operador** (React Native/Expo, prioridade 1) — porteiro/apoio na
   portaria. Android na prática.
2. **App do morador** (React Native/Expo, prioridade 2) — consumidor final.
3. **Painel web do síndico** (Next.js, depois) — gestão e relatórios.

## Usuários e contexto de uso

- **Operador (porteiro/apoio):** em pé, no balcão, com pressa, muitas vezes com
  um pacote na outra mão. Faixa etária ampla, familiaridade variável com
  tecnologia. Usa o app dezenas de vezes por dia em rajadas (chegada do
  caminhão). Luz variável (guarita à noite). Meta de produto: **registrar um
  pacote em <10 segundos**.
- **Morador:** qualquer perfil de consumidor. Interage por notificação push;
  abre o app para ver pendências, mostrar QR de retirada e conferir histórico.
- **Síndico:** cobra visibilidade — pendências, adoção do app, auditoria.

## Princípios de design (nesta ordem)

1. **Velocidade acima de tudo no app do operador** — botões grandes, uma ação
   principal por tela, mínimo de confirmações (só a unidade é obrigatória).
2. **Legível à distância e para todas as idades** — tipografia generosa,
   contraste alto, alvos de toque grandes.
3. **Estado sempre visível** — online/offline, o que está pendente, o que foi
   notificado. Confiança é o valor central do produto.
4. **Morador = zero fricção** — onboarding em 3 passos (telefone → OTP →
   vínculo), sem senha, sem cadastro longo.
5. **Dark mode desde o início** (guarita à noite; preferência do sistema).

## Telas da v1

### App do operador

1. **Home da portaria** — nome do condomínio + operador logado + selo
   online/offline; dois botões gigantes: "Nova entrada" (abre direto a câmera)
   e "Retirada"; contadores do dia (pacotes na portaria, retiradas hoje).
2. **Entrada — câmera** — câmera aberta com leitor de código de barras ativo;
   fotografou/bipou a etiqueta → segue.
3. **Entrada — confirmação** — miniatura da foto; campos pré-preenchidos por
   OCR (transportadora, rastreio); campo UNIDADE em destaque máximo (sugestão
   do OCR, toque para trocar — única confirmação obrigatória); prateleira em
   chips de 1 toque (lembra a última usada); botão único "Confirmar e
   notificar".
4. **Retirada** — busca por unidade (teclado numérico) ou bipar QR do morador;
   lista de pacotes pendentes da unidade com checkbox, transportadora,
   prateleira e "há quanto tempo"; seleção parcial é caso normal (retira 2 de
   3); aviso do que permanece; botão "Foto e entregar (N)" abre câmera para
   foto de saída e conclui.

### App do morador

1. **Onboarding** — telefone → código OTP por SMS → vínculo à unidade
   (automático se o telefone está no cadastro; senão informa bloco/apto e fica
   pendente de aprovação). Aceite de termos/notificações aqui.
2. **Home — minhas encomendas** — pendentes na portaria com "há quantos dias"
   (badge de urgência se parado há 3+ dias); botão grande "Retirar na portaria".
3. **QR de retirada** — QR dinâmico (renova a cada 60s), instrução de mostrar
   ao porteiro, contagem de pendentes.
4. **Detalhe/histórico** — cada encomenda com foto da entrada, foto da saída,
   horários, quem registrou/entregou. É o comprovante anti-disputa.
5. **Minha unidade** — cartão simples, não um "perfil": lista dos moradores
   vinculados à unidade (transparência: são eles que recebem os avisos) +
   botão "Convidar familiar" (convite feito por morador ativo entra direto;
   auto-cadastro de estranho fica pendente para aprovação do síndico) +
   botão de notificações que abre as preferências em tela própria
   (contato preferencial, silenciar tipos de aviso — conteúdo Fase 2, mas o
   ponto de acesso já existe na v1).

## Voz e conteúdo

- Português brasileiro, tom direto e caloroso, sem jargão. Sentence case.
- Notificações-modelo: *"Chegou! Sua encomenda da Amazon está na portaria."* /
  *"2 encomendas retiradas às 14h. 1 ainda na portaria."*
- O porteiro é tratado como profissional (nunca infantilizar a UI).

## Constraints técnicas

- React Native + Expo; o design system deve virar tokens (cores, tipografia,
  espaçamento, raios) exportáveis para código TS.
- Web (Next.js) compartilhará os mesmos tokens depois.
- Acessibilidade: contraste AA, alvos ≥44pt, suporte a fonte do sistema
  ampliada.
- Fotos de etiquetas/pacotes aparecem na UI — prever contêineres de imagem.

## O que se espera do trabalho de design

1. Identidade visual (paleta, tipografia, iconografia) — neutra quanto ao nome.
2. Design system: tokens + componentes base (botões, campos, chips, cards de
   pacote, badges de status, listas) com variantes light/dark.
3. Alta fidelidade das 9 telas listadas acima (4 do operador, 5 do morador).

## Estado atual do projeto

Backend (NestJS + Postgres multi-tenant) funcionando com o fluxo completo
(entrada, retirada parcial, notificações enfileiradas). Wireframes de baixa
fidelidade das telas acima já validados em conversa — o layout estrutural
descrito por tela reflete esses wireframes aprovados.
