/**
 * Suíte E2E dos módulos: exercita a API de verdade, pela borda HTTP, com o
 * banco olhado por dentro quando a resposta não basta como prova.
 *
 * COMO RODAR (dois terminais):
 *   1. API de dev:  OTP_DEV_ECHO=1 PUSH_DEV_SIMULAR=1 \
 *        FINANCEIRO_CRIPTO_CHAVE=qualquer-frase pnpm dev:api
 *   2. A suíte:     pnpm --filter @pacotes/api test:e2e
 *
 * Pré-requisitos: banco com o seed de demo (contas 51900000001/2/3, código
 * 246810) e a API recém-iniciada. O rate limit de OTP é em memória (3 envios
 * por telefone/hora) e cada execução gasta 1 por conta: depois de 3 rodadas
 * seguidas, reinicie a API.
 *
 * A suíte é AUTOCONTIDA: zera o estado dos módulos no começo e no fim, e não
 * toca nos pacotes/moradores do seed. Roda em ~2 minutos porque os checks
 * que dependem do worker de push (ciclo de 15s) esperam o status mudar no
 * banco em vez de dormir às cegas.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { MODULOS_CONDOMINIO } from "@pacotes/shared";

const API = process.env.E2E_API_URL ?? "http://localhost:3001/v1";
const prisma = new PrismaClient();

// ---------- infra ----------

let falhas: string[] = [];

function checa(rotulo: string, condicao: boolean, detalhe = ""): void {
  const marca = condicao ? "OK   " : "FALHA";
  console.log(`  ${marca} ${rotulo}${detalhe ? `  [${detalhe}]` : ""}`);
  if (!condicao) falhas.push(rotulo);
}

async function req<T = Record<string, unknown>>(
  metodo: string,
  caminho: string,
  opts: { token?: string; corpo?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      ...(opts.corpo !== undefined ? { "content-type": "application/json" } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.corpo !== undefined ? JSON.stringify(opts.corpo) : undefined,
  });
  return (await res.json().catch(() => ({}))) as T;
}

async function login(telefone: string): Promise<string> {
  const pedido = await req<{ statusCode?: number }>("POST", "/auth/otp/request", {
    corpo: { telefone },
  });
  // O rate limit de envio é em memória (3 por telefone/hora) e cada execução
  // gasta um. Sem esta mensagem o erro aparecia como "código expirado", que
  // manda investigar o lugar errado.
  if (pedido.statusCode === 429) {
    throw new Error(
      `Rate limit de OTP atingido para ${telefone}. ` +
        "São 3 execuções por hora; reinicie a API de dev para zerar o contador.",
    );
  }
  const r = await req<{ token?: string }>("POST", "/auth/otp/verify", {
    corpo: { telefone, codigo: "246810" },
  });
  if (!r.token) throw new Error(`Login falhou para ${telefone}: ${JSON.stringify(r)}`);
  return r.token;
}

/** Pede o OTP e devolve o status do envio, sem verificar ainda. */
async function pedirOtp(telefone: string): Promise<void> {
  const pedido = await req<{ statusCode?: number }>("POST", "/auth/otp/request", {
    corpo: { telefone },
  });
  if (pedido.statusCode === 429) {
    throw new Error(
      `Rate limit de OTP atingido para ${telefone}. ` +
        "São 3 execuções por hora; reinicie a API de dev para zerar o contador.",
    );
  }
}

/** Verifica pela porta do painel, que só aceita a equipe do condomínio. */
async function verificarPelaPortaDoPainel(
  telefone: string,
  jaPediu = false,
): Promise<{ status: number; token?: string; tipo?: string }> {
  if (!jaPediu) await pedirOtp(telefone);
  const res = await fetch(`${API}/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ telefone, codigo: "246810", somenteEquipe: true }),
  });
  const corpo = (await res.json().catch(() => ({}))) as {
    token?: string;
    perfil?: { tipo?: string };
  };
  if (!jaPediu) {
    checa(`${telefone} entra pelo painel`, !!corpo.token && corpo.perfil?.tipo === "usuario");
  }
  return { status: res.status, token: corpo.token, tipo: corpo.perfil?.tipo };
}

/**
 * O morador erra de porta, é recusado, e o código dele CONTINUA valendo.
 *
 * O painel checava o perfil depois de verificar o OTP, no cliente: o morador
 * que digitasse o telefone ali por engano recebia a recusa com o código já
 * consumido e, com o limite de três envios por hora, se trancava fora do
 * próprio aplicativo. A recusa passou a acontecer antes de encerrar o
 * desafio, e é isto que a sequência abaixo prova.
 *
 * Também é como o morador loga para o resto da suíte: um OTP só.
 */
async function loginDeMoradorRecusadoNoPainel(telefone: string): Promise<string> {
  await pedirOtp(telefone);
  const recusa = await verificarPelaPortaDoPainel(telefone, true);
  checa("morador no painel leva 403", recusa.status === 403, String(recusa.status));
  checa("e nenhum token é emitido", !recusa.token);

  const noApp = await req<{ token?: string; perfil?: { tipo?: string } }>(
    "POST",
    "/auth/otp/verify",
    { corpo: { telefone, codigo: "246810" } },
  );
  checa("o código sobrevive à recusa e entra no app", !!noApp.token);
  checa("e entra como morador", noApp.perfil?.tipo === "morador");
  if (!noApp.token) throw new Error(`Login do morador falhou: ${JSON.stringify(noApp)}`);
  return noApp.token;
}

/** RLS por transação, como a API faz. O cid vem do nosso próprio banco. */
function comTenant<T>(
  cid: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.condominio_id', '${cid}', true)`,
    );
    return fn(tx);
  });
}

