import { describe, expect, it } from "vitest";
import { DESPACHOS, type NotifComRelacoes } from "./mensagens";

/**
 * O registry é `Record<TipoNotificacao, Despacho>`, então a exaustividade já
 * vem do compilador. O que ele NÃO garante, e estes testes garantem:
 *
 * 1. As funções de título/corpo aguentam relação nula. O worker carrega as
 *    relações com `include`, mas uma FK `SET NULL` (comunicado apagado,
 *    cobrança cancelada) entrega a notificação com a relação faltando, e um
 *    `.titulo` sobre null derrubaria o ciclo inteiro do worker, parando a
 *    fila de TODOS os condomínios.
 * 2. O mapa de canais pagos não cresce por acidente. Cada `semApp` novo em
 *    "whatsapp" é mensagem paga; em "convite-sms" é o motor de adoção. Uma
 *    linha trocada aqui muda custo e produto sem ninguém notar no diff.
 */

/** Notificação com TODAS as relações nulas: o pior caso que o worker vê. */
function nua(tipo: keyof typeof DESPACHOS): NotifComRelacoes {
  return {
    id: "n1",
    condominioId: "c1",
    pacoteId: null,
    avisoId: null,
    comunicadoId: null,
    visitaId: null,
    cobrancaId: null,
    canal: "PUSH",
    tipo,
    status: "FILA",
    providerMsgId: null,
    criadoEm: new Date(),
    pacote: null,
    aviso: null,
    comunicado: null,
    visita: null,
    cobranca: null,
  } as NotifComRelacoes;
}

const TIPOS = Object.keys(DESPACHOS) as Array<keyof typeof DESPACHOS>;

describe("registry de notificações", () => {
  it("título, corpo e data aguentam relação nula em todo tipo", () => {
    for (const tipo of TIPOS) {
      const d = DESPACHOS[tipo];
      const n = nua(tipo);
      expect(() => d.titulo(n), `${tipo}.titulo com relação nula`).not.toThrow();
      expect(() => d.corpo(n), `${tipo}.corpo com relação nula`).not.toThrow();
      expect(() => d.data(n), `${tipo}.data com relação nula`).not.toThrow();
      expect(typeof d.titulo(n)).toBe("string");
      expect(typeof d.corpo(n)).toBe("string");
    }
  });

  it("só comunicado e cobranças usam o canal pago (whatsapp)", () => {
    const pagos = TIPOS.filter((t) => DESPACHOS[t].semApp === "whatsapp");
    expect(pagos.sort()).toEqual([
      "COBRANCA_GERADA",
      "COBRANCA_LEMBRETE",
      "COBRANCA_VENCIDA",
      "COMUNICADO",
    ]);
  });

  it("encomenda continua sendo o motor de adoção (convite-sms), nunca whatsapp", () => {
    expect(DESPACHOS.ENTRADA.semApp).toBe("convite-sms");
  });

  it("os tipos fora da fila continuam fora (dedup/marcador, nunca enviados por ela)", () => {
    expect(DESPACHOS.LEMBRETE.audiencia).toBe("naoEnfileirada");
    expect(DESPACHOS.CONVITE.audiencia).toBe("naoEnfileirada");
  });

  it("tipo com audiência de unidade sempre embute o id do recurso no data", () => {
    // O app navega pelo `data` do push; um data vazio vira notificação que
    // abre o app em lugar nenhum.
    const comRecurso: Array<[keyof typeof DESPACHOS, string]> = [
      ["ENTRADA", "pacoteId"],
      ["RETIRADA", "pacoteId"],
      ["AVISO", "avisoId"],
      ["OCORRENCIA", "avisoId"],
      ["OCORRENCIA_NOVA", "avisoId"],
      ["COMUNICADO", "comunicadoId"],
      ["VISITA_CHEGOU", "visitaId"],
      ["COBRANCA_GERADA", "cobrancaId"],
      ["COBRANCA_LEMBRETE", "cobrancaId"],
      ["COBRANCA_VENCIDA", "cobrancaId"],
      ["COBRANCA_PAGA", "cobrancaId"],
    ];
    for (const [tipo, chave] of comRecurso) {
      expect(
        Object.keys(DESPACHOS[tipo].data(nua(tipo))),
        `${tipo}.data sem ${chave}`,
      ).toContain(chave);
    }
  });
});
