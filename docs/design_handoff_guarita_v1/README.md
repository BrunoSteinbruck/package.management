# Handoff: Guarita — app de encomendas de condomínio (design v1)

## Overview
SaaS multi-condomínio de gestão de encomendas na portaria. Três superfícies:
1. **App do operador** (portaria, Android): registrar entrada de pacotes com câmera/OCR e entregar na retirada.
2. **App do morador** (Android): aviso de chegada, QR de retirada, histórico com comprovante.
3. **Painel web do síndico**: dashboard, lista/auditoria de pacotes, relatórios.

Nome provisório do produto: **Guarita** (tweakável no design; alternativas: Chegou, Condô, Praça). Condomínio de exemplo: Residencial Aurora.

## About the Design Files
Os arquivos deste pacote são **referências de design criadas em HTML** — protótipos que mostram aparência e comportamento pretendidos, não código de produção. A tarefa é **recriar estas telas no ambiente do monorepo existente** (`sistema pacotes/`): apps Expo/React Native (`apps/operador`, e o futuro app do morador), API NestJS + Prisma (`apps/api`) e schemas compartilhados em `packages/shared` (zod). O painel do síndico não tem app ainda — escolha o padrão do repo (sugestão: React + Vite ou Next.js dentro de `apps/`). Não portar o HTML diretamente.

## Fidelity
**High-fidelity.** Cores, tipografia, espaçamentos, raios e copy são finais. Recriar pixel-perfect com os componentes do ambiente alvo (React Native: `View`/`Pressable`/`FlatList`; web: componentes próprios). As fotos de pacote/etiqueta são placeholders listrados — substituir por imagens reais da câmera.

## Files
- `Guarita - Telas v1.dc.html` — canvas com as 12 telas (fonte da verdade). IDs 1a–1l.
- `Guarita - Deck v1.dc.html` — mesmas telas em formato apresentação (contexto, não referência de medidas).
- `android-frame.jsx`, `browser-window.jsx`, `deck-stage.js`, `support.js` — infraestrutura do preview; ignorar na implementação.

Abra `Guarita - Telas v1.dc.html` num navegador para ver tudo. Cada tela está dentro de uma moldura Android (viewport útil ≈ 412×892 px lógicos) ou janela de browser (1360×850).

## Design Tokens

### Cores
| Token | Hex | Uso |
|---|---|---|
| verde-marca | `#175C38` | headers, sidebar, botões secundários, bordas ativas |
| verde-marca-escuro | `#0F4728` | fim dos gradientes (`linear-gradient(160deg,#175C38,#0F4728)`) |
| verde-ação | `#00A85A` | CTA primário (gradiente `135deg, #00A85A → #00803E`), toggles on, barras de gráfico |
| verde-ação-escuro | `#00803E` | fim do gradiente do CTA |
| verde-claro-acento | `#7CE3A8` | detalhes sobre fundo verde (kickers, ícones, dot online) |
| verde-texto-ok | `#0F7A44` | texto de status positivo |
| verde-bg-ok | `#EAF6EE` | fundo de badge/ícone positivo |
| tinta | `#17251C` | texto principal |
| texto-secundário | `#5E6E63` | texto de apoio |
| texto-terciário | `#7A8A7E` / `#9FB0A4` | hints, chevrons |
| fundo-app | `#F3F5F2` | fundo de tela light |
| fundo-canvas | `#E9EDE9` | fundo do canvas (não é do app) |
| borda-card | `#E3EAE4` | borda 1px de cards brancos |
| borda-chip | `#C7D2C9` | borda 1.5px de chips inativos |
| divisor | `#EEF2EE` | linhas internas de lista |
| toggle-off / barras claras | `#D8E0D9` / `#BFDCC9` | toggle off, série secundária de gráfico |
| alerta-texto | `#B45309` | badges "há X dias" |
| alerta-fundo | `#FDF0DC` | fundo dos badges de atraso |
| notificação | `#D9480F` / `#D97706` | dot de notificação / dot de aviso |
| câmera-fundo | `#12160F` + listras `#1B2418`/`#161D13` | tela da câmera (dark) |
| scanner | `#3FD98A` | cantos e linha de scan do viewfinder |

