/**
 * Rótulo curto de pessoa para caber num chip.
 *
 * O primeiro nome basta quase sempre e é como o porteiro chama o morador.
 * Mas ele não pode ser ambíguo DENTRO da unidade: pai e filho com o mesmo
 * nome, ou dois "João", virariam dois chips idênticos e a escolha de quem
 * recebeu passaria a ser um chute. Quando o primeiro nome se repete na
 * lista, o rótulo cresce até desempatar.
 */
export function rotuloCurto(nome: string, naLista: readonly string[]): string {
  const partes = separar(nome);
  if (partes.length === 0) return nome.trim();

  const primeiro = partes[0];
  const homonimos = naLista.filter((n) => separar(n)[0] === primeiro);
  if (homonimos.length <= 1) return primeiro;

  // Primeiro nome + sobrenome seguinte resolve o caso comum. Se ainda
  // empatar (dois cadastros com o nome inteiro igual), devolve o nome cheio:
  // não dá para desambiguar o que é igual, e é melhor mostrar tudo do que
  // uma abreviação que esconde a coincidência.
  const comSobrenome = partes.slice(0, 2).join(" ");
  const aindaEmpatam = homonimos.filter(
    (n) => separar(n).slice(0, 2).join(" ") === comSobrenome,
  );
  if (partes.length > 1 && aindaEmpatam.length <= 1) return comSobrenome;
  return nome.trim();
}

function separar(nome: string): string[] {
  return nome.trim().split(/\s+/).filter(Boolean);
}
