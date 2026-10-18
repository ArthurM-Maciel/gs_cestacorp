import { criarApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';

const app = criarApp();

app.listen(env.PORT, () => {
  logger.info(`API da Gincana Solidária em http://localhost:${env.PORT}`);
});
