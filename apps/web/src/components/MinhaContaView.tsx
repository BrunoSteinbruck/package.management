"use client";

import { useCallback, useEffect, useState } from "react";
import type { MinhaConta } from "@pacotes/shared";
import { apiFetch } from "@/lib/api";

/**
 * A conta de quem está logado: o e-mail que recupera a senha, e a senha.
 *
 * Existe porque sem ela o gestor dependia de alguém mexer no banco. As contas
 * criadas antes da senha não têm e-mail nenhum, e o "esqueci a senha" é
 * justamente o caminho que precisa de e-mail: sem esta tela, elas ficavam na
 * rampa de SMS para sempre.
 *
 * A senha atual é cobrada nas duas operações, e por motivos diferentes. Na
 * troca de senha, porque um navegador esquecido aberto na administração não
 * pode expulsar o dono da conta. Na troca de e-mail, porque redirecionar a
 * recuperação para outra caixa é tomar a conta em definitivo. Quem ainda não
 * tem senha é a exceção: cobrar dele uma senha que nunca teve seria trancá-lo
 * do lado de fora.
 */
export function MinhaContaView() {
  const [conta, setConta] = useState<MinhaConta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [senhaDoEmail, setSenhaDoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [avisoEmail, setAvisoEmail] = useState<string | null>(null);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [avisoSenha, setAvisoSenha] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const c = await apiFetch<MinhaConta>("/conta/perfil");
      setConta(c);
      setEmail(c.email ?? "");
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarEmail() {
    setSalvandoEmail(true);
    setErro(null);
    setAvisoEmail(null);
    try {
      await apiFetch("/conta/email", {
        method: "POST",
        body: {
          email: email.trim(),
          ...(conta?.temSenha ? { senhaAtual: senhaDoEmail } : {}),
        },
      });
      setSenhaDoEmail("");
      setAvisoEmail("E-mail salvo.");
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoEmail(false);
    }
  }

  async function salvarSenha() {
    setSalvandoSenha(true);
    setErro(null);
    setAvisoSenha(null);
    try {
      await apiFetch("/conta/senha", {
        method: "POST",
        body: { senhaAtual, novaSenha },
      });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      setAvisoSenha("Senha alterada. Ela vale a partir do próximo login.");
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoSenha(false);
    }
  }

  if (!conta) {
    return (
      <>
        <h1>Minha conta</h1>
        {erro && <p className="erro">{erro}</p>}
      </>
    );
  }

  const emailMudou = email.trim().toLowerCase() !== (conta.email ?? "");
  const podeSalvarEmail =
    email.includes("@") &&
    emailMudou &&
    (!conta.temSenha || senhaDoEmail.length >= 8) &&
    !salvandoEmail;

  const senhasDiferem = confirmacao.length > 0 && novaSenha !== confirmacao;
  const podeSalvarSenha =
    senhaAtual.length >= 1 &&
    novaSenha.length >= 8 &&
    novaSenha === confirmacao &&
    !salvandoSenha;

  return (
    <>
      <h1>Minha conta</h1>
      <p className="aviso">
        {conta.nome} · {conta.papel.toLowerCase()} · {conta.condominioNome}
      </p>
      {erro && <p className="erro">{erro}</p>}

      <section className="card">
        <h2>E-mail de recuperação</h2>
        {!conta.email && (
          <p className="aviso" style={{ marginBottom: 10 }}>
            Sua conta ainda não tem e-mail. Sem ele não há como recuperar a
            senha do painel.
          </p>
        )}
        <div className="linha">
          <input
            type="email"
            style={{ width: 280 }}
            placeholder="seu@email.com"
            maxLength={160}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {conta.temSenha && (
            <input
              type="password"
              style={{ width: 200 }}
              placeholder="Sua senha atual"
              maxLength={100}
              autoComplete="current-password"
              value={senhaDoEmail}
              onChange={(e) => setSenhaDoEmail(e.target.value)}
            />
          )}
          <button className="acao" onClick={salvarEmail} disabled={!podeSalvarEmail}>
            {salvandoEmail ? "Salvando..." : "Salvar e-mail"}
          </button>
        </div>
        {avisoEmail && (
          <p className="aviso" style={{ marginTop: 8, color: "var(--ok)" }}>
            {avisoEmail}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Senha</h2>
        {conta.temSenha ? (
          <>
            <div className="linha">
              <input
                type="password"
                style={{ width: 200 }}
                placeholder="Senha atual"
                maxLength={100}
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
              <input
                type="password"
                style={{ width: 200 }}
                placeholder="Nova senha"
                maxLength={100}
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
              <input
                type="password"
                style={{ width: 200 }}
                placeholder="Repita a nova"
                maxLength={100}
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
              <button className="acao" onClick={salvarSenha} disabled={!podeSalvarSenha}>
                {salvandoSenha ? "Salvando..." : "Trocar senha"}
              </button>
            </div>
            <p className="aviso" style={{ marginTop: 8 }}>
              {senhasDiferem
                ? "As duas senhas novas não são iguais."
                : "Mínimo de 8 caracteres."}
            </p>
          </>
        ) : (
          <p className="aviso">
            Sua conta ainda entra pelo código por SMS. Cadastre o e-mail acima e
            depois use &quot;Esqueci a senha&quot; na tela de entrada para criar
            a sua senha.
          </p>
        )}
        {avisoSenha && (
          <p className="aviso" style={{ marginTop: 8, color: "var(--ok)" }}>
            {avisoSenha}
          </p>
        )}
      </section>
    </>
  );
}
