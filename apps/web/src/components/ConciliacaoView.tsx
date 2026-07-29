"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DespesaLinha,
  PainelConciliacao,
  SugestaoConciliacao,
} from "@pacotes/shared";
import { apiFetch } from "@/lib/api";

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Conciliação bancária: o ouro da prestação de contas.
 *
 * O fluxo do síndico: registra as despesas do mês, importa o OFX do banco, e
 * o motor devolve cada linha JÁ CASADA com a explicação ("compensado 2 dias
 * depois: pagamento de fim de semana"). Ele confere e aceita em lote, em vez
 * de investigar linha vermelha por linha vermelha, que é o que a ferramenta
 * atual dele oferece.
 */
export function ConciliacaoView() {
  const [painel, setPainel] = useState<PainelConciliacao | null>(null);
  const [despesas, setDespesas] = useState<DespesaLinha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  // Todas marcadas por padrão: o motor só sugere o que tem explicação, e o
  // trabalho do síndico deve ser desmarcar a exceção, não marcar 40 caixas.
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set());
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [descNova, setDescNova] = useState("");
  const [valorNovo, setValorNovo] = useState("");
  const [dataNova, setDataNova] = useState(hojeIso());

  const carregar = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([
        apiFetch<PainelConciliacao>("/cadastro/financeiro/conciliacao"),
        apiFetch<DespesaLinha[]>("/cadastro/financeiro/despesas"),
      ]);
      setPainel(p);
      setDespesas(d);
      setDesmarcadas(new Set());
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function importar() {
    const arquivo = arquivoRef.current?.files?.[0];
    if (!arquivo) {
      setErro("Escolha o arquivo OFX exportado do banco.");
      return;
    }
    setImportando(true);
    try {
      const ofx = await arquivo.text();
      const r = await apiFetch<{
        importados: number;
        repetidos: number;
        ilegiveis: number;
      }>("/cadastro/financeiro/extrato", { method: "POST", body: { ofx } });
      setAviso(
        `${r.importados} lançamento(s) importado(s)` +
          (r.repetidos ? `, ${r.repetidos} já existiam` : "") +
          (r.ilegiveis ? `, ${r.ilegiveis} ilegíveis` : "") +
          ".",
      );
      if (arquivoRef.current) arquivoRef.current.value = "";
      setErro(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setImportando(false);
    }
  }

  async function aceitarSelecionadas() {
    if (!painel) return;
    const itens = painel.sugestoes
      .filter((s) => !desmarcadas.has(s.extrato.id))
      .map((s) => ({
        extratoItemId: s.extrato.id,
        alvoTipo: s.alvoTipo,
        alvoId: s.alvoId,
        motivo: s.motivo,
      }));
    if (itens.length === 0) return;
    setAceitando(true);
    try {
      const r = await apiFetch<{ aceitas: number }>(
        "/cadastro/financeiro/conciliacao/aceitar",
        { method: "POST", body: { itens } },
      );
      setAviso(`${r.aceitas} conciliação(ões) registrada(s), com o motivo gravado.`);
      setErro(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAceitando(false);
    }
  }

  async function ignorar(id: string) {
    const motivo = prompt(
      "Por que esta linha não entra na prestação? (ex.: rendimento da aplicação)",
    );
    if (!motivo || motivo.trim().length < 3) return;
    try {
      await apiFetch(`/cadastro/financeiro/conciliacao/${id}/ignorar`, {
        method: "POST",
        body: { motivo },
      });
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function criarDespesa() {
    const valor = Number(valorNovo.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0 || descNova.trim().length < 2) {
      setErro("Preencha descrição e valor da despesa.");
      return;
    }
    try {
      await apiFetch("/cadastro/financeiro/despesas", {
        method: "POST",
        body: { descricao: descNova, valor, data: dataNova },
      });
      setDescNova("");
      setValorNovo("");
      setErro(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function removerDespesa(d: DespesaLinha) {
    if (!confirm(`Remover a despesa "${d.descricao}"?`)) return;
    try {
      await apiFetch(`/cadastro/financeiro/despesas/${d.id}`, {
        method: "DELETE",
      });
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const selecionadas =
    painel?.sugestoes.filter((s) => !desmarcadas.has(s.extrato.id)).length ?? 0;

  return (
    <>
      <p className="aviso">
        Registre as despesas do mês, importe o extrato (OFX) do banco e aceite
        as sugestões: cada uma sai com o motivo escrito, pronto para a
        prestação de contas. Pagamento de fim de semana que compensou na
        segunda e diferença de centavos por tarifa são casados automaticamente.
      </p>

      {erro && (
        <p className="erro" style={{ marginTop: 10 }}>
          {erro}
        </p>
      )}
      {aviso && (
        <p className="aviso" style={{ marginTop: 10, color: "var(--ok)" }}>
          {aviso}
        </p>
      )}

      <div className="card">
        <div className="linha">
          <input type="file" accept=".ofx,.OFX,text/plain" ref={arquivoRef} />
          <button className="acao" disabled={importando} onClick={importar}>
            {importando ? "Importando..." : "Importar extrato"}
          </button>
          {painel && (
            <span className="aviso" style={{ marginLeft: "auto" }}>
              {painel.conciliadas} conciliada(s) até aqui
              {painel.ignoradas > 0 ? ` · ${painel.ignoradas} ignorada(s)` : ""}
            </span>
          )}
        </div>
      </div>

      {painel && painel.sugestoes.length > 0 && (
        <div className="card">
          <div className="linha" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>
              Sugestões com explicação ({painel.sugestoes.length})
            </h2>
            <button
              className="acao"
              disabled={aceitando || selecionadas === 0}
              onClick={aceitarSelecionadas}
            >
              {aceitando ? "Registrando..." : `Aceitar selecionadas (${selecionadas})`}
            </button>
          </div>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th />
                <th>Extrato</th>
                <th>Casa com</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {painel.sugestoes.map((s: SugestaoConciliacao) => (
                <tr key={s.extrato.id}>
                  <td style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18 }}
                      checked={!desmarcadas.has(s.extrato.id)}
                      onChange={() =>
                        setDesmarcadas((atual) => {
                          const novo = new Set(atual);
                          if (novo.has(s.extrato.id)) novo.delete(s.extrato.id);
                          else novo.add(s.extrato.id);
                          return novo;
                        })
                      }
                    />
                  </td>
                  <td>
                    <div className="unidade">
                      {dataCurta(s.extrato.data)} · {reais(s.extrato.valor)}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--texto-3)" }}>
                      {s.extrato.descricao}
                    </div>
                  </td>
                  <td>
                    <div className="unidade">{s.alvoRotulo}</div>
                    <div style={{ fontSize: 12.5, color: "var(--texto-3)" }}>
                      {s.alvoTipo === "COBRANCA" ? "cobrança" : "despesa"} ·{" "}
                      {dataCurta(s.alvoData)} · {reais(s.alvoValor)}
                    </div>
                  </td>
                  <td>
                    <span className={`selo ${s.confianca === "exata" ? "ok" : "info"}`}>
                      {s.confianca === "exata" ? "bate exato" : "provável"}
                    </span>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>{s.motivo}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {painel && painel.semPar.length > 0 && (
        <div className="card">
          <h2>Precisam de você ({painel.semPar.length})</h2>
          <p className="aviso">
            Sem par plausível. Se for despesa que faltou registrar, cadastre
            abaixo e ela vira sugestão; se não pertence à prestação
            (rendimento, estorno), ignore com o motivo.
          </p>
          <table>
            <tbody>
              {painel.semPar.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="unidade">
                      {dataCurta(l.data)} · {reais(l.valor)}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--texto-3)" }}>
                      {l.descricao}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="outline" onClick={() => ignorar(l.id)}>
                      Ignorar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {painel && painel.alvosSemExtrato.length > 0 && (
        <div className="card">
          <h2>Esperado e não encontrado no extrato ({painel.alvosSemExtrato.length})</h2>
          <p className="aviso">
            Dinheiro que deveria ter aparecido e o extrato importado não
            mostra. Confira se o período do OFX cobre estas datas.
          </p>
          <table>
            <tbody>
              {painel.alvosSemExtrato.map((a, i) => (
                <tr key={i}>
                  <td className="unidade">{a.rotulo}</td>
                  <td>{a.tipo === "COBRANCA" ? "cobrança paga" : "despesa"}</td>
                  <td>{dataCurta(a.data)}</td>
                  <td style={{ textAlign: "right" }}>{reais(a.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Despesas do condomínio</h2>
        <p className="aviso">
          O que sai do caixa (elevador, limpeza, luz). É contra isto que as
          saídas do extrato são conferidas. Não agenda nem paga nada: só
          registra para a prestação.
        </p>
        <div className="linha" style={{ marginTop: 10 }}>
          <input
            placeholder="Descrição (ex.: Manutenção elevador)"
            value={descNova}
            onChange={(e) => setDescNova(e.target.value)}
            maxLength={160}
            style={{ flex: 1, minWidth: 220 }}
          />
          <input
            placeholder="Valor"
            inputMode="decimal"
            value={valorNovo}
            onChange={(e) => setValorNovo(e.target.value)}
            style={{ width: 110 }}
          />
          <input
            type="date"
            value={dataNova}
            onChange={(e) => setDataNova(e.target.value)}
            style={{ width: 160 }}
          />
          <button className="acao" onClick={criarDespesa}>
            Registrar
          </button>
        </div>
        {despesas.length > 0 && (
          <table style={{ marginTop: 12 }}>
            <tbody>
              {despesas.map((d) => (
                <tr key={d.id}>
                  <td className="unidade">{d.descricao}</td>
                  <td>{dataCurta(d.data)}</td>
                  <td>{reais(d.valor)}</td>
                  <td>
                    <span className={`selo ${d.conciliada ? "ok" : "info"}`}>
                      {d.conciliada ? "no extrato" : "aguardando extrato"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {!d.conciliada && (
                      <button className="outline" onClick={() => removerDespesa(d)}>
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
