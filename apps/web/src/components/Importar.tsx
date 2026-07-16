"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function Importar({ aoImportar }: { aoImportar: () => void }) {
  const [csv, setCsv] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function importar() {
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const linhas = csv
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [nome, telefone, bloco, identificacao] = l
            .split(/[;,\t]/)
            .map((c) => c.trim());
          return { nome, telefone, bloco: bloco || undefined, identificacao };
        });
      const res = await apiFetch<{ vinculados: number; semUnidade: string[] }>(
        "/cadastro/moradores/importar",
        { method: "POST", body: { linhas } },
      );
      setResultado(
        `${res.vinculados} morador(es) importados.` +
          (res.semUnidade.length > 0
            ? ` Sem unidade correspondente: ${res.semUnidade.join(", ")}`
            : ""),
      );
      setCsv("");
      aoImportar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card">
      <h2>Importar moradores</h2>
      <p className="aviso" style={{ marginBottom: 10 }}>
        Uma linha por morador: nome; telefone; bloco; unidade — separados por
        ponto e vírgula, vírgula ou tab (cole direto da planilha).
      </p>
      <textarea
        rows={5}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={"Maria Silva; 41988887777; A; 302\nJoão Souza; 41988886666; B; 101"}
      />
      <button
        className="acao"
        style={{ marginTop: 14 }}
        onClick={importar}
        disabled={enviando || !csv.trim()}
      >
        Importar
      </button>
      {resultado && <p className="aviso" style={{ marginTop: 10 }}>{resultado}</p>}
      {erro && <p className="erro" style={{ marginTop: 10 }}>{erro}</p>}
    </section>
  );
}
