"use client";

import { useEffect, useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { assinarSessaoExpirada, carregarPerfil, renovarSessao } from "@/lib/api";
import { Dashboard } from "@/components/Dashboard";
import { Login } from "@/components/Login";

export default function Pagina() {
  const [carregado, setCarregado] = useState(false);
  const [perfil, setPerfil] = useState<JwtPayload | null>(null);

  useEffect(() => {
    const salvo = carregarPerfil();
    if (salvo?.tipo === "usuario") {
      setPerfil(salvo);
      // Sessão deslizante: a do painel vale 24h, e sem renovar ao abrir quem
      // trabalha nele todo dia seria derrubado no meio do expediente
      // seguinte. Sem `await`: o painel desenha com o token que já tem.
      void renovarSessao();
    }
    setCarregado(true);
  }, []);

  // Token expirado devolve a tela de login em vez de deixar o painel repetindo
  // "Token inválido ou expirado" em cada visão, sem saída.
  useEffect(() => assinarSessaoExpirada(() => setPerfil(null)), []);

  if (!carregado) return null;
  if (!perfil) return <Login aoEntrar={setPerfil} />;
  return <Dashboard perfil={perfil} aoSair={() => setPerfil(null)} />;
}
