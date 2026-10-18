import { z } from 'zod';

import { idSchema } from './comum.js';

/**
 * US09 — "quero ver quem aprovou ou alterou cada lançamento".
 *
 * A trilha é gravada desde a US03 e é a evidência que sustenta o selo PQCRS. Este
 * contrato descreve só a **leitura** dela: nada aqui cria, altera ou apaga registro —
 * a tabela é somente-inclusão.
 *
 * Duas decisões moldam o formato:
 *
 *  1. O autor viaja com **nome**, não só identificador. A tela diz "Aprovado por Arthur
 *     Souza"; se só o identificador viesse, cada linha da linha do tempo custaria uma
 *     requisição a mais.
 *  2. `valoresAntes` e `valoresDepois` são `Json` livre no banco, e continuam disponíveis
 *     crus. Mas o que a tela precisa renderizar é "quantidade: 12 → 15", então o servidor
 *     também entrega `mudancas`: a lista já comparada, com rótulo em português e os dois
 *     valores em texto. Assim o front não precisa adivinhar o formato de cada entidade
 *     nem repetir a comparação campo a campo.
 */

export const acoesAuditadas = ['CRIACAO', 'APROVACAO', 'RECUSA', 'ALTERACAO', 'EXCLUSAO'] as const;
export const acaoAuditadaSchema = z.enum(acoesAuditadas);
export type AcaoAuditada = z.infer<typeof acaoAuditadaSchema>;

/** As entidades que hoje deixam rastro. Cresce junto com o que grava auditoria. */
export const entidadesAuditadas = [
  'Lancamento',
  'RegraPontuacao',
  'TipoAcao',
  'Colaborador',
  'Equipe',
  'Gincana',
] as const;
export const entidadeAuditadaSchema = z.enum(entidadesAuditadas);
export type EntidadeAuditada = z.infer<typeof entidadeAuditadaSchema>;

export const rotulosDeAcaoAuditada: Record<AcaoAuditada, string> = {
  CRIACAO: 'Criação',
  APROVACAO: 'Aprovação',
  RECUSA: 'Recusa',
  ALTERACAO: 'Alteração',
  EXCLUSAO: 'Exclusão',
};

/** Qualquer valor que caiba numa coluna `Json`. Existe para não haver `any` no caminho. */
export type ValorJson =
  string | number | boolean | null | ValorJson[] | { [campo: string]: ValorJson };

export const valorJsonSchema: z.ZodType<ValorJson> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(valorJsonSchema),
    z.record(z.string(), valorJsonSchema),
  ]),
);

/**
 * Uma linha do "o que mudou".
 *
 * `de` e `para` já vêm em texto pronto para exibir ("12", "Pendente", "—" vira `null`).
 * O número cru continua em `valoresAntes`/`valoresDepois` para quem precisar calcular.
 * Numa criação, `de` é `null`: não havia valor anterior.
 */
export const mudancaAuditadaSchema = z.object({
  campo: z.string(),
  rotulo: z.string(),
  de: z.string().nullable(),
  para: z.string().nullable(),
});
export type MudancaAuditada = z.infer<typeof mudancaAuditadaSchema>;

const autorSchema = z.object({ id: idSchema, nome: z.string() });

export const registroDeAuditoriaSchema = z.object({
  id: idSchema,
  entidade: z.string(),
  entidadeId: idSchema,
  acao: acaoAuditadaSchema,
  /** Com nome, porque a tela escreve "Aprovado por Fulana". */
  autor: autorSchema,
  descricao: z.string().nullable(),
  criadoEm: z.string(),
  /** A comparação já pronta. Vazia quando não há nada comparável. */
  mudancas: z.array(mudancaAuditadaSchema),
  valoresAntes: valorJsonSchema.nullable(),
  valoresDepois: valorJsonSchema.nullable(),
});
export type RegistroDeAuditoria = z.infer<typeof registroDeAuditoriaSchema>;

/** A linha do tempo de um lançamento, do mais antigo para o mais recente. */
export const linhaDoTempoSchema = z.object({
  entidade: z.literal('Lancamento'),
  entidadeId: idSchema,
  itens: z.array(registroDeAuditoriaSchema),
});
export type LinhaDoTempo = z.infer<typeof linhaDoTempoSchema>;

const paginaSchema = z.coerce
  .number({ message: 'Página inválida.' })
  .int('Página inválida.')
  .positive('Página inválida.')
  .default(1);

/**
 * O painel de evidência do PQCRS: só a administradora.
 *
 * Todos os filtros são opcionais e nenhum deles amplia escopo — a rota já é restrita ao
 * papel ADMIN no middleware.
 */
export const listarAuditoriaQuerySchema = z.object({
  entidade: entidadeAuditadaSchema.optional(),
  entidadeId: idSchema.optional(),
  autorId: idSchema.optional(),
  acao: acaoAuditadaSchema.optional(),
  pagina: paginaSchema,
  porPagina: z.coerce
    .number({ message: 'Quantidade por página inválida.' })
    .int('Quantidade por página inválida.')
    .positive('Quantidade por página inválida.')
    .max(100, 'No máximo 100 registros por página.')
    .default(20),
});
export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuerySchema>;

export const paginaDeAuditoriaSchema = z.object({
  itens: z.array(registroDeAuditoriaSchema),
  pagina: z.number().int(),
  porPagina: z.number().int(),
  total: z.number().int(),
  totalDePaginas: z.number().int(),
});
export type PaginaDeAuditoria = z.infer<typeof paginaDeAuditoriaSchema>;
