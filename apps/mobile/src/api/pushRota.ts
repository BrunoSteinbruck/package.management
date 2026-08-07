import { perfilDe, type JwtPayload } from "@pacotes/shared";

/**
 * Para onde o toque numa notificação leva.
 *
 * O servidor já manda o id da coisa em `data` (`mensagens.ts`), e até agora
 * ninguém lia: o push abria o app na home, e o morador que tocou em "Sua
 * visita chegou" tinha que procurar a visita sozinho.
 *
 * A união é por pilha porque cada perfil monta um navigator diferente: mandar
 * o morador para `OcorrenciaDetalhe`, que só existe na pilha do síndico,
 * seria um `navigate` para uma rota inexistente, que o React Navigation
 * ignora em silêncio.
 */
export type DestinoPush =
  | { rota: "Detalhe"; params: { pacoteId: string } }
  | { rota: "Comunicado"; params: { comunicadoId: string } }
  | { rota: "Avisos" }
  | { rota: "Visitas" }
  | { rota: "Cobrancas" }
  | { rota: "OcorrenciaDetalhe"; params: { avisoId: string } }
  | { rota: "Ocorrencias" };

/** O valor só serve como id se for string não vazia: `data` vem do fio. */
function id(data: Record<string, unknown>, chave: string): string | null {
  const v = data[chave];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * A rota do push, ou null para ficar onde está.
 *
 * Null é resposta legítima e comum: `LEMBRETE` e `CONVITE` mandam `data`
 * vazio, e um tipo novo no servidor chega aqui antes de existir tela para
 * ele. Nesses casos abrir a home é melhor do que adivinhar.
 */
export function rotaDoPush(
  perfil: JwtPayload,
  data: Record<string, unknown> | undefined,
): DestinoPush | null {
  if (!data) return null;
  const quem = perfilDe(perfil);

  const avisoId = id(data, "avisoId");
  if (avisoId) {
    /**
     * O mesmo `avisoId` significa coisas diferentes nas três pilhas.
     *
     * Morador: é o aviso que ele recebeu ou o relato que ele abriu, e a lista
     * dá conta dos dois. Síndico: é o relato novo que chegou, e aí a tela
     * nominal existe e é onde ele age.
     *
     * Porteiro é null e NÃO segue a regra do síndico: `OcorrenciaDetalhe` só
     * existe na pilha do síndico (`navigation.ts` a declara no bloco que a
     * portaria não recebe), e `navigate` para rota inexistente o React
     * Navigation engole calado. Hoje nenhum push de aviso chega ao porteiro
     * (`tokensDosGestores` filtra SINDICO/ADMIN), mas escrever "gestor" aqui
     * deixava a armadilha armada para o dia em que alguém ampliar a
     * audiência: o toque abriria o app e não faria nada.
     */
    if (quem === "morador") return { rota: "Avisos" };
    if (quem === "porteiro") return null;
    return { rota: "OcorrenciaDetalhe", params: { avisoId } };
  }

  // Encomenda, comunicado, visita e cobrança só são notificados ao morador.
  // Se um gestor receber um destes um dia, a home é o destino honesto: as
  // telas de detalhe não existem na pilha dele.
  if (quem !== "morador") return null;

  const pacoteId = id(data, "pacoteId");
  if (pacoteId) return { rota: "Detalhe", params: { pacoteId } };

  const comunicadoId = id(data, "comunicadoId");
  if (comunicadoId) return { rota: "Comunicado", params: { comunicadoId } };

  // Visita e cobrança vão para a LISTA e não para um detalhe: nenhuma das
  // duas tem tela por id no app, e a lista já abre com a de hoje em cima.
  if (id(data, "visitaId")) return { rota: "Visitas" };
  if (id(data, "cobrancaId")) return { rota: "Cobrancas" };

  return null;
}
