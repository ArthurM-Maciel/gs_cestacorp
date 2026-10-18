import type { UsuarioAutenticado } from '@gincana/contracts';
import { papelSchema } from '@gincana/contracts';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../../env.js';

/** O token vale por um turno de trabalho: depois disso, a pessoa entra de novo. */
export const VALIDADE_DO_TOKEN = '8h';

/**
 * Conteúdo mínimo do token.
 *
 * `equipeLideradaId` viaja junto para que o middleware saiba de cara quem lidera equipe,
 * mas nenhuma decisão de escrita se apoia só nisso: papel e equipe podem ter mudado
 * depois da emissão, então o caminho autenticado recarrega o colaborador do banco.
 *
 * Nada de nome, e-mail ou qualquer outro dado pessoal aqui: o JWT é apenas assinado,
 * não é cifrado, e qualquer pessoa com o token lê o conteúdo.
 */
export const conteudoDoTokenSchema = z.object({
  sub: z.uuid(),
  papel: papelSchema,
  equipeLideradaId: z.uuid().nullable(),
});
export type ConteudoDoToken = z.infer<typeof conteudoDoTokenSchema>;

export function assinarToken(usuario: UsuarioAutenticado): string {
  const conteudo: ConteudoDoToken = {
    sub: usuario.id,
    papel: usuario.papel,
    equipeLideradaId: usuario.equipeLideradaId,
  };

  return jwt.sign(conteudo, env.JWT_SECRET, { expiresIn: VALIDADE_DO_TOKEN });
}

/**
 * Devolve o conteúdo quando o token é válido e `null` em qualquer outro caso —
 * ausente, malformado, assinatura adulterada, expirado ou com formato inesperado.
 * Quem chama transforma isso em 401; o motivo exato não vai para o cliente.
 */
export function verificarToken(token: string): ConteudoDoToken | null {
  try {
    const conteudo = jwt.verify(token, env.JWT_SECRET);
    const resultado = conteudoDoTokenSchema.safeParse(conteudo);
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}
