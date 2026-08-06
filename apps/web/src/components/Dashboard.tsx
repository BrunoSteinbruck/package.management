"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatarTelefone,
  linkWhatsApp,
  perfilDe,
  rotuloUnidade,
  type Adocao,
  type Capacidades,
  type ModuloCondominio,
  type DiaSerie,
  type FotoRef,
  type JwtPayload,
  type ListaPacotes,
  type MembroEquipe,
  type OcorrenciaGestor as Ocorrencia,
  type PacoteLinha,
  type Pendencia,
  type Relatorios,
  type ResumoFinanceiro,
  type Resumo,
  type UnidadePanorama,
  type UnidadeRotulo,
  type VagaLinha,
  type VinculoPendente,
} from "@pacotes/shared";
import { apiFetch, API_URL, limparSessao } from "@/lib/api";
import { janelaDePaginas, RETICENCIAS } from "@/lib/paginacao";
import { ComunicadosView } from "./ComunicadosView";
import { ConfiguracoesView } from "./ConfiguracoesView";
import { ConsumosView } from "./ConsumosView";
import { DocumentosView } from "./DocumentosView";
import { VisitantesView } from "./VisitantesView";
import { FinanceiroView } from "./FinanceiroView";
import { Importar } from "./Importar";
import { MinhaContaView } from "./MinhaContaView";

type Visao =
  | "visao-geral"
  | "pacotes"
  | "relatorios"
  | "consumos"
  | "moradores"
  | "ocorrencias"
  | "comunicados"
  | "documentos"
  | "visitantes"
  | "financeiro"
  | "configuracoes"
  | "minha-conta";

function urlFoto(foto: FotoRef): string {
  return `${API_URL}/uploads/${foto.key}?t=${encodeURIComponent(foto.token)}`;
}

const STATUS_OCORRENCIA: Record<
  Ocorrencia["status"],
  { rotulo: string; selo: string }
