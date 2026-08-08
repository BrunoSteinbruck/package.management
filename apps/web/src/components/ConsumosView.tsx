"use client";

import { useCallback, useEffect, useState } from "react";
import {
  mesAno,
  mesCurto,
  rotuloUnidade,
  type ConsumoLinha,
  type ConsumosResposta,
  type FotoRef,
  type HistoricoConsumoMes,
  type TarifaLinha,
  type TipoMedidor,
} from "@pacotes/shared";
import { apiFetch, API_URL } from "@/lib/api";

const NOMES: Record<TipoMedidor, string> = { AGUA: "Água", GAS: "Gás" };
function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function somarMeses(competencia: string, n: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function reais(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function urlFoto(foto: FotoRef): string {
  return `${API_URL}/uploads/${foto.key}?t=${encodeURIComponent(foto.token)}`;
}

const ROTULO_ALERTA: Record<string, string> = {
  NEGATIVO: "conferir",
  ACIMA_MEDIA: "acima da média",
};

export function ConsumosView() {
  const [tipo, setTipo] = useState<TipoMedidor>("AGUA");
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [dados, setDados] = useState<ConsumosResposta | null>(null);
  const [serie, setSerie] = useState<HistoricoConsumoMes[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [fotoAberta, setFotoAberta] = useState<ConsumoLinha | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [consumos, historico] = await Promise.all([
        apiFetch<ConsumosResposta>(
          `/leituras/consumos?tipo=${tipo}&competencia=${competencia}`,
        ),
        apiFetch<HistoricoConsumoMes[]>(
          `/leituras/historico?tipo=${tipo}&competencia=${competencia}&meses=12`,
        ),
      ]);
      setDados(consumos);
      setSerie(historico);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [tipo, competencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportar(formato: "xlsx" | "pdf", escopo: "mes" | "geral") {
    try {
      const { token } = await apiFetch<{ token: string }>(
        "/leituras/export-token",
        { method: "POST", body: { formato, escopo, tipo, competencia } },
      );
      // Content-Disposition é attachment: a navegação vira download e a
      // página fica. `location.assign` não cai no bloqueador de popup, que
      // pode barrar window.open depois de um await.
      window.location.assign(
        `${API_URL}/leituras/export?t=${encodeURIComponent(token)}`,
      );
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const totais = dados?.totais;
  const mesAnterior = serie.length >= 2 ? serie[serie.length - 2] : null;
  const variacao =
    totais && mesAnterior && mesAnterior.consumoTotal > 0
      ? Math.round(
          ((totais.consumo - mesAnterior.consumoTotal) / mesAnterior.consumoTotal) * 100,
        )
      : null;
  const alertas = dados?.linhas.filter((l) => l.alerta).length ?? 0;
  const maxSerie = Math.max(1, ...serie.map((m) => m.consumoTotal));
  const podeAvancar = competencia < competenciaAtual();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1>Consumos</h1>
        <div className="linha">
          <button className="outline" onClick={() => exportar("xlsx", "mes")}>
            Excel do mês
          </button>
          <button className="outline" onClick={() => exportar("pdf", "mes")}>
            PDF do mês
          </button>
          <button className="outline" onClick={() => exportar("xlsx", "geral")}>
            Excel geral
          </button>
          <button className="outline" onClick={() => exportar("pdf", "geral")}>
            PDF geral
          </button>
        </div>
      </div>
      <p className="aviso">
        Leituras feitas pela portaria com foto como comprovante. O valor usa a
        tarifa vigente por m³.
      </p>

      <div className="linha" style={{ marginTop: 16 }}>
        <div className="chips">
          {(["AGUA", "GAS"] as const).map((t) => (
            <button
              key={t}
              className={`chip ${tipo === t ? "ativo" : ""}`}
              onClick={() => setTipo(t)}
            >
              {NOMES[t]}
            </button>
          ))}
        </div>
        <div className="chips" style={{ marginLeft: "auto" }}>
          <button className="chip" onClick={() => setCompetencia((c) => somarMeses(c, -1))}>
            {"<"}
          </button>
          <span style={{ fontWeight: 700, alignSelf: "center", minWidth: 120, textAlign: "center" }}>
            {mesAno(competencia)}
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
      </div>

      {erro && <p className="erro" style={{ marginTop: 12 }}>{erro}</p>}

      <div className="metricas">
        <div className="metrica">
          <div className="valor">
            {totais ? totais.consumo.toLocaleString("pt-BR") : "-"}
          </div>
          <div className="rotulo">m³ no mês</div>
          {variacao !== null && (
            <div className={`sub ${variacao > 0 ? "ambar" : ""}`}>
              {variacao > 0 ? "+" : ""}
              {variacao}% vs {mesCurto(somarMeses(competencia, -1))}
            </div>
          )}
        </div>
        <div className="metrica">
          <div className="valor">
            {totais?.valorReais != null ? reais(totais.valorReais) : "-"}
          </div>
          <div className="rotulo">valor do mês</div>
          <div className="sub">
            {dados?.tarifa != null
              ? `tarifa ${reais(dados.tarifa)}/m³`
              : "defina a tarifa para ver R$"}
          </div>
        </div>
        <div className="metrica">
          <div className="valor">
            {totais ? `${totais.lidas}/${totais.totalUnidades}` : "-"}
          </div>
          <div className="rotulo">unidades lidas</div>
          {totais && totais.lidas < totais.totalUnidades && (
            <div className="sub">{totais.totalUnidades - totais.lidas} pendentes</div>
          )}
        </div>
        <div className="metrica">
          <div className={`valor ${alertas > 0 ? "" : "verde"}`}>{alertas}</div>
          <div className="rotulo">consumos para conferir</div>
          <div className="sub">negativos ou acima da média</div>
        </div>
      </div>

      {/* Acima da tabela: o gráfico e a tarifa são o contexto do mês, e a
          lista unidade a unidade é o detalhe. Embaixo, os dois só apareciam
          depois de rolar dezesseis linhas, e o síndico ajustava a tarifa sem
          ver o histórico que ela reajusta. Os dois sobem JUNTOS porque
          dividem a mesma grade: separá-los deixaria a tarifa órfã embaixo da
          tabela. */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
        <section className="card">
          <h2>Consumo de {NOMES[tipo].toLowerCase()}: 12 meses</h2>
          <div className="grafico-horario">
            {serie.map((m) => (
              <div
                className="faixa"
                key={m.competencia}
                title={`${mesAno(m.competencia)}: ${m.consumoTotal.toLocaleString("pt-BR")} m³ (${m.unidadesLidas} leituras)${m.valorTotal != null ? ` · ${reais(m.valorTotal)}` : ""}`}
              >
                <div
                  className="coluna"
                  style={{
                    height: `${(m.consumoTotal / maxSerie) * 100}%`,
                    opacity: m.competencia === competencia ? 1 : 0.55,
                  }}
                />
                <div className="rotulo">{mesCurto(m.competencia)}</div>
              </div>
            ))}
          </div>
          <p className="aviso" style={{ marginTop: 10 }}>
            Passe o mouse para ver o total do mês. A barra cheia é o mês
            selecionado.
          </p>
        </section>

        <TarifasSection aoSalvar={carregar} />
      </div>

      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Unidade</th>
              <th style={{ textAlign: "right" }}>Leitura anterior</th>
              <th style={{ textAlign: "right" }}>Leitura atual</th>
              <th>Foto</th>
              <th style={{ textAlign: "right" }}>Consumo (m³)</th>
              <th style={{ textAlign: "right" }}>Valor (R$)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dados?.linhas.map((l) => (
              <tr key={l.unidadeId}>
                <td className="unidade">
                  {rotuloUnidade(l)}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {l.anterior ? l.anterior.valor.toLocaleString("pt-BR") : "-"}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {l.atual ? l.atual.valor.toLocaleString("pt-BR") : "-"}
                </td>
                <td>
                  {l.atual?.fotoRef ? (
                    <img
                      src={urlFoto(l.atual.fotoRef)}
                      alt={`foto da leitura de ${l.identificacao}`}
                      onClick={() => setFotoAberta(l)}
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: "cover",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    />
                  ) : (
                    <span className="aviso">-</span>
                  )}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {l.consumo !== null ? l.consumo.toLocaleString("pt-BR") : "-"}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {l.valorReais !== null ? reais(l.valorReais) : "-"}
                </td>
                <td>
                  {l.alerta && (
                    <span className="selo alerta">{ROTULO_ALERTA[l.alerta]}</span>
                  )}
                  {!l.alerta && l.atual && !l.anterior && (
                    <span className="selo info">primeira leitura</span>
                  )}
                </td>
              </tr>
            ))}
            {dados && dados.linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="aviso">
                  Nenhuma unidade cadastrada.
                </td>
              </tr>
            )}
          </tbody>
          {totais && (
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>
                  Total ({totais.lidas} de {totais.totalUnidades} lidas)
                </td>
                <td />
                <td />
                <td />
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>
                  {totais.consumo.toLocaleString("pt-BR")}
                </td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>
                  {totais.valorReais != null ? reais(totais.valorReais) : "-"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      {fotoAberta?.atual?.fotoRef && (
        <div
          onClick={() => setFotoAberta(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            zIndex: 50,
            gap: 12,
          }}
        >
          <img
            src={urlFoto(fotoAberta.atual.fotoRef)}
            alt="foto da leitura"
            style={{ maxWidth: "90%", maxHeight: "80%", borderRadius: 12 }}
          />
          <div style={{ color: "#fff", fontWeight: 600 }}>
            {rotuloUnidade(fotoAberta)}
            {" · "}
            {NOMES[tipo]} {fotoAberta.atual.valor.toLocaleString("pt-BR")}
            {" · lida por "}
            {fotoAberta.atual.lidoPor}
            {" em "}
            {new Date(fotoAberta.atual.lidoEm).toLocaleDateString("pt-BR")}
          </div>
        </div>
      )}
    </>
  );
}

function TarifasSection({ aoSalvar }: { aoSalvar: () => void }) {
  const [valores, setValores] = useState<Record<TipoMedidor, string>>({
    AGUA: "",
    GAS: "",
  });
  const [salvas, setSalvas] = useState<TarifaLinha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const linhas = await apiFetch<TarifaLinha[]>("/leituras/tarifas");
      setSalvas(linhas);
      setValores((v) => {
        const novo = { ...v };
        for (const t of linhas) {
          novo[t.tipo] = t.valorPorM3.toFixed(2).replace(".", ",");
        }
        return novo;
      });
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    setEnviando(true);
    setErro(null);
    setOk(null);
    try {
      for (const tipo of ["AGUA", "GAS"] as const) {
        const texto = valores[tipo].trim();
        if (!texto) continue;
        // Com vírgula, ponto é milhar ("1.234,56"). Sem vírgula, ponto é
        // decimal ("8.65"): tratar como milhar viraria 865.
        const normalizado = texto.includes(",")
          ? texto.replace(/\./g, "").replace(",", ".")
          : texto;
        const valor = Number(normalizado);
        if (!Number.isFinite(valor) || valor < 0) {
          throw new Error(`Tarifa de ${NOMES[tipo].toLowerCase()} inválida`);
        }
        const salva = salvas.find((s) => s.tipo === tipo);
        if (salva && Math.abs(salva.valorPorM3 - valor) < 0.005) continue;
        await apiFetch("/leituras/tarifas", {
          method: "PUT",
          body: { tipo, valorPorM3: valor },
        });
      }
      setOk("Tarifas salvas.");
      await carregar();
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card">
      <h2>Tarifas por m³</h2>
      <p className="aviso" style={{ marginBottom: 12 }}>
        Usadas para calcular o valor em R$ da tabela e dos relatórios. Ajuste
        quando a concessionária reajustar.
      </p>
      {(["AGUA", "GAS"] as const).map((tipo) => (
        <div className="linha" style={{ marginTop: 10 }} key={tipo}>
          <span style={{ width: 50, fontWeight: 600, fontSize: 14 }}>
            {NOMES[tipo]}
          </span>
          <span className="aviso">R$</span>
          <input
            style={{ width: 110 }}
            inputMode="decimal"
            placeholder="0,00"
            value={valores[tipo]}
            onChange={(e) =>
              setValores((v) => ({ ...v, [tipo]: e.target.value }))
            }
          />
          <span className="aviso">por m³</span>
        </div>
      ))}
      <button
        className="acao"
        style={{ marginTop: 14 }}
        onClick={salvar}
        disabled={enviando}
      >
        Salvar tarifas
      </button>
      {ok && <p className="aviso" style={{ marginTop: 10 }}>{ok}</p>}
      {erro && <p className="erro" style={{ marginTop: 10 }}>{erro}</p>}
    </section>
  );
}
