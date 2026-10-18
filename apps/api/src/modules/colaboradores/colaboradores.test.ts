import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
import { prisma } from '../../db.js';
import {
  criarCenarioDeCadastro,
  SENHA_DE_TESTE,
  type CenarioDeCadastro,
  type EquipeDeTeste,
  type PessoaDeTeste,
} from '../../testes/cadastro.fixtures.js';

import { atualizarColaborador } from './service.js';

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

async function auditoriasDe(entidadeId: string) {
  return prisma.registroAuditoria.findMany({
    where: { entidade: 'Colaborador', entidadeId },
    orderBy: { criadoEm: 'asc' },
  });
}

describe('US03 — cadastro de colaboradores', () => {
  let cenario: CenarioDeCadastro;
  let equipe: EquipeDeTeste;
  let administradora: PessoaDeTeste;
  let lider: PessoaDeTeste;
  let colaborador: PessoaDeTeste;
  let comoAdmin: string;

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    const gincana = await cenario.criarGincana();
    equipe = await cenario.criarEquipe(gincana.id);

    administradora = await cenario.criarPessoa({ papel: 'ADMIN' });
    lider = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipe.id });
    colaborador = await cenario.criarPessoa({ equipeId: equipe.id });
    comoAdmin = `Bearer ${administradora.token}`;
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('POST /colaboradores', () => {
    it('cadastra guardando só o hash da senha, com o custo do projeto', async () => {
      const email = cenario.emailDeTeste('novo');

      const resposta = await request(app)
        .post('/colaboradores')
        .set('Authorization', comoAdmin)
        .send({ nome: 'Pessoa recém-cadastrada', email, senha: SENHA_DE_TESTE });

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({
        nome: 'Pessoa recém-cadastrada',
        email,
        papel: 'COLABORADOR',
        ativo: true,
        equipe: null,
      });

      const guardado = await prisma.colaborador.findUniqueOrThrow({ where: { email } });
      expect(guardado.senhaHash).not.toBe(SENHA_DE_TESTE);
      expect(guardado.senhaHash).toMatch(/^\$2[aby]\$10\$/);
      expect(await bcrypt.compare(SENHA_DE_TESTE, guardado.senhaHash)).toBe(true);
    });

    it('nunca devolve senha nem hash na resposta', async () => {
      const resposta = await request(app)
        .post('/colaboradores')
        .set('Authorization', comoAdmin)
        .send({
          nome: 'Pessoa discreta',
          email: cenario.emailDeTeste('discreta'),
          senha: SENHA_DE_TESTE,
        });

      const corpo = JSON.stringify(resposta.body);
      expect(corpo).not.toContain('senha');
      expect(corpo).not.toContain(SENHA_DE_TESTE);
    });

    it('já vincula à equipe quando o identificador vem no cadastro', async () => {
      const resposta = await request(app)
        .post('/colaboradores')
        .set('Authorization', comoAdmin)
        .send({
          nome: 'Pessoa com equipe',
          email: cenario.emailDeTeste('com-equipe'),
          senha: SENHA_DE_TESTE,
          equipeId: equipe.id,
        });

      expect(resposta.status).toBe(201);
      expect(resposta.body.equipe).toEqual({ id: equipe.id, nome: equipe.nome });
    });

    it('devolve 409 quando o e-mail já está cadastrado', async () => {
      const resposta = await request(app)
        .post('/colaboradores')
        .set('Authorization', comoAdmin)
        .send({
          nome: 'Pessoa repetida',
          email: colaborador.email,
          senha: SENHA_DE_TESTE,
        });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('EMAIL_JA_CADASTRADO');
      expect(resposta.body.erro.mensagem).toBe('Já existe um colaborador com este e-mail.');
    });

    it('devolve 404 quando a equipe informada não existe', async () => {
      const resposta = await request(app)
        .post('/colaboradores')
        .set('Authorization', comoAdmin)
        .send({
          nome: 'Pessoa sem equipe válida',
          email: cenario.emailDeTeste('equipe-fantasma'),
          senha: SENHA_DE_TESTE,
          equipeId: ID_INEXISTENTE,
        });

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Equipe não encontrada.');
    });

    it('devolve 400 quando a senha não atende à regra do protótipo', async () => {
      const resposta = await request(app)
        .post('/colaboradores')
        .set('Authorization', comoAdmin)
        .send({
          nome: 'Pessoa com senha fraca',
          email: cenario.emailDeTeste('senha-fraca'),
          senha: 'curta',
        });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
      expect(resposta.body.erro.detalhes.senha).toBeDefined();
    });

    it('devolve 403 para líder e colaborador, e 401 sem token', async () => {
      for (const pessoa of [lider, colaborador]) {
        const resposta = await request(app)
          .post('/colaboradores')
          .set('Authorization', `Bearer ${pessoa.token}`)
          .send({
            nome: 'Pessoa proibida',
            email: cenario.emailDeTeste(`proibida-${pessoa.id.slice(0, 4)}`),
            senha: SENHA_DE_TESTE,
          });

        expect(resposta.status).toBe(403);
        expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
      }

      const semToken = await request(app)
        .post('/colaboradores')
        .send({
          nome: 'Pessoa sem token',
          email: cenario.emailDeTeste('sem-token'),
          senha: SENHA_DE_TESTE,
        });
      expect(semToken.status).toBe(401);
    });
  });

  describe('GET /colaboradores', () => {
    it('filtra por equipe e por papel', async () => {
      const porEquipe = await request(app)
        .get(`/colaboradores?equipeId=${equipe.id}`)
        .set('Authorization', comoAdmin);

      expect(porEquipe.status).toBe(200);
      const idsDaEquipe = porEquipe.body.map((pessoa: { id: string }) => pessoa.id);
      expect(idsDaEquipe).toContain(colaborador.id);
      expect(idsDaEquipe).toContain(lider.id);
      expect(idsDaEquipe).not.toContain(administradora.id);

      const porPapel = await request(app)
        .get(`/colaboradores?equipeId=${equipe.id}&papel=LIDER`)
        .set('Authorization', comoAdmin);

      expect(porPapel.body.map((pessoa: { id: string }) => pessoa.id)).toEqual([lider.id]);
    });

    it('não devolve senha nem hash de senha', async () => {
      const resposta = await request(app)
        .get(`/colaboradores?equipeId=${equipe.id}`)
        .set('Authorization', comoAdmin);

      expect(JSON.stringify(resposta.body)).not.toContain('senha');
    });

    it('devolve 400 para filtro malformado', async () => {
      const resposta = await request(app)
        .get('/colaboradores?equipeId=nao-e-uuid')
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(400);
    });

    it('devolve 403 para líder e colaborador, e 401 sem token', async () => {
      for (const pessoa of [lider, colaborador]) {
        const resposta = await request(app)
          .get('/colaboradores')
          .set('Authorization', `Bearer ${pessoa.token}`);

        expect(resposta.status).toBe(403);
      }

      await request(app).get('/colaboradores').expect(401);
    });
  });

  describe('PATCH /colaboradores/:id', () => {
    it('muda o nome sem gerar auditoria: isso não explica placar nenhum', async () => {
      const pessoa = await cenario.criarPessoa();

      const resposta = await request(app)
        .patch(`/colaboradores/${pessoa.id}`)
        .set('Authorization', comoAdmin)
        .send({ nome: 'Nome corrigido' });

      expect(resposta.status).toBe(200);
      expect(resposta.body.nome).toBe('Nome corrigido');
      expect(await auditoriasDe(pessoa.id)).toHaveLength(0);
    });

    it('registra a mudança de papel com autor e valores antes e depois', async () => {
      const pessoa = await cenario.criarPessoa();

      const resposta = await request(app)
        .patch(`/colaboradores/${pessoa.id}`)
        .set('Authorization', comoAdmin)
        .send({ papel: 'ADMIN' });

      expect(resposta.status).toBe(200);
      expect(resposta.body.papel).toBe('ADMIN');

      const auditoria = await auditoriasDe(pessoa.id);
      expect(auditoria).toHaveLength(1);
      expect(auditoria[0]).toMatchObject({ acao: 'ALTERACAO', autorId: administradora.id });
      expect(auditoria[0]?.valoresAntes).toEqual({ papel: 'COLABORADOR' });
      expect(auditoria[0]?.valoresDepois).toEqual({ papel: 'ADMIN' });
    });

    it('registra a mudança de equipe', async () => {
      const pessoa = await cenario.criarPessoa({ equipeId: null });

      const resposta = await request(app)
        .patch(`/colaboradores/${pessoa.id}`)
        .set('Authorization', comoAdmin)
        .send({ equipeId: equipe.id });

      expect(resposta.status).toBe(200);
      expect(resposta.body.equipe).toEqual({ id: equipe.id, nome: equipe.nome });

      const auditoria = await auditoriasDe(pessoa.id);
      expect(auditoria[0]?.valoresAntes).toEqual({ equipeId: null });
      expect(auditoria[0]?.valoresDepois).toEqual({ equipeId: equipe.id });
    });

    it('registra a desativação do colaborador', async () => {
      const pessoa = await cenario.criarPessoa({ equipeId: equipe.id });

      const resposta = await request(app)
        .patch(`/colaboradores/${pessoa.id}`)
        .set('Authorization', comoAdmin)
        .send({ ativo: false });

      expect(resposta.status).toBe(200);
      expect(resposta.body.ativo).toBe(false);

      const auditoria = await auditoriasDe(pessoa.id);
      expect(auditoria).toHaveLength(1);
      expect(auditoria[0]?.valoresAntes).toEqual({ ativo: true });
      expect(auditoria[0]?.valoresDepois).toEqual({ ativo: false });
      expect(auditoria[0]?.descricao).toContain('desativação');
      expect(auditoria[0]?.autorId).toBe(administradora.id);
    });

    it('recusa mexer em quem lidera equipe antes da troca de líder', async () => {
      const outraEquipe = await cenario.criarEquipe(equipe.gincanaId);
      const quemLidera = await cenario.criarPessoa({
        papel: 'LIDER',
        lideraEquipeId: outraEquipe.id,
      });

      const tentativas = [
        { ativo: false },
        { equipeId: equipe.id },
        { papel: 'COLABORADOR' as const },
      ];

      for (const corpo of tentativas) {
        const resposta = await request(app)
          .patch(`/colaboradores/${quemLidera.id}`)
          .set('Authorization', comoAdmin)
          .send(corpo);

        expect(resposta.status).toBe(409);
        expect(resposta.body.erro.codigo).toBe('LIDERA_EQUIPE');
        expect(resposta.body.erro.mensagem).toContain(outraEquipe.nome);
      }

      const intacta = await prisma.colaborador.findUniqueOrThrow({ where: { id: quemLidera.id } });
      expect(intacta.ativo).toBe(true);
      expect(intacta.papel).toBe('LIDER');
      expect(intacta.equipeId).toBe(outraEquipe.id);
    });

    it('recusa vincular a uma equipe quem está desativado', async () => {
      const pessoa = await cenario.criarPessoa({ ativo: false, equipeId: null });

      const resposta = await request(app)
        .patch(`/colaboradores/${pessoa.id}`)
        .set('Authorization', comoAdmin)
        .send({ equipeId: equipe.id });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('COLABORADOR_INATIVO');
    });

    it('devolve 404 para colaborador e para equipe inexistentes', async () => {
      const pessoa = await cenario.criarPessoa({ equipeId: null });

      const semPessoa = await request(app)
        .patch(`/colaboradores/${ID_INEXISTENTE}`)
        .set('Authorization', comoAdmin)
        .send({ nome: 'Quem quer que seja' });
      expect(semPessoa.status).toBe(404);
      expect(semPessoa.body.erro.mensagem).toBe('Colaborador não encontrado.');

      const semEquipe = await request(app)
        .patch(`/colaboradores/${pessoa.id}`)
        .set('Authorization', comoAdmin)
        .send({ equipeId: ID_INEXISTENTE });
      expect(semEquipe.status).toBe(404);
      expect(semEquipe.body.erro.mensagem).toBe('Equipe não encontrada.');
    });

    it('devolve 403 para líder e colaborador', async () => {
      const pessoa = await cenario.criarPessoa();

      for (const quem of [lider, colaborador]) {
        const resposta = await request(app)
          .patch(`/colaboradores/${pessoa.id}`)
          .set('Authorization', `Bearer ${quem.token}`)
          .send({ papel: 'ADMIN' });

        expect(resposta.status).toBe(403);
      }

      const intacta = await prisma.colaborador.findUniqueOrThrow({ where: { id: pessoa.id } });
      expect(intacta.papel).toBe('COLABORADOR');
    });

    it('desfaz a mudança quando a auditoria falha', async () => {
      const pessoa = await cenario.criarPessoa();

      // Autor inexistente derruba a gravação da auditoria pela chave estrangeira.
      await expect(
        atualizarColaborador(pessoa.id, { papel: 'ADMIN' }, ID_INEXISTENTE),
      ).rejects.toThrow();

      const intacta = await prisma.colaborador.findUniqueOrThrow({ where: { id: pessoa.id } });
      expect(intacta.papel).toBe('COLABORADOR');
      expect(await auditoriasDe(pessoa.id)).toHaveLength(0);
    });
  });
});
