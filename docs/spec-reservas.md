# Especificação: reservas de áreas comuns

Módulo opcional (flag `reservas` em `Condominio.modulos`). Morador reserva
salão de festas, churrasqueira e afins pelo app; síndico define as áreas e as
regras no painel e aprova quando a área exigir; porteiro vê no app quem tem
reserva hoje.

Molde de referência no código: `Visita` (pedido do morador com data futura e
baixa pela equipe) e o manifesto de módulos do app (`modulos.ts`).

## O que fica FORA do v1 (decidido, não esquecido)

- **Grade horária.** v1 trabalha com turnos fixos (manhã, tarde, noite, dia
  inteiro). Cobre salão e churrasqueira, que são o caso dominante; quadra por
  hora fica para v2. Grade horária multiplica a complexidade de conflito e de
  interface por um ganho pequeno no público-alvo atual.
- **Cobrança automática da taxa.** `Cobranca` tem
  `@@unique([unidadeId, competencia])`, que impede segunda cobrança da mesma
  unidade no mês. Integrar taxa de reserva ao financeiro exige o desenho de
  `ItemCobranca` (ver análise de 2026-07-30 sobre composição do boleto), que
  não entra agora. v1 registra e exibe a taxa; a cobrança segue o processo
  que o condomínio já usa.
- **Bloqueio por inadimplência.** Não construir nem quando pedirem: o STJ
  firmou que restringir área comum por inadimplência é ilícito. Recusar o
  pedido é proteção jurídica ao síndico, e vale deixar isso escrito na
  resposta comercial.
- **Item no feed do morador.** Reserva NÃO entra no feed no v1. Motivo:
  tipo novo de `ItemFeed` exige subir `VERSAO_FEED` e tratar cliente antigo
  (armadilha conhecida do `apresentar()`); a tela própria de reservas atende
  sem tocar nisso. Push deep-linka direto para a tela.
- Lembrete de véspera, lista de espera, termo de uso com aceite, caução.

## Modelo de dados

```prisma
enum TurnoReserva {
  MANHA
  TARDE
  NOITE
  DIA_INTEIRO
}

enum StatusReserva {
  PENDENTE    // área exige aprovação e o síndico ainda não decidiu
  CONFIRMADA
  RECUSADA
  CANCELADA   // pelo morador ou pelo síndico, campo canceladaEm diz quando
}

model AreaComum {
  id             String   @id @default(uuid()) @db.Uuid
  condominioId   String   @map("condominio_id") @db.Uuid
  nome           String
  descricao      String?
  capacidade     Int?
  // Snapshot em Reserva.taxa na criação; mudar aqui não muda reserva feita.
  taxa           Decimal  @default(0) @db.Decimal(10, 2)
  exigeAprovacao Boolean  @default(false) @map("exige_aprovacao")
  // Janela de antecedência: pedido só entre (hoje + minHoras) e
  // (hoje + maxDias). Defaults cobrem o uso comum sem configuração.
  antecedenciaMinHoras Int @default(24)  @map("antecedencia_min_horas")
  antecedenciaMaxDias  Int @default(90)  @map("antecedencia_max_dias")
  // Anti-monopólio: reservas futuras ativas por unidade nesta área.
  maxFuturasPorUnidade Int @default(1)   @map("max_futuras_por_unidade")
  turnosDisponiveis TurnoReserva[] @map("turnos_disponiveis")
  // Soft delete, mesmo racional de Documento: área desativada some da lista
  // mas as reservas históricas continuam apontando para ela.
  removidoEm     DateTime? @map("removido_em")
  criadoEm       DateTime  @default(now()) @map("criado_em")

  condominio Condominio @relation(fields: [condominioId], references: [id])
  reservas   Reserva[]

  @@unique([condominioId, nome])
  @@index([condominioId])
  @@map("areas_comuns")
}

model Reserva {
  id           String        @id @default(uuid()) @db.Uuid
  condominioId String        @map("condominio_id") @db.Uuid
  areaId       String        @map("area_id") @db.Uuid
  // Nulos quando é BLOQUEIO do síndico (manutenção): a agenda ocupa,
  // ninguém é notificado.
  unidadeId    String?       @map("unidade_id") @db.Uuid
  moradorId    String?       @map("morador_id") @db.Uuid
  data         DateTime      @db.Date
  turno        TurnoReserva
  status       StatusReserva @default(CONFIRMADA)
  taxa         Decimal       @default(0) @db.Decimal(10, 2)
  motivoRecusa String?       @map("motivo_recusa")
  decididaPorId String?      @map("decidida_por_id") @db.Uuid
  canceladaEm  DateTime?     @map("cancelada_em")
  criadoEm     DateTime      @default(now()) @map("criado_em")

  condominio   Condominio    @relation(fields: [condominioId], references: [id])
  area         AreaComum     @relation(fields: [areaId], references: [id])
  unidade      Unidade?      @relation(fields: [unidadeId], references: [id])
  morador      Morador?      @relation(fields: [moradorId], references: [id])
  decididaPor  Usuario?      @relation(fields: [decididaPorId], references: [id])
  notificacoes Notificacao[]

  @@index([condominioId, data])
  @@index([areaId, data])
  @@index([unidadeId])
  @@map("reservas")
}
```

