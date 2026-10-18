import { z } from 'zod';

import { idSchema, statusLancamentoSchema, unidadeSchema } from './comum.js';
import { evidenciaSchema } from './evidencia.js';

/**
 * US06 — o colaborador lança uma ação com a quantidade.
 * US08 — o líder (ou a administradora) aprova ou recusa.
 *
 * Três promessas do protótipo moldam estes contratos:
 *
 *  1. "+120 pts" aparece enquanto a pessoa digita. Daí `previaDeLancamentoSchema`, que
 *     calcula sem gravar nada e devolve a regra que seria aplicada.
 *  2. Os pontos são congelados no lançamento. Por isso a resposta carrega
 *     `regraPontuacaoId` e `pontosPorUnidadeAplicado` ao lado de `pontosCalculados`:
 *     o front mostra o preço que valeu, não o que vale hoje.
 *  3. A recusa precisa dizer o que corrigir ("Foto sem a etiqueta da ONG"), então
 *     `motivoRecusa` é obrigatório.
 */

/**
 * A quantidade da ação: 24 kg de tampinhas, 3 peças de roupa, 1 certificado.
 *
 * Três casas decimais, que é o que a coluna do banco guarda — pedir mais precisão seria
 * prometer um arredondamento que o banco não faz. Zero não vale: lançamento sem
 * quantidade não é lançamento.
 */
export const quantidadeSchema = z
  .number({ message: 'Informe a quantidade da ação.' })
  .positive('A quantidade precisa ser maior que zero.')
  .max(9_999_999.999, 'Quantidade fora do intervalo aceito.')
  .multipleOf(0.001, 'A quantidade tem no máximo três casas decimais.');

/**
 * O dia em que a ação aconteceu, sem hora e sem fuso.
 *
 * A doação de agasalhos aconteceu num dia do calendário, não num instante: é a mesma
 * decisão que o período da gincana usa. Quem confere se o dia é passado e se cai dentro
 * da gincana é o servidor, porque o relógio do navegador não é fonte confiável.
 */
export const dataAcaoSchema = z.iso.date({ message: 'Informe a data em que a ação aconteceu.' });

export const observacaoSchema = z
  .string()
  .trim()
  .max(500, 'A observação tem no máximo 500 caracteres.');

/** A prévia de pontos do formulário. Não grava nada. */
export const previaDeLancamentoSchema = z.object({
  tipoAcaoId: idSchema,
  quantidade: quantidadeSchema,
  dataAcao: dataAcaoSchema,
});
export type PreviaDeLancamento = z.infer<typeof previaDeLancamentoSchema>;

export const resultadoDaPreviaSchema = z.object({
  tipoAcaoId: idSchema,
  quantidade: z.number(),
  dataAcao: z.string(),
  unidade: unidadeSchema,
  /** A regra que seria congelada se o lançamento fosse gravado agora. */
  regraPontuacaoId: idSchema,
  pontosPorUnidade: z.number(),
  pontos: z.number().int(),
  /** O tipo exige comprovante? A tela usa para avisar antes de enviar. */
  exigeEvidencia: z.boolean(),
});
export type ResultadoDaPrevia = z.infer<typeof resultadoDaPreviaSchema>;

export const criarLancamentoSchema = z.object({
  tipoAcaoId: idSchema,
  quantidade: quantidadeSchema,
  dataAcao: dataAcaoSchema,
  observacao: observacaoSchema.nullish(),
  /**
   * Só a administradora pode lançar para outra pessoa — ela registra o que chega por
   * papel na recepção. Para qualquer outro perfil o servidor ignora e usa quem está
   * autenticado, porque autorização não vem do corpo da requisição.
   */
  colaboradorId: idSchema.optional(),
});
export type CriarLancamento = z.infer<typeof criarLancamentoSchema>;

const CAMPOS_DO_PATCH = ['quantidade', 'observacao', 'dataAcao'] as const;

/**
 * A correção do lançamento.
 *
 * O dono corrige enquanto está PENDENTE e também depois de uma recusa — nesse caso o
 * lançamento volta para PENDENTE e entra de novo na fila, que é o "corrigir e reenviar"
 * do protótipo. A administradora corrige em qualquer status, inclusive aprovado.
 *
 * `status` aparece aqui só para ser recusado com uma mensagem que ensina o caminho certo:
 * aprovar e recusar têm rota própria, com auditoria de avaliação.
 */
