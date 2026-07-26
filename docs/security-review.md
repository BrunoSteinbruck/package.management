# Revisão de segurança: Guarita

## Revisão 3 (2026-07-26): leituras de medidores (água/gás)

Escopo: módulo `/leituras` (registro por porteiro/apoio, painel de consumos
do gestor, tarifas, export xlsx/pdf por token), telas novas do app e do
painel, tabelas `leituras_medidor` e `tarifas_consumo`.

### Verificado e correto

- Autorização por papel em toda rota: registrar exige PORTEIRO/APOIO (síndico
  recebe 403, testado); consumos/histórico/tarifas/export-token exigem
  gestor; morador não alcança nada do módulo.
- Isolamento de tenant: todas as queries em `withTenant` + RLS; teste
  cross-tenant real (usuário de outro condomínio: lista vazia e POST em
  unidade alheia → 400). RLS das tabelas novas versionado em migração
  (`20260726190000_rls_leituras`), não só no rls.sql de dev: mesma lição do
  achado 11 da Revisão 1.
- Export segue o modelo do foto-token: JWT dedicado de 10 min com
  `{tipo:"export", condominioId, params}`; o endpoint de download rejeita
  qualquer outro tipo de token (sessão testada → 401) e o AuthGuard rejeita
  o export-token como sessão. JWT de sessão continua nunca indo em URL.
- Filename do `Content-Disposition` montado só com valores de enum/regex
  validados: sem injeção de header.
- Injeção de fórmula em Excel não se aplica: exceljs grava célula string,
  nunca fórmula; PDF é texto plano.
- Corpo e query validados (Zod + enum/regex/caps); nenhuma query raw nova.

### Corrigido nesta revisão

| Sev. | Achado | Correção |
|---|---|---|
| Média | `backup-role.sql` prometia SELECT automático para tabelas futuras, mas `ALTER DEFAULT PRIVILEGES` sem `FOR ROLE` só vale para objetos do superusuário que rodou o script; tabelas criadas pelas migrations (role da API) ficariam fora e o pg_dump passaria a **falhar por inteiro** | Bloco adicional com `FOR ROLE <dono das tabelas>`; **rodar o script de novo** no banco onde ele já tiver sido executado |
| Baixa | Campos de key de foto (leituras e também pacote/retirada/aviso/ocorrência) aceitavam string arbitrária de até 500 chars; a key só era validada na hora de servir | `FotoKeySchema` no shared (espelho do `KEY_FOTO_SEGURA`) aplicado aos 5 campos na borda |
| Baixa | Download do export sem `Cache-Control` | `private, no-store` (relatório tem consumo por unidade e a URL carrega token) |

### Superfície aceita

- Export-token na query string: mesmo modelo auditado do foto-token (curto,
  preso aos parâmetros, um único uso prático). No app a URL abre no navegador
  do sistema e fica no histórico por 10 min de validade.
- Reenvio de leitura sobrescreve valor e foto sem histórico de versões
  (`lidoPorId`/`atualizadoEm` registram só o último). Se auditoria por
  leitura virar requisito, criar tabela de revisões.
- Dado de consumo por unidade é dado pessoal de hábito: exposto apenas a
  gestor (painel/exports) e à equipe da portaria (progresso, necessário à
  operação); morador não vê nada no v1.

---

## Revisão 2 (2026-07-19): delta desde a Revisão 1

Escopo: tudo que entrou depois da revisão 1, gestão de equipe, app único,
convite por SMS, foto-tokens, ocr-texto, listagem filtrada, notificações do
morador, EAS/Twilio.

### Verificado e correto

