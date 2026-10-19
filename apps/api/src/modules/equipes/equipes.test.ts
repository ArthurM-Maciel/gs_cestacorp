import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
import { prisma } from '../../db.js';
import {
  criarCenarioDeCadastro,
  type CenarioDeCadastro,
  type GincanaDeTeste,
  type PessoaDeTeste,
} from '../../testes/cadastro.fixtures.js';

import { vincularMembros } from './service.js';

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

/** Lê a trilha de auditoria da entidade, da mais antiga para a mais recente. */
async function auditoriasDe(entidade: string, entidadeId: string) {
  return prisma.registroAuditoria.findMany({
    where: { entidade, entidadeId },
    orderBy: { criadoEm: 'asc' },
  });
}

describe('US03 — equipes da gincana', () => {
  let cenario: CenarioDeCadastro;
  let gincana: GincanaDeTeste;
  let administradora: PessoaDeTeste;
  let lider: PessoaDeTeste;
  let colaborador: PessoaDeTeste;
  let comoAdmin: string;

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    gincana = await cenario.criarGincana();
    const equipeDosPerfis = await cenario.criarEquipe(gincana.id);

    administradora = await cenario.criarPessoa({ papel: 'ADMIN' });
    lider = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipeDosPerfis.id });
    colaborador = await cenario.criarPessoa({ equipeId: equipeDosPerfis.id });
    comoAdmin = `Bearer ${administradora.token}`;
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('POST /gincanas/:gincanaId/equipes', () => {
    it('cadastra a equipe na gincana', async () => {
      const resposta = await request(app)
        .post(`/gincanas/${gincana.id}/equipes`)
        .set('Authorization', comoAdmin)
        .send({ nome: `Equipe azul ${cenario.marca}` });

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({
        nome: `Equipe azul ${cenario.marca}`,
        gincanaId: gincana.id,
        lider: null,
        totalMembros: 0,
      });
    });

    it('já nasce com líder quando o identificador vem no cadastro', async () => {
      const pessoa = await cenario.criarPessoa();

      const resposta = await request(app)
        .post(`/gincanas/${gincana.id}/equipes`)
        .set('Authorization', comoAdmin)
        .send({ nome: `Equipe com líder ${cenario.marca}`, liderId: pessoa.id });

      expect(resposta.status).toBe(201);
      expect(resposta.body.lider).toEqual({ id: pessoa.id, nome: pessoa.nome });

      const promovida = await prisma.colaborador.findUniqueOrThrow({ where: { id: pessoa.id } });
      expect(promovida.papel).toBe('LIDER');
      expect(promovida.equipeId).toBe(resposta.body.id);
    });

    it('devolve 404 quando a gincana não existe', async () => {
      const resposta = await request(app)
        .post(`/gincanas/${ID_INEXISTENTE}/equipes`)
        .set('Authorization', comoAdmin)
        .send({ nome: `Equipe órfã ${cenario.marca}` });

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Gincana não encontrada.');
    });

    it('devolve 409 quando o nome se repete na mesma gincana', async () => {
      const nome = `Equipe repetida ${cenario.marca}`;
      await cenario.criarEquipe(gincana.id, nome);

      const resposta = await request(app)
        .post(`/gincanas/${gincana.id}/equipes`)
        .set('Authorization', comoAdmin)
        .send({ nome });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('NOME_DE_EQUIPE_DUPLICADO');
      expect(resposta.body.erro.mensagem).toContain(nome);
    });

    it('aceita o mesmo nome de equipe em outra gincana', async () => {
      const outra = await cenario.criarGincana();
      const nome = `Equipe homônima ${cenario.marca}`;
      await cenario.criarEquipe(gincana.id, nome);

      const resposta = await request(app)
        .post(`/gincanas/${outra.id}/equipes`)
        .set('Authorization', comoAdmin)
        .send({ nome });

      expect(resposta.status).toBe(201);
    });

    it('devolve 403 para líder e colaborador, e 401 sem token', async () => {
      for (const pessoa of [lider, colaborador]) {
        const resposta = await request(app)
          .post(`/gincanas/${gincana.id}/equipes`)
          .set('Authorization', `Bearer ${pessoa.token}`)
          .send({ nome: `Equipe proibida ${cenario.marca}` });

        expect(resposta.status).toBe(403);
      }

      const semToken = await request(app)
        .post(`/gincanas/${gincana.id}/equipes`)
        .send({ nome: `Equipe sem token ${cenario.marca}` });
      expect(semToken.status).toBe(401);
    });
  });

  describe('definição de líder', () => {
    it('devolve 409 dizendo qual equipe a pessoa já lidera', async () => {
      const equipeAtual = await cenario.criarEquipe(gincana.id);
      const pessoa = await cenario.criarPessoa({
        papel: 'LIDER',
        lideraEquipeId: equipeAtual.id,
      });
      const outra = await cenario.criarEquipe(gincana.id);

      const resposta = await request(app)
        .patch(`/equipes/${outra.id}`)
        .set('Authorization', comoAdmin)
        .send({ liderId: pessoa.id });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('JA_LIDERA_OUTRA_EQUIPE');
      expect(resposta.body.erro.mensagem).toContain(equipeAtual.nome);
    });

    it('devolve 409 para quem está desativado e 404 para quem não existe', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const desativado = await cenario.criarPessoa({ ativo: false });

      const inativo = await request(app)
        .patch(`/equipes/${equipe.id}`)
        .set('Authorization', comoAdmin)
        .send({ liderId: desativado.id });
      expect(inativo.status).toBe(409);
      expect(inativo.body.erro.codigo).toBe('COLABORADOR_INATIVO');

      const inexistente = await request(app)
        .patch(`/equipes/${equipe.id}`)
        .set('Authorization', comoAdmin)
        .send({ liderId: ID_INEXISTENTE });
      expect(inexistente.status).toBe(404);
      expect(inexistente.body.erro.mensagem).toBe('Colaborador não encontrado.');
    });

    it('troca o líder, devolve o anterior a colaborador e registra as duas pontas', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const antigo = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipe.id });
      const novo = await cenario.criarPessoa();

      const resposta = await request(app)
        .patch(`/equipes/${equipe.id}`)
        .set('Authorization', comoAdmin)
        .send({ liderId: novo.id });

      expect(resposta.status).toBe(200);
      expect(resposta.body.lider).toEqual({ id: novo.id, nome: novo.nome });

      const anterior = await prisma.colaborador.findUniqueOrThrow({ where: { id: antigo.id } });
      const promovido = await prisma.colaborador.findUniqueOrThrow({ where: { id: novo.id } });
      expect(anterior.papel).toBe('COLABORADOR');
      expect(promovido.papel).toBe('LIDER');
      expect(promovido.equipeId).toBe(equipe.id);

      const daEquipe = await auditoriasDe('Equipe', equipe.id);
      expect(daEquipe).toHaveLength(1);
      expect(daEquipe[0]).toMatchObject({ acao: 'ALTERACAO', autorId: administradora.id });
      expect(daEquipe[0]?.valoresAntes).toEqual({ liderId: antigo.id });
      expect(daEquipe[0]?.valoresDepois).toEqual({ liderId: novo.id });

      const doAnterior = await auditoriasDe('Colaborador', antigo.id);
      expect(doAnterior[0]?.valoresAntes).toEqual({ papel: 'LIDER' });
      expect(doAnterior[0]?.valoresDepois).toEqual({ papel: 'COLABORADOR' });

      const doNovo = await auditoriasDe('Colaborador', novo.id);
      expect(doNovo[0]?.valoresAntes).toMatchObject({ papel: 'COLABORADOR' });
      expect(doNovo[0]?.valoresDepois).toMatchObject({ papel: 'LIDER', equipeId: equipe.id });
      expect(doNovo[0]?.autorId).toBe(administradora.id);
    });

    it('tira o líder da equipe quando vem liderId nulo', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const pessoa = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipe.id });

      const resposta = await request(app)
        .patch(`/equipes/${equipe.id}`)
        .set('Authorization', comoAdmin)
        .send({ liderId: null });

      expect(resposta.status).toBe(200);
      expect(resposta.body.lider).toBeNull();

      const antigo = await prisma.colaborador.findUniqueOrThrow({ where: { id: pessoa.id } });
      expect(antigo.papel).toBe('COLABORADOR');
      expect(antigo.equipeId).toBe(equipe.id);

      const daEquipe = await auditoriasDe('Equipe', equipe.id);
      expect(daEquipe[0]?.valoresDepois).toEqual({ liderId: null });
    });
  });

  describe('PATCH /equipes/:id', () => {
    it('renomeia a equipe e recusa nome já usado na gincana', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const vizinha = await cenario.criarEquipe(gincana.id);

      const renomeada = await request(app)
        .patch(`/equipes/${equipe.id}`)
        .set('Authorization', comoAdmin)
        .send({ nome: `Equipe verde ${cenario.marca}` });
      expect(renomeada.status).toBe(200);
      expect(renomeada.body.nome).toBe(`Equipe verde ${cenario.marca}`);

      const duplicada = await request(app)
        .patch(`/equipes/${equipe.id}`)
        .set('Authorization', comoAdmin)
        .send({ nome: vizinha.nome });
      expect(duplicada.status).toBe(409);
      expect(duplicada.body.erro.codigo).toBe('NOME_DE_EQUIPE_DUPLICADO');
    });

    it('devolve 404 para equipe inexistente e 403 para quem não é a administradora', async () => {
      const inexistente = await request(app)
        .patch(`/equipes/${ID_INEXISTENTE}`)
        .set('Authorization', comoAdmin)
        .send({ nome: `Equipe fantasma ${cenario.marca}` });
      expect(inexistente.status).toBe(404);

      const equipe = await cenario.criarEquipe(gincana.id);
      for (const pessoa of [lider, colaborador]) {
        const resposta = await request(app)
          .patch(`/equipes/${equipe.id}`)
          .set('Authorization', `Bearer ${pessoa.token}`)
          .send({ nome: `Equipe tomada ${cenario.marca}` });

        expect(resposta.status).toBe(403);
      }
    });
  });

  describe('GET /gincanas/:gincanaId/equipes', () => {
    it('devolve líder e total de membros, sem contar quem lidera', async () => {
      const outraGincana = await cenario.criarGincana();
      const equipe = await cenario.criarEquipe(outraGincana.id);
      const quemLidera = await cenario.criarPessoa({ lideraEquipeId: equipe.id });
      await cenario.criarPessoa({ equipeId: equipe.id });
      await cenario.criarPessoa({ equipeId: equipe.id });

      const resposta = await request(app)
        .get(`/gincanas/${outraGincana.id}/equipes`)
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(200);
      expect(resposta.body).toHaveLength(1);
      expect(resposta.body[0]).toMatchObject({
        id: equipe.id,
        lider: { id: quemLidera.id, nome: quemLidera.nome },
        totalMembros: 2,
      });
    });

    it('qualquer perfil autenticado consulta, e sem token é 401', async () => {
      for (const pessoa of [administradora, lider, colaborador]) {
        const resposta = await request(app)
          .get(`/gincanas/${gincana.id}/equipes`)
          .set('Authorization', `Bearer ${pessoa.token}`);

        expect(resposta.status).toBe(200);
      }

      await request(app).get(`/gincanas/${gincana.id}/equipes`).expect(401);
    });

    it('devolve 404 quando a gincana não existe', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${ID_INEXISTENTE}/equipes`)
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(404);
    });
  });

  describe('POST /equipes/:id/membros', () => {
    it('vincula colaboradores e registra quem veio de outra equipe', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const origem = await cenario.criarEquipe(gincana.id);
      const semEquipe = await cenario.criarPessoa({ equipeId: null });
      const mudando = await cenario.criarPessoa({ equipeId: origem.id });

      const resposta = await request(app)
        .post(`/equipes/${equipe.id}/membros`)
        .set('Authorization', comoAdmin)
        .send({ colaboradorIds: [semEquipe.id, mudando.id] });

      expect(resposta.status).toBe(200);
      expect(resposta.body.totalMembros).toBe(2);

      const movido = await prisma.colaborador.findUniqueOrThrow({ where: { id: mudando.id } });
      expect(movido.equipeId).toBe(equipe.id);

      const auditoriaDaMudanca = await auditoriasDe('Colaborador', mudando.id);
      expect(auditoriaDaMudanca).toHaveLength(1);
      expect(auditoriaDaMudanca[0]).toMatchObject({
        acao: 'ALTERACAO',
        autorId: administradora.id,
      });
      expect(auditoriaDaMudanca[0]?.valoresAntes).toEqual({ equipeId: origem.id });
      expect(auditoriaDaMudanca[0]?.valoresDepois).toEqual({ equipeId: equipe.id });

      const auditoriaDeEntrada = await auditoriasDe('Colaborador', semEquipe.id);
      expect(auditoriaDeEntrada[0]?.valoresAntes).toEqual({ equipeId: null });
    });

    it('recusa quem está desativado e quem lidera outra equipe', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const desativado = await cenario.criarPessoa({ ativo: false });
      const outraEquipe = await cenario.criarEquipe(gincana.id);
      const lideraOutra = await cenario.criarPessoa({
        papel: 'LIDER',
        lideraEquipeId: outraEquipe.id,
      });

      const inativo = await request(app)
        .post(`/equipes/${equipe.id}/membros`)
        .set('Authorization', comoAdmin)
        .send({ colaboradorIds: [desativado.id] });
      expect(inativo.status).toBe(409);
      expect(inativo.body.erro.codigo).toBe('COLABORADOR_INATIVO');

      const comLider = await request(app)
        .post(`/equipes/${equipe.id}/membros`)
        .set('Authorization', comoAdmin)
        .send({ colaboradorIds: [lideraOutra.id] });
      expect(comLider.status).toBe(409);
      expect(comLider.body.erro.codigo).toBe('LIDERA_OUTRA_EQUIPE');

      const aindaNaOutra = await prisma.colaborador.findUniqueOrThrow({
        where: { id: lideraOutra.id },
      });
      expect(aindaNaOutra.equipeId).toBe(outraEquipe.id);
    });

    it('devolve 404 para equipe ou colaborador inexistente', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const pessoa = await cenario.criarPessoa();

      const semEquipe = await request(app)
        .post(`/equipes/${ID_INEXISTENTE}/membros`)
        .set('Authorization', comoAdmin)
        .send({ colaboradorIds: [pessoa.id] });
      expect(semEquipe.status).toBe(404);

      const semPessoa = await request(app)
        .post(`/equipes/${equipe.id}/membros`)
        .set('Authorization', comoAdmin)
        .send({ colaboradorIds: [pessoa.id, ID_INEXISTENTE] });
      expect(semPessoa.status).toBe(404);

      // Nada foi vinculado: ou entra a lista inteira, ou não entra ninguém.
      const intacta = await prisma.colaborador.findUniqueOrThrow({ where: { id: pessoa.id } });
      expect(intacta.equipeId).toBeNull();
    });

    it('devolve 403 para líder e colaborador', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const pessoa = await cenario.criarPessoa();

      for (const quem of [lider, colaborador]) {
        const resposta = await request(app)
          .post(`/equipes/${equipe.id}/membros`)
          .set('Authorization', `Bearer ${quem.token}`)
          .send({ colaboradorIds: [pessoa.id] });

        expect(resposta.status).toBe(403);
      }
    });

    it('desfaz tudo quando a auditoria falha', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const pessoa = await cenario.criarPessoa({ equipeId: null });

      // Autor inexistente faz a gravação da auditoria estourar a chave estrangeira.
      await expect(vincularMembros(equipe.id, [pessoa.id], ID_INEXISTENTE)).rejects.toThrow();

      const intacta = await prisma.colaborador.findUniqueOrThrow({ where: { id: pessoa.id } });
      expect(intacta.equipeId).toBeNull();
      expect(await auditoriasDe('Colaborador', pessoa.id)).toHaveLength(0);
    });
  });

  describe('DELETE /equipes/:id/membros/:colaboradorId', () => {
    it('desfaz o vínculo sem apagar o colaborador e deixa rastro', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const pessoa = await cenario.criarPessoa({ equipeId: equipe.id });

      const resposta = await request(app)
        .delete(`/equipes/${equipe.id}/membros/${pessoa.id}`)
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(204);

      const continua = await prisma.colaborador.findUniqueOrThrow({ where: { id: pessoa.id } });
      expect(continua.equipeId).toBeNull();
      expect(continua.ativo).toBe(true);

      const auditoria = await auditoriasDe('Colaborador', pessoa.id);
      expect(auditoria[0]?.valoresAntes).toEqual({ equipeId: equipe.id });
      expect(auditoria[0]?.valoresDepois).toEqual({ equipeId: null });
      expect(auditoria[0]?.autorId).toBe(administradora.id);
    });

    it('devolve 409 quando a pessoa é a líder da equipe', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const quemLidera = await cenario.criarPessoa({
        papel: 'LIDER',
        lideraEquipeId: equipe.id,
      });

      const resposta = await request(app)
        .delete(`/equipes/${equipe.id}/membros/${quemLidera.id}`)
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('LIDER_DA_EQUIPE');

      const continua = await prisma.colaborador.findUniqueOrThrow({ where: { id: quemLidera.id } });
      expect(continua.equipeId).toBe(equipe.id);
    });

    it('devolve 404 quando a pessoa não está nessa equipe', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const deOutroLugar = await cenario.criarPessoa({ equipeId: null });

      const resposta = await request(app)
        .delete(`/equipes/${equipe.id}/membros/${deOutroLugar.id}`)
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Este colaborador não está nesta equipe.');
    });

    it('devolve 403 para líder e colaborador', async () => {
      const equipe = await cenario.criarEquipe(gincana.id);
      const pessoa = await cenario.criarPessoa({ equipeId: equipe.id });

      for (const quem of [lider, colaborador]) {
        const resposta = await request(app)
          .delete(`/equipes/${equipe.id}/membros/${pessoa.id}`)
          .set('Authorization', `Bearer ${quem.token}`);

        expect(resposta.status).toBe(403);
      }
    });
  });
  describe('trilha de auditoria da equipe', () => {
    it('descreve a troca de líder com o nome que a equipe passou a ter', async () => {
      const gincana = await cenario.criarGincana();
      const equipe = await cenario.criarEquipe(gincana.id, 'Equipe Antes');
      const pessoa = await cenario.criarPessoa();

      // Renomeia e troca o líder na mesma requisição: a auditoria precisa citar o nome
      // novo, senão a trilha do selo de qualidade aponta para uma equipe que não existe
      // mais com aquele nome.
      const resposta = await request(app)
        .patch(`/equipes/${equipe.id}`)
        .set('Authorization', comoAdmin)
        .send({ nome: 'Equipe Depois', liderId: pessoa.id });

      expect(resposta.status).toBe(200);

      const registros = await prisma.registroAuditoria.findMany({
        where: { entidade: 'Equipe', entidadeId: equipe.id },
        orderBy: { criadoEm: 'desc' },
        take: 1,
      });

      expect(registros[0]?.descricao).toContain('Equipe Depois');
      expect(registros[0]?.descricao).not.toContain('Equipe Antes');
    });
  });
});
