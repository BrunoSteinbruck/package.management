"use client";

import { useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch } from "@/lib/api";

/**
 * Exclusão de conta pela web — exigência do Google Play, que pede um caminho
 * fora do aplicativo (a Apple se satisfaz com o botão dentro do app, que
 * também existe).
 *
 * Fluxo próprio, deliberadamente separado do login do painel: aqui entram
 * MORADORES também (o painel só aceita equipe), e o token fica em memória, sem
 * tocar no localStorage — senão abrir esta página derrubaria a sessão do
 * síndico no mesmo navegador.
 */
type Previa =
  | { tipo: "morador"; unidadesVinculadas: number; efeitos: string[] }
  | { tipo: "equipe"; bloqueio: string | null; efeitos: string[] };

export default function ExcluirContaPage() {
  const [fase, setFase] = useState<"telefone" | "codigo" | "confirmar" | "pronto">(
    "telefone",
  );
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [token, setToken] = useState("");
  const [perfil, setPerfil] = useState<JwtPayload | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const soDigitos = telefone.replace(/\D/g, "");

  async function executar(fn: () => Promise<void>) {
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

  const pedirCodigo = () =>
    executar(async () => {
      await apiFetch("/auth/otp/request", {
        method: "POST",
        body: { telefone: soDigitos },
      });
      setFase("codigo");
    });

  const confirmarIdentidade = () =>
    executar(async () => {
      const res = await apiFetch<{ token: string; perfil: JwtPayload }>(
        "/auth/otp/verify",
        { method: "POST", body: { telefone: soDigitos, codigo: codigo.trim() } },
      );
      const p = await apiFetch<Previa>("/conta/exclusao/previa", {
        token: res.token,
      });
      setToken(res.token);
      setPerfil(res.perfil);
      setPrevia(p);
      setFase("confirmar");
    });

  const excluir = () =>
    executar(async () => {
      await apiFetch("/conta", { method: "DELETE", token });
      setToken("");
      setFase("pronto");
    });

  const bloqueio = previa?.tipo === "equipe" ? previa.bloqueio : null;

  return (
    <div className="login-fundo">
      <div className="login-cartao">
        <div className="login-logo">guarita</div>
        <h1 style={{ marginTop: 12 }}>Excluir minha conta</h1>

        {fase === "telefone" && (
          <>
            <p className="aviso" style={{ marginTop: 4 }}>
              Confirme que o número é seu: enviamos um código por SMS.
            </p>
            <div style={{ marginTop: 20 }}>
              <label>Celular (DDD + número)</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="41 99999 0002"
                autoFocus
              />
              <button
                className="acao"
                style={{ marginTop: 12, width: "100%" }}
                onClick={pedirCodigo}
                disabled={carregando || soDigitos.length < 10}
              >
                Receber código por SMS
              </button>
            </div>
          </>
        )}

        {fase === "codigo" && (
          <>
            <p className="aviso" style={{ marginTop: 4 }}>
              Código enviado para {telefone}.
            </p>
            <div style={{ marginTop: 20 }}>
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
                style={{ marginTop: 12, width: "100%" }}
                onClick={confirmarIdentidade}
                disabled={carregando || codigo.trim().length !== 6}
              >
                Continuar
              </button>
              <button
                className="outline"
                style={{ marginTop: 8, width: "100%" }}
                onClick={() => setFase("telefone")}
              >
                Trocar telefone
              </button>
            </div>
          </>
        )}

        {fase === "confirmar" && previa && (
          <>
            <p className="aviso" style={{ marginTop: 4 }}>
              Conta de <strong>{perfil?.nome}</strong>.
            </p>
            {bloqueio ? (
              <p className="erro" style={{ marginTop: 20 }}>
                {bloqueio}
              </p>
            ) : (
              <>
                <ul
                  style={{
                    marginTop: 20,
                    paddingLeft: 18,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--texto-2)",
                  }}
                >
                  {previa.efeitos.map((efeito) => (
                    <li key={efeito} style={{ marginBottom: 8 }}>
                      {efeito}
                    </li>
                  ))}
                </ul>
                <p
                  className="aviso"
                  style={{ marginTop: 14, fontWeight: 600, color: "#a32d2d" }}
                >
                  A exclusão é definitiva e não pode ser desfeita.
                </p>
                <button
                  className="acao"
                  style={{ marginTop: 14, width: "100%", background: "#a32d2d" }}
                  onClick={excluir}
                  disabled={carregando}
                >
                  Excluir definitivamente
                </button>
              </>
            )}
          </>
        )}

        {fase === "pronto" && (
          <p className="aviso" style={{ marginTop: 20, lineHeight: 1.6 }}>
            Conta excluída. Seus dados pessoais foram removidos.
            <br />
            Se mudar de ideia, peça um novo convite a alguém da sua unidade.
          </p>
        )}

        {erro && fase !== "pronto" && (
          <p className="erro" style={{ marginTop: 12 }}>
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
