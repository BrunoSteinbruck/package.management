import { describe, expect, it } from "vitest";
import {
  CriarUsuarioSchema,
  EsqueciSenhaSchema,
  LoginSenhaSchema,
  RedefinirSenhaSchema,
} from "./dto";

const ok = <T>(r: { success: boolean; data?: T }) => (r.success ? r.data : null);

describe("login do painel por senha", () => {
  it("identificador é aparado, senha não", () => {
    // Aparar a senha seria destrutivo: gerenciador de senhas gera valor com
    // espaço, e o navegador que salvou "  x  " deixaria de entrar no dia em
    // que o servidor decidisse aparar.
    const r = ok(
      LoginSenhaSchema.safeParse({
        identificador: "  sindico@convivar.com  ",
        senha: "  senha com espaco  ",
      }),
    );
    expect(r?.identificador).toBe("sindico@convivar.com");
    expect(r?.senha).toBe("  senha com espaco  ");
  });

  it("senha curta demais é recusada", () => {
    expect(LoginSenhaSchema.safeParse({ identificador: "a", senha: "1234567" }).success).toBe(false);
    expect(LoginSenhaSchema.safeParse({ identificador: "a", senha: "12345678" }).success).toBe(true);
  });

  it("identificador vazio não passa", () => {
    expect(LoginSenhaSchema.safeParse({ identificador: "", senha: "12345678" }).success).toBe(false);
  });
});

describe("e-mail como identificador", () => {
  it("normaliza caixa e pontas", () => {
    // O teclado do celular capitaliza a primeira letra sozinho; a comparação
    // no banco é exata, então a normalização tem que ser da borda.
    expect(ok(EsqueciSenhaSchema.safeParse({ email: "  Sindico@Convivar.COM " }))?.email).toBe(
      "sindico@convivar.com",
    );
  });

  it("recusa o que não é e-mail", () => {
    for (const ruim of ["", "sindico", "sindico@", "@convivar.com", "a b@c.com"]) {
      expect(EsqueciSenhaSchema.safeParse({ email: ruim }).success).toBe(false);
    }
  });
});

describe("redefinição", () => {
  it("token curto é recusado antes de ir ao banco", () => {
    const token = "x".repeat(43);
    expect(RedefinirSenhaSchema.safeParse({ token: "curto", novaSenha: "12345678" }).success).toBe(
      false,
    );
    expect(RedefinirSenhaSchema.safeParse({ token, novaSenha: "12345678" }).success).toBe(true);
  });
});

describe("criar usuário com e-mail", () => {
  it("e-mail é opcional no formato e normalizado quando vem", () => {
    const semEmail = CriarUsuarioSchema.safeParse({
      nome: "Carlos Mendes",
      telefone: "51999990000",
      papel: "PORTEIRO",
    });
    expect(semEmail.success).toBe(true);

    const comEmail = ok(
      CriarUsuarioSchema.safeParse({
        nome: "Sindico Demo",
        telefone: "51999990001",
        papel: "SINDICO",
        email: "  Sindico@Convivar.com ",
      }),
    );
    expect(comEmail?.email).toBe("sindico@convivar.com");
  });

  it("e-mail inválido é recusado mesmo sendo opcional", () => {
    expect(
      CriarUsuarioSchema.safeParse({
        nome: "X Y",
        telefone: "51999990002",
        papel: "SINDICO",
        email: "nao-e-email",
      }).success,
    ).toBe(false);
  });
});
