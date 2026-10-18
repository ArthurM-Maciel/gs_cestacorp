import { z } from 'zod';

/**
 * Vocabulário compartilhado entre a API e o front.
 *
 * O domínio é escrito em português, igual ao vocabulário da cliente: é o que aparece na
 * Sprint Review e o que evita tradução mental na revisão de código.
 */

export const papeis = ['COLABORADOR', 'LIDER', 'ADMIN'] as const;
export const papelSchema = z.enum(papeis);
export type Papel = z.infer<typeof papelSchema>;

export const statusGincanas = ['PLANEJADA', 'ATIVA', 'ENCERRADA'] as const;
export const statusGincanaSchema = z.enum(statusGincanas);
export type StatusGincana = z.infer<typeof statusGincanaSchema>;

export const statusLancamentos = ['PENDENTE', 'APROVADO', 'RECUSADO'] as const;
export const statusLancamentoSchema = z.enum(statusLancamentos);
export type StatusLancamento = z.infer<typeof statusLancamentoSchema>;

/** Unidades de medida das ações, conforme o protótipo da tela de nova regra. */
export const unidades = ['KG', 'UNIDADE', 'PECA', 'CERTIFICADO'] as const;
export const unidadeSchema = z.enum(unidades);
export type Unidade = z.infer<typeof unidadeSchema>;

export const rotulosDeUnidade: Record<Unidade, { singular: string; plural: string }> = {
  KG: { singular: 'kg', plural: 'kg' },
  UNIDADE: { singular: 'unidade', plural: 'unidades' },
  PECA: { singular: 'peça', plural: 'peças' },
  CERTIFICADO: { singular: 'certificado', plural: 'certificados' },
};

export const idSchema = z.uuid({ message: 'Identificador inválido.' });

/**
 * Formato único de erro da API. O front depende dele para decidir entre mostrar uma
 * mensagem geral ou destacar o campo que falhou.
 */
export const erroSchema = z.object({
  erro: z.object({
    codigo: z.string(),
    mensagem: z.string(),
    detalhes: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type RespostaDeErro = z.infer<typeof erroSchema>;
