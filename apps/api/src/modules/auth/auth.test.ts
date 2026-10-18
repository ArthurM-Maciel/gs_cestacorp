import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
import { prisma } from '../../db.js';
import { env } from '../../env.js';

import { criarCenario, type CenarioDeTeste, type PessoaDeTeste } from './auth.fixtures.js';

const app = criarApp();

describe('POST /auth/login', () => {
  let cenario: CenarioDeTeste;
  let colaborador: PessoaDeTeste;
  let lider: PessoaDeTeste;
  let administradora: PessoaDeTeste;
  let desativado: PessoaDeTeste;

  beforeAll(async () => {
    cenario = await criarCenario();
    colaborador = await cenario.criarPessoa({ papel: 'COLABORADOR' });
    lider = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipe: true });
    administradora = await cenario.criarPessoa({ papel: 'ADMIN', naEquipe: false });
    desativado = await cenario.criarPessoa({ ativo: false });
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  it('entra com perfil de colaborador, de líder e de administradora', async () => {
    for (const [pessoa, papel] of [
      [colaborador, 'COLABORADOR'],
      [lider, 'LIDER'],
      [administradora, 'ADMIN'],
    ] as const) {
      const resposta = await request(app)
        .post('/auth/login')
        .send({ email: pessoa.email, senha: pessoa.senha });

      expect(resposta.status).toBe(200);
      expect(typeof resposta.body.token).toBe('string');
      expect(resposta.body.usuario).toMatchObject({ id: pessoa.id, email: pessoa.email, papel });
    }
  });

  it('só o líder recebe a equipe liderada preenchida', async () => {
    const respostaLider = await request(app)
      .post('/auth/login')
      .send({ email: lider.email, senha: lider.senha });
    const respostaColaborador = await request(app)
      .post('/auth/login')
      .send({ email: colaborador.email, senha: colaborador.senha });

    expect(respostaLider.body.usuario.equipeLideradaId).toBe(cenario.equipeId);
    expect(respostaColaborador.body.usuario.equipeLideradaId).toBeNull();
    expect(respostaColaborador.body.usuario.equipeId).toBe(cenario.equipeId);
  });

  it('nunca devolve senha nem hash de senha no corpo da resposta', async () => {
    const resposta = await request(app)
      .post('/auth/login')
      .send({ email: colaborador.email, senha: colaborador.senha });

    const corpo = JSON.stringify(resposta.body);
    expect(corpo).not.toContain('senhaHash');
    expect(corpo).not.toContain('senha');
    expect(corpo).not.toContain(colaborador.senha);
    expect(resposta.body.usuario.senhaHash).toBeUndefined();
  });

  it('devolve 401 com a mesma mensagem para senha errada e para e-mail inexistente', async () => {
    const senhaErrada = await request(app)
      .post('/auth/login')
      .send({ email: colaborador.email, senha: 'Senha@Errada1' });
    const emailInexistente = await request(app)
      .post('/auth/login')
      .send({ email: 'us01-ninguem@teste.invalido', senha: colaborador.senha });

    expect(senhaErrada.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    expect(senhaErrada.body.erro.codigo).toBe('NAO_AUTENTICADO');
    expect(emailInexistente.body.erro).toEqual(senhaErrada.body.erro);
    expect(senhaErrada.body.erro.mensagem).toBe('E-mail ou senha incorretos.');
  });

  it('devolve 401 para quem está desativado, sem dizer que a conta existe', async () => {
    const resposta = await request(app)
      .post('/auth/login')
      .send({ email: desativado.email, senha: desativado.senha });

    expect(resposta.status).toBe(401);
    expect(resposta.body.erro.mensagem).toBe('E-mail ou senha incorretos.');
  });

  it('devolve 400 com detalhes por campo quando o corpo é inválido', async () => {
    const resposta = await request(app).post('/auth/login').send({ email: 'nao-e-email' });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(resposta.body.erro.detalhes).toMatchObject({
      email: ['Informe um e-mail válido.'],
      senha: expect.any(Array),
    });
  });
});

describe('GET /auth/me', () => {
  let cenario: CenarioDeTeste;
  let pessoa: PessoaDeTeste;
  let token: string;

  beforeAll(async () => {
    cenario = await criarCenario();
    pessoa = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipe: true });

    const login = await request(app)
      .post('/auth/login')
      .send({ email: pessoa.email, senha: pessoa.senha });
    token = login.body.token;
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  it('devolve o usuário atual com token válido', async () => {
    const resposta = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({
      id: pessoa.id,
      nome: pessoa.nome,
      email: pessoa.email,
      papel: 'LIDER',
      equipeId: cenario.equipeId,
      equipeLideradaId: cenario.equipeId,
    });
  });

  it('devolve 401 sem token, com cabeçalho malformado ou com esquema errado', async () => {
    const semToken = await request(app).get('/auth/me');
    const semEsquema = await request(app).get('/auth/me').set('Authorization', token);
    const outroEsquema = await request(app).get('/auth/me').set('Authorization', `Basic ${token}`);

    for (const resposta of [semToken, semEsquema, outroEsquema]) {
      expect(resposta.status).toBe(401);
      expect(resposta.body.erro.codigo).toBe('NAO_AUTENTICADO');
    }
  });

  it('devolve 401 com token adulterado, expirado ou assinado por outro segredo', async () => {
    const adulterado = `${token.slice(0, -2)}xy`;
    const expirado = jwt.sign(
      { sub: pessoa.id, papel: 'LIDER', equipeLideradaId: cenario.equipeId },
      env.JWT_SECRET,
      { expiresIn: '-1h' },
    );
    const outroSegredo = jwt.sign(
      { sub: pessoa.id, papel: 'ADMIN', equipeLideradaId: null },
      'um-segredo-diferente-com-mais-de-32-caracteres',
    );

    for (const invalido of [adulterado, expirado, outroSegredo]) {
      const resposta = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${invalido}`);

      expect(resposta.status).toBe(401);
      expect(resposta.body.erro.codigo).toBe('NAO_AUTENTICADO');
    }
  });

  it('não confia no papel gravado no token: o usuário vem recarregado do banco', async () => {
    const tokenForjado = jwt.sign(
      { sub: pessoa.id, papel: 'ADMIN', equipeLideradaId: null },
      env.JWT_SECRET,
      { expiresIn: '8h' },
    );

    const resposta = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenForjado}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.papel).toBe('LIDER');
    expect(resposta.body.equipeLideradaId).toBe(cenario.equipeId);
  });

  it('derruba a sessão de quem foi desativado depois de entrar', async () => {
    const outroCenario = await criarCenario();
    const demitido = await outroCenario.criarPessoa();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: demitido.email, senha: demitido.senha });

    await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    await prisma.colaborador.update({ where: { id: demitido.id }, data: { ativo: false } });

    const depois = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(depois.status).toBe(401);

    await outroCenario.limpar();
  });
});
