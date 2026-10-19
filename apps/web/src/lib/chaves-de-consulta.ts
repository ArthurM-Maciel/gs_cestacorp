/**
 * Chaves do cache do TanStack Query. Ficam num arquivo só para que equipes e colaboradores,
 * que se invalidam mutuamente, não precisem importar um ao outro.
 *
 * Invalidar pela chave curta (`['equipes']`) atinge também as variações com filtro.
 */
export const chaveDasGincanas = ['gincanas'] as const;
export const chaveDasEquipes = ['equipes'] as const;
export const chaveDosColaboradores = ['colaboradores'] as const;
export const chaveDosLancamentos = ['lancamentos'] as const;
export const chaveDosTiposDeAcao = ['tipos-de-acao'] as const;
/** A prévia de pontos não é dado da pessoa: fica fora de `chaveDosLancamentos` para não ser refeita a cada decisão. */
export const chaveDasPrevias = ['previas-de-lancamento'] as const;
/**
 * O placar e o extrato por tipo de ação. Aprovar ou recusar um lançamento muda os dois,
 * então quem decide invalida esta chave junto com a dos lançamentos.
 */
export const chaveDoRanking = ['ranking'] as const;
/** O painel de auditoria da administradora. Todo lançamento novo ou decidido acrescenta uma linha a ele. */
export const chaveDaAuditoria = ['auditoria'] as const;
