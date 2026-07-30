"use client";

import { useEffect, useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { assinarSessaoExpirada, carregarPerfil } from "@/lib/api";
import { Dashboard } from "@/components/Dashboard";
import { Login } from "@/components/Login";

export default function Pagina() {
  const [carregado, setCarregado] = useState(false);
  const [perfil, setPerfil] = useState<JwtPayload | null>(null);

  useEffect(() => {
    const salvo = carregarPerfil();
    if (salvo?.tipo === "usuario") setPerfil(salvo);
    setCarregado(true);
  }, []);

  // Token expirado devolve a tela de login em vez de deixar o painel repetindo
  // "Token inválido ou expirado" em cada visão, sem saída.
  useEffect(() => assinarSessaoExpirada(() => setPerfil(null)), []);

  if (!carregado) return null;
  if (!perfil) return <Login aoEntrar={setPerfil} />;
  return <Dashboard perfil={perfil} aoSair={() => setPerfil(null)} />;
}