**Por que não há `@@unique([areaId, data, turno])`:** CANCELADA e RECUSADA
não podem bloquear o slot, e DIA_INTEIRO conflita com qualquer turno do
mesmo dia, o que um unique não expressa. O conflito é checado no service,
dentro da transação do tenant, com re-verificação antes do insert (mesma
técnica da trava de duplicidade de `Cobranca`, só que em código):

```
conflito = existe Reserva na área+data com status PENDENTE|CONFIRMADA
           e (turno = pedido OU turno = DIA_INTEIRO OU pedido = DIA_INTEIRO)
```

**RLS:** as duas tabelas novas recebem a mesma política FORCE RLS por
`condominio_id` das demais. Lembrar da armadilha registrada: buscar `unidade`
sempre dentro de `withTenant`.

**Migração:** aditiva (2 tabelas, 2 enums novos, 2 valores em
`TipoNotificacao`). Nada de alteração em tabela existente, deploy seguro com
app publicado.

## Regras de negócio

1. Reserva nasce `CONFIRMADA` se `exigeAprovacao = false`; senão `PENDENTE`.
2. Validações no pedido: área ativa e com o turno disponível; data dentro da
   janela de antecedência; unidade abaixo de `maxFuturasPorUnidade` (contando
   PENDENTE + CONFIRMADA com data >= hoje); sem conflito de slot.
3. Cancelamento pelo morador: até o fim do dia anterior à data. No dia, só o
   síndico cancela (telefone/painel), porque desistência em cima da hora é
   decisão de gestão, não de sistema.
4. Recusa exige `motivoRecusa` (vai no push e evita a ligação "por quê?").
5. Bloqueio do síndico: linha com `unidadeId`/`moradorId` nulos, status
   CONFIRMADA, sem notificação. Serve para manutenção e dedetização.
6. Multi-vínculo: qualquer morador ATIVO da unidade pode reservar e cancelar
   as reservas da própria unidade (consistente com visitas).

## Notificações

Dois valores novos em `TipoNotificacao`, o `Record` de `DESPACHOS` obriga a
decisão na compilação:

- `RESERVA_CONFIRMADA`: audiência `unidadeDaReserva`, corpo com área, data e
  turno. `semApp: "ignorar"` (não é gancho de adoção nem mensagem que
  justifique custo de WhatsApp).
- `RESERVA_RECUSADA`: idem, corpo inclui o motivo.

Pedido pendente NÃO gera push para o síndico no v1: aparece como contador na
aba do painel (mesmo padrão da fila de aprovação de vínculos). Se o tempo de
resposta virar problema real, v2 avalia digest.

Área sem aprovação: a confirmação é imediata, então só o feedback in-app já
resolve; o push `RESERVA_CONFIRMADA` sai mesmo assim para servir de recibo.