### Tipografia
- Stack do sistema: `-apple-system, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif` (React Native: fonte padrão da plataforma). **Nenhuma webfont.**
- Pesos: 700 títulos/números grandes, 600 subtítulos/botões/badges, 500 texto de apoio, 400 hints.
- Escala mobile: título de tela 19px; número hero 34–46px; CTA 20–23px; corpo 15–17px; apoio 13–13.5px; kicker 12–13px uppercase, letter-spacing 1–2px. Nada abaixo de 12px.
- Logo: nome em lowercase, peso 700, letter-spacing −0.5px.

### Espaçamento e formas
- Padding lateral de tela mobile: 16–20px; gaps entre cards: 12–16px.
- Raios: cards 20px; tiles/CTAs 22–26px; sheet que sobe do header verde 28px (só em cima); chips/pills/busca 999px; inputs 18px; fotos placeholder 10–14px; sidebar itens 12px; cards web 18px.
- Sombra do CTA verde: `0 8px 20px rgba(0,140,70,.3)` (tile grande: `0 10px 24px rgba(0,140,70,.32)`).
- Toggle: 50×29px, knob 23px branco.
- Alvos de toque ≥ 44px sempre.

## Screens / Views

### App do operador (Android)

**1a. Home da portaria** — header em gradiente verde (logo lowercase + pill "Online" com dot `#7CE3A8`; nome do condomínio 25px/700 + "Carlos Mendes · Portaria"; avatar circular com iniciais). Corpo `#F3F5F2` com raio 28px em cima contendo: tile CTA **"Nova entrada"** (190px alto, gradiente verde-ação, ícone câmera 46px, título 30px/700, sub "Abre a câmera direto"), tile **"Retirada"** (120px, `#175C38` sólido, ícone QR, 27px/700), duas stat cards brancas lado a lado ("38 / na portaria agora", "112 / retiradas hoje", número 34px/700), e linha de aviso central com dot laranja "12 encomendas paradas há 3+ dias". Pressed state dos tiles: `scale(0.98)`.

**1b. Entrada — câmera** (dark `#12160F`) — top bar: botão fechar circular translúcido, título "Nova entrada", botão flash. Viewfinder central 310×225 com 4 cantos em L (4px `#3FD98A`, raio 14px no canto externo) e linha de scan animada (translateY 0→180px, 2.6s ease-in-out loop). Pill "Leitor de código ativo" com dot pulsante. Hint: "Aponte para a etiqueta — o código é lido sozinho". Rodapé: pills "Digitar código" e "Sem etiqueta" + shutter branco 78px com anel translúcido de 5px.
Comportamento: leitor de código de barras roda contínuo; ao reconhecer, dispara a foto e navega para 1c. Shutter = captura manual. "Sem etiqueta" pula OCR e vai para 1c vazio.

**1c. Entrada — confirmação** — header com voltar + "Confirmar entrada" + "2 de 2". Card branco com thumb da foto da etiqueta (92px) + campos pré-preenchidos pelo OCR: TRANSPORTADORA "Amazon", CÓDIGO DE BARRAS "BR7492810334BR" (mono), chevron para editar. Card **Unidade** em destaque (`#F0FBF4`, borda 2.5px `#00A85A`): kicker "UNIDADE", valor "B · 302" a 46px/700, hint "Sugerida pela etiqueta · toque para trocar", chevron. Seletor de **Prateleira** em chips pill (A1 A2 B1 **B2** C1; ativo = `#175C38` com check; hint "B2 foi a última usada" — pré-selecionar a última usada). CTA "Confirmar e notificar" (72px, gradiente, check) + microcopy "O morador recebe o aviso na hora".
Comportamento: confirmar → POST pacote, notifica morador, volta pra 1b pronto pro próximo (fluxo em lote).

