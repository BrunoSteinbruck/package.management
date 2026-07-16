export type RootStackParamList = {
  Home: undefined;
  Qr: { unidadeId: string; rotulo: string; pendentes: number };
  Detalhe: { pacoteId: string };
  MinhaUnidade: { unidadeId: string; rotulo: string; condominio: string };
};
