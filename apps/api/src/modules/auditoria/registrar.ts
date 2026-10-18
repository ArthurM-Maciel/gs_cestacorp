import type { Prisma } from '../../../generated/prisma/client.js';

import type { Transacao } from '../../db.js';

export type AcaoAuditada = 'CRIACAO' | 'APROVACAO' | 'RECUSA' | 'ALTERACAO' | 'EXCLUSAO';

export interface EntradaDeAuditoria {
  entidade: 'Lancamento' | 'RegraPontuacao' | 'TipoAcao' | 'Colaborador' | 'Equipe' | 'Gincana';
  entidadeId: string;
  acao: AcaoAuditada;
  autorId: string;
  valoresAntes?: Prisma.InputJsonValue;
  valoresDepois?: Prisma.InputJsonValue;
  descricao?: string;
}

/**
 * Único caminho para gravar auditoria.
 *
 * Recebe a transação em vez do cliente de propósito: a auditoria precisa viver ou morrer
 * junto da mutação que a originou. Se a alteração de pontuação falhar, não pode sobrar um
 * registro dizendo que ela aconteceu — e se a auditoria falhar, a pontuação não vale.
 *
 * A tabela é somente-inclusão: nada aqui atualiza ou apaga registro anterior.
 */
export async function registrarAuditoria(
  tx: Transacao,
  entrada: EntradaDeAuditoria,
): Promise<void> {
  await tx.registroAuditoria.create({
    data: {
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId,
      acao: entrada.acao,
      autorId: entrada.autorId,
      valoresAntes: entrada.valoresAntes,
      valoresDepois: entrada.valoresDepois,
      descricao: entrada.descricao,
    },
  });
}
