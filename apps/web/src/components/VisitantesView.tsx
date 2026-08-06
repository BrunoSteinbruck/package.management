"use client";

import { useCallback, useEffect, useState } from "react";
import {
  rotuloUnidade,
  type StatusVisita,
  type VisitaPortaria,
} from "@pacotes/shared";
import { apiFetch } from "@/lib/api";

const STATUS: Record<StatusVisita, { rotulo: string; selo: string }> = {
  AUTORIZADA: { rotulo: "esperada", selo: "info" },
  CHEGOU: { rotulo: "entrou", selo: "ok" },
  CANCELADA: { rotulo: "cancelada", selo: "alerta" },
};

/** "2026-07-28" vira "28/07/26" sem passar por Date (que deslocaria o dia). */
function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function hora(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VisitantesView() {
  const [hoje, setHoje] = useState<VisitaPortaria[]>([]);
  const [historico, setHistorico] = useState<VisitaPortaria[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [doDia, todas] = await Promise.all([
        apiFetch<VisitaPortaria[]>("/portaria/visitas-hoje"),
        apiFetch<VisitaPortaria[]>("/cadastro/visitas"),
      ]);
      setHoje(doDia);
      setHistorico(todas);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const termo = busca.trim().toLowerCase();
  const filtrado = termo
    ? historico.filter(
        (v) =>
          v.nomeVisitante.toLowerCase().includes(termo) ||
          rotuloUnidade(v.unidade).toLowerCase().includes(termo) ||
          v.autorizadoPor.toLowerCase().includes(termo),
      )
    : historico;

  const esperadas = hoje.filter((v) => v.status === "AUTORIZADA").length;

  return (
    <>
      <h1>Visitantes</h1>
      <p className="aviso">
        O morador autoriza pelo app e a portaria dá baixa na chegada, que avisa
        a unidade na hora. O documento é apagado 90 dias depois da visita.
      </p>

      {erro && (
        <p className="erro" style={{ marginTop: 12 }}>
          {erro}
        </p>
      )}

      <div className="metricas">
        <div className="metrica">
          <div className="valor">{esperadas}</div>
          <div className="rotulo">esperadas hoje</div>
        </div>
        <div className="metrica">
          <div className="valor">
            {hoje.filter((v) => v.status === "CHEGOU").length}
          </div>
          <div className="rotulo">entraram hoje</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Histórico</h2>
        <input
          placeholder="Buscar por visitante, unidade ou quem autorizou"
          maxLength={60}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: "100%", marginBottom: 12 }}
        />
        <table>
          <thead>
            <tr>
              <th>Visitante</th>
              <th>Unidade</th>
              <th>Autorizado por</th>
              <th>Data</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrado.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="unidade">{v.nomeVisitante}</div>
                  {(v.codigo || v.documento) && (
                    <div style={{ fontSize: 13, color: "var(--texto-3)" }}>
                      {[v.codigo, v.documento].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td>{rotuloUnidade(v.unidade)}</td>
                <td>{v.autorizadoPor}</td>
                <td>
                  {diaCurto(v.dataPrevista)}
                  {v.chegadaEm && (
                    <div style={{ fontSize: 13, color: "var(--texto-3)" }}>
                      entrou {hora(v.chegadaEm)}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`selo ${STATUS[v.status].selo}`}>
                    {STATUS[v.status].rotulo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrado.length === 0 && (
          <p className="aviso">
            {termo ? "Nada encontrado." : "Nenhuma visita registrada ainda."}
          </p>
        )}
      </div>
    </>
  );
}
