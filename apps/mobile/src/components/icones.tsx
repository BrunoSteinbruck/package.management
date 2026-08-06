import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type NomeIcone =
  | "camera"
  | "qr"
  | "check"
  | "chevron"
  | "voltar"
  | "fechar"
  | "flash"
  | "busca"
  | "sino"
  | "mais"
  | "escudo"
  | "casa"
  | "lista"
  | "pacote"
  | "pessoa"
  | "medidor"
  | "gota"
  | "chama"
  | "boleto"
  | "megafone"
  | "alerta"
  | "ajustes"
  | "grafico";

const DESENHOS: Record<NomeIcone, React.ReactNode> = {
  camera: (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </>
  ),
  qr: (
    <>
      <Rect x={3} y={3} width={7} height={7} rx={1} />
      <Rect x={14} y={3} width={7} height={7} rx={1} />
      <Rect x={3} y={14} width={7} height={7} rx={1} />
      <Path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
    </>
  ),
  check: <Path d="M20 6L9 17l-5-5" />,
  chevron: <Path d="M9 18l6-6-6-6" />,
  voltar: <Path d="M15 18l-6-6 6-6" />,
  fechar: <Path d="M18 6L6 18M6 6l12 12" />,
  flash: <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  busca: (
    <>
      <Circle cx={11} cy={11} r={8} />
      <Path d="M21 21l-4.35-4.35" />
    </>
  ),
  sino: (
    <>
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  mais: <Path d="M12 5v14M5 12h14" />,
  // Comunicado é da administração para todos; aviso é da portaria para uma
  // unidade. Enquanto os dois usavam o sino, as duas linhas do menu eram o
  // mesmo desenho e a diferença entre elas só existia no texto.
  megafone: (
    <>
      <Path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z" />
      <Path d="M17 9a4 4 0 0 1 0 6" />
    </>
  ),
  escudo: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  alerta: (
    <>
      <Path d="M12 3l10 18H2z" />
      <Path d="M12 10v4M12 17.5v.5" />
    </>
  ),
  // Controles deslizantes, não engrenagem: o que a tela faz é ligar e
  // desligar módulo, não abrir um painel de opções técnicas.
  ajustes: (
    <>
      <Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <Circle cx={16} cy={6} r={2} />
      <Circle cx={10} cy={12} r={2} />
      <Circle cx={16} cy={18} r={2} />
    </>
  ),
  casa: (
    <>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </>
  ),
  lista: (
    <>
      <Path d="M8 6h13M8 12h13M8 18h13" />
      <Path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  // Relatórios: colunas de altura diferente, que é o desenho da própria tela.
  // Existe porque "lista" já era Documentos, e as duas linhas ficavam lado a
  // lado no menu do síndico com o mesmo ícone.
  grafico: (
    <>
      <Path d="M4 20h16" />
      <Path d="M7 20v-6M12 20V6M17 20v-9" />
    </>
  ),
  // Boleto: as barras do código de barras. Os ícones de caixa e de lista já
  // são encomenda e documento, e reaproveitar qualquer um deles fazia duas
  // linhas do menu virarem o mesmo desenho.
  boleto: (
    <>
      <Rect x="2.5" y="5" width="19" height="14" rx="2" />
      <Path d="M6 9v6M9 9v6M12.5 9v6M16 9v6M18.5 9v6" />
    </>
  ),
  pacote: (
    <>
      <Path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
      <Path d="M3.3 7L12 12l8.7-5" />
      <Path d="M12 22V12" />
    </>
  ),
  pessoa: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </>
  ),
  // Mostrador de medidor: aro + ponteiro.
  medidor: (
    <>
      <Circle cx={12} cy={13} r={9} />
      <Path d="M12 13l4-4" />
      <Path d="M12 4v2M5 6.5l1.4 1.4M19 6.5l-1.4 1.4" />
    </>
  ),
  gota: <Path d="M12 2.5s6.5 7.6 6.5 12a6.5 6.5 0 0 1-13 0c0-4.4 6.5-12 6.5-12z" />,
  chama: (
    <Path d="M12 2s6 5.5 6 11a6 6 0 0 1-12 0c0-2.5 1.2-4.6 2.5-6 .3 1.8 1.2 3 2.5 3.5C10 7.5 11 4.5 12 2z" />
  ),
};

export function Icone(props: {
  nome: NomeIcone;
  tamanho?: number;
  cor?: string;
  traco?: number;
}) {
  return (
    <Svg
      width={props.tamanho ?? 24}
      height={props.tamanho ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={props.cor ?? "#FFFFFF"}
      strokeWidth={props.traco ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {DESENHOS[props.nome]}
    </Svg>
  );
}
