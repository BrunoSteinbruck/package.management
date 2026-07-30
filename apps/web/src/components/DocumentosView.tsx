"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATEGORIAS_DOCUMENTO,
  type CategoriaDocumento,
  type DocumentoLinha,
} from "@pacotes/shared";
import { apiFetch, API_URL } from "@/lib/api";

const ROTULO: Record<CategoriaDocumento, string> = {
  ATA: "Ata",
  REGIMENTO: "Regimento interno",
  CONVENCAO: "Convenção",
  OUTRO: "Outro",
};

const LIMITE_BYTES = 20 * 1024 * 1024;

function tamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  // Abaixo de 1 KB mostra os bytes: arredondar daria "0 KB", que lê como
  // arquivo vazio quando na verdade é só um PDF pequeno.
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function DocumentosView() {
  const [itens, setItens] = useState<DocumentoLinha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDocumento>("ATA");
  const [enviando, setEnviando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await apiFetch<DocumentoLinha[]>("/cadastro/documentos"));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviar() {
    const arquivo = inputArquivo.current?.files?.[0];
    if (!arquivo) {
      setErro("Escolha um arquivo PDF.");
      return;
    }
    // Barra aqui também, além do servidor: subir 20 MB para receber 400 no
    // fim é a pior forma de descobrir que o arquivo é grande demais.
    if (arquivo.size > LIMITE_BYTES) {
      setErro("O PDF passa de 20 MB.");
      return;
    }
    setEnviando(true);
    try {
      // Multipart não passa pelo apiFetch (que serializa JSON): vai em fetch
      // direto, como o upload de foto no app.
      const form = new FormData();
      form.append("file", arquivo);
      const res = await fetch(`${API_URL}/uploads/documento`, {
        method: "POST",
        headers: { authorization: `Bearer ${localStorage.getItem("painel/token")}` },
        body: form,
      });
      if (!res.ok) {
        const erroJson = await res.json().catch(() => ({}));
        throw new Error(erroJson?.message ?? "Falha ao enviar o PDF");
      }
      const { key, tamanhoBytes } = (await res.json()) as {
        key: string;
        tamanhoBytes: number;
      };
      await apiFetch("/cadastro/documentos", {
        method: "POST",
        body: { titulo, categoria, arquivoKey: key, tamanhoBytes },
      });
      setTitulo("");
      if (inputArquivo.current) inputArquivo.current.value = "";
      setErro(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Tirar "${nome}" do app dos moradores?`)) return;
    try {
      await apiFetch(`/cadastro/documentos/${id}`, { method: "DELETE" });
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  function abrir(doc: DocumentoLinha) {
    window.open(
      `${API_URL}/uploads/${doc.arquivo.key}?t=${encodeURIComponent(doc.arquivo.token)}`,
      "_blank",
      "noopener",
    );
  }

  return (
    <>
      <h1>Documentos</h1>
      <p className="aviso">
        Ata, regimento e convenção ficam disponíveis no app do morador. Só PDF,
        até 20 MB por arquivo.
      </p>

      {erro && (
        <p className="erro" style={{ marginTop: 12 }}>
          {erro}
        </p>
      )}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Publicar documento</h2>
        <div className="linha">
          <input
            placeholder="Título (ex.: Ata da assembleia de março)"
            maxLength={160}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
          <div className="chips">
            {CATEGORIAS_DOCUMENTO.map((c) => (
              <button
                key={c}
                className={`chip ${categoria === c ? "ativo" : ""}`}
                onClick={() => setCategoria(c)}
              >
                {ROTULO[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="linha" style={{ marginTop: 12 }}>
          <input type="file" accept="application/pdf" ref={inputArquivo} />
          <button
            className="acao"
            disabled={enviando || titulo.trim().length < 3}
            onClick={enviar}
          >
            {enviando ? "Enviando..." : "Publicar"}
          </button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Categoria</th>
              <th>Tamanho</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="unidade">{d.titulo}</div>
                  <div style={{ fontSize: 13, color: "var(--texto-3)" }}>
                    {dataCurta(d.criadoEm)}
                  </div>
                </td>
                <td>{ROTULO[d.categoria]}</td>
                <td>{tamanho(d.tamanhoBytes)}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="outline" onClick={() => abrir(d)}>
                    Abrir
                  </button>{" "}
                  <button
                    className="outline"
                    onClick={() => remover(d.id, d.titulo)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {itens.length === 0 && (
          <p className="aviso">Nenhum documento publicado ainda.</p>
        )}
      </div>
    </>
  );
}
