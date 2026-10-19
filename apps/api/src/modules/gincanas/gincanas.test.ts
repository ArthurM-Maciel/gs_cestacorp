import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
import {
  criarCenarioDeCadastro,
  type CenarioDeCadastro,
  type PessoaDeTeste,
} from '../../testes/cadastro.fixtures.js';

import { paraDataDoBanco, paraDataDoContrato } from './service.js';

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

describe('US02 — cadastro da gincana do ano', () => {
  let cenario: CenarioDeCadastro;
  let administradora: PessoaDeTeste;
  let lider: PessoaDeTeste;
  let colaborador: PessoaDeTeste;

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    const gincana = await cenario.criarGincana();
    const equipe = await cenario.criarEquipe(gincana.id);

    administradora = await cenario.criarPessoa({ papel: 'ADMIN' });
    lider = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipe.id });
    colaborador = await cenario.criarPessoa({ equipeId: equipe.id });
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('conversão de datas', () => {
    it('trata a data como dia do calendário, sem escorregar por causa do fuso', () => {
      expect(paraDataDoContrato(paraDataDoBanco('2099-03-01'))).toBe('2099-03-01');
      expect(paraDataDoBanco('2099-03-01').toISOString()).toBe('2099-03-01T00:00:00.000Z');
    });
  });

  describe('POST /gincanas', () => {
    it('a administradora cadastra a gincana com o período e ela nasce planejada', async () => {
      const ano = await cenario.anoLivre();

      const resposta = await request(app)
        .post('/gincanas')
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({
          ano,
          nome: `Gincana ${cenario.marca} criada`,
          dataInicio: '2099-03-01',
          dataFim: '2099-11-30',
        });

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({
        ano,
        nome: `Gincana ${cenario.marca} criada`,
        dataInicio: '2099-03-01',
        dataFim: '2099-11-30',
        status: 'PLANEJADA',
      });
    });

    it('devolve 409 em português quando o ano já está cadastrado', async () => {
      const existente = await cenario.criarGincana();

      const resposta = await request(app)
        .post('/gincanas')
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({
          ano: existente.ano,
          nome: `Gincana ${cenario.marca} repetida`,
          dataInicio: '2099-03-01',
          dataFim: '2099-11-30',
        });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('ANO_JA_CADASTRADO');
      expect(resposta.body.erro.mensagem).toBe(
        `Já existe uma gincana cadastrada para o ano de ${existente.ano}.`,
      );
    });

    it('devolve 400 quando o término é anterior ao início', async () => {
      const resposta = await request(app)
        .post('/gincanas')
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({
          ano: await cenario.anoLivre(),
          nome: `Gincana ${cenario.marca} invertida`,
          dataInicio: '2099-11-30',
          dataFim: '2099-03-01',
        });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
      expect(resposta.body.erro.detalhes.dataFim).toEqual([
        'A data de término não pode ser anterior à de início.',
      ]);
    });

    it('devolve 403 para líder e colaborador, e 401 sem token', async () => {
      const corpo = {
        ano: await cenario.anoLivre(),
        nome: `Gincana ${cenario.marca} proibida`,
        dataInicio: '2099-03-01',
        dataFim: '2099-11-30',
      };

      for (const pessoa of [lider, colaborador]) {
        const resposta = await request(app)
          .post('/gincanas')
          .set('Authorization', `Bearer ${pessoa.token}`)
          .send(corpo);

        expect(resposta.status).toBe(403);
        expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
      }

      const semToken = await request(app).post('/gincanas').send(corpo);
      expect(semToken.status).toBe(401);
    });
  });

  describe('GET /gincanas', () => {
    it('qualquer perfil autenticado lista as gincanas', async () => {
      const gincana = await cenario.criarGincana();

      for (const pessoa of [administradora, lider, colaborador]) {
        const resposta = await request(app)
          .get('/gincanas')
          .set('Authorization', `Bearer ${pessoa.token}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.map((item: { id: string }) => item.id)).toContain(gincana.id);
      }
    });

    it('devolve 401 sem token', async () => {
      await request(app).get('/gincanas').expect(401);
    });
  });

  describe('GET /gincanas/:id', () => {
    it('devolve a gincana pedida', async () => {
      const gincana = await cenario.criarGincana();

      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}`)
        .set('Authorization', `Bearer ${colaborador.token}`);

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({ id: gincana.id, ano: gincana.ano });
    });

    it('devolve 404 para gincana inexistente e 400 para identificador inválido', async () => {
      const inexistente = await request(app)
        .get(`/gincanas/${ID_INEXISTENTE}`)
        .set('Authorization', `Bearer ${colaborador.token}`);
      const invalido = await request(app)
        .get('/gincanas/nao-e-uuid')
        .set('Authorization', `Bearer ${colaborador.token}`);

      expect(inexistente.status).toBe(404);
      expect(inexistente.body.erro.mensagem).toBe('Gincana não encontrada.');
      expect(invalido.status).toBe(400);
    });
  });

  describe('PATCH /gincanas/:id', () => {
    it('altera nome e status', async () => {
      const gincana = await cenario.criarGincana();

      const resposta = await request(app)
        .patch(`/gincanas/${gincana.id}`)
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({ nome: `Gincana ${cenario.marca} renomeada`, status: 'ATIVA' });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        nome: `Gincana ${cenario.marca} renomeada`,
        status: 'ATIVA',
      });
    });

    it('confere a data que falta contra a que está no banco', async () => {
      const gincana = await cenario.criarGincana();

      const soFim = await request(app)
        .patch(`/gincanas/${gincana.id}`)
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({ dataFim: '2099-01-15' });

      expect(soFim.status).toBe(400);
      expect(soFim.body.erro.detalhes.dataFim).toEqual([
        'A data de término não pode ser anterior à de início.',
      ]);

      const soInicio = await request(app)
        .patch(`/gincanas/${gincana.id}`)
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({ dataInicio: '2099-12-20' });

      expect(soInicio.status).toBe(400);

      const valida = await request(app)
        .patch(`/gincanas/${gincana.id}`)
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({ dataFim: '2099-12-20' });

      expect(valida.status).toBe(200);
      expect(valida.body).toMatchObject({ dataInicio: '2099-03-01', dataFim: '2099-12-20' });
    });

    it('devolve 404 para gincana inexistente e 403 para quem não é a administradora', async () => {
      const gincana = await cenario.criarGincana();

      const inexistente = await request(app)
        .patch(`/gincanas/${ID_INEXISTENTE}`)
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({ nome: 'Qualquer nome' });
      expect(inexistente.status).toBe(404);

      for (const pessoa of [lider, colaborador]) {
        const resposta = await request(app)
          .patch(`/gincanas/${gincana.id}`)
          .set('Authorization', `Bearer ${pessoa.token}`)
          .send({ status: 'ENCERRADA' });

        expect(resposta.status).toBe(403);
      }
    });

    it('devolve 400 quando o corpo vem vazio', async () => {
      const gincana = await cenario.criarGincana();

      const resposta = await request(app)
        .patch(`/gincanas/${gincana.id}`)
        .set('Authorization', `Bearer ${administradora.token}`)
        .send({});

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    });
  });
});