- Guards presentes em todos os endpoints novos: equipe (gestor), ocr/ocr-texto
  (operador + tenant), morador/* (vínculo ativo), pacotes (tenant via RLS).
- Filtros de listagem parametrizados via Prisma (sem injeção); paginação e
  períodos com cap.
- `.env` fora do git; projectId do EAS não é segredo.
- Telefone normalizado (dígitos) em app e painel antes do envio.
- AuthGuard rejeita tokens que não são de sessão (foto/QR-token barrados).

### Corrigido nesta revisão

| Sev. | Achado | Correção |
|---|---|---|
| Média | `POST /morador/convites` sem teto: morador podia emitir convites (credenciais de vínculo) ilimitados | Cap de **5 convites ativos por unidade** (não usados, não expirados) |

### Recomendações operacionais (fora do código)

1. **Rotacionar credenciais antes de produção**: o Auth Token do Twilio e a
   chave do Vision foram colados no chat durante o setup: regenerar ambos
   nos consoles (5 min) quando o piloto virar produção.
2. **Twilio Geo Permissions**: no console, restringir envio de SMS a
   **Brasil apenas**: é a defesa real contra SMS pumping (fraude que dispara
   OTPs para números premium internacionais). Nosso rate limit ajuda, mas o
   geo-lock corta o golpe na raiz.
3. **Superfície aceita**: `otp/request` envia SMS para números desconhecidos
   por design (necessário ao onboarding por convite). Mitigações: rate limit
   3/telefone/h e 10/IP/h + geo-lock acima + monitorar consumo Twilio.

---

## Revisão 1 (2026-07-16)

Auditoria da Fase 1 antes do piloto. Escopo: API NestJS, os dois apps Expo e
o painel web. Modelo de ameaça central: **isolamento entre condomínios
(multi-tenant)** e **acesso indevido a dados de encomenda/morador**.

## Corrigido nesta revisão

| # | Severidade | Achado | Correção |
|---|---|---|---|
| 1 | **Alta** | Path traversal no OCR: a extensão do arquivo salvo vinha de `originalname` (controlado pelo cliente), permitia gravar fora de `uploads/` ou com extensão arbitrária. | Extensão derivada **sempre do mimetype** (`extPorMime`); mimetype fora da allowlist (JPEG/PNG/WebP) é recusado. Mesma regra no upload direto. |
| 2 | **Alta** | Foto servida com o **JWT de sessão na query string** (`?t=<token>`): token de 30 dias exposto em logs/proxies/histórico e reutilizável em qualquer rota. | **Foto-token dedicado**: JWT curto (1h) com `{tipo:"foto", key}`, preso à foto específica, emitido pela API junto do detalhe. Não abre nenhuma outra rota. |
| 3 | **Alta** | OTP ecoado na resposta HTTP quando `NODE_ENV !== "production"`: um deploy sem `NODE_ENV=production` viraria takeover total (qualquer telefone, código na resposta). | Echo agora exige opt-in explícito `OTP_DEV_ECHO=1`; ausência de flag = nunca vaza, independente de `NODE_ENV`. |
| 4 | **Média** | `JWT_SECRET` caía silenciosamente para `"dev-secret"`: se esquecido em produção, qualquer um forja tokens de qualquer usuário. | A API **não sobe** em produção sem `JWT_SECRET`. |
| 5 | **Média** | Registro de entrada não checava a unidade: com um `unidadeId` de outro condomínio, criava pacote e **notificava moradores alheios** (o RLS bloqueia a leitura, mas o create passava). | Valida a unidade dentro do tenant antes de criar; unidade inexistente → 400. |
| 6 | **Média** | Upload sem restrição de papel nem de tipo: morador (ou qualquer sessão) podia encher o disco com arquivos arbitrários. | Upload restrito a operadores; 1 arquivo; só imagens; 10 MB. |
| 7 | **Média** | Brute force de código de convite: cada tentativa errada apenas retornava erro, sem consumir o desafio OTP → varredura ilimitada de convites com um OTP válido. | Tentativa de convite inválida **incrementa** o contador do OTP (trava em 5). Código de convite já era aleatório de 31^6 e de uso único. |
| 8 | **Média** | OTP guardado como `sha256(codigo)` puro: espaço de 10^6 é trivial de reverter num dump de banco. | Agora **HMAC-SHA256 com o segredo do servidor**: o dump sozinho não deriva o código. |
| 9 | **Baixa** | CORS liberado para qualquer origem. | Em produção, só as origens de `CORS_ORIGINS`; apps nativos não usam CORS. |
| 10 | **Baixa** | Sem cap no período de relatórios (`?dias`): varredura pesada. | Limitado a 365 dias (série diária já limitava a 60). |
| 11 | **Baixa** | RLS aplicado por script fora do fluxo de migração: um `migrate deploy` limpo subiria **sem isolamento**. | Policies viraram **migração versionada** (`20260716220000_enable_rls`), aplicadas no deploy. |
| 12 | **Baixa** | Sem headers de segurança básicos. | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. |
| 13 | **Baixa** (def. em profundidade) | Foto-token e QR-token são JWT do mesmo segredo: poderiam teoricamente passar pelo guard. | `AuthGuard` exige `tipo ∈ {usuario, morador}`; qualquer outro token é 401. |

## Verificado e correto (sem ação)

- **Isolamento multi-tenant por RLS**: confirmado no Postgres, sem `app.condominio_id`
  na transação, `SELECT` em tabelas com tenant retorna 0 linhas. Toda query
  tenant-scoped passa por `withTenant()`. O `NULLIF` no cast evita erro em
  conexão de pool.
- **IDOR nos endpoints do morador**: `detalhePacote`, `emitirQr`, `emitirConvite`
  e `vinculados` só operam sobre unidades com **vínculo ATIVO** do morador
  autenticado. QR-resolve valida que o QR pertence ao condomínio do operador.
- **Autorização de gestor**: import de moradores, aprovação de vínculos e
  listagem de pendentes exigem papel SINDICO/ADMIN.
- **Separação operador × morador**: apps checam `perfil.tipo` no login; a API
  reforça por endpoint (não confia no cliente).
- **Retirada parcial**: valida que todos os `pacoteIds` pertencem ao tenant e
  estão ARMAZENADOS antes de dar baixa.
- **Validação de entrada**: todos os corpos passam por schemas zod; params UUID
  por `ParseUUIDPipe`; SQL só via Prisma (sem concatenação).
- **Sessão sem senha**: OTP com expiração (5 min), uso único, 5 tentativas,
  rate limit de envio (3/telefone/h, 10/IP/h) e renovação silenciosa.

## Pendências de produção (fora do escopo de código, para o deploy)

- Rate limit em memória por processo → mover para **Redis** ao escalar além de
  uma instância (vale para OTP e para o cap de envio).
- Trocar disco local por **R2/S3 com URLs assinadas** (o foto-token já modela
  esse fluxo).
- **HTTPS/TLS** obrigatório no proxy à frente da API (os tokens dependem disso).
- Provedor de **SMS** real e verificação de entrega.
- Retenção/expurgo de fotos e dados conforme **LGPD** (política de retenção).
- Considerar **refresh token revogável** (hoje o JWT de 30 dias não é revogável
  antes de expirar; para revogar acesso imediato, manter blocklist).
