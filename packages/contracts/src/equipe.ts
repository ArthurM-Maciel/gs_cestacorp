import { z } from 'zod';

import { idSchema } from './comum.js';

/** US03 — a administradora cadastra equipes e vincula colaboradores. */

export const criarEquipeSchema = z.object({
  nome: z.string().trim().min(2, 'O nome precisa de pelo menos 2 caracteres.').max(80),
  liderId: idSchema.nullish(),
});
export type CriarEquipe = z.infer<typeof criarEquipeSchema>;

export const atualizarEquipeSchema = z
  .object({
    nome: z.string().trim().min(2).max(80).optional(),
    liderId: idSchema.nullish(),
  })
  .refine((e) => Object.keys(e).length > 0, { message: 'Informe ao menos um campo.' });
export type AtualizarEquipe = z.infer<typeof atualizarEquipeSchema>;

export const vincularMembrosSchema = z.object({
  colaboradorIds: z.array(idSchema).min(1, 'Selecione ao menos um colaborador.'),
});
export type VincularMembros = z.infer<typeof vincularMembrosSchema>;

export const equipeSchema = z.object({
  id: idSchema,
  nome: z.string(),
  gincanaId: idSchema,
  lider: z.object({ id: idSchema, nome: z.string() }).nullable(),
  /** Quantos colaboradores a equipe tem, sem contar quem a lidera. */
  totalMembros: z.number().int().nonnegative(),
});
export type Equipe = z.infer<typeof equipeSchema>;
