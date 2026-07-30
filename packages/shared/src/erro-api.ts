/**
 * Traduz o corpo de um erro da API na frase que o usuário lê.
 *
 * Existe porque os dois clientes só sabiam ler `message`, e o erro de
 * validação NÃO vem nesse formato: o `ZodPipe` lança
 * `BadRequestException(error.flatten().fieldErrors)`, e o Nest usa o objeto
 * como corpo. Ou seja, a resposta é `{"linhas": ["Telefone inválido..."]}`,
 * sem `message` nenhum, e o cliente caía no genérico "Erro 400".
 *
 * O efeito era grande e silencioso: TODA validação de TODO formulário do
 * produto aparecia como "Erro 400". O síndico colava uma planilha de 200
 * moradores e não descobria qual linha estava errada.
 *
 * As três formas que a API produz hoje:
 *  - `{ message: "texto" }`            exceções do domínio (a maioria)
 *  - `{ message: ["a", "b"] }`         validação do Nest
 *  - `{ campo: ["erro"], ... }`        fieldErrors do zod, via ZodPipe
 */
export function mensagemDeErro(corpo: unknown, status: number): string {
  const generico = `Erro ${status}`;
  if (!corpo || typeof corpo !== "object") return generico;
  const d = corpo as Record<string, unknown>;

  if (typeof d.message === "string" && d.message.trim()) return d.message;
  if (Array.isArray(d.message)) {
    const partes = d.message.filter((m): m is string => typeof m === "string");
    if (partes.length > 0) return partes.join(", ");
  }

  // fieldErrors do zod: junta o que cada campo reclamou. O nome do campo
  // entra só quando há mais de um, porque "Telefone inválido" já se explica
  // e "telefone: Telefone inválido" só repete a palavra.
  const campos = Object.entries(d).filter(
    ([chave, valor]) =>
      chave !== "statusCode" && chave !== "error" && Array.isArray(valor),
  );
  if (campos.length === 1) {
    const [, valor] = campos[0];
    const partes = (valor as unknown[]).filter(
      (m): m is string => typeof m === "string",
    );
    if (partes.length > 0) return partes.join(", ");
  }
  if (campos.length > 1) {
    return campos
      .map(([chave, valor]) => {
        const partes = (valor as unknown[]).filter(
          (m): m is string => typeof m === "string",
        );
        return `${chave}: ${partes.join(", ")}`;
      })
      .join(" · ");
  }

  return generico;
}
