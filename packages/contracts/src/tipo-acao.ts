import { z } from 'zod';

import { idSchema, unidadeSchema } from './comum.js';

/**
 * US04 — a administradora cadastra tipos de ação com a regra de pontos, inclusive as
 * atividades extras criadas no meio da gincana.
 *
 * Duas coisas que o protótipo promete em texto moldam estes contratos:
 *
 *  1. "Mudanças valem só para lançamentos novos." Por isso trocar a pontuação não é
 *     editar a regra: é `novaRegraSchema`, que abre uma vigência nova. O `PATCH` do tipo
 *     não aceita `pontosPorUnidade` — e recusa explicitamente quem tentar.
 *  2. "Ficam registradas no histórico." Por isso a resposta carrega a regra vigente
 *     separada do histórico completo de vigências.
 *
 * Atividade extra não tem schema próprio: ela é um tipo de ação como qualquer outro.
 */

/**
 * O instante em que uma vigência começa.
 *
 * É data e hora, não dia do calendário: a administradora troca a pontuação no meio do
 * expediente e o que já foi lançado naquela manhã continua valendo o preço antigo.
 */
const instanteSchema = z.iso.datetime({
  offset: true,
  message: 'Informe uma data e hora válidas.',
});

/**
 * Zero é permitido de propósito: existe ação simbólica, que entra no mural sem somar
 * ponto. Negativo não — punição não faz parte das regras da gincana.
 */
const pontosPorUnidadeSchema = z
  .number({ message: 'Informe quantos pontos a ação vale por unidade.' })
  .nonnegative('Os pontos por unidade não podem ser negativos.')
  .max(99_999_999.99, 'Pontos por unidade fora do intervalo aceito.')
  .multipleOf(0.01, 'Os pontos por unidade têm no máximo duas casas decimais.');

export const criarTipoAcaoSchema = z.object({
  nome: z.string().trim().min(2, 'O nome precisa de pelo menos 2 caracteres.').max(80),
  descricao: z.string().trim().max(500).nullish(),
  unidade: unidadeSchema,
  /** Curso exige certificado; uma atitude pode não exigir nada. */
  exigeEvidencia: z.boolean().default(true),
  pontosPorUnidade: pontosPorUnidadeSchema,
  /** Ausente significa "a partir de agora", que é o caso normal da tela. */
  vigenciaInicio: instanteSchema.optional(),
});
export type CriarTipoAcao = z.infer<typeof criarTipoAcaoSchema>;

const CAMPOS_DO_PATCH = ['nome', 'descricao', 'exigeEvidencia', 'ativo'] as const;

/**
 * O `PATCH` muda a identidade do tipo de ação, nunca o preço dele.
 *
 * `pontosPorUnidade` aparece aqui só para ser recusado com uma mensagem que ensina o
 * caminho certo: sem isso, o zod descartaria o campo em silêncio e quem usa sairia da
 * tela achando que a pontuação mudou.
 */
export const atualizarTipoAcaoSchema = z
  .strictObject({
    nome: z.string().trim().min(2).max(80).optional(),
    descricao: z.string().trim().max(500).nullish(),
    exigeEvidencia: z.boolean().optional(),
    /** `false` pausa o tipo: ele some do formulário do colaborador sem apagar histórico. */
    ativo: z.boolean().optional(),
    pontosPorUnidade: z
      .undefined({
        message:
          'A pontuação não muda por aqui. Registre uma nova regra para valer a partir de agora.',
      })
      .optional(),
  })
  .refine((t) => CAMPOS_DO_PATCH.some((campo) => Object.hasOwn(t, campo)), {
    message: 'Informe ao menos um campo.',
  });
export type AtualizarTipoAcao = z.infer<typeof atualizarTipoAcaoSchema>;

/**
 * A troca de pontuação: fecha a vigência da regra atual e abre a próxima no mesmo
 * instante, sem buraco nem sobreposição.
 */
export const novaRegraSchema = z.object({
  pontosPorUnidade: pontosPorUnidadeSchema,
  vigenciaInicio: instanteSchema.optional(),
  /** Texto livre que vai para a trilha de auditoria, para explicar a decisão. */
  motivo: z.string().trim().max(240).optional(),
});
export type NovaRegra = z.infer<typeof novaRegraSchema>;

export const listarTiposAcaoQuerySchema = z.object({
  /** Chega como texto na barra de endereço; sem o filtro, a lista vem inteira. */
  ativo: z
    .enum(['true', 'false'], { message: 'O filtro de ativo aceita apenas true ou false.' })
    .transform((valor) => valor === 'true')
    .optional(),
});
export type ListarTiposAcaoQuery = z.infer<typeof listarTiposAcaoQuerySchema>;

export const regraPontuacaoSchema = z.object({
  id: idSchema,
  tipoAcaoId: idSchema,
  pontosPorUnidade: z.number(),
  vigenciaInicio: z.string(),
  /** Nulo significa "é a regra atual". */
  vigenciaFim: z.string().nullable(),
  criadoPorId: idSchema,
});
export type RegraPontuacao = z.infer<typeof regraPontuacaoSchema>;

export const tipoAcaoSchema = z.object({
  id: idSchema,
  gincanaId: idSchema,
  nome: z.string(),
  descricao: z.string().nullable(),
  unidade: unidadeSchema,
  exigeEvidencia: z.boolean(),
  ativo: z.boolean(),
  /**
   * A regra que vale agora — é a que a tela de registrar ação mostra ao colaborador e a
   * que alimenta a prévia de pontos. Nula quando a vigência ainda não começou.
   */
  regraVigente: regraPontuacaoSchema.nullable(),
});
export type TipoAcao = z.infer<typeof tipoAcaoSchema>;

/** O tipo de ação com todas as vigências já cadastradas, da mais recente para a mais antiga. */
export const tipoAcaoComHistoricoSchema = tipoAcaoSchema.extend({
  regras: z.array(regraPontuacaoSchema),
});
export type TipoAcaoComHistorico = z.infer<typeof tipoAcaoComHistoricoSchema>;
