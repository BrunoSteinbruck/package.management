import { Injectable } from "@nestjs/common";
import type { TipoMedidor } from "@pacotes/shared";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface LinhaExport {
  unidade: string;
  anterior: number | null;
  atual: number | null;
  consumo: number | null;
  valorReais: number | null;
}

export interface MesExport {
  competencia: string;
  linhas: LinhaExport[];
  totais: {
    lidas: number;
    totalUnidades: number;
    consumo: number;
    valorReais: number | null;
  };
}

export interface DadosExport {
  condominio: string;
  tipo: TipoMedidor;
  tarifa: number | null;
  meses: MesExport[];
}

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function nomeTipo(tipo: TipoMedidor): string {
  return tipo === "AGUA" ? "Água" : "Gás";
}

/** "2026-07" vira "Julho/2026" nos cabeçalhos; a chave técnica fica nos dados. */
function nomeCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES_PT[mes - 1]}/${ano}`;
}

const fmtNumero = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});
const fmtReais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Gera os relatórios em memória. Sem fotos embutidas: o comprovante visual
 * fica no painel; aqui é o documento que circula por e-mail e assembleia.
 */
@Injectable()
export class ExportService {
  async gerarXlsx(dados: DadosExport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "guarita";
    for (const mes of dados.meses) {
      const ws = wb.addWorksheet(mes.competencia);
      ws.columns = [
        { header: "Unidade", key: "unidade", width: 16 },
        { header: "Leitura anterior", key: "anterior", width: 18 },
        { header: "Leitura atual", key: "atual", width: 18 },
        { header: "Consumo (m³)", key: "consumo", width: 16 },
        { header: "Valor (R$)", key: "valorReais", width: 14 },
      ];
      // Título acima do cabeçalho: insere linha e some com a duplicata do header.
      ws.spliceRows(1, 0, [
        `Consumo de ${nomeTipo(dados.tipo).toLowerCase()} - ${nomeCompetencia(mes.competencia)} - ${dados.condominio}`,
      ]);
      ws.mergeCells("A1:E1");
      ws.getRow(1).font = { bold: true, size: 13 };
      ws.getRow(2).font = { bold: true };

      for (const linha of mes.linhas) {
        ws.addRow(linha);
      }
      const totalRow = ws.addRow({
        unidade: `Total (${mes.totais.lidas} de ${mes.totais.totalUnidades} lidas)`,
        consumo: mes.totais.consumo,
        valorReais: mes.totais.valorReais,
      });
      totalRow.font = { bold: true };

      ws.getColumn("anterior").numFmt = "#,##0.###";
      ws.getColumn("atual").numFmt = "#,##0.###";
      ws.getColumn("consumo").numFmt = "#,##0.###";
      ws.getColumn("valorReais").numFmt = '"R$" #,##0.00';
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async gerarPdf(dados: DadosExport): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const fim = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    // pdfkit não tem tabela nativa: colunas em posições fixas, quebra manual.
    const cols = [
      { titulo: "Unidade", x: 40, largura: 90, alinha: "left" as const },
      { titulo: "Leitura anterior", x: 130, largura: 100, alinha: "right" as const },
      { titulo: "Leitura atual", x: 230, largura: 100, alinha: "right" as const },
      { titulo: "Consumo (m³)", x: 330, largura: 100, alinha: "right" as const },
      { titulo: "Valor (R$)", x: 430, largura: 100, alinha: "right" as const },
    ];
    const fimPagina = doc.page.height - 50;

    const cabecalhoTabela = () => {
      doc.fontSize(8.5).font("Helvetica-Bold");
      const y = doc.y;
      for (const c of cols) {
        doc.text(c.titulo, c.x, y, {
          width: c.largura,
          align: c.alinha,
          lineBreak: false,
        });
      }
      doc.y = y + 14;
      doc
        .moveTo(40, doc.y)
        .lineTo(530, doc.y)
        .lineWidth(0.5)
        .strokeColor("#999999")
        .stroke();
      doc.y += 6;
      doc.font("Helvetica");
    };

    const celulas = (valores: (string | null)[], bold = false) => {
      if (doc.y > fimPagina) {
        doc.addPage();
        cabecalhoTabela();
      }
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      const y = doc.y;
      for (const [i, v] of valores.entries()) {
        doc.text(v ?? "-", cols[i].x, y, {
          width: cols[i].largura,
          align: cols[i].alinha,
          lineBreak: false,
        });
      }
      doc.y = y + 14;
    };

    for (const [idx, mes] of dados.meses.entries()) {
      if (idx > 0) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(15);
      doc.text(
        `Consumo de ${nomeTipo(dados.tipo).toLowerCase()} - ${nomeCompetencia(mes.competencia)}`,
        40,
        doc.y,
      );
      doc.font("Helvetica").fontSize(10).fillColor("#555555");
      doc.moveDown(0.3);
      const tarifaTxt =
        dados.tarifa !== null
          ? `Tarifa: ${fmtReais.format(dados.tarifa)}/m³`
          : "Tarifa não cadastrada";
      doc.text(
        `${dados.condominio}  |  ${tarifaTxt}  |  Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
        40,
        doc.y,
      );
      doc.fillColor("#000000");
      doc.moveDown(1);
      cabecalhoTabela();

      for (const linha of mes.linhas) {
        celulas([
          linha.unidade,
          linha.anterior !== null ? fmtNumero.format(linha.anterior) : null,
          linha.atual !== null ? fmtNumero.format(linha.atual) : null,
          linha.consumo !== null ? fmtNumero.format(linha.consumo) : null,
          linha.valorReais !== null ? fmtReais.format(linha.valorReais) : null,
        ]);
      }
      doc.moveDown(0.3);
      celulas(
        [
          `Total (${mes.totais.lidas} de ${mes.totais.totalUnidades} lidas)`,
          "",
          "",
          fmtNumero.format(mes.totais.consumo),
          mes.totais.valorReais !== null
            ? fmtReais.format(mes.totais.valorReais)
            : null,
        ],
        true,
      );
    }

    doc.end();
    return fim;
  }
}
