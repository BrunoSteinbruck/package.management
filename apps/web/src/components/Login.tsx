"use client";

import { useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch, salvarSessao } from "@/lib/api";

export function Login({ aoEntrar }: { aoEntrar: (perfil: JwtPayload) => void }) {
  const [fase, setFase] = useState<"telefone" | "codigo">("telefone");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function pedirCodigo() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await apiFetch<{ devCodigo?: string }>("/auth/otp/request", {
        method: "POST",
        body: { telefone: telefone.replace(/\D/g, "") },
      });
      if (res.devCodigo) setCodigo(res.devCodigo);
      setFase("codigo");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function entrar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await apiFetch<{ token: string; perfil: JwtPayload }>(
        "/auth/otp/verify",
        {
          method: "POST",
          body: { telefone: telefone.replace(/\D/g, ""), codigo: codigo.trim() },
        },
      );
      if (res.perfil.tipo !== "usuario") {
        setErro("Este painel é para a equipe do condomínio.");
        return;
      }
      salvarSessao(res.token, res.perfil);
      aoEntrar(res.perfil);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-fundo">
      <div className="login-cartao">
        <div className="login-logo">convivar</div>
        <h1 style={{ marginTop: 12 }}>Painel do condomínio</h1>
        <p className="aviso" style={{ marginTop: 4 }}>
          {fase === "telefone"
            ? "Entre com o telefone cadastrado."
            : `Código enviado por SMS para ${telefone}.`}
        </p>
        <div style={{ marginTop: 20 }}>
        {fase === "telefone" ? (
          <>
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
              disabled={carregando || telefone.replace(/\D/g, "").length < 10}
            >
              Receber código por SMS
            </button>
          </>
        ) : (
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
              style={{ marginTop: 12, width: "100%" }}
              onClick={entrar}
              disabled={carregando || codigo.trim().length !== 6}
            >
              Entrar
            </button>
            <button
              className="outline"
              style={{ marginTop: 8, width: "100%" }}
              onClick={() => setFase("telefone")}
            >
              Trocar telefone
            </button>
          </>
        )}
        {erro && <p className="erro" style={{ marginTop: 12 }}>{erro}</p>}
        </div>
      </div>
    </div>
  );
}