**1d. Retirada** — header voltar + "Retirada". Busca pill com borda `#175C38` (autofoco, teclado numérico; cursor piscando após "302") + botão "Bipar QR" (`#175C38`). Resultado: "B · 302" 28px/700 + "3 encomendas na portaria". Lista de cards selecionáveis: selecionado = borda 2px `#00A85A` + checkbox quadrado 30px verde com check; não selecionado = borda `#E3EAE4` + checkbox outline. Cada card: thumb 52px, transportadora 17.5px/700, "Prateleira X · há N dias" (atraso ≥3 dias vira badge âmbar). Nota "1 encomenda permanece na portaria" em card `#EEF3EE`. CTA "Foto e entregar (2)" com contagem dinâmica.
Comportamento: QR do morador seleciona a unidade direto. Confirmar abre câmera para foto de comprovação, marca entregues, atualiza contadores.

### App do morador (Android)

**1e. Onboarding — telefone** — header gradiente com logo `#7CE3A8`, headline 31px/700 "Suas encomendas, sem espera na portaria", sub "Avisamos quando chegar. Você retira com um QR.". Sheet com stepper de 3 passos (Telefone ativo verde / Código / Unidade — barras 5px), campo "Seu celular" com prefixo +55 separado por divisor, hint "Sem senha e sem cadastro longo — só o número.", CTA "Receber código por SMS" (64px), legal 12.5px com link "termos de uso".
Fluxo: telefone → SMS 6 dígitos → seleção/confirmação de unidade (convite do titular ou aprovação da administração).

**1f. Home — minhas encomendas** — header "Oi, Marina" 24px/700 + "Residencial Aurora · B 302" (unidade com `white-space:nowrap`), sino com dot `#D9480F`. Seção "Na portaria" com badge contador pill verde "2". Cards: thumb 58px, transportadora 17px/700, "Chegou ontem às 14h"; atraso = "Há 5 dias" + badge âmbar "retire logo"; chevron. CTA "Retirar na portaria" (66px, gradiente, ícone QR) → 1g. Seção "Histórico": lista branca com ícone check circular `#EAF6EE`/`#0F7A44`, "Entregue · sábado, 14h" → 1h.

**1g. QR de retirada** — fundo gradiente verde, header voltar + "Retirar na portaria". Card branco central (raio 28, sombra `0 20px 50px rgba(0,0,0,.3)`) com QR 216px (gerar QR real dinâmico) + barra de progresso 6px verde que esvazia em 60s linear + "O código renova a cada 60 s". Pill translúcida "2 encomendas para retirar". Hint "Mostre este código ao porteiro. Ele confere e registra a entrega com foto."
Comportamento: token rotativo de 60s; regenerar automático; brilho da tela no máximo enquanto aberta (nice-to-have).

**1h. Detalhe da encomenda** — header voltar + "Encomenda" + badge "Entregue" (`#EAF6EE`/`#0F7A44`). Card com "Amazon" 21px/700 + código mono à direita, duas fotos lado a lado 120px ("foto da entrada" / "foto da entrega"). Card timeline vertical: dot verde `#00A85A` + linha 2.5px `#D8E0D9` → "Recebida na portaria / ter, 12 jul · 14h32 · por Carlos (portaria) / Prateleira B2 · morador avisado às 14h33"; dot `#175C38` → "Entregue / qui, 14 jul · 18h05 · retirada por Marina". Card nota `#EEF3EE` com ícone escudo: "Este registro com fotos e horários vale como comprovante de entrega."

**1i. Minha unidade** — header voltar + "Minha unidade". Card gradiente verde: kicker "RESIDENCIAL AURORA" (`#7CE3A8`), "Bloco B · Apto 302" 34px/700. Seção "Moradores": lista com avatar de iniciais (titular `#175C38`, demais `#5E6E63`), nome + telefone, badge "Titular"; botão outline 56px "Convidar familiar" (borda 2px `#175C38`, ícone +). Linha única **"Notificações"** (card branco: ícone sino em círculo `#EAF6EE`, título + sub "Todos os vinculados recebem os avisos", chevron) → abre tela/sheet de configurações de notificação (Fase 2; na v1 todo vinculado recebe tudo).
Estratégico: o convite de familiar é o mecanismo de crescimento dentro do prédio — não cortar.

### Painel web do síndico (1360×850, sidebar 236px)

Layout comum: sidebar em gradiente vertical `#175C38→#0F4728` com logo, itens (Visão geral, Pacotes, Relatórios, Moradores, Configurações; ativo = fundo `rgba(255,255,255,.16)` raio 12px, texto branco; inativo 75% branco) e card do condomínio no rodapé. Conteúdo com padding 26×30px sobre `#F3F5F2`.

