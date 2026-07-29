/**
 * O motor da conciliação: casa cada linha do extrato com uma cobrança paga
 * (entrada) ou uma despesa registrada (saída), e DIZ POR QUE casou.
 *
 * A dor que isto ataca é específica: as ferramentas do mercado marcam a
 * divergência em vermelho e param aí, e o síndico investiga uma a uma, todo
 * mês. A esmagadora maioria das divergências tem duas causas banais, ambas
 * detectáveis por máquina:
 *
 *  1. Data deslocada: pagamento feito na sexta ou no fim de semana só
 *     compensa no dia útil seguinte.
 *  2. Centavos de diferença: tarifa do banco ou arredondamento do provedor.
 *
 * Então cada sugestão sai com nível de confiança e um motivo em português
 * pronto para a prestação de contas. O que o motor NÃO faz: aceitar sozinho.
 * Prestação de contas é responsabilidade civil do síndico; o clique de
 * aceite é dele, o trabalho braçal de descobrir o porquê é nosso.
 *
 * Puro e determinístico de propósito: datas como "YYYY-MM-DD", dinheiro em
 * centavos inteiros, e nenhuma consulta a banco. É o arquivo com vitest.
 */

export interface LinhaExtrato {
  id: string;
  data: string;
  /** Centavos, com sinal: positivo entra, negativo sai. */
  valorCentavos: number;
  descricao: string;
}

export interface Alvo {
  id: string;
  tipo: "COBRANCA" | "DESPESA";
  /** Cobrança: dia do pagamento confirmado. Despesa: dia esperado do débito. */
  data: string;
  /** Centavos, sempre positivo: o sinal vem do tipo. */
  valorCentavos: number;
  rotulo: string;
}

export interface Sugestao {
  extratoItemId: string;
  alvoTipo: Alvo["tipo"];
  alvoId: string;
  confianca: "exata" | "provavel";
  motivo: string;
  deltaDias: number;
  deltaCentavos: number;
}

export interface ResultadoConciliacao {
  sugestoes: Sugestao[];
  /** Linhas do extrato sem nenhum par plausível. */
  semPar: string[];
  /** Alvos que nenhuma linha do extrato cobre (dinheiro que não apareceu). */
  alvosSemExtrato: string[];
}

/** Tolerâncias: além disso vira investigação humana, não sugestão. */
const MAX_DELTA_DIAS = 4;
const MAX_DELTA_CENTAVOS = 100;

function diasEntre(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

/** 0=domingo ... 6=sábado, estável porque a data é ancorada em UTC. */
function diaDaSemana(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay();
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

/**
 * O motivo é o produto: é o que transforma a linha vermelha muda do
 * concorrente na frase que o síndico cola na prestação de contas.
 */
function motivoDe(deltaDias: number, deltaCentavos: number, alvo: Alvo): string {
  const partes: string[] = [];
  if (deltaDias !== 0) {
    const dia = diaDaSemana(alvo.data);
    const fimDeSemana = dia === 5 || dia === 6 || dia === 0;
    const base = `compensado ${Math.abs(deltaDias)} ${plural(Math.abs(deltaDias), "dia", "dias")} ${deltaDias > 0 ? "depois" : "antes"}`;
    partes.push(
      fimDeSemana && deltaDias > 0
        ? `${base} (pagamento de ${dia === 5 ? "sexta" : "fim de semana"}, liquidado no dia útil seguinte)`
        : base,
    );
  }
  if (deltaCentavos !== 0) {
    partes.push(
      `diferença de ${reais(Math.abs(deltaCentavos))} (tarifa ou arredondamento)`,
    );
  }
  if (partes.length === 0) return "valor e data batem";
  return `mesmo ${deltaCentavos === 0 ? "valor" : "dia aproximado"}, ${partes.join("; ")}`;
}

interface Par {
  linha: LinhaExtrato;
  alvo: Alvo;
  deltaDias: number;
  deltaCentavos: number;
  exata: boolean;
}

/**
 * Gera as sugestões. Um alvo casa com no máximo uma linha e vice-versa
 * (atribuição gulosa por qualidade): duas mensalidades iguais no mesmo dia
 * são pares distintos, não a mesma sugestão duas vezes.
 */
export function conciliar(
  extrato: readonly LinhaExtrato[],
  alvos: readonly Alvo[],
): ResultadoConciliacao {
  const pares: Par[] = [];
  for (const linha of extrato) {
    // Entrada só casa com cobrança, saída só com despesa: um estorno de
    // tarifa jamais deve ser sugerido como mensalidade recebida.
    const tipoEsperado = linha.valorCentavos > 0 ? "COBRANCA" : "DESPESA";
    for (const alvo of alvos) {
      if (alvo.tipo !== tipoEsperado) continue;
      const deltaDias = diasEntre(alvo.data, linha.data);
      const deltaCentavos = Math.abs(linha.valorCentavos) - alvo.valorCentavos;
      if (Math.abs(deltaDias) > MAX_DELTA_DIAS) continue;
      if (Math.abs(deltaCentavos) > MAX_DELTA_CENTAVOS) continue;
      // Data E valor divergirem ao mesmo tempo já não é "causa banal": fica
      // para o humano, senão a sugestão vira chute com aparência de certeza.
      if (deltaDias !== 0 && deltaCentavos !== 0) continue;
      pares.push({
        linha,
        alvo,
        deltaDias,
        deltaCentavos,
        exata: deltaDias === 0 && deltaCentavos === 0,
      });
    }
  }

  // Melhores pares primeiro: exatos, depois menor desvio de dias, depois de
  // centavos. O empate final por id mantém o resultado determinístico.
  pares.sort((a, b) => {
    if (a.exata !== b.exata) return a.exata ? -1 : 1;
    const dd = Math.abs(a.deltaDias) - Math.abs(b.deltaDias);
    if (dd !== 0) return dd;
    const dc = Math.abs(a.deltaCentavos) - Math.abs(b.deltaCentavos);
    if (dc !== 0) return dc;
    return a.linha.id.localeCompare(b.linha.id);
  });

  const linhasUsadas = new Set<string>();
  const alvosUsados = new Set<string>();
  const sugestoes: Sugestao[] = [];
  for (const p of pares) {
    if (linhasUsadas.has(p.linha.id) || alvosUsados.has(p.alvo.id)) continue;
    linhasUsadas.add(p.linha.id);
    alvosUsados.add(p.alvo.id);
    sugestoes.push({
      extratoItemId: p.linha.id,
      alvoTipo: p.alvo.tipo,
      alvoId: p.alvo.id,
      confianca: p.exata ? "exata" : "provavel",
      motivo: motivoDe(p.deltaDias, p.deltaCentavos, p.alvo),
      deltaDias: p.deltaDias,
      deltaCentavos: p.deltaCentavos,
    });
  }

  return {
    sugestoes,
    semPar: extrato.filter((l) => !linhasUsadas.has(l.id)).map((l) => l.id),
    alvosSemExtrato: alvos.filter((a) => !alvosUsados.has(a.id)).map((a) => a.id),
  };
}
