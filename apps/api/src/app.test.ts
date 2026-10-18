import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { criarApp } from './app.js';

const app = criarApp();

describe('API', () => {
  it('responde o healthcheck, usado para acordar o ambiente de homologação', async () => {
    const resposta = await request(app).get('/health');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ status: 'ok', emFuncionamento: true });
  });

  it('devolve 404 no formato padrão de erro quando a rota não existe', async () => {
    const resposta = await request(app).get('/rota-que-nao-existe');

    expect(resposta.status).toBe(404);
    expect(resposta.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });

  it('não expõe o cabeçalho que entrega a tecnologia do servidor', async () => {
    const resposta = await request(app).get('/health');

    expect(resposta.headers['x-powered-by']).toBeUndefined();
  });
});
