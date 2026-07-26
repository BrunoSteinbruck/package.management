# Revisão estratégica: 2026-07-19

Auditoria das decisões tomadas desde o início do projeto, com olhar crítico:
o que manteríamos, o que faríamos diferente, e lacunas que a revisão expôs.

## Decisões auditadas: mantidas (e por quê)

| Decisão | Veredito |
|---|---|
| TypeScript ponta a ponta, monorepo pnpm, NestJS + Prisma + Postgres | Certa. Supabase/Firebase teriam acelerado a semana 1, mas bateriam no teto em RLS custom, worker e multi-tenant: migração dolorosa no pior momento. |
| **RLS multi-tenant desde o dia 1** | Custou 3 bugs de curva (ovo-e-galinha do auth, cast `''` em pool, convites cross-tenant): mas **pegou um vazamento real** (pacote/notificação para unidade de outro condomínio) que passaria despercebido. Pagou o preço. |
| Sem senha (OTP por SMS) | Certa para o público. Custo controlado (~R$10-15/mês/condomínio) com renovação silenciosa de sessão. |
| **App único com roteamento por papel** | A melhor decisão de produto da semana: 1 download, 1 QR, metade da manutenção. Premissa "nunca morador-porteiro" documentada. |
| Push como único aviso de pacote + SMS-convite 1x/14d para não-adotantes | Economicamente ótima (fallback ~R$7/mês/condomínio) e vira motor de adoção. |
| ML Kit (OCR no aparelho) no lugar do Google Vision | Elimina billing do Google e custo por leitura; funciona offline. **Pendência: validar precisão em etiqueta real no APK v2.** Vision permanece plugável por env como plano B. |
| Verificação de marca antes de registrar "Guarita" | Evitou registrar nome já usado por concorrente direto (Tecno-Rise): rebrand barato agora, caro depois. |

## O que faríamos diferente (aprendizados)

1. **SDK do Expo**: começar direto no 54 (o que o Expo Go da loja suporta)
   teria evitado a migração 57→54 (~1h perdida). Lição: checar compatibilidade
   do Expo Go antes do scaffold.
2. **Ordem do OCR**: Vision foi implementado antes de checar a exigência de
   billing; com a decisão do dev build, o ML Kit poderia ter sido o plano A
   desde o início. Custo pequeno (a integração Vision segue útil como fallback).
3. **App único**: se decidido na fase de desenho (e não após o teste), teria
   evitado a duplicação inicial de dois apps (~1-2h de refactor). A decisão
   original seguia o design handoff: razoável na época.
4. Nenhum dos desvios custou mais que horas; nenhuma decisão estrutural
   precisou ser revertida.

## Lacunas expostas por esta revisão (novas: entram no plano)

| # | Lacuna | Gravidade | Ação |
|---|---|---|---|
| 1 | **Foto se perde no modo offline**: entrada offline enfileira o pacote SEM a foto (o upload falha e não é retentado). O comprovante é promessa central do produto. | Alta (pré-piloto) | Guardar o URI local na fila e subir no flush. Adicionado ao checklist de retomada. |
| 2 | **Backup do Postgres indefinido** | Alta (pré-produção) | Definir: plano Render com backup + pg_dump diário para R2. |
| 3 | **Termos de uso e Política de Privacidade não existem**: o onboarding já linka "termos de uso" (morto) e a Apple exige URL de privacidade no review. LGPD: condomínio controlador / nós operadores. | Alta (pré-loja) | Redigir drafts (Claude pode gerar) + revisão jurídica. |
| 4 | **"Lembretes automáticos no 3º dia"**: o painel promete e o job não existe. Para quem tem app é um push barato; para não-adotante conflita com a regra "sem app, sem aviso de pacote". | Média | Decisão do usuário pendente: push no 3º dia p/ adotantes + (opcional) exceção de 1 SMS p/ não-adotante com pacote parado. |
| 5 | **Sem observabilidade** (erros/alertas) | Média | Sentry free (API + app) no início do piloto. |
| 6 | **Painel web sem hospedagem definida** | Baixa | Vercel free + CORS_ORIGINS (item pequeno, no checklist). |
| 7 | **Porteiro não pode atuar em 2 condomínios** (telefone único em `usuarios`): relevante para portaria terceirizada/administradoras | Baixa (fase 3) | Documentado como limitação conhecida; modelagem muda quando entrarem administradoras. |
| 8 | Upgrade de volta ao SDK 57+ | Baixa | Opcional; dev builds não dependem do Expo Go. Fazer quando conveniente. |

