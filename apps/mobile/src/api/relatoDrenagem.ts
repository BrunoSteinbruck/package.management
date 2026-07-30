import type { OperacaoDescartada } from "./offlineQueue";

/**
 * O texto que a portaria lê depois de uma sincronização.
 *
 * Puro de propósito: a decisão de "isto some sem avisar" era um bug de
 * produto, não de rede, e bug de produto precisa de teste. A tela só chama o
 * Alert com o que sair daqui.
 */
export interface RelatoDrenagem {
  titulo: string;
  corpo: string;
}

const NOMES_OPERACAO: Record<string, string> = {
  "/portaria/pacotes": "entrada de encomenda",
  "/portaria/retiradas": "retirada de encomenda",
  "/portaria/avisos": "aviso ao morador",
  "/leituras": "leitura de medidor",
};

export function nomeDaOperacao(path: string): string {
  return NOMES_OPERACAO[path] ?? path;
}

export function relatarDrenagem(resultado: {
  enviadas: number;
  descartadas: OperacaoDescartada[];
}): RelatoDrenagem | null {
  const { enviadas, descartadas } = resultado;
  if (enviadas === 0 && descartadas.length === 0) return null;

  const recusadas = descartadas.filter((d) => !d.perdeuFoto);
  const semFoto = descartadas.filter((d) => d.perdeuFoto);
  if (recusadas.length === 0 && semFoto.length === 0) {
    return {
      titulo: "Sincronizado",
      corpo: `${enviadas} registro(s) offline enviados.`,
    };
  }

  const linhas: string[] = [];
  if (enviadas > 0) linhas.push(`${enviadas} registro(s) enviados.`);
  for (const d of semFoto) {
    linhas.push(`A ${nomeDaOperacao(d.path)} entrou SEM a foto: ${d.motivo}.`);
  }
  for (const d of recusadas) {
    const quando = new Date(d.criadaEm).toLocaleString("pt-BR");
    linhas.push(
      `A ${nomeDaOperacao(d.path)} de ${quando} NÃO foi aceita: ${d.motivo}. Refaça o registro.`,
    );
  }
  return {
    titulo: recusadas.length > 0 ? "Registro offline recusado" : "Sincronizado, com ressalva",
    corpo: linhas.join("\n\n"),
  };
}