/** Espera uma condição virar verdade (worker de 15s no meio do caminho). */
async function esperar(
  fn: () => Promise<boolean>,
  timeoutMs = 40_000,
): Promise<boolean> {
  const fim = Date.now() + timeoutMs;
  while (Date.now() < fim) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return fn();
}

/** Volta o tenant de teste ao estado de fábrica dos módulos. */
async function zerar(cid: string): Promise<void> {
  await comTenant(cid, async (tx) => {
    await tx.notificacao.deleteMany({
      where: {
        OR: [
          { cobrancaId: { not: null } },
          { comunicadoId: { not: null } },
          { visitaId: { not: null } },
        ],
      },
    });
    // Extrato antes de cobranças e despesas: as FKs apontam para elas.
    await tx.extratoItem.deleteMany({});
    await tx.despesa.deleteMany({});
    await tx.cobranca.deleteMany({});
    await tx.taxaUnidade.deleteMany({});
    await tx.configFinanceiro.deleteMany({});
    await tx.integracaoFinanceira.deleteMany({});
    await tx.comunicadoLeitura.deleteMany({});
    await tx.comunicado.deleteMany({});
    await tx.documento.deleteMany({});
    await tx.visita.deleteMany({});
  });
  await prisma.eventoWebhookFinanceiro.deleteMany({});
  await prisma.morador.updateMany({ data: { aceitaWhatsapp: false } });
  await prisma.condominio.update({ where: { id: cid }, data: { modulos: [] } });
}

// ---------- a suíte ----------

