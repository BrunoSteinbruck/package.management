"use client";

import { useCallback, useEffect, useState } from "react";
import {
  rotuloUnidade,
  type ComunicadoGestor,
  type LeituraComunicado,
  type Unidade,
} from "@pacotes/shared";
import { apiFetch } from "@/lib/api";

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function ComunicadosView() {
  const [itens, setItens] = useState<ComunicadoGestor[]>([]);
  const [blocosDisponiveis, setBlocosDisponiveis] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [compondo, setCompondo] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [blocos, setBlocos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Leituras carregadas sob demanda: a lista mostra o número, e só quem
  // clica paga a consulta de quem leu.
  const [abertas, setAbertas] = useState<Record<string, LeituraComunicado[]>>({});

  const carregar = useCallback(async () => {
    try {
      setItens(await apiFetch<ComunicadoGestor[]>("/cadastro/comunicados"));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
    apiFetch<Unidade[]>("/cadastro/unidades")
      .then((us) =>
        setBlocosDisponiveis([
          ...new Set(us.map((u) => u.bloco).filter(Boolean) as string[]),
        ]),
      )
      .catch(() => {});
  }, [carregar]);

  async function publicar() {
    // Publicar manda push para todo mundo e não tem desfazer: nem aqui nem no
    // servidor. A confirmação diz o alcance em vez de perguntar "tem certeza?",
    // porque o erro que ela evita é justamente mandar para o condomínio
    // inteiro um aviso que era de um bloco só.
    const alcance =
      blocos.length === 0
        ? "TODOS os moradores do condomínio"
        : `os moradores ${blocos.length === 1 ? "do bloco" : "dos blocos"} ${blocos.join(", ")}`;
    if (!confirm(`Publicar "${titulo.trim()}" e notificar ${alcance}?`)) return;
    setEnviando(true);
    try {
      await apiFetch("/cadastro/comunicados", {
        method: "POST",
        body: { titulo, corpo, blocos },
      });
      setTitulo("");
      setCorpo("");
      setBlocos([]);
      setCompondo(false);
      setErro(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function verLeituras(id: string) {
    if (abertas[id]) {
      setAbertas(({ [id]: _, ...resto }) => resto);
      return;
    }
    try {
      const leituras = await apiFetch<LeituraComunicado[]>(
        `/cadastro/comunicados/${id}/leituras`,
      );
      setAbertas((a) => ({ ...a, [id]: leituras }));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const podePublicar =
    titulo.trim().length >= 3 && corpo.trim().length > 0 && !enviando;

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1>Comunicados</h1>
        {/* Cancelar descarta mesmo. Antes só fechava o compositor e o texto
            voltava na próxima abertura, o que faz o botão mentir: quem cancela
            espera perder o rascunho, e reencontrá-lo depois assusta mais do
            que ajuda. */}
        <button
          className="acao"
          onClick={() => {
            if (compondo) {
              setTitulo("");
              setCorpo("");
              setBlocos([]);
            }
            setCompondo((c) => !c);
          }}
        >
          {compondo ? "Cancelar" : "Novo comunicado"}
        </button>
      </div>
      <p className="aviso">
        Chega como notificação no app de quem mora no condomínio. Quem ainda
        não instalou não recebe: a lista abaixo mostra quantos leram.
      </p>

      {erro && (
        <p className="erro" style={{ marginTop: 12 }}>
          {erro}
        </p>
      )}

      {compondo && (
        <div className="card">
          <input
            placeholder="Título (ex.: Manutenção do elevador na terça)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            style={{ width: "100%" }}
          />
          <textarea
            placeholder="O que os moradores precisam saber."
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            maxLength={4000}
            rows={6}
            style={{ width: "100%", marginTop: 12 }}
          />
          {blocosDisponiveis.length > 0 && (
            <div className="linha" style={{ marginTop: 12 }}>
              <span style={{ fontSize: 13, color: "var(--texto-3)" }}>
                Blocos:
              </span>
              <div className="chips">
                {blocosDisponiveis.map((b) => (
                  <button
                    key={b}
                    className={`chip ${blocos.includes(b) ? "ativo" : ""}`}
                    onClick={() =>
                      setBlocos((atual) =>
                        atual.includes(b)
                          ? atual.filter((x) => x !== b)
                          : [...atual, b],
                      )
                    }
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="aviso">
            {blocos.length === 0
              ? "Vai para o condomínio inteiro."
              : `Vai só para: ${blocos.join(", ")}.`}
          </p>
          <button
            className="acao"
            disabled={!podePublicar}
            onClick={publicar}
            style={{ marginTop: 8 }}
          >
            {enviando ? "Publicando..." : "Publicar"}
          </button>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Comunicado</th>
              <th>Alvo</th>
              <th>Leitura</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="unidade">{c.titulo}</div>
                  <div style={{ fontSize: 13, color: "var(--texto-3)" }}>
                    {dataCurta(c.criadoEm)} · {c.autor}
                  </div>
                  {abertas[c.id] && (
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      {abertas[c.id].length === 0 ? (
                        <span style={{ color: "var(--texto-3)" }}>
                          Ninguém leu ainda.
                        </span>
                      ) : (
                        abertas[c.id].map((l, i) => (
                          <div key={i} style={{ color: "var(--texto-3)" }}>
                            {l.nome} · {rotuloUnidade(l.unidade)} ·{" "}
                            {dataCurta(l.lidoEm)}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </td>
                <td>{c.blocos.length === 0 ? "todo o condomínio" : c.blocos.join(", ")}</td>
                <td>
                  <span className={`selo ${c.leituras > 0 ? "ok" : "alerta"}`}>
                    {c.leituras} de {c.alcance}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="outline" onClick={() => verLeituras(c.id)}>
                    {abertas[c.id] ? "Ocultar" : "Quem leu"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {itens.length === 0 && (
          <p className="aviso">Nenhum comunicado publicado ainda.</p>
        )}
      </div>
    </>
  );
}
