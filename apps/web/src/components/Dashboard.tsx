"use client";

import { useCallback, useEffect, useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch, limparSessao } from "@/lib/api";

interface Pendencia {
  unidade?: { id: string; bloco: string | null; identificacao: string };
  pendentes: number;
  maisAntigoEm: string | null;
}

interface Resumo {
  naPortaria: number;
  retiradasHoje: number;
  paradas3Dias: number;
}

interface Adocao {
  totalUnidades: number;
  unidadesComApp: number;
  percentual: number;
}

interface VinculoPendente {
  id: string;
  criadoEm: string;
  morador: { nome: string; telefone: string };
  unidade: { bloco: string | null; identificacao: string };
}

type Visao = "visao-geral" | "moradores";

function rotulo(u?: { bloco: string | null; identificacao: string }) {
  if (!u) return "—";
  return u.bloco ? `${u.identificacao} · Bloco ${u.bloco}` : u.identificacao;
}

function diasDesde(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function Dashboard({
  perfil,
  aoSair,
}: {
  perfil: JwtPayload;
  aoSair: () => void;
}) {
  const gestor = perfil.papel === "SINDICO" || perfil.papel === "ADMIN";
  const [visao, setVisao] = useState<Visao>("visao-geral");
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [adocao, setAdocao] = useState<Adocao | null>(null);
  const [vinculos, setVinculos] = useState<VinculoPendente[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setResumo(await apiFetch<Resumo>("/portaria/resumo"));
      setPendencias(await apiFetch<Pendencia[]>("/portaria/pendencias"));
      setAdocao(await apiFetch<Adocao>("/cadastro/adocao"));
      if (gestor) {
        setVinculos(await apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes"));
      }
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [gestor]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aprovar(id: string) {
    await apiFetch(`/cadastro/vinculos/${id}/aprovar`, { method: "POST" });
    carregar();
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">guarita</div>
        <nav>
          <button
            className={`item ${visao === "visao-geral" ? "ativo" : ""}`}
            onClick={() => setVisao("visao-geral")}
          >
            Visão geral
          </button>
          <button className="item" disabled>
            Pacotes <span className="embreve">em breve</span>
          </button>
          <button className="item" disabled>
            Relatórios <span className="embreve">em breve</span>
          </button>
          {gestor && (
            <button
              className={`item ${visao === "moradores" ? "ativo" : ""}`}
              onClick={() => setVisao("moradores")}
            >
              Moradores
              {vinculos.length > 0 && (
                <span className="embreve" style={{ color: "#7CE3A8" }}>
                  {vinculos.length}
                </span>
              )}
            </button>
          )}
          <button className="item" onClick={() => { limparSessao(); aoSair(); }}>
            Sair
          </button>
        </nav>
        <div className="rodape">
          <div className="nome">{perfil.condominioNome ?? "Condomínio"}</div>
          <div className="sub">
            {perfil.nome} · {perfil.papel?.toLowerCase()}
          </div>
        </div>
      </aside>

      <main className="conteudo">
        {erro && <p className="erro">{erro}</p>}

        {visao === "visao-geral" && (
          <>
            <h1>Visão geral</h1>
            <p className="aviso">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>

            <div className="metricas">
              <div className="metrica">
                <div className="valor">{resumo?.naPortaria ?? "—"}</div>
                <div className="rotulo">na portaria agora</div>
                {(resumo?.paradas3Dias ?? 0) > 0 && (
                  <div className="sub ambar">{resumo!.paradas3Dias} há 3+ dias</div>
                )}
              </div>
              <div className="metrica">
                <div className="valor">{resumo?.retiradasHoje ?? "—"}</div>
                <div className="rotulo">retiradas hoje</div>
              </div>
              <div className="metrica">
                <div className="valor verde">{adocao ? `${adocao.percentual}%` : "—"}</div>
                <div className="rotulo">adoção do app</div>
                <div className="sub">
                  {adocao?.unidadesComApp ?? 0} de {adocao?.totalUnidades ?? 0} unidades
                </div>
              </div>
            </div>

            <section className="card">
              <h2>Paradas há mais tempo</h2>
              {pendencias.length === 0 ? (
                <p className="aviso">Nenhuma encomenda aguardando retirada.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Pacotes</th>
                      <th>Mais antigo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendencias.map((p, i) => {
                      const dias = diasDesde(p.maisAntigoEm);
                      return (
                        <tr key={p.unidade?.id ?? i}>
                          <td className="unidade">{rotulo(p.unidade)}</td>
                          <td>
                            <span className="selo info">{p.pendentes}</span>
                          </td>
                          <td>
                            <span className={`selo ${dias >= 3 ? "alerta" : "ok"}`}>
                              {dias === 0 ? "hoje" : `há ${dias} dia${dias > 1 ? "s" : ""}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p className="aviso" style={{ marginTop: 12 }}>
                Lembretes automáticos são enviados no 3º dia.
              </p>
            </section>
          </>
        )}

        {visao === "moradores" && gestor && (
          <>
            <h1>Moradores</h1>
            <p className="aviso">Vínculos, aprovações e importação do cadastro.</p>

            {vinculos.length > 0 && (
              <section className="card">
                <h2>Vínculos aguardando aprovação</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Morador</th>
                      <th>Telefone</th>
                      <th>Unidade</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vinculos.map((v) => (
                      <tr key={v.id}>
                        <td className="unidade">{v.morador.nome}</td>
                        <td>{v.morador.telefone}</td>
                        <td>{rotulo(v.unidade)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="acao" onClick={() => aprovar(v.id)}>
                            Aprovar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <Importar aoImportar={carregar} />
          </>
        )}
      </main>
    </div>
  );
}

function Importar({ aoImportar }: { aoImportar: () => void }) {
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