> = {
  ABERTO: { rotulo: "aberta", selo: "alerta" },
  RESOLVIDO: { rotulo: "resolvida", selo: "ok" },
};

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
  const gestor = perfilDe(perfil) === "sindico";
  const [visao, setVisao] = useState<Visao>("visao-geral");
  const [pendentesAprovacao, setPendentesAprovacao] = useState(0);
  const [ocorrenciasAbertas, setOcorrenciasAbertas] = useState<Ocorrencia[]>([]);
  const [modulos, setModulos] = useState<ModuloCondominio[]>([]);
  // Vem junto das capacidades para o convite por WhatsApp anexar ao texto;
  // sem env no servidor é null e o convite sai sem link.
  const [appDownloadUrl, setAppDownloadUrl] = useState<string | null>(null);
  const ligado = (m: ModuloCondominio) => modulos.includes(m);

  // Recarrega a cada troca de visão: sair de Configurações depois de ligar um
  // módulo tem que revelar a seção dele sem exigir F5.
  useEffect(() => {
    apiFetch<Capacidades>("/conta/capacidades")
      .then((c) => {
        setModulos(c.modulos);
        setAppDownloadUrl(c.appDownloadUrl ?? null);
      })
      .catch(() => {});
  }, [visao]);

  /**
   * Visão de módulo desligado volta para a Visão geral.
   *
   * Cada visão de módulo é renderizada com `&& ligado(m)`, então se a flag
   * cair enquanto ela está aberta o `main` fica VAZIO: barra lateral à
   * esquerda e um retângulo branco, sem título, sem mensagem, sem nada em que
   * clicar. Acontece quando o módulo é desligado em outra aba, ou quando a
   * lista de módulos termina de carregar depois da navegação. Encontrado na
   * varredura de QA, com o painel numa tela em branco.
   */
  useEffect(() => {
    const exigido: Partial<Record<Visao, ModuloCondominio>> = {
      comunicados: "comunicados",
      documentos: "documentos",
      visitantes: "visitantes",
      financeiro: "financeiro",
    };
    const m = exigido[visao];
    if (m && modulos.length > 0 && !modulos.includes(m)) setVisao("visao-geral");
  }, [visao, modulos]);

  useEffect(() => {
    if (gestor) {
      apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes")
        .then((v) => setPendentesAprovacao(v.length))
        .catch(() => {});
      // Guarda a lista, não só o tamanho: a visão geral diz há quanto tempo a
      // mais antiga está esperando e de que categoria ela é, que é o que faz
      // o síndico clicar. Era a mesma requisição jogando o resto fora.
      apiFetch<Ocorrencia[]>("/cadastro/ocorrencias?status=ABERTO")
        .then(setOcorrenciasAbertas)
        .catch(() => {});
    }
  }, [gestor, visao]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">convivar</div>
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
              className={`item ${visao === "consumos" ? "ativo" : ""}`}
              onClick={() => setVisao("consumos")}
            >
              Consumos
            </button>
          )}
          {gestor && (
            <button
              className={`item ${visao === "ocorrencias" ? "ativo" : ""}`}
              onClick={() => setVisao("ocorrencias")}
            >
              Ocorrências
              {ocorrenciasAbertas.length > 0 && (
                <span className="embreve" style={{ color: "#7CE3A8" }}>
                  {ocorrenciasAbertas.length}
                </span>
              )}
            </button>
          )}
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
          {/* Sem `gestor`: quem confere o portão é a portaria, e o endpoint
              já aceita a equipe inteira. */}
          {ligado("visitantes") && (
            <button
              className={`item ${visao === "visitantes" ? "ativo" : ""}`}
              onClick={() => setVisao("visitantes")}
            >
              Visitantes
            </button>
          )}
          {gestor && ligado("comunicados") && (
            <button
              className={`item ${visao === "comunicados" ? "ativo" : ""}`}
              onClick={() => setVisao("comunicados")}
            >
              Comunicados
            </button>
          )}
          {gestor && ligado("documentos") && (
            <button
              className={`item ${visao === "documentos" ? "ativo" : ""}`}
              onClick={() => setVisao("documentos")}
            >
              Documentos
            </button>
          )}
          {gestor && ligado("financeiro") && (
            <button
              className={`item ${visao === "financeiro" ? "ativo" : ""}`}
              onClick={() => setVisao("financeiro")}
            >
              Financeiro
            </button>
          )}
          {gestor && (
            <button
              className={`item ${visao === "configuracoes" ? "ativo" : ""}`}
              onClick={() => setVisao("configuracoes")}
            >
              Configurações
            </button>
          )}
          <button
            className={`item ${visao === "minha-conta" ? "ativo" : ""}`}
            onClick={() => setVisao("minha-conta")}
          >
            Minha conta
          </button>
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
        {visao === "visao-geral" && (
          <VisaoGeral
            gestor={gestor}
            ocorrenciasAbertas={ocorrenciasAbertas}
            pendentesAprovacao={pendentesAprovacao}
            modulos={modulos}
            aoNavegar={setVisao}
          />
        )}
        {visao === "pacotes" && <PacotesView />}
        {visao === "relatorios" && <RelatoriosView />}
        {visao === "consumos" && gestor && <ConsumosView />}
        {visao === "ocorrencias" && gestor && <OcorrenciasView />}
        {visao === "moradores" && gestor && (
          <MoradoresView
            appDownloadUrl={appDownloadUrl}
            condominio={perfil.condominioNome ?? "condomínio"}
          />
        )}
        {visao === "comunicados" && gestor && ligado("comunicados") && (
          <ComunicadosView />
        )}
        {visao === "documentos" && gestor && ligado("documentos") && (
          <DocumentosView />
        )}
        {visao === "visitantes" && ligado("visitantes") && <VisitantesView />}
        {visao === "financeiro" && gestor && ligado("financeiro") && (
          <FinanceiroView />
        )}
        {visao === "configuracoes" && gestor && <ConfiguracoesView />}
        {visao === "minha-conta" && <MinhaContaView />}
      </main>
    </div>
  );
}