async function main() {
  const saude = await fetch(`${API.replace(/\/v1$/, "")}/v1/health`).catch(() => null);
  if (!saude?.ok) {
    console.error(`API não responde em ${API}. Suba com pnpm dev:api antes.`);
    process.exit(2);
  }

  const porteiro = await login("51900000002");

  // Síndico e morador entram pelo caminho do painel, de propósito: as
  // asserções abaixo saem de graça, sem gastar uma segunda solicitação de OTP
  // dos três que o telefone tem por hora.
  console.log("\n== Login do painel: morador recusado sem perder o código ==");
  const { token: sindico } = await verificarPelaPortaDoPainel("51900000001");
  const morador = await loginDeMoradorRecusadoNoPainel("51900000003");

  // O tenant vem do próprio síndico de demo, e não de um findFirst genérico:
  // o seed tem mais de um condomínio com síndico, e olhar o banco pelo tenant
  // errado faz a suíte inteira mentir.
  const donoDaConta = await prisma.usuario.findFirstOrThrow({
    where: { telefone: { contains: "51900000001" } },
    select: { condominioId: true },
  });
  const cid = donoDaConta.condominioId;
  // As flags de módulo voltam como estavam NO FIM da suíte. Zerá-las e não
  // devolver apagava o menu do painel/app de quem estava explorando a demo:
  // a pessoa recarregava e "sumiu tudo", três vezes seguidas.
  const modulosOriginais = (
    await prisma.condominio.findUniqueOrThrow({
      where: { id: cid },
      select: { modulos: true },
    })
  ).modulos;
  await zerar(cid);

  // ===== Onda 0: flags e capacidades =====
  console.log("\n== Onda 0: flags por condomínio ==");
  {
    const cap = await req<{ modulos: string[] }>("GET", "/conta/capacidades", {
      token: morador,
    });
    checa("capacidades começam vazias", cap.modulos.length === 0);

    const lista = await req<Array<{ id: string; ativo: boolean }>>(
      "GET",
      "/cadastro/modulos",
      { token: sindico },
    );
    checa(
      "síndico vê todos os módulos, todos desligados",
      lista.length === MODULOS_CONDOMINIO.length && lista.every((m) => !m.ativo),
      lista.map((m) => m.id).join(","),
    );
    checa(
      "qr_retirada nasce desligado (recurso rebaixado, não padrão)",
      lista.find((m) => m.id === "qr_retirada")?.ativo === false,
    );
    checa(
      "porteiro não lê a configuração de módulos",
      (await req<{ statusCode?: number }>("GET", "/cadastro/modulos", {
        token: porteiro,
      })).statusCode === 403,
    );
    checa(
      "porteiro não grava módulos",
      (await req<{ statusCode?: number }>("POST", "/cadastro/modulos", {
        token: porteiro,
        corpo: { modulos: [] },
      })).statusCode === 403,
    );

    const salvo = await req<{ modulos: string[] }>("POST", "/cadastro/modulos", {
      token: sindico,
      corpo: { modulos: ["visitantes", "comunicados", "comunicados"] },
    });
    checa(
      "gravação normaliza ordem e duplicata",
      JSON.stringify(salvo.modulos) === JSON.stringify(["comunicados", "visitantes"]),
      salvo.modulos?.join(","),
    );
    checa(
      "módulo inexistente é barrado pelo zod",
      JSON.stringify(
        await req("POST", "/cadastro/modulos", {
          token: sindico,
          corpo: { modulos: ["piscina"] },
        }),
      ).includes("piscina") ||
        (await req<{ statusCode?: number }>("POST", "/cadastro/modulos", {
          token: sindico,
          corpo: { modulos: ["piscina"] },
        })).statusCode === 400,
    );

    const capDepois = await req<{ modulos: string[] }>("GET", "/conta/capacidades", {
      token: morador,
    });
    checa(
      "capacidades do morador refletem o que o síndico ligou",
      JSON.stringify(capDepois.modulos) ===
        JSON.stringify(["comunicados", "visitantes"]),
      capDepois.modulos?.join(","),
    );

    // Valor desconhecido gravado direto no banco não pode vazar ao cliente.
    await prisma.condominio.update({
      where: { id: cid },
      data: { modulos: ["comunicados", "modulo_do_futuro"] },
    });
    const capSujo = await req<{ modulos: string[] }>("GET", "/conta/capacidades", {
      token: morador,
    });
    checa(
      "valor desconhecido no banco não vaza para o cliente",
      !capSujo.modulos.includes("modulo_do_futuro"),
      capSujo.modulos?.join(","),
    );
    await prisma.condominio.update({
      where: { id: cid },
      data: { modulos: ["comunicados", "documentos", "visitantes"] },
    });
  }

  // ===== Retirada: quem recebeu =====
  console.log("\n== Retirada: quem recebeu ==");
  {
    const unidade = (
      await req<Array<{ unidade: { id: string } }>>("GET", "/morador/pacotes", {
        token: morador,
      })
    )[0].unidade;

    const moradores = await req<Array<{ id: string; nome: string }>>(
      "GET",
      `/portaria/unidades/${unidade.id}/moradores`,
      { token: porteiro },
    );
    checa("portaria lista os moradores da unidade", moradores.length > 0);
    checa(
      "a lista traz só id e nome: telefone não serve para dar baixa",
      moradores.every((m) => Object.keys(m).sort().join() === "id,nome"),
    );
    checa(
      "morador não acessa a lista da portaria",
      (await req<{ statusCode?: number }>(
        "GET",
        `/portaria/unidades/${unidade.id}/moradores`,
        { token: morador },
      )).statusCode === 403,
    );

    const novoPacote = async () =>
      (await req<{ id: string }>("POST", "/portaria/pacotes", {
        token: porteiro,
        corpo: { unidadeId: unidade.id, transportadora: "Correios" },
      })).id;

    const p1 = await novoPacote();
    await req("POST", "/portaria/retiradas", {
      token: porteiro,
      corpo: { pacoteIds: [p1], recebidoPorMoradorId: moradores[0].id },
    });
    checa(
      "morador que recebeu aparece no detalhe do pacote",
      (await req<{ retiradoPorNome: string | null }>(
        "GET",
        `/morador/pacotes/${p1}`,
        { token: morador },
      )).retiradoPorNome === moradores[0].nome,
    );

    const p2 = await novoPacote();
    await req("POST", "/portaria/retiradas", {
      token: porteiro,
      corpo: { pacoteIds: [p2], recebidoPorNome: "Dona Cida (faxineira)" },
    });
    checa(
      "quem não é morador entra pelo nome livre",
      (await req<{ retiradoPorNome: string | null }>(
        "GET",
        `/morador/pacotes/${p2}`,
        { token: morador },
      )).retiradoPorNome === "Dona Cida (faxineira)",
    );

    // Morador de OUTRA unidade não pode constar como quem recebeu: seria um
    // registro de custódia apontando para quem não tem nada a ver com a entrega.
    const outraUnidade = (
      await req<Array<{ id: string }>>("GET", "/cadastro/unidades", {
        token: sindico,
      })
    ).find((u) => u.id !== unidade.id);
    if (outraUnidade) {
      const alheios = await req<Array<{ id: string }>>(
        "GET",
        `/portaria/unidades/${outraUnidade.id}/moradores`,
        { token: porteiro },
      );
      const forasteiro = alheios.find(
        (a) => !moradores.some((m) => m.id === a.id),
      );
      if (forasteiro) {
        const p3 = await novoPacote();
        checa(
          "morador de outra unidade é recusado como recebedor",
          (await req<{ statusCode?: number }>("POST", "/portaria/retiradas", {
            token: porteiro,
            corpo: { pacoteIds: [p3], recebidoPorMoradorId: forasteiro.id },
          })).statusCode === 400,
        );
        await req("POST", "/portaria/retiradas", {
          token: porteiro,
          corpo: { pacoteIds: [p3] },
        });
      }
    }

    // A versão do app publicada nas lojas não manda o campo: a entrega não
    // pode passar a falhar por causa disso.
    const p4 = await novoPacote();
    const semRecebedor = await req<{ retiradas?: unknown[] }>(
      "POST",
      "/portaria/retiradas",
      { token: porteiro, corpo: { pacoteIds: [p4] } },
    );
    checa("retirada sem informar quem recebeu continua valendo", !!semRecebedor.retiradas);
    checa(
      "e o campo volta nulo, sem inventar um nome",
      (await req<{ retiradoPorNome: string | null }>(
        "GET",
        `/morador/pacotes/${p4}`,
        { token: morador },
      )).retiradoPorNome === null,
    );
  }

  // ===== Onda 1: comunicados =====
  console.log("\n== Onda 1: comunicados ==");
  let comunicadoId = "";
  {
    const criado = await req<{ id?: string }>("POST", "/cadastro/comunicados", {
      token: sindico,
      corpo: {
        titulo: "Manutencao do elevador (e2e)",
        corpo: "Terca, das 8h as 12h.\nUsem o de servico.",
      },
    });
    comunicadoId = criado.id ?? "";
    checa("síndico publica comunicado", !!comunicadoId);
    checa(
      "porteiro não publica",
      (await req<{ statusCode?: number }>("POST", "/cadastro/comunicados", {
        token: porteiro,
        corpo: { titulo: "Indevido", corpo: "x" },
      })).statusCode === 403,
    );

    type Item = { tipo: string; comunicadoId?: string; lido?: boolean };
    const v1 = await req<Item[]>("GET", "/morador/feed?v=1", { token: morador });
    checa(
      "app v1 NÃO recebe o comunicado (não saberia renderizar)",
      !v1.some((i) => i.tipo === "COMUNICADO"),
      v1.map((i) => i.tipo).join(","),
    );
    const v2 = await req<Item[]>("GET", "/morador/feed?v=2", { token: morador });
    const item = v2.find((i) => i.comunicadoId === comunicadoId);
    checa("app v2 recebe, marcado como não lido", item?.lido === false);

    const antes = (await req<Array<{ id: string; leituras: number }>>(
      "GET",
      "/cadastro/comunicados",
      { token: sindico },
    )).find((c) => c.id === comunicadoId)!.leituras;
    await req("GET", `/morador/comunicados/${comunicadoId}`, { token: morador });
    await req("GET", `/morador/comunicados/${comunicadoId}`, { token: morador });
    const depois = (await req<Array<{ id: string; leituras: number }>>(
      "GET",
      "/cadastro/comunicados",
      { token: sindico },
    )).find((c) => c.id === comunicadoId)!.leituras;
    checa("abrir conta leitura uma única vez (idempotente)", depois === antes + 1,
      `${antes} -> ${depois}`);

    const quem = await req<Array<{ nome: string; unidade: { identificacao: string } }>>(
      "GET",
      `/cadastro/comunicados/${comunicadoId}/leituras`,
      { token: sindico },
    );
    checa(
      "quem leu traz nome e unidade",
      quem.length > 0 && !!quem[0].nome && !!quem[0].unidade.identificacao,
      quem[0] ? `${quem[0].nome} / ${quem[0].unidade.identificacao}` : "vazio",
    );

    // Bloco alheio: invisível e 404, nunca "existe mas sem permissão".
    const blocos = await comTenant(cid, (tx) =>
      tx.unidade.findMany({ where: { bloco: { not: null } }, select: { bloco: true } }),
    );
    const meuBloco = (await req<Array<{ unidade: { bloco: string | null } }>>(
      "GET",
      "/morador/pacotes",
      { token: morador },
    ))[0]?.unidade.bloco;
    const outro = [...new Set(blocos.map((b) => b.bloco))].find((b) => b !== meuBloco);
    if (outro) {
      const alheio = await req<{ id: string }>("POST", "/cadastro/comunicados", {
        token: sindico,
        corpo: { titulo: "So do outro bloco (e2e)", corpo: "x", blocos: [outro] },
      });
      const feed = await req<Item[]>("GET", "/morador/feed?v=2", { token: morador });
      checa(
        "comunicado de outro bloco não aparece no feed",
        !feed.some((i) => i.comunicadoId === alheio.id),
      );
      checa(
        "acesso direto ao comunicado de outro bloco dá 404",
        (await req<{ statusCode?: number }>(
          "GET",
          `/morador/comunicados/${alheio.id}`,
          { token: morador },
        )).statusCode === 404,
      );
    }

    const push = await esperar(async () => {
      const n = await comTenant(cid, (tx) =>
        tx.notificacao.findFirst({
          where: { comunicadoId, tipo: "COMUNICADO" },
        }),
      );
      return n?.status === "ENVIADA";
    });
    checa("push do comunicado foi processado pelo worker", push);
  }

  // ===== Onda 1: documentos =====
  console.log("\n== Onda 1: documentos ==");
  {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "ata.pdf");
    const up = await fetch(`${API}/uploads/documento`, {
      method: "POST",
      headers: { authorization: `Bearer ${sindico}` },
      body: form,
    }).then((r) => r.json() as Promise<{ key?: string; tamanhoBytes?: number }>);
    checa("síndico sobe PDF válido", !!up.key, up.key);

    const falso = new FormData();
    falso.append(
      "file",
      new Blob([Buffer.from("nao sou pdf")], { type: "application/pdf" }),
      "falso.pdf",
    );
    const upFalso = await fetch(`${API}/uploads/documento`, {
      method: "POST",
      headers: { authorization: `Bearer ${sindico}` },
      body: falso,
    });
    checa("arquivo sem assinatura %PDF- é recusado", upFalso.status === 400);

    const formPorteiro = new FormData();
    formPorteiro.append("file", new Blob([pdf], { type: "application/pdf" }), "a.pdf");
    checa(
      "porteiro não sobe documento",
      (
        await fetch(`${API}/uploads/documento`, {
          method: "POST",
          headers: { authorization: `Bearer ${porteiro}` },
          body: formPorteiro,
        })
      ).status === 403,
    );

    await req("POST", "/cadastro/documentos", {
      token: sindico,
      corpo: {
        titulo: "Ata e2e",
        categoria: "ATA",
        arquivoKey: up.key,
        tamanhoBytes: up.tamanhoBytes,
      },
    });
    const docs = await req<
      Array<{ titulo: string; arquivo: { key: string; token: string } }>
    >("GET", "/morador/documentos", { token: morador });
    const meuDoc = docs.find((d) => d.titulo === "Ata e2e");
    checa("morador lista o documento com link assinado", !!meuDoc);
    const arq = meuDoc?.arquivo;
    if (arq) {
      const aberto = await fetch(
        `${API}/uploads/${arq.key}?t=${encodeURIComponent(arq.token)}`,
      );
      checa(
        "PDF abre com o token e o Content-Type certo",
        aberto.status === 200 &&
          aberto.headers.get("content-type") === "application/pdf",
      );
      checa(
        "sem token o arquivo não abre",
        (await fetch(`${API}/uploads/${arq.key}`)).status === 401,
      );
    }
  }

  // ===== Onda 2: visitantes =====
  console.log("\n== Onda 2: visitantes ==");
  {
    const hoje = new Date().toLocaleDateString("en-CA");
    const amanha = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");
    const unidadeId = (await req<Array<{ unidade: { id: string } }>>(
      "GET",
      "/morador/pacotes",
      { token: morador },
    ))[0].unidade.id;

    const v = await req<{ id?: string }>("POST", "/morador/visitas", {
      token: morador,
      corpo: {
        unidadeId,
        nomeVisitante: "Joao da Silva (e2e)",
        documento: "12345678900",
        dataPrevista: hoje,
        janelaInicio: "14:00",
      },
    });
    checa("morador autoriza visita", !!v.id);

    const minhas = await req<
      Array<{ id: string; dataPrevista: string } & Record<string, unknown>>
    >("GET", "/morador/visitas", { token: morador });
    const minha = minhas.find((x) => x.id === v.id);
    checa("data não desloca de dia", minha?.dataPrevista === hoje,
      `${minha?.dataPrevista} vs ${hoje}`);
    checa("morador não vê o documento na resposta dele", !("documento" in (minha ?? {})));

    checa(
      "janela invertida é barrada",
      JSON.stringify(
        await req("POST", "/morador/visitas", {
          token: morador,
          corpo: {
            unidadeId,
            nomeVisitante: "Teste",
            dataPrevista: hoje,
            janelaInicio: "18:00",
            janelaFim: "09:00",
          },
        }),
      ).includes("janelaFim"),
    );

    const amanhaV = await req<{ id: string }>("POST", "/morador/visitas", {
      token: morador,
      corpo: { unidadeId, nomeVisitante: "So amanha (e2e)", dataPrevista: amanha },
    });
    const doDia = await req<
      Array<{ id: string; documento: string | null; autorizadoPor: string }>
    >("GET", "/portaria/visitas-hoje", { token: porteiro });
    checa(
      "portaria vê a visita de hoje, com documento e quem autorizou",
      doDia.some((x) => x.id === v.id && x.documento === "12345678900" && !!x.autorizadoPor),
    );
    checa(
      "visita de amanhã fora da lista de hoje",
      !doDia.some((x) => x.id === amanhaV.id),
    );

    const baixa = await req<{ status?: string }>(
      "POST",
      `/portaria/visitas/${v.id}/chegada`,
      { token: porteiro },
    );
    checa("baixa na chegada", baixa.status === "CHEGOU");
    checa(
      "baixa repetida é recusada",
      (await req<{ statusCode?: number }>(
        "POST",
        `/portaria/visitas/${v.id}/chegada`,
        { token: porteiro },
      )).statusCode === 404,
    );
    checa(
      "morador cancela a visita futura",
      (await req<{ cancelada?: boolean }>(
        "POST",
        `/morador/visitas/${amanhaV.id}/cancelar`,
        { token: morador },
      )).cancelada === true,
    );
    checa(
      "não cancela quem já entrou",
      (await req<{ statusCode?: number }>(
        "POST",
        `/morador/visitas/${v.id}/cancelar`,
        { token: morador },
      )).statusCode === 404,
    );
    checa(
      "morador não acessa a lista da portaria",
      (await req<{ statusCode?: number }>("GET", "/portaria/visitas-hoje", {
        token: morador,
      })).statusCode === 403,
    );
    checa(
      "morador não autoriza para unidade alheia",
      (await req<{ statusCode?: number }>("POST", "/morador/visitas", {
        token: morador,
        corpo: {
          unidadeId: "00000000-0000-0000-0000-000000000000",
          nomeVisitante: "Invasor",
          dataPrevista: hoje,
        },
      })).statusCode === 403,
    );

    const push = await esperar(async () => {
      const n = await comTenant(cid, (tx) =>
        tx.notificacao.findFirst({ where: { visitaId: v.id, tipo: "VISITA_CHEGOU" } }),
      );
      return n?.status === "ENVIADA";
    });
    checa("push de chegada foi processado", push);
  }

  // ===== Onda 3: financeiro =====
  console.log("\n== Onda 3: financeiro ==");
  let unidadeIsolada = "";
  {
    await prisma.condominio.update({
      where: { id: cid },
      data: { modulos: ["comunicados", "documentos", "visitantes", "financeiro"] },
    });

    const cfg = await req<{ emissaoReal?: boolean; geracaoAutomatica?: boolean }>(
      "GET",
      "/cadastro/financeiro/config",
      { token: sindico },
    );
    checa("config avisa que a emissão NÃO é real (stub)", cfg.emissaoReal === false);
    checa("geração automática nasce desligada", cfg.geracaoAutomatica === false);
    checa(
      "morador não acessa a config",
      (await req<{ statusCode?: number }>("GET", "/cadastro/financeiro/config", {
        token: morador,
      })).statusCode === 403,
    );
    await req("POST", "/cadastro/financeiro/config", {
      token: sindico,
      corpo: { diaVencimento: 10, geracaoAutomatica: false, reguaAtiva: true },
    });

    const taxas = await req<Array<{ unidadeId: string; valorMensal: number | null }>>(
      "GET",
      "/cadastro/financeiro/taxas",
      { token: sindico },
    );
    checa(
      "lista de taxas cobre as unidades, sem valor por padrão",
      taxas.length > 0 && taxas.every((t) => t.valorMensal === null),
      `${taxas.length} unidades`,
    );

    // A unidade do morador de teste + uma unidade SEM nenhum device (para a
    // Onda 4 exercitar o WhatsApp como único caminho).
    const unidadeMorador = (await req<Array<{ unidade: { id: string } }>>(
      "GET",
      "/morador/pacotes",
      { token: morador },
    ))[0].unidade.id;
    const vinculos = await prisma.vinculo.findMany({
      where: { condominioId: cid, status: "ATIVO" },
      select: { unidadeId: true, moradorId: true },
    });
    const comDevice = new Set(
      (
        await prisma.device.findMany({
          where: { moradorId: { in: vinculos.map((v) => v.moradorId) } },
          select: { moradorId: true },
        })
      ).map((d) => d.moradorId),
    );
    const porUnidade = new Map<string, string[]>();
    for (const v of vinculos) {
      porUnidade.set(v.unidadeId, [...(porUnidade.get(v.unidadeId) ?? []), v.moradorId]);
    }
    unidadeIsolada =
      [...porUnidade.entries()].find(
        ([, moradores]) => !moradores.some((m) => comDevice.has(m)),
      )?.[0] ?? "";
    checa("seed tem unidade sem nenhum app (para a Onda 4)", !!unidadeIsolada);

    await req("POST", "/cadastro/financeiro/taxas", {
      token: sindico,
      corpo: {
        taxas: [
          { unidadeId: unidadeMorador, valorMensal: 450.5 },
          ...(unidadeIsolada ? [{ unidadeId: unidadeIsolada, valorMensal: 300 }] : []),
        ],
      },
    });
    checa(
      "unidade de fora do condomínio é recusada",
      (await req<{ statusCode?: number }>("POST", "/cadastro/financeiro/taxas", {
        token: sindico,
        corpo: {
          taxas: [
            { unidadeId: "00000000-0000-0000-0000-000000000000", valorMensal: 1 },
          ],
        },
      })).statusCode === 400,
    );

    const competencia = new Date().toISOString().slice(0, 7);
    const g1 = await req<{ criadas?: number; vencimento?: string }>(
      "POST",
      "/cadastro/financeiro/gerar",
      { token: sindico, corpo: { competencia } },
    );
    const esperadas = unidadeIsolada ? 2 : 1;
    checa(
      "gera cobrança só para quem tem valor",
      g1.criadas === esperadas,
      `criadas=${g1.criadas}`,
    );
    checa(
      "vencimento respeita o dia configurado",
      !!g1.vencimento?.endsWith("-10"),
      g1.vencimento,
    );
    const g2 = await req<{ criadas?: number; puladas?: number }>(
      "POST",
      "/cadastro/financeiro/gerar",
      { token: sindico, corpo: { competencia } },
    );
    checa(
      "gerar de novo não cobra em duplicidade",
      g2.criadas === 0 && g2.puladas === esperadas,
      `criadas=${g2.criadas} puladas=${g2.puladas}`,
    );

    const integ = await req<{ webhookSegredo?: string }>(
      "POST",
      "/cadastro/financeiro/integracao",
      { token: sindico, corpo: { contaExternaId: "acc_e2e", apiKey: "$aact_e2e_123" } },
    );
    checa("integração devolve o segredo do webhook", !!integ.webhookSegredo);
    // Corpo VÁLIDO de propósito: com corpo inválido o zod devolve 400 antes
    // de a autorização ser exercitada, e o teste passaria pelo motivo errado.
    checa(
      "porteiro não configura a integração",
      (await req<{ statusCode?: number }>("POST", "/cadastro/financeiro/integracao", {
        token: porteiro,
        corpo: { contaExternaId: "acc_x", apiKey: "chave_valida_123" },
      })).statusCode === 403,
    );
    const guardada = await comTenant(cid, (tx) =>
      tx.integracaoFinanceira.findUnique({ where: { condominioId: cid } }),
    );
    checa(
      "apiKey está cifrada no banco (iv:tag:corpo, sem o texto original)",
      !!guardada &&
        !guardada.apiKeyCifrada.includes("$aact_e2e_123") &&
        guardada.apiKeyCifrada.split(":").length === 3,
    );

    const cobrancas = await req<Array<{ id: string; valor: number }>>(
      "GET",
      `/cadastro/financeiro/cobrancas?competencia=${competencia}`,
      { token: sindico },
    );
    const alvo = cobrancas[0];
    const evento = {
      id: "evt_e2e_1",
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_e2e",
        externalReference: `${cid}:${alvo.id}`,
        value: alvo.valor,
        paymentDate: new Date().toISOString().slice(0, 10),
      },
    };
    checa(
      "webhook sem token é recusado",
      (await req<{ statusCode?: number }>("POST", "/webhooks/asaas", {
        corpo: evento,
      })).statusCode === 401,
    );
    checa(
      "webhook com token errado é recusado",
      (await req<{ statusCode?: number }>("POST", "/webhooks/asaas", {
        corpo: evento,
        headers: { "asaas-access-token": "errado" },
      })).statusCode === 401,
    );
    const auth = { "asaas-access-token": integ.webhookSegredo! };
    checa(
      "webhook com o token certo processa",
      (await req<{ processado?: boolean }>("POST", "/webhooks/asaas", {
        corpo: evento,
        headers: auth,
      })).processado === true,
    );
    checa(
      "reentrega do mesmo evento não processa de novo",
      (await req<{ repetido?: boolean }>("POST", "/webhooks/asaas", {
        corpo: evento,
        headers: auth,
      })).repetido === true,
    );
    checa(
      "referência que não é UUID não chega ao banco",
      (await req<{ ignorado?: boolean }>("POST", "/webhooks/asaas", {
        corpo: {
          id: "evt_e2e_2",
          event: "PAYMENT_RECEIVED",
          payment: { externalReference: "lixo:tambem-lixo" },
        },
        headers: auth,
      })).ignorado === true,
    );

    const depois = await req<Array<{ id: string; status: string; pagoEm: string | null }>>(
      "GET",
      `/cadastro/financeiro/cobrancas?competencia=${competencia}`,
      { token: sindico },
    );
    const paga = depois.find((c) => c.id === alvo.id);
    checa("cobrança ficou PAGA com a data gravada", paga?.status === "PAGA" && !!paga.pagoEm);

    const minhas = await req<
      Array<{ unidade: { identificacao: string }; linhaDigitavel: string | null }>
    >("GET", "/morador/cobrancas", { token: morador });
    checa(
      "morador vê só a própria unidade, com o código para pagar",
      minhas.length >= 1 &&
        new Set(minhas.map((c) => c.unidade.identificacao)).size === 1 &&
        !!minhas[0].linhaDigitavel,
    );
  }

  // ===== Conciliação bancária =====
  console.log("\n== Conciliação bancária ==");
  {
    const despesa = await req<{ id: string }>(
      "POST",
      "/cadastro/financeiro/despesas",
      {
        token: sindico,
        corpo: { descricao: "Elevador (e2e)", valor: 1200, data: "2026-07-10" },
      },
    );
    // O caso número 1 do síndico: despesa esperada na sexta (10/07), débito
    // aparecendo na segunda (13/07). Tem que virar sugestão explicada.
    const ofx = `OFXHEADER:100\n<OFX><BANKTRANLIST><STMTTRN>\n<DTPOSTED>20260713\n<TRNAMT>-1200,00\n<FITID>e2e-fds-1\n<MEMO>PAGTO ELEVADOR\n</STMTTRN><STMTTRN>\n<DTPOSTED>20260714\n<TRNAMT>35.00\n<FITID>e2e-rend-1\n<MEMO>RENDIMENTO\n</STMTTRN></BANKTRANLIST></OFX>`;
    const imp = await req<{ importados: number }>(
      "POST",
      "/cadastro/financeiro/extrato",
      { token: sindico, corpo: { ofx } },
    );
    checa("OFX importado (2 lançamentos)", imp.importados === 2);
    checa(
      "reimportar não duplica",
      (await req<{ importados: number; repetidos: number }>(
        "POST",
        "/cadastro/financeiro/extrato",
        { token: sindico, corpo: { ofx } },
      )).repetidos === 2,
    );

    const painel = await req<{
      sugestoes: Array<{
        extrato: { id: string; descricao: string };
        alvoTipo: "COBRANCA" | "DESPESA";
        alvoId: string;
        confianca: string;
        motivo: string;
      }>;
      semPar: Array<{ descricao: string }>;
    }>("GET", "/cadastro/financeiro/conciliacao", { token: sindico });
    const s = painel.sugestoes.find((x) => x.extrato.descricao === "PAGTO ELEVADOR");
    checa(
      "débito de segunda casa com a despesa de sexta, com o motivo escrito",
      s?.alvoId === despesa.id && !!s?.motivo.includes("sexta"),
      s?.motivo,
    );
    checa(
      "rendimento não vira chute: fica para o humano",
      painel.semPar.some((x) => x.descricao === "RENDIMENTO"),
    );
    if (s) {
      const ac = await req<{ aceitas: number }>(
        "POST",
        "/cadastro/financeiro/conciliacao/aceitar",
        {
          token: sindico,
          corpo: {
            itens: [
              {
                extratoItemId: s.extrato.id,
                alvoTipo: s.alvoTipo,
                alvoId: s.alvoId,
                motivo: s.motivo,
              },
            ],
          },
        },
      );
      checa("aceite grava com a justificativa", ac.aceitas === 1);
      checa(
        "aceitar de novo não duplica o vínculo",
        (await req<{ aceitas: number }>(
          "POST",
          "/cadastro/financeiro/conciliacao/aceitar",
          {
            token: sindico,
            corpo: {
              itens: [
                {
                  extratoItemId: s.extrato.id,
                  alvoTipo: s.alvoTipo,
                  alvoId: s.alvoId,
                  motivo: s.motivo,
                },
              ],
            },
          },
        )).aceitas === 0,
      );
    }
    checa(
      "despesa conciliada não pode ser removida",
      (await req<{ statusCode?: number }>(
        "DELETE",
        `/cadastro/financeiro/despesas/${despesa.id}`,
        { token: sindico },
      )).statusCode === 400,
    );
    checa(
      "porteiro não registra despesa",
      (await req<{ statusCode?: number }>("POST", "/cadastro/financeiro/despesas", {
        token: porteiro,
        corpo: { descricao: "indevida", valor: 10, data: "2026-07-10" },
      })).statusCode === 403,
    );
  }

  // ===== Borda: entrada malformada vira 400, nunca 500 =====
  console.log("\n== Borda: pedido malformado ==");
  {
    /**
     * Todos estes devolviam 500 antes da varredura de QA: querystring é texto
     * livre do cliente, e ia sem validação para o `where` do Prisma ou para
     * `new Date()`. 500 é o servidor dizendo "a culpa é minha" quando a culpa
     * é do pedido, e mascara falha real no monitoramento.
     */
    const status = async (metodo: string, caminho: string, corpo?: unknown) => {
      const res = await fetch(`${API}${caminho}`, {
        method: metodo,
        headers: {
          authorization: `Bearer ${sindico}`,
          ...(corpo !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      });
      return res.status;
    };

    checa(
      "status inválido na query devolve 400",
      (await status("GET", "/cadastro/ocorrencias?status=DROP")) === 400,
    );
    checa(
      "status com emoji devolve 400",
      (await status("GET", "/cadastro/ocorrencias?status=%F0%9F%8E%89")) === 400,
    );
    checa(
      "unidadeId não-uuid na query devolve 400",
      (await status("GET", "/cadastro/visitas?unidadeId=abc")) === 400,
    );
    checa(
      "competência inválida na query devolve 400",
      (await status("GET", "/cadastro/financeiro/cobrancas?competencia=xx")) === 400,
    );
    checa(
      "competência com mês 99 devolve 400",
      (await status("GET", "/cadastro/financeiro/resumo?competencia=2026-99")) === 400,
    );
    // O regex antigo (`\d{2}`) deixava passar mês e dia impossíveis, que
    // viravam Invalid Date lá dentro.
    checa(
      "data 2026-99-99 devolve 400",
      (await status("POST", "/cadastro/financeiro/despesas", {
        descricao: "borda",
        valor: 10,
        data: "2026-99-99",
      })) === 400,
    );
    checa(
      "data 30 de fevereiro devolve 400",
      (await status("POST", "/cadastro/financeiro/despesas", {
        descricao: "borda",
        valor: 10,
        data: "2026-02-30",
      })) === 400,
    );

    // E o caminho feliz continua de pé: validar não pode fechar a porta certa.
    checa(
      "filtros válidos continuam respondendo 200",
      (await status("GET", "/cadastro/ocorrencias?status=ABERTO")) === 200 &&
        (await status("GET", "/cadastro/visitas")) === 200 &&
        (await status("GET", "/cadastro/financeiro/cobrancas")) === 200,
    );

    /**
     * Extrato de tamanho real. O limite padrão do Express (100 KB) recusava
     * com 413 um OFX de um mês comum, tornando a conciliação inutilizável em
     * uso real, embora o schema aceitasse 2 MB.
     */
    const linhas = Array.from({ length: 900 }, (_, i) => {
      // Dia com dois dígitos: o parser exige AAAAMMDD, e "2026091" (sete
      // dígitos) é lido como ilegível, corretamente.
      const dia = String((i % 28) + 1).padStart(2, "0");
      return `<STMTTRN>\n<DTPOSTED>202609${dia}\n<TRNAMT>-${100 + i}.00\n<FITID>e2e-grande-${i}\n<MEMO>LANCAMENTO DE TESTE ${i} COM DESCRICAO LONGA COMO BANCO ESCREVE\n</STMTTRN>`;
    }).join("\n");
    const ofxGrande = `OFXHEADER:100\n<OFX><BANKTRANLIST>${linhas}</BANKTRANLIST></OFX>`;
    checa(
      "OFX de um mês real (>100 KB) importa",
      (
        await req<{ importados?: number }>("POST", "/cadastro/financeiro/extrato", {
          token: sindico,
          corpo: { ofx: ofxGrande },
        })
      ).importados === 900,
      `${Math.round(ofxGrande.length / 1024)} KB`,
    );
  }

  // ===== Onda 4: WhatsApp =====
  console.log("\n== Onda 4: WhatsApp ==");
  if (unidadeIsolada) {
    const p = await req<{ aceitaWhatsapp?: boolean; temApp?: boolean }>(
      "GET",
      "/morador/preferencias",
      { token: morador },
    );
    checa("opt-in nasce desligado (consentimento é ato positivo)", p.aceitaWhatsapp === false);
    checa("resposta diz se o morador tem o app", typeof p.temApp === "boolean");
    checa(
      "morador liga o próprio opt-in",
      (await req<{ aceitaWhatsapp?: boolean }>("POST", "/morador/preferencias/whatsapp", {
        token: morador,
        corpo: { aceita: true },
      })).aceitaWhatsapp === true,
    );
    checa(
      "síndico não mexe na preferência de morador",
      (await req<{ statusCode?: number }>("POST", "/morador/preferencias/whatsapp", {
        token: sindico,
        corpo: { aceita: true },
      })).statusCode === 403,
    );
    await req("POST", "/morador/preferencias/whatsapp", {
      token: morador,
      corpo: { aceita: false },
    });

    // As três portas, observadas pelo marcador que o worker grava na
    // notificação de uma unidade onde NINGUÉM tem o app. A cada caso, uma
    // cobrança de competência nova gera a notificação.
    const moradoresIsolados = (
      await prisma.vinculo.findMany({
        where: { unidadeId: unidadeIsolada, status: "ATIVO" },
        select: { moradorId: true },
      })
    ).map((v) => v.moradorId);

    async function cobrancaMarcador(competencia: string): Promise<string> {
      await req("POST", "/cadastro/financeiro/gerar", {
        token: sindico,
        corpo: { competencia },
      });
      const cobranca = await comTenant(cid, (tx) =>
        tx.cobranca.findFirst({
          where: { unidadeId: unidadeIsolada, competencia: new Date(`${competencia}-01T00:00:00Z`) },
        }),
      );
      await esperar(async () => {
        const n = await comTenant(cid, (tx) =>
          tx.notificacao.findFirst({
            where: { cobrancaId: cobranca!.id, tipo: "COBRANCA_GERADA" },
          }),
        );
        return !!n && n.status !== "FILA";
      });
      const n = await comTenant(cid, (tx) =>
        tx.notificacao.findFirst({
          where: { cobrancaId: cobranca!.id, tipo: "COBRANCA_GERADA" },
        }),
      );
      return `${n?.canal}|${n?.status}|${n?.providerMsgId}`;
    }

    // Porta 1: módulo desligado (financeiro ligado, whatsapp não). O triplo
    // completo importa: um bug real marcava ENVIADA|WHATSAPP aqui só porque
    // a marca "whatsapp-desligado" passava numa heurística de prefixo.
    const m1 = await cobrancaMarcador("2026-10");
    checa(
      "módulo desligado: nada sai, e a notificação NÃO conta como enviada",
      m1 === "PUSH|FALHA|whatsapp-desligado",
      m1,
    );

    // Porta 2: módulo ligado, sem opt-in.
    await prisma.condominio.update({
      where: { id: cid },
      data: {
        modulos: ["comunicados", "documentos", "visitantes", "financeiro", "whatsapp"],
      },
    });
    const m2 = await cobrancaMarcador("2026-11");
    checa(
      "sem opt-in do morador: nada é enviado nem conta como enviado",
      m2 === "PUSH|FALHA|sem-destinatario-whatsapp",
      m2,
    );

    // Portas abertas: módulo + opt-in + sem app.
    await prisma.morador.updateMany({
      where: { id: { in: moradoresIsolados } },
      data: { aceitaWhatsapp: true },
    });
    const m3 = await cobrancaMarcador("2026-12");
    checa(
      "portas abertas: canal vira WHATSAPP e conta como ENVIADA",
      m3.startsWith("WHATSAPP|ENVIADA|whatsapp-"),
      m3,
    );
  } else {
    console.log("  (pulada: sem unidade 100% sem app no seed)");
  }

  // ---------- fim ----------
  await zerar(cid);
  await prisma.condominio.update({
    where: { id: cid },
    data: { modulos: modulosOriginais },
  });
  await prisma.$disconnect();

  console.log(
    `\n${falhas.length === 0 ? "TODOS OS TESTES PASSARAM" : `FALHAS: ${falhas.join("; ")}`}`,
  );
  process.exit(falhas.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Erro na suíte:", e);
  await prisma.$disconnect();
  process.exit(2);
});
