import { pino } from 'pino';

import { env } from './env.js';

/**
 * Nunca registramos senha, token ou conteúdo de comprovante: a trilha de log não é o
 * lugar de dado pessoal de colaborador (LGPD).
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.senha',
      'req.body.senhaAtual',
      'res.headers["set-cookie"]',
    ],
    censor: '[oculto]',
  },
});