export const atualizarLancamentoSchema = z
  .strictObject({
    quantidade: quantidadeSchema.optional(),
    observacao: observacaoSchema.nullish(),
    dataAcao: dataAcaoSchema.optional(),
    status: z
      .undefined({
        message:
          'O status não muda por aqui. Use as ações de aprovar ou recusar, que ficam registradas.',
      })
      .optional(),
  })
  .refine((l) => CAMPOS_DO_PATCH.some((campo) => Object.hasOwn(l, campo)), {
    message: 'Informe ao menos um campo.',
  });
export type AtualizarLancamento = z.infer<typeof atualizarLancamentoSchema>;

/**
 * A recusa exige motivo: sem ele o colaborador não sabe o que corrigir e volta a lançar
 * a mesma coisa. O protótipo mostra exatamente isso — "Foto sem a etiqueta da ONG".
 */
export const recusarLancamentoSchema = z.object({
  motivoRecusa: z
    .string()
    .trim()
    .min(5, 'Explique em uma frase o que precisa ser corrigido.')
    .max(500, 'O motivo tem no máximo 500 caracteres.'),
});
export type RecusarLancamento = z.infer<typeof recusarLancamentoSchema>;

/** Observação opcional da aprovação, que vai para a trilha de auditoria. */
export const aprovarLancamentoSchema = z.object({
  observacao: observacaoSchema.optional(),
});
export type AprovarLancamento = z.infer<typeof aprovarLancamentoSchema>;

const paginaSchema = z.coerce
  .number({ message: 'Página inválida.' })
  .int('Página inválida.')
  .positive('Página inválida.')
  .default(1);

/**
 * Filtros da listagem. Tudo chega como texto na barra de endereço, então tudo é opcional.
 *
 * Nenhum destes campos amplia o que a pessoa enxerga: o escopo do papel entra no `where`
 * antes deles. Um colaborador que escrever `colaboradorId` de outra pessoa recebe lista
 * vazia, não a lista alheia.
 */
export const listarLancamentosQuerySchema = z.object({
  status: statusLancamentoSchema.optional(),
  gincanaId: idSchema.optional(),
  equipeId: idSchema.optional(),
  colaboradorId: idSchema.optional(),
  tipoAcaoId: idSchema.optional(),
  pagina: paginaSchema,
  porPagina: z.coerce
    .number({ message: 'Quantidade por página inválida.' })
    .int('Quantidade por página inválida.')
    .positive('Quantidade por página inválida.')
    .max(100, 'No máximo 100 lançamentos por página.')
    .default(20),
});
export type ListarLancamentosQuery = z.infer<typeof listarLancamentosQuerySchema>;

/** A fila do avaliador: mesmos filtros, sem `status`, que é sempre PENDENTE. */
export const filaDePendentesQuerySchema = listarLancamentosQuerySchema.omit({ status: true });
export type FilaDePendentesQuery = z.infer<typeof filaDePendentesQuerySchema>;

const pessoaResumidaSchema = z.object({ id: idSchema, nome: z.string() });

export const lancamentoSchema = z.object({
  id: idSchema,
  gincanaId: idSchema,
  colaboradorId: idSchema,
  colaborador: pessoaResumidaSchema,
  /** Gravada no lançamento: mudar de equipe depois não leva os pontos junto. */
  equipeId: idSchema,
  equipe: pessoaResumidaSchema,
  tipoAcaoId: idSchema,
  tipoAcao: z.object({
    id: idSchema,
    nome: z.string(),
    unidade: unidadeSchema,
    exigeEvidencia: z.boolean(),
  }),
  quantidade: z.number(),
  /** Congelados no lançamento: mudar a regra depois não mexe aqui. */
  regraPontuacaoId: idSchema,
  pontosPorUnidadeAplicado: z.number(),
  pontosCalculados: z.number().int(),
  status: statusLancamentoSchema,
  observacao: z.string().nullable(),
  dataAcao: z.string(),
  avaliadoPor: pessoaResumidaSchema.nullable(),
  avaliadoEm: z.string().nullable(),
  motivoRecusa: z.string().nullable(),
  evidencias: z.array(evidenciaSchema),
  criadoEm: z.string(),
});
export type Lancamento = z.infer<typeof lancamentoSchema>;

export const paginaDeLancamentosSchema = z.object({
  itens: z.array(lancamentoSchema),
  pagina: z.number().int(),
  porPagina: z.number().int(),
  total: z.number().int(),
  totalDePaginas: z.number().int(),
});
export type PaginaDeLancamentos = z.infer<typeof paginaDeLancamentosSchema>;
