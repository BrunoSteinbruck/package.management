"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cpfCnpjValido,
  formatarCpfCnpj,
  type CobrancaGestor,
  type ConfigFinanceiro,
  type ResumoFinanceiro,
  type StatusCobranca,
  type TaxaLinha,
} from "@pacotes/shared";
import { apiFetch } from "@/lib/api";
import { ConciliacaoView } from "./ConciliacaoView";

/** Só cobra quem tem valor E pagador: o provedor exige nome e documento. */
function prontaParaCobrar(t: TaxaLinha): boolean {
  return (
    (t.valorMensal ?? 0) > 0 && !!t.responsavelNome && !!t.responsavelCpfCnpj
  );
}

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
  const [aba, setAba] = useState<"cobrancas" | "taxas" | "conciliacao">(
    "cobrancas",
  );
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
      const r = await apiFetch<{
        criadas: number;
        puladas: number;
        naoCobradas: string[];
      }>("/cadastro/financeiro/gerar", { method: "POST", body: { competencia } });
      setErro(null);
      // As unidades que ficaram de fora precisam ser ditas em voz alta: sem
      // isso o síndico lê "3 criadas" e não descobre que 13 não foram
      // cobradas. As duas causas aparecem juntas de propósito: da resposta
      // não dá para saber qual foi, e mandar conferir as duas é honesto.
      const faltando = r.naoCobradas?.length
        ? `\n\nSEM COBRANÇA (${r.naoCobradas.length}): ${r.naoCobradas.join(", ")}.` +
          "\nOu falta nome/CPF do responsável na aba Taxas, ou a credencial do" +
          " provedor foi recusada. Corrija e gere de novo: o que já foi criado" +
          " não duplica."
        : "";
      alert(
        `${r.criadas} cobrança(s) criada(s), ${r.puladas} já existiam.${faltando}`,
      );
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  /**
   * Salva um campo por vez (a tabela grava no blur de cada célula), mas manda
   * a linha inteira: o endpoint faz upsert e omitir os outros campos os
   * apagaria.
   */
  async function salvarTaxa(
    unidadeId: string,
    mudanca: { valor?: string; nome?: string; documento?: string; email?: string },
  ) {
    const atual = taxas.find((t) => t.unidadeId === unidadeId);
    if (!atual) return;

    // Limpa o erro anterior antes de tentar de novo: sem isso, uma tentativa
    // que falha em silêncio deixa na tela a mensagem da tentativa passada, e
    // o síndico lê "CPF inválido" enquanto o problema real é outro campo.
    setErro(null);

    const valorMensal =
      mudanca.valor !== undefined
        ? Number(mudanca.valor.replace(",", "."))
        : (atual.valorMensal ?? 0);
    // Antes isto era um `return` mudo: digitar "abc" no valor não gravava e
    // não avisava, e o número errado seguia na tela parecendo salvo.
    if (!Number.isFinite(valorMensal) || valorMensal < 0) {
      setErro(
        `Valor inválido em ${rotulo(atual.unidade)}. Use só números, como 450,50.`,
      );
      return;
    }

    const documento =
      mudanca.documento !== undefined
        ? mudanca.documento.trim()
        : (atual.responsavelCpfCnpj ?? "");
    // Barra aqui o documento inválido: o servidor também recusa, mas o erro
    // vindo do zod fala de "taxas.0.responsavelCpfCnpj", que não diz nada
    // para quem está preenchendo uma tabela.
    if (documento && !cpfCnpjValido(documento)) {
      setErro(`CPF/CNPJ inválido em ${rotulo(atual.unidade)}.`);
      return;
    }

    const nome =
      mudanca.nome !== undefined ? mudanca.nome.trim() : (atual.responsavelNome ?? "");
    const email =
      mudanca.email !== undefined
        ? mudanca.email.trim()
        : (atual.responsavelEmail ?? "");

    try {
      await apiFetch("/cadastro/financeiro/taxas", {
        method: "POST",
        body: {
          taxas: [
            {
              unidadeId,
              valorMensal,
              ...(nome ? { responsavelNome: nome } : {}),
              ...(documento ? { responsavelCpfCnpj: documento } : {}),
              ...(email ? { responsavelEmail: email } : {}),
            },
          ],
        },
      });
      setErro(null);
      // Recarrega em vez de remendar o estado: trocar o pagador zera o
      // cliente do provedor no servidor, e o selo "pronta?" tem que refletir
      // isso sem exigir F5.
      setTaxas(await apiFetch<TaxaLinha[]>("/cadastro/financeiro/taxas"));
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
          <button
            className={`chip ${aba === "conciliacao" ? "ativo" : ""}`}
            onClick={() => setAba("conciliacao")}
          >
            Conciliação
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
            O valor mensal de cada unidade e quem paga. Unidade sem valor não é
            cobrada, e sem <strong>nome e CPF/CNPJ do responsável</strong> o
            banco não emite o boleto: é o proprietário, que na unidade alugada
            não é quem mora.
          </p>
          <table>
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Valor mensal</th>
                <th>Responsável</th>
                <th>CPF/CNPJ</th>
                <th>E-mail (opcional)</th>
                <th>Pronta?</th>
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
                      style={{ width: 110 }}
                      onBlur={(e) =>
                        salvarTaxa(t.unidadeId, { valor: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={t.responsavelNome ?? ""}
                      placeholder="Nome completo"
                      style={{ width: 180 }}
                      onBlur={(e) =>
                        salvarTaxa(t.unidadeId, { nome: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      defaultValue={
                        t.responsavelCpfCnpj
                          ? formatarCpfCnpj(t.responsavelCpfCnpj)
                          : ""
                      }
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      style={{ width: 170 }}
                      onBlur={(e) =>
                        salvarTaxa(t.unidadeId, { documento: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="email"
                      defaultValue={t.responsavelEmail ?? ""}
                      placeholder="opcional"
                      style={{ width: 180 }}
                      onBlur={(e) =>
                        salvarTaxa(t.unidadeId, { email: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <span className={`selo ${prontaParaCobrar(t) ? "ok" : "alerta"}`}>
                      {prontaParaCobrar(t) ? "sim" : "faltam dados"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "conciliacao" && <ConciliacaoView />}
    </>
  );
}
