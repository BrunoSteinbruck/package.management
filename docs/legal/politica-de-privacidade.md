# Política de Privacidade

> **RASCUNHO — precisa de revisão jurídica antes de publicar.**
> Os campos entre `[[colchetes duplos]]` dependem de decisões pendentes
> (nome do produto, razão social, CNPJ, domínio, e-mail do encarregado).
> Escrito a partir do que o sistema realmente faz, conferido no código em
> 2026-07-25 — se o produto mudar, este texto muda junto.

**Última atualização:** [[DATA DE PUBLICAÇÃO]]

## 1. Quem é quem

O aplicativo **[[NOME DO APP]]** é operado por **[[RAZÃO SOCIAL]]**,
CNPJ [[CNPJ]], com sede em [[ENDEREÇO]] ("nós").

Esta divisão importa e define seus direitos:

- **O seu condomínio é o CONTROLADOR** dos dados. É ele quem decide registrar
  as encomendas que chegam na portaria e quem contrata este serviço.
- **Nós somos o OPERADOR.** Tratamos os dados seguindo as instruções do
  condomínio e não usamos essas informações para finalidade própria.

Na prática: pedidos sobre os registros da portaria (histórico de encomendas,
por exemplo) são decisão do síndico/administradora. Pedidos sobre o seu
cadastro pessoal você resolve direto no app (seção 7).

## 2. Que dados tratamos

**Você fornece:**

| Dado | Para quê |
|---|---|
| Nome e telefone celular | Identificar você e enviar o código de acesso |
| Unidade e bloco | Saber de quem é a encomenda que chegou |
| Placa, modelo e cor do veículo *(opcional)* | Permitir que a portaria avise sobre o seu carro (luz acesa, alarme) |
| Fotos que você envia ao relatar uma ocorrência *(opcional)* | Mostrar o problema à administração |

**Gerado pelo uso do app:**

| Dado | Para quê |
|---|---|
| Fotos da etiqueta e do pacote (entrada e retirada) | Comprovar o que chegou e o que foi entregue |
| Registro de quem recebeu e quem entregou cada pacote, com data e hora | Cadeia de responsabilidade da portaria |
| Identificador de notificação do aparelho (*push token*) e plataforma (iOS/Android) | Enviar o aviso de encomenda |

**O que NÃO coletamos:** localização, agenda de contatos, áudio, dados
bancários ou de cartão. O aplicativo não usa o microfone e não pede acesso a
eles. A câmera é usada apenas quando você abre a tela de foto ou de leitura
de QR code.

**Não há senha.** O acesso é por código de 6 dígitos enviado por SMS.

## 3. Por que podemos tratar esses dados (bases legais — LGPD art. 7º)

- **Execução de contrato / legítimo interesse do condomínio**: registrar
  encomendas, avisar o morador e comprovar a entrega. É a razão de existir do
  serviço contratado pelo condomínio.
- **Cumprimento de obrigação legal**, quando aplicável.
- **Consentimento**, nos itens opcionais: cadastro de veículo e fotos que você
  anexa a uma ocorrência. Pode retirar a qualquer momento, apagando o item.

## 4. Com quem compartilhamos

Não vendemos dados e não fazemos publicidade. Os dados são visíveis para:

- **A portaria e a administração do seu condomínio**, no que cabe a cada
  papel: a portaria vê a unidade de destino do pacote; o síndico vê os
  relatórios do condomínio.
- **Outros moradores vinculados à sua unidade**, que veem o nome e o telefone
  de quem está vinculado (é como você confere quem tem acesso às encomendas
  da sua unidade).

Usamos os seguintes fornecedores de infraestrutura, apenas para fazer o
serviço funcionar:

| Fornecedor | Papel | Onde |
|---|---|---|
| [[PROVEDOR DE SMS — hoje Twilio]] | Envio do código de acesso e do convite | Estados Unidos |
| Apple e Google | Entrega das notificações no aparelho | Estados Unidos |
| [[PROVEDOR DE HOSPEDAGEM — hoje Render]] | Servidor e banco de dados | [[REGIÃO — confirmar no painel]] |
| Cloudflare R2 | Armazenamento das fotos | [[REGIÃO]] |

