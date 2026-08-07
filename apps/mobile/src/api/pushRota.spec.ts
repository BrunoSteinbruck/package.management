import { describe, expect, it } from "vitest";
import type { JwtPayload } from "@pacotes/shared";
import { rotaDoPush } from "./pushRota";

const MORADOR: JwtPayload = { sub: "m1", tipo: "morador", nome: "Ana" };
const SINDICO: JwtPayload = {
  sub: "u1",
  tipo: "usuario",
  nome: "Bruno",
  papel: "SINDICO",
};
const PORTEIRO: JwtPayload = {
  sub: "u2",
  tipo: "usuario",
  nome: "Carlos",
  papel: "PORTEIRO",
};

describe("destino do toque na notificação", () => {
  it("encomenda abre a encomenda", () => {
    expect(rotaDoPush(MORADOR, { pacoteId: "p1" })).toEqual({
      rota: "Detalhe",
      params: { pacoteId: "p1" },
    });
  });

  it("comunicado abre o comunicado", () => {
    expect(rotaDoPush(MORADOR, { comunicadoId: "c1" })).toEqual({
      rota: "Comunicado",
      params: { comunicadoId: "c1" },
    });
  });

  it("visita e cobrança abrem a lista, que é a tela que existe", () => {
    expect(rotaDoPush(MORADOR, { visitaId: "v1" })).toEqual({ rota: "Visitas" });
    expect(rotaDoPush(MORADOR, { cobrancaId: "b1" })).toEqual({
      rota: "Cobrancas",
    });
  });

  it("o mesmo avisoId separa morador de gestor", () => {
    // A pilha do morador não tem OcorrenciaDetalhe: mandá-lo para lá seria um
    // navigate para rota inexistente, que o React Navigation engole calado.
    expect(rotaDoPush(MORADOR, { avisoId: "a1" })).toEqual({ rota: "Avisos" });
    expect(rotaDoPush(SINDICO, { avisoId: "a1" })).toEqual({
      rota: "OcorrenciaDetalhe",
      params: { avisoId: "a1" },
    });
  });

  it("porteiro NÃO vai para OcorrenciaDetalhe, que não existe na pilha dele", () => {
    // A rota é declarada só para o síndico. Mandar o porteiro para lá seria um
    // navigate silenciosamente ignorado: o toque abre o app e não acontece
    // nada. Hoje nenhum push de aviso chega ao porteiro, então isto guarda o
    // dia em que alguém ampliar a audiência.
    expect(rotaDoPush(PORTEIRO, { avisoId: "a1" })).toBeNull();
  });

  it("gestor com push de morador fica na home em vez de ir para o nada", () => {
    expect(rotaDoPush(SINDICO, { pacoteId: "p1" })).toBeNull();
    expect(rotaDoPush(SINDICO, { cobrancaId: "b1" })).toBeNull();
  });

  it("data vazio ou ausente não navega", () => {
    // LEMBRETE e CONVITE mandam {}; um tipo novo no servidor chega aqui antes
    // de existir tela para ele.
    expect(rotaDoPush(MORADOR, {})).toBeNull();
    expect(rotaDoPush(MORADOR, undefined)).toBeNull();
    expect(rotaDoPush(MORADOR, { tipoNovo: "x" })).toBeNull();
  });

  it("id que não é string não vira rota", () => {
    // `data` atravessa JSON e vem do servidor: um null ou um número no lugar
    // do id navegaria para uma tela que buscaria "null" e mostraria erro.
    expect(rotaDoPush(MORADOR, { pacoteId: null })).toBeNull();
    expect(rotaDoPush(MORADOR, { pacoteId: 7 })).toBeNull();
    expect(rotaDoPush(MORADOR, { pacoteId: "" })).toBeNull();
  });
});