**1j. Visão geral** — título + data; usuária "Sandra Lima · Síndica" com avatar. 4 stat cards (número 34px/700): Na portaria agora 38 (sub âmbar "12 há 3+ dias"), Entradas hoje 124, Retiradas hoje 112 (sub "tempo médio: 1,4 dia"), Adoção do app 71% em verde (sub "213 de 300 unidades"). Grid 1.7fr/1fr: gráfico de barras pareadas 14 dias (entradas `#00A85A`, retiradas `#BFDCC9`, legenda com quadradinhos) + card "Paradas há 3+ dias" (linhas: unidade 700, transportadora · prateleira, badge âmbar "N dias"; link "ver todas" → 1k; nota "Lembretes automáticos são enviados no 3º dia.").

**1k. Pacotes** — título + botão outline "Exportar CSV". Filtros: busca pill 280px ("Unidade, rastreio, transportadora…"), chips: **Na portaria · 38** (ativo), Entregues, Extraviados, Últimos 30 dias. Tabela em card (grid `90px 1.1fr 1.5fr 1fr 1fr 1fr 110px`): UNIDADE / TRANSPORTADORA / RASTREIO (mono 12.5px) / PRATELEIRA / ENTRADA / TEMPO (≥3 dias em âmbar 600) / STATUS (badge pill "na portaria" verde-claro ou "entregue" cinza). Paginação com página ativa `#175C38`. Clicar numa linha → detalhe com fotos e timeline (mesmo modelo do 1h).

**1l. Relatórios** — título + chip "Últimos 30 dias" + "Exportar PDF". 3 stat cards: Tempo médio até retirada **1,4 dia** (delta verde "0,3 dia a menos que junho"), Volume no mês **3.482**, Notificações entregues **98,2%** (sub "push + WhatsApp fallback"). Grid 2 colunas: "Volume por transportadora" (barras horizontais 22px, trilha `#EEF2EE`, preenchimento `#00A85A`, rótulo 110px + % à direita: Amazon 42, Mercado Livre 28, Shopee 14, Correios 10, Outras 6) e "Retiradas por horário" (barras verticais 6 faixas "6 a 9h"…"21 a 24h", intensidade de verde proporcional, pico 18–21h a 92%; nota "Pico entre 18h e 21h: reforce a portaria nesse turno.").

## Interactions & Behavior
- Pressed state universal em tiles/CTAs: `transform: scale(0.98)`.
- Animações: linha de scan (2.6s loop), dot pulsante (opacity 1→0.35, 1.6s), cursor piscando, barra do QR (60s linear, reinicia com novo token).
- Navegação operador: home → câmera → confirmação → (loop câmera). Home → retirada → foto → home.
- Navegação morador: home → QR; home → detalhe; header → unidade (1i); 1i → notificações.
- Estados não desenhados (implementar seguindo os tokens): offline/fila de sync do operador, lista vazia ("Nenhuma encomenda na portaria"), erro de OCR (campos vazios editáveis), loading (skeleton cinza `#E9EDE8`).

## State Management (sugestão)
- Operador: fila local de entradas pendentes de sync (funciona offline, brief exige), pacote em edição (foto, ocr, unidade, prateleira), seleção de retirada por unidade.
- Morador: sessão por telefone (JWT), lista de pacotes por status, token QR rotativo.
- Síndico: filtros de tabela, período de relatório. Dados via API NestJS existente; validar payloads com os schemas zod de `packages/shared`.

## Assets
- Nenhuma imagem externa. Ícones são SVG stroke 1.8–2.4px, linecap/linejoin round, 24×24 viewBox (câmera, QR, busca, sino, check, chevron, seta, flash, escudo, casa, caixa, gráfico, pessoas, engrenagem) — recriar com a lib de ícones do repo ou copiar os paths do HTML.
- QR do design é decorativo; usar gerador real.
- Placeholders listrados (`repeating-linear-gradient(45deg,#E9EDE8 0 10px,#F2F5F1 10px 20px)` + borda dashed `#C7D2C9`) marcam onde entram fotos reais.