function VisaoGeral({
  gestor,
  ocorrenciasAbertas,
  pendentesAprovacao,
  modulos,
  aoNavegar,
}: {
  gestor: boolean;
  ocorrenciasAbertas: Ocorrencia[];
  pendentesAprovacao: number;
  modulos: ModuloCondominio[];
  aoNavegar: (v: Visao) => void;
}) {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [adocao, setAdocao] = useState<Adocao | null>(null);
  const [serie, setSerie] = useState<DiaSerie[]>([]);
  const [financeiro, setFinanceiro] = useState<ResumoFinanceiro | null>(null);
  const [visitasHoje, setVisitasHoje] = useState<number | null>(null);
  const [relatorios, setRelatorios] = useState<Relatorios | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const temFinanceiro = gestor && modulos.includes("financeiro");
  const temVisitantes = modulos.includes("visitantes");

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
    // Fora do bloco acima porque só alimenta uma legenda: se os relatórios
    // caírem, a visão geral continua de pé sem o tempo médio.
    apiFetch<Relatorios>("/portaria/relatorios?dias=30")
      .then(setRelatorios)
      .catch(() => {});
  }, []);

  // Os blocos dos módulos falham sozinhos: um endpoint fora do ar não pode
  // apagar a home inteira do síndico.
  useEffect(() => {
    if (temFinanceiro) {
      apiFetch<ResumoFinanceiro>("/cadastro/financeiro/resumo")
        .then(setFinanceiro)
        .catch(() => {});
    }
    if (temVisitantes) {
      apiFetch<Array<unknown>>("/portaria/visitas-hoje")
        .then((v) => setVisitasHoje(v.length))
        .catch(() => {});
    }
  }, [temFinanceiro, temVisitantes]);

  const maxSerie = Math.max(1, ...serie.map((d) => Math.max(d.entradas, d.retiradas)));

  const maisAntiga = ocorrenciasAbertas.reduce<Ocorrencia | null>(
    (velha, o) => (!velha || o.criadoEm < velha.criadoEm ? o : velha),
    null,
  );
  // Entradas de hoje e a média do período saem da própria série de 14 dias: o
  // resumo da portaria conta o que ESTÁ na portaria, não o que entrou.
  const entradasHoje = serie.length > 0 ? serie[serie.length - 1].entradas : null;
  const mediaEntradas =
    serie.length > 0
      ? Math.round(serie.reduce((soma, d) => soma + d.entradas, 0) / serie.length)
      : null;

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

      {/* O dia do síndico é reativo: a primeira linha responde "o que precisa
          de MIM agora?", em cards que já levam para a ação. Métrica de
          acompanhamento vem depois; o quarteirão de pacotes, que era a tela
          inteira, vira o terceiro bloco. */}
      {gestor && (
        <div className="metricas">
          <button
            type="button"
            className="metrica metrica-acao"
            onClick={() => aoNavegar("ocorrencias")}
          >
            <div className={`valor ${ocorrenciasAbertas.length > 0 ? "" : "verde"}`}>
              {ocorrenciasAbertas.length}
            </div>
            <div className="rotulo">relatos de moradores abertos</div>
            {/* A mais antiga e de que assunto: "3 abertos" não diz se são
                três lâmpadas de hoje ou um elevador parado há dois dias. */}
            <div className="sub">
              {maisAntiga
                ? `mais antiga há ${diasDesde(maisAntiga.criadoEm)} dia${
                    diasDesde(maisAntiga.criadoEm) === 1 ? "" : "s"
                  } · ${maisAntiga.categoria}`
                : "fila limpa"}
            </div>
          </button>
          <button
            type="button"
            className="metrica metrica-acao"
            onClick={() => aoNavegar("moradores")}
          >
            <div className={`valor ${pendentesAprovacao > 0 ? "" : "verde"}`}>
              {pendentesAprovacao}
            </div>
            <div className="rotulo">moradores para aprovar</div>
            <div className="sub">
              {pendentesAprovacao > 0
                ? "vínculos pedidos pelo app"
                : "ninguém esperando"}
            </div>
          </button>
          {temFinanceiro && financeiro && (
            <button
              type="button"
              className="metrica metrica-acao"
              onClick={() => aoNavegar("financeiro")}
            >
              <div
                className={`valor ${financeiro.inadimplencia > 0 ? "" : "verde"}`}
              >
                {financeiro.inadimplencia.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="rotulo">em aberto no mês</div>
              <div className="sub">
                {financeiro.unidadesPagas} de {financeiro.unidadesCobradas}{" "}
                unidades pagaram
              </div>
            </button>
          )}
          {temVisitantes && (
            <button
              type="button"
              className="metrica metrica-acao"
              onClick={() => aoNavegar("visitantes")}
            >
              <div className="valor">{visitasHoje ?? "-"}</div>
              <div className="rotulo">visitas esperadas hoje</div>
              <div className="sub">pré-autorizadas pelos moradores</div>
            </button>
          )}
        </div>
      )}

      <div className="metricas">
        <div className="metrica">
          <div className="valor">{resumo?.naPortaria ?? "-"}</div>
          <div className="rotulo">na portaria agora</div>
          {(resumo?.paradas3Dias ?? 0) > 0 && (
            <div className="sub ambar">{resumo!.paradas3Dias} há 3+ dias</div>
          )}
        </div>
        <div className="metrica">
          <div className="valor">{entradasHoje ?? "-"}</div>
          <div className="rotulo">entradas hoje</div>
          {mediaEntradas !== null && (
            <div className="sub">média: {mediaEntradas}/dia</div>
          )}
        </div>
        <div className="metrica">
          <div className="valor">{resumo?.retiradasHoje ?? "-"}</div>
          <div className="rotulo">retiradas hoje</div>
          {relatorios && (
            <div className="sub">
              tempo médio: {relatorios.tempoMedioDias.toLocaleString("pt-BR")} dia
              {relatorios.tempoMedioDias === 1 ? "" : "s"}
            </div>
          )}
        </div>
        <div className="metrica">
          <div className="valor verde">{adocao ? `${adocao.percentual}%` : "-"}</div>
          <div className="rotulo">adoção do app</div>
          <div className="sub">
            {adocao?.unidadesComApp ?? 0} de {adocao?.totalUnidades ?? 0} unidades
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
        <section className="card">
          <h2>Entradas x retiradas: 14 dias</h2>
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
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <h2 style={{ margin: 0 }}>Paradas há 3+ dias</h2>
            {/* A lista mostra 6. Sem esta saída, o síndico com 12 unidades
                paradas via metade e não tinha para onde ir. */}
            <button
              type="button"
              className="link"
              onClick={() => aoNavegar("pacotes")}
            >
              ver todas
            </button>
          </div>
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
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{rotuloUnidade(p.unidade)}</div>
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
  const [exportando, setExportando] = useState(false);

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

  // O laço faz até 42 requisições. Uma que falhe no meio abortava a exportação
  // inteira sem baixar nada e sem dizer nada: o síndico clicava e o navegador
  // ficava parado. Agora o download só sai completo, e a falha aparece na tela.
  async function exportarCsv() {
    const linhas: string[] = [
      "unidade;transportadora;rastreio;prateleira;entrada;retirada;status",
    ];
    setExportando(true);
    try {
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
              rotuloUnidade(i.unidade),
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
      setErro(null);
    } catch (e) {
      setErro(`Exportação interrompida: ${(e as Error).message}`);
      return;
    } finally {
      setExportando(false);
    }
    const blob = new Blob(["﻿" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "convivar-pacotes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Pacotes</h1>
        <button className="outline" onClick={exportarCsv} disabled={exportando}>
          {exportando ? "Exportando..." : "Exportar CSV"}
        </button>
      </div>

      <div className="linha" style={{ marginTop: 16 }}>
        <input
          style={{ width: 280 }}
          placeholder="Unidade, rastreio, transportadora…"
          maxLength={60}
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
          {/* Os três status são excludentes e nenhum desmarca: sem esta opção
              não havia como ver a lista inteira, e a busca só encontrava
              dentro do filtro ativo. Procurar uma encomenda já entregue a
              partir da tela padrão não devolvia nada, como se ela não
              existisse. */}
          <button
            className={`chip ${filtroStatus === "" ? "ativo" : ""}`}
            onClick={() => {
              setFiltroStatus("");
              setPagina(1);
            }}
          >
            Todos{dados && filtroStatus === "" ? ` · ${dados.total}` : ""}
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
                  <td className="unidade">{rotuloUnidade(p.unidade)}</td>
                  <td>{p.transportadora ?? "-"}</td>
                  <td className="mono">{p.codigoRastreio ?? "-"}</td>
                  <td>{p.localArmazenamento ?? "-"}</td>
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
        {/* Quantos de quantos: a paginação sozinha não diz se a página 3 de 4
            tem 12 linhas ou 2, e o CSV exporta o filtro inteiro, não a página. */}
        {dados && dados.itens.length > 0 && (
          <p className="aviso" style={{ marginTop: 10 }}>
            Mostrando {dados.itens.length} de {dados.total}
          </p>
        )}
        {totalPaginas > 1 && (
          <div className="paginacao">
            {janelaDePaginas(pagina, totalPaginas).map((item, i) =>
              item === RETICENCIAS ? (
                <span key={`sep-${i}`} className="paginacao-salto">
                  {RETICENCIAS}
                </span>
              ) : (
                <button
                  key={item}
                  className={item === pagina ? "ativa" : ""}
                  onClick={() => setPagina(item)}
                >
                  {item}
                </button>
              ),
            )}
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
            {dados ? `${dados.tempoMedioDias.toLocaleString("pt-BR")} dia${dados.tempoMedioDias === 1 ? "" : "s"}` : "-"}
          </div>
          <div className="rotulo">tempo médio até retirada</div>
        </div>
        <div className="metrica">
          <div className="valor">{dados?.volume.toLocaleString("pt-BR") ?? "-"}</div>
          <div className="rotulo">volume no período</div>
          <div className="sub">pacotes recebidos</div>
        </div>
        <div className="metrica">
          <div className="valor verde">{dados ? `${dados.notificacoesPct}%` : "-"}</div>
          <div className="rotulo">notificações entregues</div>
          <div className="sub">push · WhatsApp fallback em breve</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section className="card">
          <h2>Volume por transportadora</h2>
          {dados?.porTransportadora.map((t, i) => (
            // Índice na chave: o nome vem do banco e já colidiu uma vez.
            <div className="barra-h" key={`${i}-${t.nome}`}>
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

function EquipeSection() {
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("PORTEIRO");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Só quem entra no painel por senha precisa de e-mail: é por ele que a
  // primeira senha é definida e recuperada.
  const exigeEmail = papel === "SINDICO";
  // Preenchimento do e-mail de quem foi cadastrado antes da senha existir.
  // Só para quem NÃO tem: trocar o de quem já tem seria tomada de conta, e o
  // servidor recusa.
  const [completando, setCompletando] = useState<string | null>(null);
  const [emailDoMembro, setEmailDoMembro] = useState("");

  const carregar = useCallback(async () => {
    try {
      setEquipe(await apiFetch<MembroEquipe[]>("/cadastro/equipe"));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar() {
    setEnviando(true);
    setErro(null);
    try {
      await apiFetch("/cadastro/equipe", {
        method: "POST",
        body: {
          nome,
          telefone: telefone.replace(/\D/g, ""),
          papel,
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      });
      setNome("");
      setTelefone("");
      setEmail("");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function completarEmail(id: string) {
    setErro(null);
    try {
      await apiFetch(`/cadastro/equipe/${id}/email`, {
        method: "POST",
        body: { email: emailDoMembro.trim() },
      });
      setCompletando(null);
      setEmailDoMembro("");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function alternar(id: string) {
    try {
      await apiFetch(`/cadastro/equipe/${id}/alternar-ativo`, { method: "POST" });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Equipe da portaria</h2>
      <p className="aviso" style={{ marginBottom: 10 }}>
        Porteiro e apoio entram no app e neste painel pelo código por SMS.
        Síndico entra por e-mail e senha: no primeiro acesso, ele usa
        "Esqueci a senha" para criar a dele.
      </p>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefone</th>
            <th>E-mail</th>
            <th>Papel</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {equipe.map((m) => (
            <tr key={m.id}>
              <td className="unidade">{m.nome}</td>
              <td>{m.telefone}</td>
              <td>
                {m.email ? (
                  m.email
                ) : completando === m.id ? (
                  <span className="linha" style={{ gap: 6 }}>
                    <input
                      type="email"
                      style={{ width: 190 }}
                      placeholder="email@exemplo.com"
                      maxLength={160}
                      value={emailDoMembro}
                      onChange={(e) => setEmailDoMembro(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="acao"
                      onClick={() => completarEmail(m.id)}
                      disabled={!emailDoMembro.includes("@")}
                    >
                      Salvar
                    </button>
                  </span>
                ) : (
                  <button
                    className="link"
                    onClick={() => {
                      setCompletando(m.id);
                      setEmailDoMembro("");
                    }}
                  >
                    Adicionar
                  </button>
                )}
              </td>
              <td>{m.papel.toLowerCase()}</td>
              <td>
                <span className={`selo ${m.ativo ? "ok" : "alerta"}`}>
                  {m.ativo ? "ativo" : "desativado"}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <button className="outline" onClick={() => alternar(m.id)}>
                  {m.ativo ? "Desativar" : "Reativar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="linha" style={{ marginTop: 16 }}>
        <input
          style={{ width: 200 }}
          placeholder="Nome"
          maxLength={120}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <input
          style={{ width: 160 }}
          placeholder="Telefone (DDD+número)"
          maxLength={20}
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
        <input
          style={{ width: 220 }}
          type="email"
          placeholder={exigeEmail ? "E-mail (obrigatório)" : "E-mail (opcional)"}
          maxLength={160}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          style={{
            border: "1px solid var(--borda)",
            borderRadius: 18,
            padding: "10px 14px",
            fontSize: 14,
            background: "var(--surface)",
          }}
        >
          <option value="PORTEIRO">porteiro</option>
          <option value="APOIO">apoio</option>
          <option value="SINDICO">síndico</option>
        </select>
        <button
          className="acao"
          onClick={adicionar}
          disabled={
            enviando ||
            nome.trim().length < 2 ||
            telefone.replace(/\D/g, "").length < 10 ||
            (exigeEmail && !email.includes("@"))
          }
        >
          Adicionar à equipe
        </button>
      </div>
      {erro && <p className="erro" style={{ marginTop: 10 }}>{erro}</p>}
    </section>
  );
}

function OcorrenciasView() {
  const [filtro, setFiltro] = useState<string>("");
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const q = filtro ? `?status=${filtro}` : "";
      setOcorrencias(await apiFetch<Ocorrencia[]>(`/cadastro/ocorrencias${q}`));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(id: string, status: Ocorrencia["status"]) {
    try {
      await apiFetch(`/cadastro/ocorrencias/${id}/status`, {
        method: "POST",
        body: { status },
      });
      setErro(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const filtros: { valor: string; rotulo: string }[] = [
    { valor: "", rotulo: "Todas" },
    { valor: "ABERTO", rotulo: "Abertas" },
    { valor: "RESOLVIDO", rotulo: "Resolvidas" },
  ];

  return (
    <>
      <h1>Ocorrências</h1>
      <p className="aviso">
        Problemas do condomínio relatados pelos moradores. Atualize o status,
        o morador é avisado a cada mudança.
      </p>

      <div className="chips" style={{ marginTop: 16 }}>
        {filtros.map((f) => (
          <button
            key={f.valor || "todas"}
            className={`chip ${filtro === f.valor ? "ativo" : ""}`}
            onClick={() => setFiltro(f.valor)}
          >
            {filtro === f.valor ? `${f.rotulo} · ${ocorrencias.length}` : f.rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="erro" style={{ marginTop: 12 }}>{erro}</p>}

      <section className="card">
        <table>
          <thead>
            {/* O relato antes da foto: é o texto que diz o que houve, e ele
                estava espremido embaixo da categoria enquanto a miniatura
                abria a linha. */}
            <tr>
              <th>Categoria</th>
              <th>Relato</th>
              <th>Unidade</th>
              <th>Aberta há</th>
              <th>Foto</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ocorrencias.map((o) => {
              const s = STATUS_OCORRENCIA[o.status];
              return (
                <tr key={o.id}>
                  <td className="unidade">{o.categoria}</td>
                  <td>{o.descricao || <span className="aviso">sem descrição</span>}</td>
                  <td>
                    {rotuloUnidade(o.unidade)}
                    {/* A API devolve "-" quando o autor foi anonimizado; um
                        travessão solto embaixo da unidade não informa nada. */}
                    {o.autor && o.autor !== "-" && (
                      <div className="aviso" style={{ marginTop: 2 }}>
                        {o.autor}
                      </div>
                    )}
                  </td>
                  <td>
                    {diasDesde(o.criadoEm) === 0
                      ? "hoje"
                      : `${diasDesde(o.criadoEm)} dia${diasDesde(o.criadoEm) === 1 ? "" : "s"}`}
                  </td>
                  <td>
                    {o.foto ? (
                      <img
                        src={urlFoto(o.foto)}
                        alt="foto da ocorrência"
                        onClick={() =>
                          setAmpliada(ampliada === o.id ? null : o.id)
                        }
                        style={{
                          width: 52,
                          height: 52,
                          objectFit: "cover",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      />
                    ) : (
                      <span className="aviso">-</span>
                    )}
                  </td>
                  <td>
                    <span className={`selo ${s.selo}`}>{s.rotulo}</span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {o.status === "ABERTO" ? (
                      <button
                        className="acao"
                        onClick={() => mudarStatus(o.id, "RESOLVIDO")}
                      >
                        Resolver
                      </button>
                    ) : (
                      <button
                        className="outline"
                        onClick={() => mudarStatus(o.id, "ABERTO")}
                      >
                        Reabrir
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {ocorrencias.length === 0 && !erro && (
              <tr>
                <td colSpan={7} className="aviso">
                  Nenhuma ocorrência {filtro ? "com esse status" : "relatada"} até agora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="aviso" style={{ marginTop: 12 }}>
          O morador que relatou recebe push quando a ocorrência é resolvida.
        </p>
      </section>

      {ampliada &&
        (() => {
          const o = ocorrencias.find((x) => x.id === ampliada);
          if (!o?.foto) return null;
          return (
            <div
              onClick={() => setAmpliada(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.72)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 32,
                zIndex: 50,
              }}
            >
              <img
                src={urlFoto(o.foto)}
                alt="foto da ocorrência"
                style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12 }}
              />
            </div>
          );
        })()}
    </>
  );
}

function VagasSection({ aoImportar }: { aoImportar: () => void }) {
  const [vagas, setVagas] = useState<VagaLinha[]>([]);
  const [csv, setCsv] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setVagas(await apiFetch<VagaLinha[]>("/cadastro/vagas"));
    } catch {
      // silencioso: a seção principal já mostra erros
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function importar() {
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      const vagasPayload = csv
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [identificacao, bloco, unidade] = l
            .split(/[;,\t]/)
            .map((c) => c.trim());
          return { identificacao, bloco: bloco || undefined, unidade };
        });
      const res = await apiFetch<{ criadas: number; semUnidade: string[] }>(
        "/cadastro/vagas",
        { method: "POST", body: { vagas: vagasPayload } },
      );
      setResultado(
        `${res.criadas} vaga(s) cadastradas.` +
          (res.semUnidade.length > 0
            ? ` Sem unidade correspondente: ${res.semUnidade.join(", ")}`
            : ""),
      );
      setCsv("");
      carregar();
      aoImportar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card">
      <h2>Vagas de garagem</h2>
      <p className="aviso" style={{ marginBottom: 10 }}>
        Uma linha por vaga: vaga; bloco; unidade, separados por ponto e vírgula,
        vírgula ou tab. A vaga liga a portaria ao morador (ex.: &quot;carro na vaga 42
        com luz acesa&quot;).
      </p>
      {vagas.length > 0 && (
        <table style={{ marginBottom: 14 }}>
          <thead>
            <tr>
              <th>Vaga</th>
              <th>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {vagas.map((v) => (
              <tr key={v.id}>
                <td className="unidade">{v.identificacao}</td>
                <td>{rotuloUnidade(v.unidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <textarea
        rows={4}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={"42; A; 302\n17; B; 101"}
      />
      <button
        className="acao"
        style={{ marginTop: 14 }}
        onClick={importar}
        disabled={enviando || !csv.trim()}
      >
        Importar vagas
      </button>
      {resultado && <p className="aviso" style={{ marginTop: 10 }}>{resultado}</p>}
      {erro && <p className="erro" style={{ marginTop: 10 }}>{erro}</p>}
    </section>
  );
}

function MoradoresView({
  appDownloadUrl,
  condominio,
}: {
  appDownloadUrl: string | null;
  condominio: string;
}) {
  const [vinculos, setVinculos] = useState<VinculoPendente[]>([]);
  const [unidades, setUnidades] = useState<UnidadePanorama[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [emVoo, setEmVoo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [pendentes, panorama] = await Promise.all([
        apiFetch<VinculoPendente[]>("/cadastro/vinculos/pendentes"),
        apiFetch<UnidadePanorama[]>("/cadastro/unidades/panorama"),
      ]);
      setVinculos(pendentes);
      setUnidades(panorama);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Aprovar dá a uma pessoa acesso aos dados daquela unidade: encomendas,
   * cobranças, documentos. O painel não tem como revogar depois, então a
   * confirmação nomeia quem e qual unidade, em vez de perguntar "tem certeza?".
   *
   * `emVoo` trava a linha durante a requisição: dois cliques rápidos mandavam
   * dois POST, e o segundo voltava recusado ("já aprovado") pintando um erro
   * na tela para uma aprovação que na verdade deu certo.
   */
  async function aprovar(v: VinculoPendente) {
    if (emVoo) return;
    const onde = rotuloUnidade(v.unidade);
    if (
      !confirm(
        `Dar a ${v.morador.nome} (${v.morador.telefone}) acesso à unidade ${onde}?\n\n` +
          "A pessoa passa a ver encomendas, cobranças e documentos desta unidade.",
      )
    ) {
      return;
    }
    setEmVoo(v.id);
    // Sem o try, a rejeição morria no console: o síndico clicava "Aprovar", a
    // linha continuava na lista, e não havia nada dizendo o que houve.
    try {
      await apiFetch(`/cadastro/vinculos/${v.id}/aprovar`, { method: "POST" });
      setErro(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEmVoo(null);
    }
  }

  /**
   * Recusar tem a mesma trava e a mesma confirmação nominal de `aprovar`.
   *
   * Antes só existia aprovar: quem pediu a unidade errada ficava para sempre
   * na fila, e o síndico convivia com um contador que nunca zerava. O vínculo
   * vai para REMOVIDO, não some: recusar não é banir, e um pedido novo pelo
   * convite ou pela importação reabre normalmente.
   */
  async function recusar(v: VinculoPendente) {
    if (emVoo) return;
    const onde = rotuloUnidade(v.unidade);
    if (
      !confirm(
        `Recusar o pedido de ${v.morador.nome} (${v.morador.telefone}) para a unidade ${onde}?\n\n` +
          "A pessoa não passa a ver os dados da unidade. Ela pode pedir de novo depois.",
      )
    ) {
      return;
    }
    setEmVoo(v.id);
    try {
      await apiFetch(`/cadastro/vinculos/${v.id}/recusar`, { method: "POST" });
      setErro(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEmVoo(null);
    }
  }

  const comApp = unidades.filter((u) => u.temApp).length;

  /**
   * Abre o WhatsApp do síndico com a mensagem pronta para o titular.
   *
   * Nada é enviado pelo servidor: é o número dele falando com o morador. Isso
   * evita a verificação de empresa da Meta (que depende do CNPJ) e a política
   * de opt-in, que barraria mensagem de empresa para quem nunca consentiu.
   */
  function convidarPorWhatsApp(u: UnidadePanorama) {
    if (!u.titular) return;
    const primeiro = u.titular.nome.trim().split(/\s+/)[0];
    const link = appDownloadUrl ? ` Baixe aqui: ${appDownloadUrl}` : "";
    const texto =
      `Olá, ${primeiro}! Aqui é da administração do ${condominio}. ` +
      `Agora avisamos as encomendas da portaria pelo aplicativo Convivar. ` +
      `Baixe o app e entre com este número de celular: a unidade ` +
      `${rotuloUnidade(u)} já está cadastrada no seu nome.${link}`;
    window.open(linkWhatsApp(u.titular.telefone, texto), "_blank", "noopener");
  }

  return (
    <>
      <h1>Moradores</h1>
      <p className="aviso">Vínculos, aprovações e importação do cadastro.</p>
      {erro && <p className="erro">{erro}</p>}

      {vinculos.length > 0 && (
        <section className="card">
          <h2>
            {vinculos.length} pedido{vinculos.length === 1 ? "" : "s"} de vínculo
            aguardando
          </h2>
          <p className="aviso">Confirme com a unidade antes de aprovar.</p>
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
                  <td>{formatarTelefone(v.morador.telefone)}</td>
                  <td>{rotuloUnidade(v.unidade)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="acao"
                      onClick={() => aprovar(v)}
                      disabled={emVoo !== null}
                    >
                      {emVoo === v.id ? "Aprovando..." : "Aprovar"}
                    </button>{" "}
                    <button
                      className="outline"
                      onClick={() => recusar(v)}
                      disabled={emVoo !== null}
                    >
                      Recusar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {unidades.length > 0 && (
        <section className="card">
          <h2>Unidades</h2>
          <table>
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Titular</th>
                <th>Telefone</th>
                <th>Vinculados</th>
                <th>Adoção</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.unidadeId}>
                  <td className="unidade">{rotuloUnidade(u)}</td>
                  <td>
                    {u.titular?.nome ?? (
                      <span style={{ color: "var(--texto-3)" }}>
                        sem titular cadastrado
                      </span>
                    )}
                  </td>
                  <td>
                    {u.titular ? formatarTelefone(u.titular.telefone) : "—"}
                  </td>
                  <td>
                    {u.vinculados === 0
                      ? "—"
                      : `${u.vinculados} pessoa${u.vinculados === 1 ? "" : "s"}`}
                  </td>
                  <td>
                    <span className={`selo ${u.temApp ? "ok" : "neutro"}`}>
                      {u.temApp ? "no app" : "sem app"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {/* Só onde há alguém para convidar. Sai do WhatsApp do
                        próprio síndico: remetente conhecido converte melhor
                        que número de empresa, e não depende da API da Meta. */}
                    {!u.temApp && u.titular && (
                      <button
                        className="outline"
                        onClick={() => convidarPorWhatsApp(u)}
                      >
                        Convidar por WhatsApp
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="aviso">
            {comApp} de {unidades.length} unidades com app (
            {Math.round((comApp / unidades.length) * 100)}%) · convites por SMS
            contam como adoção quando aceitos.
          </p>
        </section>
      )}

      <Importar aoImportar={carregar} />

      <VagasSection aoImportar={carregar} />

      <EquipeSection />
    </>
  );
}
