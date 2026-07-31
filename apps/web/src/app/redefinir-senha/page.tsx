"use client";

import { useEffect, useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch, salvarSessao } from "@/lib/api";

/**
 * Página do link que chega por e-mail: define a senha e já entra.
 *
 * Pública como a de exclusão de conta, e pelo mesmo motivo: quem chega aqui
 * não tem sessão. O token vem na URL e é a única credencial, então ele nunca
 * é guardado em lugar nenhum: é usado na hora e trocado por uma sessão de
 * verdade.
 *
 * Entrar direto depois de redefinir não é atalho de conveniência: quem abriu
 * o link acabou de provar que tem a caixa de e-mail, que é exatamente a prova
 * que o login por senha pediria em seguida. Mandar de volta para a tela de
 * login só faria digitar a senha recém-criada.
 */
export default function RedefinirSenhaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Lido no efeito, e não na renderização: `window` não existe no servidor.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) setErro("Link incompleto. Peça um novo em 'Esqueci a senha'.");
  }, []);

  const curta = senha.length > 0 && senha.length < 8;
  const diferentes = confirmacao.length > 0 && senha !== confirmacao;
  const podeSalvar =
    !!token && senha.length >= 8 && senha === confirmacao && !salvando;

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await apiFetch<{ token: string; perfil: JwtPayload }>(
        "/auth/senha/redefinir",
        { method: "POST", body: { token, novaSenha: senha } },
      );
      salvarSessao(r.token, r.perfil);
      setPronto(true);
      // Recarrega na raiz: a página inicial lê a sessão do localStorage e
      // monta o painel. Um push de rota não bastaria, porque esta página é
      // uma árvore separada.
      window.location.href = "/";
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="login-fundo">
      <div className="login-cartao">
        <div className="login-logo">convivar</div>
        <h1 style={{ marginTop: 12 }}>Criar uma senha</h1>
        <p className="aviso" style={{ marginTop: 4 }}>
          {pronto
            ? "Senha criada. Abrindo o painel..."
            : "Escolha a senha que você vai usar para entrar no painel."}
        </p>

        {!pronto && (
          <div style={{ marginTop: 20 }}>
            <label>Nova senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              maxLength={100}
              autoComplete="new-password"
              disabled={!token}
              autoFocus
            />
            <p className="aviso" style={{ marginTop: 4 }}>
              {curta ? "Pelo menos 8 caracteres." : "Mínimo de 8 caracteres."}
            </p>

            <label style={{ marginTop: 12 }}>Repita a senha</label>
            <input
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              maxLength={100}
              autoComplete="new-password"
              disabled={!token}
              onKeyDown={(e) => {
                if (e.key === "Enter") salvar();
              }}
            />
            {diferentes && (
              <p className="erro" style={{ marginTop: 4 }}>
                As duas senhas não são iguais.
              </p>
            )}

            <button
              className="acao"
              style={{ marginTop: 14, width: "100%" }}
              onClick={salvar}
              disabled={!podeSalvar}
            >
              {salvando ? "Salvando..." : "Salvar e entrar"}
            </button>
          </div>
        )}

        {erro && (
          <>
            <p className="erro" style={{ marginTop: 12 }}>
              {erro}
            </p>
            <a href="/" className="link" style={{ display: "block", marginTop: 10 }}>
              Voltar para o login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
