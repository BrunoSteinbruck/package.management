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
  | "lista";

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
  escudo: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
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
