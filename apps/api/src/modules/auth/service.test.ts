import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../../env.js';
import { ErroDaAplicacao } from '../../middlewares/erros.js';

import { criarCenario, type CenarioDeTeste } from './auth.fixtures.js';
import { autenticar, carregarUsuarioAutenticado, montarUsuarioAutenticado } from './service.js';
import { assinarToken, conteudoDoTokenSchema, verificarToken } from './token.js';

describe('montarUsuarioAutenticado', () => {
  const base = {
    id: '7b1f6f3c-0f4a-4a9f-9a1a-6a3b2c1d0e9f',
    nome: 'Pessoa de teste',
    email: 'us01-base@teste.invalido',
    papel: 'LIDER' as const,
    ativo: true,
    equipeId: '2f4e6a8c-1b3d-4f5a-8c7e-9d0b1a2c3d4e',
  };

  it('traz o id da equipe liderada quando a pessoa lidera', () => {
    const usuario = montarUsuarioAutenticado({
      ...base,
      equipeLiderada: { id: '3c5d7e9f-2a4b-4c6d-8e0f-1a2b3c4d5e6f' },
    });

    expect(usuario.equipeLideradaId).toBe('3c5d7e9f-2a4b-4c6d-8e0f-1a2b3c4d5e6f');
    expect(usuario.papel).toBe('LIDER');
  });

  it('deixa a equipe liderada nula para quem não lidera', () => {
    const usuario = montarUsuarioAutenticado({
      ...base,
      papel: 'COLABORADOR',
      equipeLiderada: null,
    });

    expect(usuario.equipeLideradaId).toBeNull();
  });

  it('não devolve nenhum campo além do contrato do usuário autenticado', () => {
    const usuario = montarUsuarioAutenticado({ ...base, equipeLiderada: null });

    expect(Object.keys(usuario).sort()).toEqual([
      'email',
      'equipeId',
      'equipeLideradaId',
      'id',
      'nome',
      'papel',
    ]);
  });
});

describe('token', () => {
  const usuario = {
    id: '7b1f6f3c-0f4a-4a9f-9a1a-6a3b2c1d0e9f',
    nome: 'Pessoa de teste',
    email: 'us01-token@teste.invalido',
    papel: 'LIDER' as const,
    equipeId: '2f4e6a8c-1b3d-4f5a-8c7e-9d0b1a2c3d4e',
    equipeLideradaId: '2f4e6a8c-1b3d-4f5a-8c7e-9d0b1a2c3d4e',
  };

  it('carrega id, papel e equipe liderada, e expira em 8 horas', () => {
    const conteudo = jwt.verify(assinarToken(usuario), env.JWT_SECRET);
    const analisado = conteudoDoTokenSchema.parse(conteudo);

    expect(analisado.sub).toBe(usuario.id);
    expect(analisado.papel).toBe('LIDER');
    expect(analisado.equipeLideradaId).toBe(usuario.equipeLideradaId);

    const { exp, iat } = conteudo as { exp: number; iat: number };
    expect(exp - iat).toBe(8 * 60 * 60);
  });

  it('não leva nome nem e-mail no conteúdo, que viaja apenas assinado', () => {
    const conteudo = jwt.verify(assinarToken(usuario), env.JWT_SECRET) as Record<string, unknown>;

    expect(conteudo.nome).toBeUndefined();
    expect(conteudo.email).toBeUndefined();
  });

  it('recusa token adulterado, expirado ou assinado com outro segredo', () => {
    const valido = assinarToken(usuario);

    expect(verificarToken(valido)?.sub).toBe(usuario.id);
    expect(verificarToken(`${valido}x`)).toBeNull();
    expect(verificarToken('nem-parece-um-token')).toBeNull();
    expect(
      verificarToken(
        jwt.sign(
          { sub: usuario.id, papel: 'ADMIN', equipeLideradaId: null },
          'outro-segredo-qualquer-com-32-caracteres',
        ),
      ),
    ).toBeNull();
    expect(
      verificarToken(
        jwt.sign({ sub: usuario.id, papel: 'LIDER', equipeLideradaId: null }, env.JWT_SECRET, {
          expiresIn: '-1h',
        }),
      ),
    ).toBeNull();
  });

  it('recusa token válido na assinatura mas com conteúdo fora do formato', () => {
    const token = jwt.sign({ sub: 'nao-e-uuid', papel: 'CHEFE' }, env.JWT_SECRET);

    expect(verificarToken(token)).toBeNull();
  });
});

describe('autenticar', () => {
  let cenario: CenarioDeTeste;

  beforeAll(async () => {
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  it('devolve token e usuário quando a credencial está correta', async () => {
    const pessoa = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipe: true });

    const resultado = await autenticar({ email: pessoa.email, senha: pessoa.senha });

    expect(resultado.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(resultado.usuario).toMatchObject({
      id: pessoa.id,
      email: pessoa.email,
      papel: 'LIDER',
      equipeId: cenario.equipeId,
      equipeLideradaId: cenario.equipeId,
    });
    expect(JSON.stringify(resultado)).not.toContain('senhaHash');
  });

  it('aceita o e-mail digitado com maiúsculas e espaços', async () => {
    const pessoa = await cenario.criarPessoa();

    const resultado = await autenticar({
      email: `  ${pessoa.email.toUpperCase()} `,
      senha: pessoa.senha,
    });

    expect(resultado.usuario.id).toBe(pessoa.id);
  });

  it('usa a mesma mensagem para senha errada e para e-mail inexistente', async () => {
    const pessoa = await cenario.criarPessoa();

    const comSenhaErrada = await autenticar({
      email: pessoa.email,
      senha: 'Senha@Errada1',
    }).catch((erro: unknown) => erro);
    const comEmailInexistente = await autenticar({
      email: 'us01-ninguem@teste.invalido',
      senha: pessoa.senha,
    }).catch((erro: unknown) => erro);

    expect(comSenhaErrada).toBeInstanceOf(ErroDaAplicacao);
    expect(comEmailInexistente).toBeInstanceOf(ErroDaAplicacao);
    expect((comSenhaErrada as ErroDaAplicacao).status).toBe(401);
    expect((comEmailInexistente as ErroDaAplicacao).message).toBe(
      (comSenhaErrada as ErroDaAplicacao).message,
    );
    expect((comSenhaErrada as ErroDaAplicacao).message).toBe('E-mail ou senha incorretos.');
  });

  it('recusa quem está desativado, mesmo com a senha certa', async () => {
    const pessoa = await cenario.criarPessoa({ ativo: false });

    await expect(autenticar({ email: pessoa.email, senha: pessoa.senha })).rejects.toMatchObject({
      status: 401,
      codigo: 'NAO_AUTENTICADO',
      message: 'E-mail ou senha incorretos.',
    });
  });
});

describe('carregarUsuarioAutenticado', () => {
  let cenario: CenarioDeTeste;

  beforeAll(async () => {
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  it('devolve o estado atual do colaborador', async () => {
    const pessoa = await cenario.criarPessoa({ papel: 'ADMIN' });

    await expect(carregarUsuarioAutenticado(pessoa.id)).resolves.toMatchObject({
      id: pessoa.id,
      papel: 'ADMIN',
    });
  });

  it('recusa id desconhecido e conta desativada depois da emissão do token', async () => {
    await expect(
      carregarUsuarioAutenticado('11111111-2222-3333-4444-555555555555'),
    ).rejects.toMatchObject({ status: 401 });

    const pessoa = await cenario.criarPessoa({ ativo: false });
    await expect(carregarUsuarioAutenticado(pessoa.id)).rejects.toMatchObject({ status: 401 });
  });
});
