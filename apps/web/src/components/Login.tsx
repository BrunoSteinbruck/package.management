"use client";

import { useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch, salvarSessao } from "@/lib/api";

/**
 * Entrada do painel: senha para gestor, código por SMS para a portaria.
 *
 * A senha é a cerimônia PADRÃO e o SMS fica atrás de um link discreto, e não
 * o contrário, porque quem decide a compra é o síndico e ele vem de sistemas
 * onde login é usuário e senha. O servidor recusa gestor no caminho do SMS,
 * então esta divisão não é só de tela: sem ela, um chip clonado contornaria
 * a senha justamente nas contas que mexem em dinheiro.
 */
type Fase = "senha" | "esqueci" | "enviado" | "sms-telefone" | "sms-codigo";

export function Login({ aoEntrar }: { aoEntrar: (perfil: JwtPayload) => void }) {
  const [fase, setFase] = useState<Fase>("senha");
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function entrar(res: { token: string; perfil: JwtPayload }) {
    salvarSessao(res.token, res.perfil);
    aoEntrar(res.perfil);
  }

  async function tentar(fn: () => Promise<void>) {
    setCarregando(true);
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const loginComSenha = () =>
    tentar(async () =>
      entrar(
        await apiFetch<{ token: string; perfil: JwtPayload }>(
          "/auth/senha/login",
          { method: "POST", body: { identificador, senha } },
        ),
      ),
    );

  const pedirLink = () =>
    tentar(async () => {
      const r = await apiFetch<{ mensagem: string; devLink?: string }>(
        "/auth/senha/esqueci",
        { method: "POST", body: { email } },
      );
      // `devLink` só existe com EMAIL_DEV_ECHO=1 no servidor: em produção a
      // resposta é sempre neutra e sem link.
      setAviso(r.devLink ? `${r.mensagem}\n\n[dev] ${r.devLink}` : r.mensagem);
      setFase("enviado");
    });

  const pedirCodigo = () =>
    tentar(async () => {
      const r = await apiFetch<{ devCodigo?: string }>("/auth/otp/request", {
        method: "POST",
        body: { telefone: telefone.replace(/\D/g, "") },
      });
      if (r.devCodigo) setCodigo(r.devCodigo);
      setFase("sms-codigo");
    });

  const entrarComCodigo = () =>
    tentar(async () =>
      entrar(
        await apiFetch<{ token: string; perfil: JwtPayload }>(
          "/auth/otp/verify",
          {
            method: "POST",
            body: {
              telefone: telefone.replace(/\D/g, ""),
              codigo: codigo.trim(),
              somenteEquipe: true,
            },
          },
        ),
      ),
    );

  function irPara(proxima: Fase) {
    // Limpa o que sobrou da fase anterior: sem isto, o código do telefone
    // antigo ficava no campo e o botão seguia habilitado, mandando ao
    // servidor um código que o usuário nunca viu.
    setErro(null);
    setAviso(null);
    setSenha("");
    setCodigo("");
    setFase(proxima);
  }

  const legenda =
    fase === "esqueci"
      ? "Informe o e-mail cadastrado. Enviamos um link para você criar uma senha nova."
      : fase === "enviado"
        ? "Confira seu e-mail."
        : fase === "sms-telefone"
          ? "Acesso da portaria. Informe o celular cadastrado."
          : fase === "sms-codigo"
            ? `Código enviado por SMS para ${telefone}.`
            : null;

  return (
    <div className="login-fundo">
      <div className="login-cartao">
        <div className="login-logo">convivar</div>
        <h1 style={{ marginTop: 12 }}>Painel do condomínio</h1>
        {/* A fase `senha` não tem legenda: os dois campos rotulados já dizem o
            que fazer, e a frase só empurrava o formulário para baixo. O
            parágrafo inteiro some quando não há texto, senão sobraria um
            espaço vazio no lugar dele. */}
        {legenda && (
          <p className="aviso" style={{ marginTop: 4 }}>
            {legenda}
          </p>
        )}

        <div style={{ marginTop: 20 }}>
          {fase === "senha" && (
            <>
              <label>E-mail ou celular</label>
              <input
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="sindico@condominio.com"
                maxLength={160}
                autoComplete="username"
                autoFocus
              />
              <label style={{ marginTop: 12 }}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                maxLength={100}
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && identificador && senha.length >= 8) {
                    loginComSenha();
                  }
                }}
              />
              <button
                className="acao"
                style={{ marginTop: 14, width: "100%" }}
                onClick={loginComSenha}
                disabled={carregando || !identificador || senha.length < 8}
              >
                {carregando ? "Entrando..." : "Entrar"}
              </button>
              <button
                className="link"
                style={{ marginTop: 12, width: "100%" }}
                onClick={() => irPara("esqueci")}
              >
                Esqueci minha senha / Primeiro acesso
              </button>
              <button
                className="link"
                style={{ marginTop: 6, width: "100%", opacity: 0.75 }}
                onClick={() => irPara("sms-telefone")}
              >
                Entrar como portaria (código por SMS)
              </button>
            </>
          )}

          {fase === "esqueci" && (
            <>
              <label>E-mail cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sindico@condominio.com"
                maxLength={160}
                autoFocus
              />
              <button
                className="acao"
                style={{ marginTop: 14, width: "100%" }}
                onClick={pedirLink}
                disabled={carregando || !email.includes("@")}
              >
                {carregando ? "Enviando..." : "Enviar link"}
              </button>
              <button
                className="link"
                style={{ marginTop: 12, width: "100%" }}
                onClick={() => irPara("senha")}
              >
                Voltar
              </button>
            </>
          )}

          {fase === "enviado" && (
            <>
              <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {aviso}
              </p>
              <p className="aviso" style={{ marginTop: 10 }}>
                O link vale por 1 hora e só funciona uma vez.
              </p>
              <button
                className="outline"
                style={{ marginTop: 14, width: "100%" }}
                onClick={() => irPara("senha")}
              >
                Voltar para o login
              </button>
            </>
          )}

          {fase === "sms-telefone" && (
            <>
              <label>Celular (DDD + número)</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="41 99999 0002"
                maxLength={20}
                autoFocus
              />
              <button
                className="acao"
                style={{ marginTop: 14, width: "100%" }}
                onClick={pedirCodigo}
                disabled={carregando || telefone.replace(/\D/g, "").length < 10}
              >
                Receber código por SMS
              </button>
              <button
                className="link"
                style={{ marginTop: 12, width: "100%" }}
                onClick={() => irPara("senha")}
              >
                Voltar para o login com senha
              </button>
            </>
          )}

          {fase === "sms-codigo" && (
            <>
              <label>Código de 6 dígitos</label>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                maxLength={6}
                style={{ textAlign: "center", letterSpacing: 6, fontSize: 20 }}
                autoFocus
              />
              <button
                className="acao"
                style={{ marginTop: 14, width: "100%" }}
                onClick={entrarComCodigo}
                disabled={carregando || codigo.trim().length !== 6}
              >
                Entrar
              </button>
              <button
                className="outline"
                style={{ marginTop: 8, width: "100%" }}
                onClick={() => irPara("sms-telefone")}
              >
                Trocar telefone
              </button>
            </>
          )}

          {erro && (
            <p className="erro" style={{ marginTop: 12 }}>
              {erro}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