**Transferência internacional:** parte da infraestrutura fica fora do Brasil.
A transferência ocorre nos termos do art. 33 da LGPD, limitada ao necessário
para prestar o serviço, com contrato e medidas de segurança com cada
fornecedor.

**Leitura da etiqueta (OCR):** o reconhecimento do texto da etiqueta acontece
**dentro do próprio aparelho** da portaria. A imagem não é enviada a nenhum
serviço externo de reconhecimento para essa finalidade.

## 5. Por quanto tempo guardamos

- **Cadastro (nome, telefone, vínculo com a unidade):** enquanto você estiver
  vinculado a uma unidade. Se excluir a conta, é apagado (seção 7).
- **Registros de encomenda e as fotos de comprovação:** [[PRAZO — sugerido 24
  meses, a confirmar com o condomínio]], por serem o comprovante de entrega do
  condomínio. Esses registros pertencem ao condomínio e sobrevivem à exclusão
  da sua conta, mas deixam de estar ligados ao seu nome.
- **Código de acesso (OTP):** 5 minutos.
- **Identificador de notificação:** até você sair da conta, excluí-la ou
  desinstalar o app.

## 6. Segurança

- Todo o tráfego é criptografado (HTTPS/TLS).
- Cada condomínio fica isolado no banco de dados por regra aplicada no próprio
  banco (*row-level security*) — um condomínio não alcança dados de outro.
- As fotos ficam em armazenamento privado; nenhuma tem link público. Cada
  exibição usa uma autorização temporária, presa àquela foto específica.
- O código de acesso é guardado apenas em forma cifrada, expira em 5 minutos e
  bloqueia após 5 tentativas erradas.

Nenhum sistema é infalível. Em caso de incidente de segurança relevante,
comunicaremos o condomínio e a ANPD conforme o art. 48 da LGPD.

## 7. Seus direitos e como exercer

A LGPD (art. 18) garante a você: confirmação e acesso, correção, anonimização
ou eliminação, portabilidade, informação sobre compartilhamento e revogação
do consentimento.

**Excluir sua conta — direto no app, sem falar com ninguém:**

- **Morador:** *Minha unidade* → **Excluir minha conta**
- **Equipe da portaria:** toque no seu avatar na tela inicial → **Excluir
  minha conta**

O que acontece: seu cadastro, seus vínculos e o registro do seu aparelho são
apagados; ocorrências que você tenha reportado continuam com a administração,
mas sem o seu nome. O histórico de encomendas da unidade permanece com o
condomínio, porque é registro dele — e ele deixa de apontar para você.

Para quem faz parte da equipe da portaria, os registros de recebimento e
entrega que você fez continuam existindo (são o comprovante das entregas),
mas seu nome e telefone são removidos deles e o acesso é encerrado.

Também é possível excluir a conta por [[URL DA PÁGINA WEB DE EXCLUSÃO]] ou
escrevendo para [[E-MAIL DE CONTATO]] — o Google Play exige um caminho fora
do app.

**Outros pedidos:** [[E-MAIL DO ENCARREGADO/DPO]]. Respondemos em até 15 dias.
Pedidos sobre os registros da portaria são encaminhados ao condomínio, que é
o controlador.

## 8. Crianças e adolescentes

O aplicativo é destinado a maiores de 18 anos (moradores responsáveis pela
unidade e equipe da portaria). Não coletamos intencionalmente dados de
menores. Se identificarmos um cadastro de menor, ele será removido.

## 9. Mudanças nesta política

Avisaremos no aplicativo com pelo menos [[PRAZO]] de antecedência quando a
mudança for relevante. A data no topo indica a versão vigente.

## 10. Contato

**Encarregado pelo tratamento de dados (DPO):** [[NOME]] — [[E-MAIL]]
**[[RAZÃO SOCIAL]]** — CNPJ [[CNPJ]] — [[ENDEREÇO]]
