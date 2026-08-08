"use client";

import { useCallback, useEffect, useState } from "react";
import {
  soAConvivarLiga,
  type Capacidades,
  type ModuloCondominio,
} from "@pacotes/shared";
import { apiFetch } from "@/lib/api";

/**
 * O que cada módulo é, na língua do síndico.
 *
 * `Record` sobre a união: módulo novo em `MODULOS_CONDOMINIO` não compila até
 * ganhar uma descrição aqui, o que impede a tela de oferecer um item sem
 * explicar o que ele faz.
 */
const DESCRICOES: Record<
  ModuloCondominio,
  { titulo: string; sub: string }
> = {
  comunicados: {
    titulo: "Comunicados",
    sub: "Avisos do síndico para o condomínio inteiro, com quem leu.",
  },
  documentos: {
    titulo: "Documentos",
    sub: "Atas, regimento e convenção disponíveis no app do morador.",
  },
  visitantes: {
    titulo: "Visitantes",
    sub: "Morador pré-autoriza a visita e a portaria dá baixa na chegada.",
  },
  financeiro: {
    titulo: "Financeiro",
    sub: "Boleto da taxa condominial, segunda via no app e inadimplência.",
  },
  whatsapp: {
    titulo: "Avisos por WhatsApp",
    sub: "Alcança quem ainda não instalou o app. Tem custo por mensagem.",
  },
  qr_retirada: {
    titulo: "QR na retirada",
    sub: "Conferência extra: o morador mostra um QR no app em vez de dizer a unidade. A entrega já é registrada com foto e o nome de quem recebeu.",
  },
};

interface LinhaModulo {
  id: ModuloCondominio;
  ativo: boolean;
}

export function ConfiguracoesView() {
  const [modulos, setModulos] = useState<LinhaModulo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Onde pedir os módulos que só a Convivar liga. Null sem o env. */
  const [suporteUrl, setSuporteUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Capacidades>("/conta/capacidades")
      .then((c) => setSuporteUrl(c.suporteUrl ?? null))
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    try {
      setModulos(await apiFetch<LinhaModulo[]>("/cadastro/modulos"));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Manda a lista inteira, não o item alternado: o que o servidor grava é o
   * estado que o síndico está vendo. Dois gestores editando ao mesmo tempo
   * produzem o estado de um dos dois, nunca uma combinação de ambos.
   */
  async function alternar(id: ModuloCondominio) {
    if (!modulos || salvando) return;
    const otimista = modulos.map((m) =>
      m.id === id ? { ...m, ativo: !m.ativo } : m,
    );
    setModulos(otimista);
    setSalvando(true);
    try {
      await apiFetch("/cadastro/modulos", {
        method: "POST",
        body: { modulos: otimista.filter((m) => m.ativo).map((m) => m.id) },
      });
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
      // Volta ao que o servidor tem: o toggle não pode mentir sobre o que
      // está contratado.
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <h1>Configurações</h1>
      <p className="aviso">
        Encomendas, avisos e leituras são a base e estão sempre ligados. Os
        módulos abaixo entram quando o condomínio quiser: ao ligar, eles
        aparecem no app de quem tem o perfil certo.
      </p>

      {erro && (
        <p className="erro" style={{ marginTop: 12 }}>
          {erro}
        </p>
      )}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Módulos</h2>
        <table>
          <tbody>
            {(modulos ?? []).map((m) => {
              const texto = DESCRICOES[m.id];
              return (
                <tr key={m.id}>
                  <td>
                    <div className="unidade">{texto.titulo}</div>
                    <div style={{ fontSize: 13, color: "var(--texto-3)" }}>
                      {texto.sub}
                    </div>
                  </td>
                  <td style={{ width: 130, textAlign: "right" }}>
                    <span className={`selo ${m.ativo ? "ok" : "alerta"}`}>
                      {m.ativo ? "ligado" : "desligado"}
                    </span>
                  </td>
                  <td style={{ width: 210, textAlign: "right" }}>
                    {soAConvivarLiga(m.id) ? (
                      /* Sem botão: estes dois são combinados com a gente. O
                         WhatsApp tem custo por mensagem e depende da nossa
                         conta no Meta Business; o QR muda o procedimento da
                         portaria inteira. Quem garante é o servidor, que
                         preserva o estado deles; aqui só se explica o porquê
                         e se dá o caminho. */
                      suporteUrl ? (
                        <a
                          className="link"
                          href={suporteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Solicitar ao suporte
                        </a>
                      ) : (
                        <span className="aviso">Fale com o suporte Convivar</span>
                      )
                    ) : (
                      <button
                        className="outline"
                        disabled={salvando}
                        onClick={() => alternar(m.id)}
                      >
                        {m.ativo ? "Desligar" : "Ligar"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {modulos !== null && modulos.length === 0 && (
          <p className="aviso">Nenhum módulo opcional disponível.</p>
        )}
        {(modulos ?? []).some((m) => soAConvivarLiga(m.id)) && (
          <p className="aviso" style={{ marginTop: 12 }}>
            Avisos por WhatsApp e QR na retirada são ativados pela Convivar:
            um tem custo por mensagem e o outro muda o procedimento da
            portaria, então combinamos os dois antes de ligar.
          </p>
        )}
      </div>
    </>
  );
}