## Estratégia de produto: confirmações

- **Wedge de encomendas → plataforma**: segue válido; nenhum dado novo contra.
- **Concorrência** (DoctorCondo analisado em 2026-07-19): feature parity no
  fluxo do porteiro: nosso território menos disputado é a **experiência do
  morador** (QR, timeline com fotos, convite). O marketing deve bater aí.
- **Precificação** (R$399/899/1.790): margens melhoraram com ML Kit e
  push-only (~R$150/mês de custo por condomínio piloto). Sem razão para mexer
  antes de dados do piloto.

## Adendo 2026-07-26: preparar o app para virar plataforma

A pergunta era se a separação de interfaces por perfil aguentaria o roadmap,
já que cada feature parecia exigir mexer em três telas.

**A separação fica.** Medindo a feature Avisos & Ocorrências (28 arquivos,
~1.900 linhas), o fanout de perfil custou 4 linhas. O custo estava em outros
lugares, todos endereçados:

| Antes | Agora |
|---|---|
| Tipo de resposta escrito 3 vezes (shared, app, painel) | `packages/shared` é fonte única: enums, dto, api, feed, perfil |
| `Aviso` polimórfico no Postgres virava 4 endpoints e 3 blocos de JSX quase iguais | `ItemFeed` e `GET /morador/feed`; a tela caiu de 235 para 142 linhas e de 3 fetches para 1 |
| Tipo novo de notificação caía num ramo final e sumia | `DESPACHOS` e `apresentar()` são exaustivos: tipo sem tratamento não compila |
| Feature nova era enxertada na home (+49/-11 para caber um botão) | Manifesto de módulos alimenta os slots secundário e rodapé |
| 7 primitivos contra 296 chaves de estilo locais | `Tela`, `ItemLista`, `Selo`, `Vazio`, `BotaoModulo`: tela de lista nova nasce com 0 a 7 chaves |

**A premissa "app único com roteamento por papel" continua, com três perfis e
não dois.** O mobile nunca lia `papel`, então síndico caía na interface do
porteiro. Agora `perfilDe` projeta `tipo` e `papel` em porteiro, morador e
síndico, e o síndico tem pilha própria: 80% do contato dele com o condomínio é
pelo celular. Ele mantém as telas da portaria, que operava de fato.

**Dois bugs saíram no caminho**, ambos do mesmo tipo (contrato implícito entre
camadas): `LEMBRETE` chegava ao app como "Encomenda retirada" para pacote ainda
na portaria, e `Reportar` recebia sempre `unidades[0]`, então morador com duas
unidades não conseguia relatar pela segunda.

**A lacuna #7 fica de pé.** Porteiro em 2 condomínios continua impedido pelo
telefone único em `usuarios`, e nada aqui mexeu na resolução de identidade por
tabela: síndico que também mora no prédio segue perdendo o lado morador. Isso é
remodelagem de identidade, não ajuste de UI, e o gatilho continua sendo a
entrada de administradoras.

**Ainda sem testes automatizados.** A rede é `pnpm typecheck` nos 4 pacotes
(que agora pega divergência de contrato), mais um smoke do feed comparando com
os endpoints antigos. Esses endpoints seguem de pé, marcados deprecated: há app
instalado em produção, e eles só saem quando a versão nova estiver nas lojas.
