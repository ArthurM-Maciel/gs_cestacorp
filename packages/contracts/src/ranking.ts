import { z } from 'zod';

import { idSchema, unidadeSchema } from './comum.js';

/**
 * US11 — "quero acompanhar o ranking da minha equipe durante a gincana".
 *
 * O placar é da gincana inteira e qualquer perfil autenticado o enxerga: é o que o
 * protótipo mostra a todo mundo, com pódio de 1º, 2º e 3º.
 *
 * Três regras do domínio aparecem no formato:
 *
 *  1. **Só lançamento APROVADO soma.** Pendente e recusado não entram em nenhum total.
 *  2. **Toda equipe da gincana aparece**, mesmo com zero — a tela lista todas, e sumir do
 *     placar seria pior do que aparecer em último.
 *  3. **Empate divide a posição** (duas equipes em 2º, a seguinte em 4º). Dentro do
 *     empate, a ordem é alfabética, só para a lista não dançar entre dois carregamentos.
 *     Daí `empatada`, que a tela usa para escrever "2º (empate)".
 *
 * Os pontos vêm sempre de `SUM(pontosCalculados)` dos lançamentos — valor congelado no
 * lançamento. Não existe total guardado em lugar nenhum: trocar a regra de pontuação
 * hoje não mexe no placar de ontem.
 */

/**
 * O filtro "Geral / Esta semana" do protótipo.
 *
 * O recorte é pela `dataAcao` (o dia em que a ação aconteceu), não pela data do registro
 * nem pela da aprovação: é o que a pessoa entende por "esta semana". Ambas as pontas são
 * inclusivas e ambas são opcionais — sem nenhuma, é o placar geral.
 */
export const periodoDoRankingQuerySchema = z
  .object({
    desde: z.iso.date({ message: 'Informe uma data inicial válida.' }).optional(),
    ate: z.iso.date({ message: 'Informe uma data final válida.' }).optional(),
  })
  .refine((periodo) => !periodo.desde || !periodo.ate || periodo.desde <= periodo.ate, {
    path: ['ate'],
    message: 'A data final não pode ser anterior à inicial.',
  });
export type PeriodoDoRankingQuery = z.infer<typeof periodoDoRankingQuerySchema>;

const equipeResumidaSchema = z.object({ id: idSchema, nome: z.string() });
const pessoaResumidaSchema = z.object({ id: idSchema, nome: z.string() });

export const linhaDoRankingSchema = z.object({
  /** Posição com empate compartilhado: 1, 2, 2, 4. */
  posicao: z.number().int().positive(),
  empatada: z.boolean(),
  equipeId: idSchema,
  equipe: equipeResumidaSchema,
  /** Equipe pode estar sem liderança atribuída no meio da gincana. */
  lider: pessoaResumidaSchema.nullable(),
  pontos: z.number().int().nonnegative(),
  acoesAprovadas: z.number().int().nonnegative(),
  totalColaboradores: z.number().int().nonnegative(),
});
export type LinhaDoRanking = z.infer<typeof linhaDoRankingSchema>;

export const rankingSchema = z.object({
  gincanaId: idSchema,
  gincana: z.object({ id: idSchema, nome: z.string(), ano: z.number().int() }),
  /** O recorte aplicado, devolvido para a tela confirmar o filtro que está valendo. */
  desde: z.string().nullable(),
  ate: z.string().nullable(),
  /** Consulta agregada na hora: é o instante em que o placar foi somado. */
  apuradoEm: z.string(),
  linhas: z.array(linhaDoRankingSchema),
});
export type Ranking = z.infer<typeof rankingSchema>;

/** Uma linha do extrato: quanto a equipe fez de cada tipo de ação. */
export const linhaDoExtratoSchema = z.object({
  tipoAcaoId: idSchema,
  tipoAcao: z.object({ id: idSchema, nome: z.string(), unidade: unidadeSchema }),
  /** Soma das quantidades aprovadas: 48 kg de tampinhas, 7 peças de roupa. */
  quantidade: z.number(),
  acoesAprovadas: z.number().int().nonnegative(),
  pontos: z.number().int().nonnegative(),
});
export type LinhaDoExtrato = z.infer<typeof linhaDoExtratoSchema>;

/** A tela de detalhe da equipe: a mesma linha do placar, aberta por tipo de ação. */
export const extratoDaEquipeSchema = z.object({
  gincanaId: idSchema,
  desde: z.string().nullable(),
  ate: z.string().nullable(),
  apuradoEm: z.string(),
  equipe: equipeResumidaSchema,
  lider: pessoaResumidaSchema.nullable(),
  posicao: z.number().int().positive(),
  empatada: z.boolean(),
  pontos: z.number().int().nonnegative(),
  acoesAprovadas: z.number().int().nonnegative(),
  totalColaboradores: z.number().int().nonnegative(),
  linhas: z.array(linhaDoExtratoSchema),
});
export type ExtratoDaEquipe = z.infer<typeof extratoDaEquipeSchema>;
