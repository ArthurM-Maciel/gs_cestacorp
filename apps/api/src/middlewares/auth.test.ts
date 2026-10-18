import type { Papel, UsuarioAutenticado } from '@gincana/contracts';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { exigePapel } from './auth.js';
import { rotaNaoEncontrada, tratadorDeErros } from './erros.js';
import { consultaValidada, validar } from './validar.js';

function usuarioFalso(papel: Papel): UsuarioAutenticado {
  return {
    id: '7b1f6f3c-0f4a-4a9f-9a1a-6a3b2c1d0e9f',
    nome: 'Pessoa de teste',
    email: 'us01-middleware@teste.invalido',
    papel,
    equipeId: null,
    equipeLideradaId: null,
  };
}

/** Sobe só o trecho de middleware que está sob teste, sem banco e sem token. */
function appComUsuario(papel?: Papel): Express {
  const app = express();
  app.use(express.json());

  app.use((req, _res, proximo) => {
    if (papel) {
      req.usuario = usuarioFalso(papel);
    }
    proximo();
  });

  app.get('/so-admin', exigePapel('ADMIN'), (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/admin-ou-lider', exigePapel('ADMIN', 'LIDER'), (_req, res) => {
    res.json({ ok: true });
  });

  const filtroSchema = z.object({ pagina: z.coerce.number().int().positive().default(1) });

  app.get('/com-filtro', validar({ query: filtroSchema }), (req, res) => {
    res.json(consultaValidada(req, filtroSchema));
  });

  app.post(
    '/com-corpo',
    validar({ body: z.object({ quantidade: z.coerce.number().positive() }) }),
    (req, res) => {
      res.json(req.body);
    },
  );

  app.use(rotaNaoEncontrada);
  app.use(tratadorDeErros);

  return app;
}

describe('exigePapel', () => {
  it('libera quem tem o papel exigido', async () => {
    await request(appComUsuario('ADMIN')).get('/so-admin').expect(200);
    await request(appComUsuario('LIDER')).get('/admin-ou-lider').expect(200);
    await request(appComUsuario('ADMIN')).get('/admin-ou-lider').expect(200);
  });

  it('devolve 403 para os papéis fora da lista', async () => {
    for (const papel of ['COLABORADOR', 'LIDER'] as const) {
      const resposta = await request(appComUsuario(papel)).get('/so-admin');

      expect(resposta.status).toBe(403);
      expect(resposta.body.erro).toMatchObject({
        codigo: 'SEM_PERMISSAO',
        mensagem: 'Você não tem permissão para esta ação.',
      });
    }

    const colaborador = await request(appComUsuario('COLABORADOR')).get('/admin-ou-lider');
    expect(colaborador.status).toBe(403);
  });

  it('devolve 401, e não 403, quando ninguém se autenticou antes', async () => {
    const resposta = await request(appComUsuario()).get('/so-admin');

    expect(resposta.status).toBe(401);
    expect(resposta.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });
});

describe('validar', () => {
  it('aplica o valor convertido e o padrão do schema na consulta', async () => {
    await request(appComUsuario()).get('/com-filtro').expect(200).expect({ pagina: 1 });

    await request(appComUsuario()).get('/com-filtro?pagina=3').expect(200).expect({ pagina: 3 });
  });

  it('reescreve o corpo com o valor já convertido', async () => {
    const resposta = await request(appComUsuario()).post('/com-corpo').send({ quantidade: '2.5' });

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ quantidade: 2.5 });
  });

  it('devolve 400 com os detalhes por campo quando a entrada não serve', async () => {
    const corpo = await request(appComUsuario()).post('/com-corpo').send({ quantidade: -1 });
    const consulta = await request(appComUsuario()).get('/com-filtro?pagina=zero');

    expect(corpo.status).toBe(400);
    expect(corpo.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(corpo.body.erro.detalhes.quantidade).toBeDefined();
    expect(consulta.status).toBe(400);
    expect(consulta.body.erro.detalhes.pagina).toBeDefined();
  });
});
