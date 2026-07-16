"use client";

import { useCallback, useEffect, useState } from "react";
import type { JwtPayload } from "@pacotes/shared";
import { apiFetch, limparSessao } from "@/lib/api";
import { Importar } from "./Importar";

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

interface DiaSerie {
  dia: string;
  entradas: number;
  retiradas: number;
}

interface PacoteLinha {
  id: string;
  status: "ARMAZENADO" | "ENTREGUE" | "EXTRAVIADO";
  transportadora: string | null;
  codigoRastreio: string | null;
  localArmazenamento: string | null;
  recebidoEm: string;
  unidade: { bloco: string | null; identificacao: string };
  retirada: { retiradoEm: string } | null;
}

interface ListaPacotes {
  total: number;
  pagina: number;
  porPagina: number;
  itens: PacoteLinha[];
}

interface Relatorios {
  tempoMedioDias: number;
  volume: number;
  notificacoesPct: number;
  porTransportadora: { nome: string; qtd: number; pct: number }[];
  porHorario: { faixa: string; qtd: number; pct: number }[];
}

type Visao = "visao-geral" | "pacotes" | "relatorios" | "moradores";

function rotulo(u?: { bloco: string | null; identificacao: string }) {
  if (!u) return "—";
  return u.bloco ? `${u.identificacao} · ${u.bloco}` : u.identificacao;
}

