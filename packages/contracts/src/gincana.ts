import { z } from 'zod';

import { idSchema, statusGincanaSchema } from './comum.js';

/** US02 — a administradora cadastra a gincana do ano com o seu período. */

const dataSchema = z.iso.date({ message: 'Informe uma data válida.' });

export const criarGincanaSchema = z
  .object({
    ano: z
      .number()
      .int()
      .min(2020, 'Ano fora do intervalo aceito.')
      .max(2100, 'Ano fora do intervalo aceito.'),
    nome: z.string().trim().min(3, 'O nome precisa de pelo menos 3 caracteres.').max(120),
    dataInicio: dataSchema,
    dataFim: dataSchema,
  })
  .refine((g) => g.dataInicio <= g.dataFim, {
    message: 'A data de término não pode ser anterior à de início.',
    path: ['dataFim'],
  });
export type CriarGincana = z.infer<typeof criarGincanaSchema>;

export const atualizarGincanaSchema = z
  .object({
    nome: z.string().trim().min(3).max(120).optional(),
    dataInicio: dataSchema.optional(),
    dataFim: dataSchema.optional(),
    status: statusGincanaSchema.optional(),
  })
  .refine((g) => Object.keys(g).length > 0, { message: 'Informe ao menos um campo.' });
export type AtualizarGincana = z.infer<typeof atualizarGincanaSchema>;

export const gincanaSchema = z.object({
  id: idSchema,
  ano: z.number().int(),
  nome: z.string(),
  dataInicio: z.string(),
  dataFim: z.string(),
  status: statusGincanaSchema,
});
export type Gincana = z.infer<typeof gincanaSchema>;
