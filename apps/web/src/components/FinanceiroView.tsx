"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CobrancaGestor,
  ConfigFinanceiro,
  ResumoFinanceiro,
  StatusCobranca,
  TaxaLinha,
} from "@pacotes/shared";
import { apiFetch } from "@/lib/api";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS: Record<StatusCobranca, { rotulo: string; selo: string }> = {
  PENDENTE: { rotulo: "em aberto", selo: "info" },
  PAGA: { rotulo: "paga", selo: "ok" },
  VENCIDA: { rotulo: "vencida", selo: "alerta" },
  CANCELADA: { rotulo: "cancelada", selo: "info" },
};

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function somarMeses(competencia: string, n: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function nomeCompetencia(c: string): string {
  const [ano, mes] = c.split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rotulo(u: CobrancaGestor["unidade"]): string {
  return u.bloco ? `${u.identificacao} · ${u.bloco}` : u.identificacao;
}

export function FinanceiroView() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [cobrancas, setCobrancas] = useState<CobrancaGestor[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [config, setConfig] = useState<ConfigFinanceiro | null>(null);
  const [taxas, setTaxas] = useState<TaxaLinha[]>([]);
  const [aba, setAba] = useState<"cobrancas" | "taxas">("cobrancas");
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [c, r, cfg] = await Promise.all([
        apiFetch<CobrancaGestor[]>(
          `/cadastro/financeiro/cobrancas?competencia=${competencia}`,
        ),
        apiFetch<ResumoFinanceiro>(
          `/cadastro/financeiro/resumo?competencia=${competencia}`,
        ),
        apiFetch<ConfigFinanceiro>("/cadastro/financeiro/config"),
      ]);
      setCobrancas(c);
      setResumo(r);
      setConfig(cfg);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [competencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba === "taxas") {
      apiFetch<TaxaLinha[]>("/cadastro/financeiro/taxas")
        .then(setTaxas)
        .catch((e) => setErro((e as Error).message));
    }
  }, [aba]);

  async function gerar() {
    if (
      !confirm(
        `Gerar as cobranças de ${nomeCompetencia(competencia)}? Unidades que já têm cobrança neste mês são puladas.`,
      )
    )
      return;
    setGerando(true);
    try {
      const r = await apiFetch<{ criadas: number; puladas: number }>(
        "/cadastro/financeiro/gerar",
        { method: "POST", body: { competencia } },
      );
      setErro(null);
      alert(`${r.criadas} cobrança(s) criada(s), ${r.puladas} já existiam.`);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function salvarTaxa(unidadeId: string, valor: string) {
    const valorMensal = Number(valor.replace(",", "."));
    if (!Number.isFinite(valorMensal) || valorMensal < 0) return;
    try {
      await apiFetch("/cadastro/financeiro/taxas", {
        method: "POST",
        body: { taxas: [{ unidadeId, valorMensal }] },
      });
      setTaxas((atual) =>
        atual.map((t) => (t.unidadeId === unidadeId ? { ...t, valorMensal } : t)),
      );
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const podeAvancar = competencia < competenciaAtual();

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
        <h1>Financeiro</h1>
        <button className="acao" disabled={gerando} onClick={gerar}>
          {gerando ? "Gerando..." : "Gerar cobranças do mês"}
        </button>
      </div>

      {config && !config.emissaoReal && (
        <p className="aviso" style={{ color: "var(--alerta)", fontWeight: 600 }}>
          Modo de teste: nenhum boleto é emitido de verdade. Configure a conta
          do provedor de cobrança antes de usar com moradores.
        </p>
      )}
      {config && !config.integrado && (
        <p className="aviso">
          Sem subconta configurada no provedor. As cobranças ficam registradas
          aqui, mas sem boleto para o morador pagar.
        </p>
      )}

      {erro && (
        <p className="erro" style={{ marginTop: 12 }}>
          {erro}
        </p>
      )}

      <div className="linha" style={{ marginTop: 16 }}>
        <div className="chips">
          <button
            className={`chip ${aba === "cobrancas" ? "ativo" : ""}`}
            onClick={() => setAba("cobrancas")}
          >
            Cobranças
          </button>
          <button
            className={`chip ${aba === "taxas" ? "ativo" : ""}`}
            onClick={() => setAba("taxas")}
          >
            Valor por unidade
          </button>
        </div>
        {aba === "cobrancas" && (
          <div className="chips" style={{ marginLeft: "auto" }}>
            <button
              className="chip"
              onClick={() => setCompetencia((c) => somarMeses(c, -1))}
            >
              {"<"}
            </button>
            <span
              style={{
                fontWeight: 700,
                alignSelf: "center",
                minWidth: 120,
                textAlign: "center",
              }}
            >
              {nomeCompetencia(competencia)}
            </span>
            <button
              className="chip"
              disabled={!podeAvancar}
              style={!podeAvancar ? { opacity: 0.35, cursor: "default" } : undefined}
              onClick={() => setCompetencia((c) => somarMeses(c, 1))}
            >
              {">"}
            </button>
          </div>
        )}
      </div>

      {aba === "cobrancas" && (
        <>
          <div className="metricas">
            <div className="metrica">
              <div className="valor">{resumo ? reais(resumo.totalCobrado) : "-"}</div>
              <div className="rotulo">cobrado no mês</div>
            </div>
            <div className="metrica">
              <div className="valor">{resumo ? reais(resumo.totalPago) : "-"}</div>
              <div className="rotulo">recebido</div>
              <div className="sub">
                {resumo
                  ? `${resumo.unidadesPagas} de ${resumo.unidadesCobradas} unidades`
                  : ""}
              </div>
            </div>
            <div className="metrica">
              <div className="valor">
                {resumo ? reais(resumo.inadimplencia) : "-"}
              </div>
              <div className="rotulo">em aberto</div>
            </div>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => (
                  <tr key={c.id}>
                    <td className="unidade">{rotulo(c.unidade)}</td>
                    <td>{reais(c.valor)}</td>
                    <td>
                      {diaCurto(c.vencimento)}
                      {c.diasAtraso > 0 && (
                        <div style={{ fontSize: 13, color: "var(--alerta)" }}>
                          {c.diasAtraso} dia(s) de atraso
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`selo ${STATUS[c.status].selo}`}>
                        {STATUS[c.status].rotulo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cobrancas.length === 0 && (
              <p className="aviso">
                Nenhuma cobrança em {nomeCompetencia(competencia)}. Defina o
                valor por unidade e gere as cobranças do mês.
              </p>
            )}
          </div>
        </>
      )}

      {aba === "taxas" && (
        <div className="card">
          <p className="aviso">
            O valor mensal de cada unidade. Unidade sem valor não é cobrada.
          </p>
          <table>
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Valor mensal</th>
              </tr>
            </thead>
            <tbody>
              {taxas.map((t) => (
                <tr key={t.unidadeId}>
                  <td className="unidade">{rotulo(t.unidade)}</td>
                  <td>
                    <input
                      defaultValue={t.valorMensal ?? ""}
                      placeholder="0,00"
                      inputMode="decimal"
                      style={{ width: 140 }}
                      onBlur={(e) => salvarTaxa(t.unidadeId, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
