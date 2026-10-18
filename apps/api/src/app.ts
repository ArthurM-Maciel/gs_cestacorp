import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './env.js';
import { logger } from './logger.js';
import { rotaNaoEncontrada, tratadorDeErros } from './middlewares/erros.js';
import { authRouter } from './modules/auth/routes.js';
import { healthRouter } from './modules/health/routes.js';

/**
 * Monta a aplicação sem abrir porta, para que os testes de integração subam o Express em
 * memória com supertest.
 */
export function criarApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use(authRouter);

  app.use(rotaNaoEncontrada);
  app.use(tratadorDeErros);

  return app;
}
