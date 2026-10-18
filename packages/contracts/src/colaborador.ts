import { z } from 'zod';

import { senhaSchema } from './auth.js';
import { idSchema, papelSchema } from './comum.js';

/** US03 — cadastro de colaboradores pela administradora. */

export const criarColaboradorSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  email: z.email({ message: 'Informe um e-mail válido.' }).toLowerCase(),
  senha: senhaSchema,
  papel: papelSchema.default('COLABORADOR'),
  equipeId: idSchema.nullish(),
});
export type CriarColaborador = z.infer<typeof criarColaboradorSchema>;

export const atualizarColaboradorSchema = z
  .object({
    nome: z.string().trim().min(3).max(120).optional(),
    papel: papelSchema.optional(),
    equipeId: idSchema.nullish(),
    ativo: z.boolean().optional(),
  })
  .refine((c) => Object.keys(c).length > 0, { message: 'Informe ao menos um campo.' });
export type AtualizarColaborador = z.infer<typeof atualizarColaboradorSchema>;

export const colaboradorSchema = z.object({
  id: idSchema,
  nome: z.string(),
  email: z.email(),
  papel: papelSchema,
  ativo: z.boolean(),
  equipe: z.object({ id: idSchema, nome: z.string() }).nullable(),
});
export type Colaborador = z.infer<typeof colaboradorSchema>;

/**
 * Filtros da listagem usada pela administradora ao montar as equipes.
 *
 * Vem da barra de endereço, então tudo é opcional: sem filtro, a lista é a de todos os
 * colaboradores cadastrados.
 */
export const listarColaboradoresQuerySchema = z.object({
  equipeId: idSchema.optional(),
  papel: papelSchema.optional(),
});
export type ListarColaboradoresQuery = z.infer<typeof listarColaboradoresQuerySchema>;