function diasDesde(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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
  const [pendentesAprovacao, setPendentesAprovacao] = useState(0);

  useEffect(() => {
    if (gestor) {
      apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes")
        .then((v) => setPendentesAprovacao(v.length))
        .catch(() => {});
    }
  }, [gestor, visao]);

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
          <button
            className={`item ${visao === "pacotes" ? "ativo" : ""}`}
            onClick={() => setVisao("pacotes")}
          >
            Pacotes
          </button>
          <button
            className={`item ${visao === "relatorios" ? "ativo" : ""}`}
            onClick={() => setVisao("relatorios")}
          >
            Relatórios
          </button>
          {gestor && (
            <button
              className={`item ${visao === "moradores" ? "ativo" : ""}`}
              onClick={() => setVisao("moradores")}
            >
              Moradores
              {pendentesAprovacao > 0 && (
                <span className="embreve" style={{ color: "#7CE3A8" }}>
                  {pendentesAprovacao}
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
        {visao === "visao-geral" && <VisaoGeral />}
        {visao === "pacotes" && <PacotesView />}
        {visao === "relatorios" && <RelatoriosView />}
        {visao === "moradores" && gestor && <MoradoresView />}
      </main>
    </div>
  );
}

function VisaoGeral() {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [adocao, setAdocao] = useState<Adocao | null>(null);
  const [serie, setSerie] = useState<DiaSerie[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setResumo(await apiFetch<Resumo>("/portaria/resumo"));
        setPendencias(await apiFetch<Pendencia[]>("/portaria/pendencias"));
        setAdocao(await apiFetch<Adocao>("/cadastro/adocao"));
        setSerie(await apiFetch<DiaSerie[]>("/portaria/serie-diaria?dias=14"));
        setErro(null);
      } catch (e) {
        setErro((e as Error).message);
      }
    })();
  }, []);

  const maxSerie = Math.max(1, ...serie.map((d) => Math.max(d.entradas, d.retiradas)));

  return (
    <>
      <h1>Visão geral</h1>
      <p className="aviso">
        {new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      {erro && <p className="erro">{erro}</p>}

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

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
        <section className="card">
          <h2>Entradas x retiradas — 14 dias</h2>
          <div className="grafico-pareado">
            {serie.map((d) => (
              <div className="dia" key={d.dia} title={`${dataCurta(d.dia)}: ${d.entradas} entradas, ${d.retiradas} retiradas`}>
                <div
                  className="barra entradas"
                  style={{ height: `${(d.entradas / maxSerie) * 100}%` }}
                />
                <div
                  className="barra retiradas"
                  style={{ height: `${(d.retiradas / maxSerie) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="legenda">
            <span>
              <span className="quadrado" style={{ background: "var(--acao)" }} />
              entradas
            </span>
            <span>
              <span className="quadrado" style={{ background: "var(--barra-clara)" }} />
              retiradas
            </span>
          </div>
        </section>

        <section className="card">
          <h2>Paradas há 3+ dias</h2>
          {pendencias.filter((p) => diasDesde(p.maisAntigoEm) >= 3).length === 0 ? (
            <p className="aviso">Nenhuma encomenda parada há 3+ dias.</p>
          ) : (
            pendencias
              .filter((p) => diasDesde(p.maisAntigoEm) >= 3)
              .slice(0, 6)
              .map((p, i) => (
                <div
                  key={p.unidade?.id ?? i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 0",
                    borderBottom: "1px solid var(--divisor)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{rotulo(p.unidade)}</div>
                    <div className="aviso">{p.pendentes} pacote(s)</div>
                  </div>
                  <span className="selo alerta">{diasDesde(p.maisAntigoEm)} dias</span>
                </div>
              ))
          )}
          <p className="aviso" style={{ marginTop: 12 }}>
            Lembretes automáticos são enviados no 3º dia.
          </p>
        </section>
      </div>
    </>
  );
}

function PacotesView() {
  const [filtroStatus, setFiltroStatus] = useState<string>("ARMAZENADO");
  const [ultimos30, setUltimos30] = useState(false);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<ListaPacotes | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (busca.trim()) params.set("busca", busca.trim());
      if (ultimos30) params.set("dias", "30");
      params.set("pagina", String(pagina));
      setDados(await apiFetch<ListaPacotes>(`/portaria/pacotes?${params}`));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [filtroStatus, busca, ultimos30, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportarCsv() {
    const linhas: string[] = [
      "unidade;transportadora;rastreio;prateleira;entrada;retirada;status",
    ];
    let p = 1;
    let total = Infinity;
    while ((p - 1) * 12 < Math.min(total, 500)) {
      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (busca.trim()) params.set("busca", busca.trim());
      if (ultimos30) params.set("dias", "30");
      params.set("pagina", String(p));
      const lote = await apiFetch<ListaPacotes>(`/portaria/pacotes?${params}`);
      total = lote.total;
      for (const i of lote.itens) {
        linhas.push(
          [
            rotulo(i.unidade),
            i.transportadora ?? "",
            i.codigoRastreio ?? "",
            i.localArmazenamento ?? "",
            new Date(i.recebidoEm).toLocaleString("pt-BR"),
            i.retirada ? new Date(i.retirada.retiradoEm).toLocaleString("pt-BR") : "",
            i.status.toLowerCase(),
          ].join(";"),
        );
      }
      if (lote.itens.length < 12) break;
      p++;
    }
    const blob = new Blob(["﻿" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guarita-pacotes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Pacotes</h1>
        <button className="outline" onClick={exportarCsv}>
          Exportar CSV
        </button>
      </div>

      <div className="linha" style={{ marginTop: 16 }}>
        <input
          style={{ width: 280 }}
          placeholder="Unidade, rastreio, transportadora…"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
        />
        <div className="chips">
          <button
            className={`chip ${filtroStatus === "ARMAZENADO" ? "ativo" : ""}`}
            onClick={() => {
              setFiltroStatus("ARMAZENADO");
              setPagina(1);
            }}
          >
            Na portaria{dados && filtroStatus === "ARMAZENADO" ? ` · ${dados.total}` : ""}
          </button>
          <button
            className={`chip ${filtroStatus === "ENTREGUE" ? "ativo" : ""}`}
            onClick={() => {
              setFiltroStatus("ENTREGUE");
              setPagina(1);
            }}
          >
            Entregues
          </button>
          <button
            className={`chip ${filtroStatus === "EXTRAVIADO" ? "ativo" : ""}`}
            onClick={() => {
              setFiltroStatus("EXTRAVIADO");
              setPagina(1);
            }}
          >
            Extraviados
          </button>
          <button
            className={`chip ${ultimos30 ? "ativo" : ""}`}
            onClick={() => {
              setUltimos30(!ultimos30);
              setPagina(1);
            }}
          >
            Últimos 30 dias
          </button>
        </div>
      </div>

      {erro && <p className="erro" style={{ marginTop: 12 }}>{erro}</p>}

      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Transportadora</th>
              <th>Rastreio</th>
              <th>Prateleira</th>
              <th>Entrada</th>
              <th>Tempo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dados?.itens.map((p) => {
              const dias = p.retirada
                ? Math.max(
                    0,
                    Math.floor(
                      (new Date(p.retirada.retiradoEm).getTime() -
                        new Date(p.recebidoEm).getTime()) /
                        86_400_000,
                    ),
                  )
                : diasDesde(p.recebidoEm);
              const atrasado = p.status === "ARMAZENADO" && dias >= 3;
              return (
                <tr key={p.id}>
                  <td className="unidade">{rotulo(p.unidade)}</td>
                  <td>{p.transportadora ?? "—"}</td>
                  <td className="mono">{p.codigoRastreio ?? "—"}</td>
                  <td>{p.localArmazenamento ?? "—"}</td>
                  <td>{new Date(p.recebidoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td style={atrasado ? { color: "var(--alerta)", fontWeight: 600 } : undefined}>
                    {dias === 0 ? "hoje" : `${dias} dia${dias > 1 ? "s" : ""}`}
                  </td>
                  <td>
                    <span className={`selo ${p.status === "ARMAZENADO" ? "info" : "ok"}`}>
                      {p.status === "ARMAZENADO"
                        ? "na portaria"
                        : p.status === "ENTREGUE"
                          ? "entregue"
                          : "extraviado"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {dados && dados.itens.length === 0 && (
              <tr>
                <td colSpan={7} className="aviso">
                  Nenhum pacote com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {totalPaginas > 1 && (
          <div className="paginacao">
            {Array.from({ length: Math.min(totalPaginas, 8) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={n === pagina ? "ativa" : ""}
                onClick={() => setPagina(n)}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function RelatoriosView() {
  const [dados, setDados] = useState<Relatorios | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Relatorios>("/portaria/relatorios?dias=30")
      .then(setDados)
      .catch((e) => setErro((e as Error).message));
  }, []);

  const pico = dados?.porHorario.reduce(
    (melhor, f) => (f.qtd > melhor.qtd ? f : melhor),
    { faixa: "", qtd: 0, pct: 0 },
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1>Relatórios</h1>
        <span className="selo info">Últimos 30 dias</span>
      </div>
      {erro && <p className="erro" style={{ marginTop: 12 }}>{erro}</p>}

      <div className="metricas">
        <div className="metrica">
          <div className="valor">
            {dados ? `${dados.tempoMedioDias.toLocaleString("pt-BR")} dia${dados.tempoMedioDias === 1 ? "" : "s"}` : "—"}
          </div>
          <div className="rotulo">tempo médio até retirada</div>
        </div>
        <div className="metrica">
          <div className="valor">{dados?.volume.toLocaleString("pt-BR") ?? "—"}</div>
          <div className="rotulo">encomendas no período</div>
        </div>
        <div className="metrica">
          <div className="valor verde">{dados ? `${dados.notificacoesPct}%` : "—"}</div>
          <div className="rotulo">notificações entregues</div>
          <div className="sub">push · WhatsApp fallback em breve</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section className="card">
          <h2>Volume por transportadora</h2>
          {dados?.porTransportadora.map((t) => (
            <div className="barra-h" key={t.nome}>
              <div className="nome">{t.nome}</div>
              <div className="trilha">
                <div className="preenchimento" style={{ width: `${t.pct}%` }} />
              </div>
              <div className="pct">{t.pct}%</div>
            </div>
          ))}
          {dados?.porTransportadora.length === 0 && (
            <p className="aviso">Sem dados no período.</p>
          )}
        </section>

        <section className="card">
          <h2>Retiradas por horário</h2>
          <div className="grafico-horario">
            {dados?.porHorario.map((f) => (
              <div className="faixa" key={f.faixa} title={`${f.qtd} retiradas`}>
                <div
                  className="coluna"
                  style={{ height: `${f.pct}%`, opacity: 0.35 + (f.pct / 100) * 0.65 }}
                />
                <div className="rotulo">{f.faixa}</div>
              </div>
            ))}
          </div>
          {pico && pico.qtd > 0 && (
            <p className="aviso" style={{ marginTop: 12 }}>
              Pico entre {pico.faixa.replace(" a ", "h e ")}: reforce a portaria nesse turno.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function MoradoresView() {
  const [vinculos, setVinculos] = useState<VinculoPendente[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setVinculos(await apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes"));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aprovar(id: string) {
    await apiFetch(`/cadastro/vinculos/${id}/aprovar`, { method: "POST" });
    carregar();
  }

  return (
    <>
      <h1>Moradores</h1>
      <p className="aviso">Vínculos, aprovações e importação do cadastro.</p>
      {erro && <p className="erro">{erro}</p>}

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
  );
}