## API

Morador (`/morador`):
- `GET /areas`: áreas ativas com regras e taxa (para a lista e o formulário).
- `GET /areas/:id/agenda?mes=YYYY-MM`: slots ocupados do mês (data + turno,
  sem expor quem reservou; privacidade entre vizinhos).
- `POST /reservas` `{ areaId, data, turno }`: cria, resposta traz status.
- `GET /reservas`: as da minha unidade, futuras e últimas 90 dias.
- `DELETE /reservas/:id`: cancela (regra 3).

Equipe (`/portaria`):
- `GET /reservas/hoje`: confirmadas do dia, com área, unidade e nome (espelho
  de `VisitasHoje`).

Painel (`/cadastro` ou módulo próprio `/reservas`):
- CRUD de `AreaComum` (delete = soft delete).
- `GET /reservas?mes=&areaId=&status=`: agenda e fila.
- `PATCH /reservas/:id/decidir` `{ aprovar: boolean, motivo? }`.
- `POST /reservas/bloqueio` `{ areaId, data, turno }`.

Tudo atrás da flag `reservas`: rota de módulo desligado responde 403 com a
mensagem padrão de módulo não contratado.

## Telas

App morador (2 telas novas):
- `ReservasScreen`: minhas reservas + lista de áreas com botão reservar.
  Entrada no manifesto: slot `secundario`, flag `reservas`, ícone calendário.
- `NovaReservaScreen`: área, calendário do mês com dias ocupados
  (`GET agenda`), turno, resumo com taxa, confirmar. Reaproveita o padrão
  visual de `NovaVisitaScreen`.

App equipe (1 tela):
- `ReservasHojeScreen`: lista do dia. Slot `secundario`, perfis porteiro e
  síndico, flag `reservas`. Espelha `VisitasHojeScreen`.

Painel web (1 seção):
- Aba Reservas: subaba Áreas (CRUD), subaba Agenda (mês, filtro por área,
  pendentes no topo com aprovar/recusar e motivo). Contador de pendentes no
  menu. Configurações ganha o toggle do módulo (já é genérico por flag).

## Testes

- Unidade: conflito de slot (turno x turno, turno x DIA_INTEIRO, cancelada
  não bloqueia), janela de antecedência, limite por unidade, transições de
  status permitidas.
- E2E (suite `run.ts`): criar área, reservar sem aprovação (nasce
  CONFIRMADA), reservar com aprovação e recusar com motivo, conflito
  devolve 409, cancelar dentro e fora do prazo, flag desligada bloqueia
  rota, bloqueio do síndico ocupa agenda.
- Lembrete operacional: a suíte E2E apaga os dados da demo; rodar o seed de
  novo depois.

## Dimensionamento (esforço concentrado)

| Fatia | Estimativa |
|---|---|
| Schema, migração, RLS, enums | 1 dia |
| Service + controllers + validações + unidade | 2 a 3 dias |
| Painel (áreas, agenda, fila) | 2 a 3 dias |
| App morador (2 telas + manifesto + navegação) | 2 a 3 dias |
| App equipe (ReservasHoje) | 1 dia |
| Despachos de push + E2E + seed de demo | 1 a 2 dias |
| **Total** | **9 a 13 dias úteis** |

Referência de proporção: o módulo de despesa/prestação de contas do briefing
está estimado em 6 a 10 semanas. Reservas custa cerca de um quarto disso.

## Decisões em aberto (travam o início)

1. **Turnos fixos bastam para o piloto?** Se algum condomínio do síndico
   entrevistado precisar de quadra por hora, o v1 não atende e é melhor
   saber antes.
2. **Padrão de `exigeAprovacao`.** Sugestão: false (confirmação imediata).
   Aprovação manual devolve ao síndico o trabalho que o módulo promete
   tirar; quem quiser controle liga por área.
3. **Taxa no v1 mostra e não cobra.** Confirmar que o processo de cobrança
   atual do condomínio absorve isso (em geral vai no boleto seguinte, feito
   pela administradora ou manualmente).
