// Fonte única do contrato entre API, app e painel.
//
// enums.ts   vocabulário fechado do domínio
// dto.ts     corpos de request (zod), validados na borda da API
// api.ts     formato das respostas (o "fio")
// feed.ts    a caixa de entrada do morador, em um formato só
// perfil.ts  identidade da sessão e o perfil que decide a experiência

export * from "./enums";
export * from "./dto";
export * from "./api";
export * from "./feed";
export * from "./perfil";
