import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
import { prisma } from '../../db.js';
import {
  criarCenarioDeCadastro,
  hojeISO,
  PERIODO_QUE_INCLUI_HOJE,
  type CenarioDeCadastro,
  type EquipeDeTeste,
  type GincanaDeTeste,
  type PessoaDeTeste,
  type TipoAcaoDeTeste,
} from '../../testes/cadastro.fixtures.js';

import { BASE_DO_ARMAZENAMENTO_FAKE } from './storage.js';

/**
 * US07 — anexar foto ou arquivo como comprovante.
 *
 * O fluxo inteiro acontece aqui com o armazenamento falso: pedir a assinatura, fingir que
 * o arquivo subiu e registrar o que subiu. O que o teste garante é o que o navegador não
 * consegue garantir sozinho — tipo e tamanho são conferidos no servidor, e só o dono do
 * lançamento mexe nos comprovantes dele.
 */

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

describe('US07 — comprovantes do lançamento', () => {
  let cenario: CenarioDeCadastro;
  let gincana: GincanaDeTeste;
  let equipeA: EquipeDeTeste;
  let marieri: PessoaDeTeste;
  let liderA: PessoaDeTeste;
  let ana: PessoaDeTeste;
  let bruno: PessoaDeTeste;
  let curso: TipoAcaoDeTeste;

  let comoAdmin: string;
  let comoLiderA: string;
  let comoAna: string;
  let comoBruno: string;

  /** O arquivo que "subiu": a URL vem da própria assinatura do armazenamento falso. */
  const arquivo = (publicId: string) => ({
    url: `${BASE_DO_ARMAZENAMENTO_FAKE}/${publicId}.jpg`,
    publicId,
    nomeArquivo: 'comprovante-tampinhas.jpg',
    mimeType: 'image/jpeg',
    tamanhoBytes: 820_000,
  });

  async function lancar(token: string): Promise<{ id: string }> {
    const resposta = await request(app)
      .post('/lancamentos')
      .set('Authorization', token)
      .send({ tipoAcaoId: curso.id, quantidade: 1, dataAcao: hojeISO() });

    expect(resposta.status).toBe(201);
    return resposta.body;
  }

  /** Pede a assinatura e registra o arquivo, que é o fluxo inteiro da tela. */
  async function anexar(token: string, lancamentoId: string) {
    const assinatura = await request(app)
      .post('/evidencias/assinatura')
      .set('Authorization', token)
      .send({
        nomeArquivo: 'comprovante-tampinhas.jpg',
        mimeType: 'image/jpeg',
        tamanhoBytes: 820_000,
      });

    expect(assinatura.status).toBe(201);

    return request(app)
      .post(`/lancamentos/${lancamentoId}/evidencias`)
      .set('Authorization', token)
      .send(arquivo(assinatura.body.publicId));
  }

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    gincana = await cenario.criarGincana({ status: 'ATIVA', ...PERIODO_QUE_INCLUI_HOJE });
    equipeA = await cenario.criarEquipe(gincana.id);
    const equipeB = await cenario.criarEquipe(gincana.id);

    marieri = await cenario.criarPessoa({ papel: 'ADMIN', equipeId: equipeA.id });
    liderA = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipeA.id });
    ana = await cenario.criarPessoa({ equipeId: equipeA.id });
    bruno = await cenario.criarPessoa({ equipeId: equipeB.id });

    comoAdmin = `Bearer ${marieri.token}`;
    comoLiderA = `Bearer ${liderA.token}`;
    comoAna = `Bearer ${ana.token}`;
    comoBruno = `Bearer ${bruno.token}`;

    curso = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: `Curso com certificado ${cenario.marca}`,
      unidade: 'CERTIFICADO',
      pontosPorUnidade: 50,
      exigeEvidencia: true,
    });
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('POST /evidencias/assinatura', () => {
    it('devolve ao navegador o que ele precisa para enviar direto ao armazenamento', async () => {
      const resposta = await request(app)
        .post('/evidencias/assinatura')
        .set('Authorization', comoAna)
        .send({ nomeArquivo: 'foto.jpg', mimeType: 'image/jpeg', tamanhoBytes: 500_000 });

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({ provedor: 'fake' });
      expect(resposta.body.urlDeUpload).toContain(BASE_DO_ARMAZENAMENTO_FAKE);
      expect(resposta.body.campos.public_id).toBe(resposta.body.publicId);
      // O identificador separa por colaborador, usando quem está autenticado.
      expect(resposta.body.publicId).toContain(ana.id);
    });

    it('recusa tipo de arquivo fora da lista', async () => {
      const resposta = await request(app)
        .post('/evidencias/assinatura')
        .set('Authorization', comoAna)
        .send({
          nomeArquivo: 'planilha.xlsx',
          mimeType: 'application/vnd.ms-excel',
          tamanhoBytes: 1000,
        });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.detalhes.mimeType).toEqual([
        'Envie uma foto (JPG, PNG ou WebP) ou um PDF.',
      ]);
    });

    it('recusa arquivo acima de 5 MB antes mesmo de assinar o envio', async () => {
      const resposta = await request(app)
        .post('/evidencias/assinatura')
        .set('Authorization', comoAna)
        .send({ nomeArquivo: 'foto.jpg', mimeType: 'image/jpeg', tamanhoBytes: 6 * 1024 * 1024 });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.detalhes.tamanhoBytes).toEqual([
        'O arquivo precisa ter no máximo 5 MB.',
      ]);
    });

    it('exige autenticação', async () => {
      const resposta = await request(app)
        .post('/evidencias/assinatura')
        .send({ nomeArquivo: 'foto.jpg', mimeType: 'image/jpeg', tamanhoBytes: 1000 });

      expect(resposta.status).toBe(401);
    });
  });

  describe('POST /lancamentos/:id/evidencias', () => {
    it('registra o arquivo enviado e devolve o lançamento com o comprovante', async () => {
      const lancamento = await lancar(comoAna);
      const resposta = await anexar(comoAna, lancamento.id);

      expect(resposta.status).toBe(201);
      expect(resposta.body.evidencias).toHaveLength(1);
      expect(resposta.body.evidencias[0]).toMatchObject({
        nomeArquivo: 'comprovante-tampinhas.jpg',
        mimeType: 'image/jpeg',
        tamanhoBytes: 820_000,
        enviadoPorId: ana.id,
      });
    });

    it('grava auditoria do anexo, com o nome do arquivo e nunca o conteúdo', async () => {
      const lancamento = await lancar(comoAna);
      await anexar(comoAna, lancamento.id);

      const registros = await prisma.registroAuditoria.findMany({
        where: { entidade: 'Lancamento', entidadeId: lancamento.id },
        orderBy: { criadoEm: 'asc' },
      });

      const anexo = registros.find((registro) => registro.descricao?.includes('anexado'));
      expect(anexo).toMatchObject({ acao: 'ALTERACAO', autorId: ana.id });
      expect(anexo?.valoresDepois).toMatchObject({
        nomeArquivo: 'comprovante-tampinhas.jpg',
        mimeType: 'image/jpeg',
      });
    });

    it('recusa tipo e tamanho no servidor, não só no navegador', async () => {
      const lancamento = await lancar(comoAna);

      const tipoProibido = await request(app)
        .post(`/lancamentos/${lancamento.id}/evidencias`)
        .set('Authorization', comoAna)
        .send({ ...arquivo('pasta/abc'), mimeType: 'application/x-msdownload' });
      expect(tipoProibido.status).toBe(400);

      const grandeDemais = await request(app)
        .post(`/lancamentos/${lancamento.id}/evidencias`)
        .set('Authorization', comoAna)
        .send({ ...arquivo('pasta/abc'), tamanhoBytes: 5 * 1024 * 1024 + 1 });
      expect(grandeDemais.status).toBe(400);

      expect(await prisma.evidencia.count({ where: { lancamentoId: lancamento.id } })).toBe(0);
    });

    it('devolve 403 para quem não é dono do lançamento, inclusive líder e administradora', async () => {
      const lancamento = await lancar(comoAna);

      for (const token of [comoLiderA, comoAdmin, comoBruno]) {
        const resposta = await request(app)
          .post(`/lancamentos/${lancamento.id}/evidencias`)
          .set('Authorization', token)
          .send(arquivo('pasta/abc'));

        expect(resposta.status).toBe(403);
      }

      expect(await prisma.evidencia.count({ where: { lancamentoId: lancamento.id } })).toBe(0);
    });

    it('devolve 409 depois de o lançamento ser avaliado', async () => {
      const lancamento = await lancar(comoAna);
      await anexar(comoAna, lancamento.id);
      await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/evidencias`)
        .set('Authorization', comoAna)
        .send(arquivo('pasta/outro'));

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('LANCAMENTO_JA_AVALIADO');
    });

    it('devolve 404 para lançamento inexistente', async () => {
      const resposta = await request(app)
        .post(`/lancamentos/${ID_INEXISTENTE}/evidencias`)
        .set('Authorization', comoAna)
        .send(arquivo('pasta/abc'));

      expect(resposta.status).toBe(404);
    });

    it('exige autenticação', async () => {
      const lancamento = await lancar(comoAna);
      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/evidencias`)
        .send(arquivo('pasta/abc'));

      expect(resposta.status).toBe(401);
    });
  });

  describe('DELETE /lancamentos/:id/evidencias/:evidenciaId', () => {
    it('deixa o dono remover o comprovante enquanto está pendente, com auditoria', async () => {
      const lancamento = await lancar(comoAna);
      const anexado = await anexar(comoAna, lancamento.id);
      const evidenciaId = anexado.body.evidencias[0].id;

      const resposta = await request(app)
        .delete(`/lancamentos/${lancamento.id}/evidencias/${evidenciaId}`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(200);
      expect(resposta.body.evidencias).toEqual([]);

      const registros = await prisma.registroAuditoria.findMany({
        where: { entidade: 'Lancamento', entidadeId: lancamento.id },
      });
      expect(registros.some((registro) => registro.descricao?.includes('removido'))).toBe(true);
    });

    it('devolve 403 para quem não é dono', async () => {
      const lancamento = await lancar(comoAna);
      const anexado = await anexar(comoAna, lancamento.id);
      const evidenciaId = anexado.body.evidencias[0].id;

      const resposta = await request(app)
        .delete(`/lancamentos/${lancamento.id}/evidencias/${evidenciaId}`)
        .set('Authorization', comoLiderA);

      expect(resposta.status).toBe(403);
      expect(await prisma.evidencia.count({ where: { id: evidenciaId } })).toBe(1);
    });

    it('devolve 409 depois de aprovado: o comprovante faz parte do que foi decidido', async () => {
      const lancamento = await lancar(comoAna);
      const anexado = await anexar(comoAna, lancamento.id);
      const evidenciaId = anexado.body.evidencias[0].id;

      await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      const resposta = await request(app)
        .delete(`/lancamentos/${lancamento.id}/evidencias/${evidenciaId}`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(409);
      expect(await prisma.evidencia.count({ where: { id: evidenciaId } })).toBe(1);
    });

    it('devolve 404 para comprovante de outro lançamento', async () => {
      const meu = await lancar(comoAna);
      const outro = await lancar(comoAna);
      const anexado = await anexar(comoAna, outro.id);

      const resposta = await request(app)
        .delete(`/lancamentos/${meu.id}/evidencias/${anexado.body.evidencias[0].id}`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(404);
    });

    it('exige autenticação', async () => {
      const lancamento = await lancar(comoAna);
      const anexado = await anexar(comoAna, lancamento.id);

      const resposta = await request(app).delete(
        `/lancamentos/${lancamento.id}/evidencias/${anexado.body.evidencias[0].id}`,
      );

      expect(resposta.status).toBe(401);
    });
  });

  describe('evidência obrigatória na aprovação', () => {
    it('bloqueia a aprovação sem comprovante e libera depois do anexo', async () => {
      const lancamento = await lancar(comoAna);

      const semComprovante = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});
      expect(semComprovante.status).toBe(409);
      expect(semComprovante.body.erro.codigo).toBe('EVIDENCIA_OBRIGATORIA');

      await anexar(comoAna, lancamento.id);

      const comComprovante = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});
      expect(comComprovante.status).toBe(200);
      expect(comComprovante.body.status).toBe('APROVADO');
    });

    it('não exige comprovante quando o tipo de ação não pede', async () => {
      const semExigencia = await cenario.criarTipoAcao(gincana.id, marieri.id, {
        nome: `Atitude ${cenario.marca}`,
        exigeEvidencia: false,
        pontosPorUnidade: 5,
      });

      const criado = await request(app)
        .post('/lancamentos')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: semExigencia.id, quantidade: 2, dataAcao: hojeISO() });

      const resposta = await request(app)
        .post(`/lancamentos/${criado.body.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      expect(resposta.status).toBe(200);
      expect(resposta.body.pontosCalculados).toBe(10);
    });
  });
});
