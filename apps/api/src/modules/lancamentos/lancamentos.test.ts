import type { UsuarioAutenticado } from '@gincana/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
import { prisma } from '../../db.js';
import {
  criarCenarioDeCadastro,
  diasAtrasISO,
  hojeISO,
  PERIODO_QUE_INCLUI_HOJE,
  type CenarioDeCadastro,
  type EquipeDeTeste,
  type GincanaDeTeste,
  type PessoaDeTeste,
  type TipoAcaoDeTeste,
} from '../../testes/cadastro.fixtures.js';

import { atualizarLancamento, criarLancamento } from './service.js';

/**
 * US06 e US08 — lançar uma ação e avaliá-la.
 *
 * Os números dos exemplos são os que a cliente usou na inception: 24 kg de tampinhas a
 * 10 pontos o quilo dão 240, e 3 peças de roupa a 15 dão 45. Eles aparecem aqui de
 * propósito — se o cálculo mudar, é por esses dois que a suíte avisa primeiro.
 */

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

const auditoriasDoLancamento = (id: string) =>
  prisma.registroAuditoria.findMany({
    where: { entidade: 'Lancamento', entidadeId: id },
    orderBy: { criadoEm: 'asc' },
  });

describe('US06 e US08 — lançamentos', () => {
  let cenario: CenarioDeCadastro;
  let gincana: GincanaDeTeste;
  let equipeA: EquipeDeTeste;
  let equipeB: EquipeDeTeste;
  let marieri: PessoaDeTeste;
  let liderA: PessoaDeTeste;
  let liderB: PessoaDeTeste;
  let anaDaEquipeA: PessoaDeTeste;
  let brunoDaEquipeB: PessoaDeTeste;
  let tampinhas: TipoAcaoDeTeste;
  let roupas: TipoAcaoDeTeste;
  let comComprovante: TipoAcaoDeTeste;

  let comoAdmin: string;
  let comoLiderA: string;
  let comoLiderB: string;
  let comoAna: string;
  let comoBruno: string;

  /** Cria um lançamento pela própria API e devolve o corpo da resposta. */
  async function lancar(
    token: string,
    corpo: Record<string, unknown>,
  ): Promise<{ id: string; colaboradorId: string; equipeId: string; [campo: string]: unknown }> {
    const resposta = await request(app)
      .post('/lancamentos')
      .set('Authorization', token)
      .send({ tipoAcaoId: tampinhas.id, quantidade: 1, dataAcao: hojeISO(), ...corpo });

    expect(resposta.status).toBe(201);
    return resposta.body;
  }

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    gincana = await cenario.criarGincana({ status: 'ATIVA', ...PERIODO_QUE_INCLUI_HOJE });
    equipeA = await cenario.criarEquipe(gincana.id);
    equipeB = await cenario.criarEquipe(gincana.id);

    marieri = await cenario.criarPessoa({ papel: 'ADMIN', equipeId: equipeA.id });
    liderA = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipeA.id });
    liderB = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipeB.id });
    anaDaEquipeA = await cenario.criarPessoa({ equipeId: equipeA.id });
    brunoDaEquipeB = await cenario.criarPessoa({ equipeId: equipeB.id });

    comoAdmin = `Bearer ${marieri.token}`;
    comoLiderA = `Bearer ${liderA.token}`;
    comoLiderB = `Bearer ${liderB.token}`;
    comoAna = `Bearer ${anaDaEquipeA.token}`;
    comoBruno = `Bearer ${brunoDaEquipeB.token}`;

    tampinhas = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: `Tampinhas ${cenario.marca}`,
      unidade: 'KG',
      pontosPorUnidade: 10,
    });
    roupas = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: `Roupas ${cenario.marca}`,
      unidade: 'PECA',
      pontosPorUnidade: 15,
    });
    comComprovante = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: `Curso ${cenario.marca}`,
      unidade: 'CERTIFICADO',
      pontosPorUnidade: 50,
      exigeEvidencia: true,
    });
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('POST /lancamentos/preview', () => {
    it('calcula 24 kg de tampinhas a 10 pontos o quilo como 240', async () => {
      const resposta = await request(app)
        .post('/lancamentos/preview')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: tampinhas.id, quantidade: 24, dataAcao: hojeISO() });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        pontos: 240,
        pontosPorUnidade: 10,
        unidade: 'KG',
        regraPontuacaoId: tampinhas.regraId,
      });
    });

    it('calcula 3 peças de roupa a 15 pontos como 45', async () => {
      const resposta = await request(app)
        .post('/lancamentos/preview')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: roupas.id, quantidade: 3, dataAcao: hojeISO() });

      expect(resposta.status).toBe(200);
      expect(resposta.body.pontos).toBe(45);
    });

    it('não grava nada', async () => {
      const antes = await prisma.lancamento.count({ where: { gincanaId: gincana.id } });

      await request(app)
        .post('/lancamentos/preview')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: tampinhas.id, quantidade: 7, dataAcao: hojeISO() });

      expect(await prisma.lancamento.count({ where: { gincanaId: gincana.id } })).toBe(antes);
    });

    it('recusa quantidade zero ou negativa', async () => {
      for (const quantidade of [0, -3]) {
        const resposta = await request(app)
          .post('/lancamentos/preview')
          .set('Authorization', comoAna)
          .send({ tipoAcaoId: tampinhas.id, quantidade, dataAcao: hojeISO() });

        expect(resposta.status).toBe(400);
        expect(resposta.body.erro.detalhes.quantidade).toEqual([
          'A quantidade precisa ser maior que zero.',
        ]);
      }
    });

    it('recusa mais de três casas decimais, que a coluna não guarda', async () => {
      const resposta = await request(app)
        .post('/lancamentos/preview')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: tampinhas.id, quantidade: 1.2345, dataAcao: hojeISO() });

      expect(resposta.status).toBe(400);
    });

    it('exige autenticação', async () => {
      const resposta = await request(app)
        .post('/lancamentos/preview')
        .send({ tipoAcaoId: tampinhas.id, quantidade: 24, dataAcao: hojeISO() });

      expect(resposta.status).toBe(401);
    });
  });

  describe('POST /lancamentos', () => {
    it('registra a ação pendente, com a equipe e os pontos congelados', async () => {
      const resposta = await request(app).post('/lancamentos').set('Authorization', comoAna).send({
        tipoAcaoId: tampinhas.id,
        quantidade: 24,
        dataAcao: hojeISO(),
        observacao: 'Entregues na portaria',
      });

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({
        gincanaId: gincana.id,
        colaboradorId: anaDaEquipeA.id,
        equipeId: equipeA.id,
        quantidade: 24,
        regraPontuacaoId: tampinhas.regraId,
        pontosPorUnidadeAplicado: 10,
        pontosCalculados: 240,
        status: 'PENDENTE',
        observacao: 'Entregues na portaria',
        avaliadoPor: null,
        motivoRecusa: null,
      });
    });

    it('grava a auditoria de criação, com autor e valores', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });
      const [registro, ...resto] = await auditoriasDoLancamento(lancamento.id);

      expect(resto).toHaveLength(0);
      expect(registro).toMatchObject({ acao: 'CRIACAO', autorId: anaDaEquipeA.id });
      expect(registro?.valoresDepois).toMatchObject({
        quantidade: 2,
        pontosCalculados: 20,
        pontosPorUnidadeAplicado: 10,
        status: 'PENDENTE',
        equipeId: equipeA.id,
      });
    });

    it('deixa a administradora lançar em nome de outra pessoa, na equipe dela', async () => {
      const resposta = await request(app)
        .post('/lancamentos')
        .set('Authorization', comoAdmin)
        .send({
          tipoAcaoId: tampinhas.id,
          quantidade: 5,
          dataAcao: hojeISO(),
          colaboradorId: brunoDaEquipeB.id,
        });

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({
        colaboradorId: brunoDaEquipeB.id,
        equipeId: equipeB.id,
      });

      const [registro] = await auditoriasDoLancamento(resposta.body.id);
      expect(registro?.autorId).toBe(marieri.id);
    });

    it('ignora o colaboradorId do corpo quando quem lança não é a administradora', async () => {
      const lancamento = await lancar(comoAna, { colaboradorId: brunoDaEquipeB.id });

      expect(lancamento.colaboradorId).toBe(anaDaEquipeA.id);
      expect(lancamento.equipeId).toBe(equipeA.id);
    });

    it('usa a regra que vigia na data da ação, não a de hoje', async () => {
      // A ação aconteceu há três dias; a pontuação mudou hoje de manhã.
      const tipo = await cenario.criarTipoAcao(gincana.id, marieri.id, {
        nome: `Doacao antiga ${cenario.marca}`,
        pontosPorUnidade: 8,
      });
      await cenario.trocarPontuacao(tipo.id, 10, marieri.id);

      const antiga = await lancar(comoAna, {
        tipoAcaoId: tipo.id,
        quantidade: 10,
        dataAcao: diasAtrasISO(3),
      });

      expect(antiga.pontosPorUnidadeAplicado).toBe(8);
      expect(antiga.pontosCalculados).toBe(80);
      expect(antiga.regraPontuacaoId).toBe(tipo.regraId);
    });

    it('congela os pontos: trocar a regra depois não mexe no que já foi lançado', async () => {
      const tipo = await cenario.criarTipoAcao(gincana.id, marieri.id, {
        nome: `Congelamento ${cenario.marca}`,
        pontosPorUnidade: 8,
      });

      const comRegraAntiga = await lancar(comoAna, {
        tipoAcaoId: tipo.id,
        quantidade: 10,
        dataAcao: hojeISO(),
      });
      expect(comRegraAntiga.pontosCalculados).toBe(80);

      const novaRegraId = await cenario.trocarPontuacao(tipo.id, 10, marieri.id);

      const comRegraNova = await lancar(comoAna, {
        tipoAcaoId: tipo.id,
        quantidade: 10,
        dataAcao: hojeISO(),
      });
      expect(comRegraNova.pontosCalculados).toBe(100);
      expect(comRegraNova.regraPontuacaoId).toBe(novaRegraId);

      // O lançamento antigo continua valendo 8, com a regra antiga apontada.
      const relido = await request(app)
        .get(`/lancamentos/${comRegraAntiga.id}`)
        .set('Authorization', comoAna);

      expect(relido.body).toMatchObject({
        pontosPorUnidadeAplicado: 8,
        pontosCalculados: 80,
        regraPontuacaoId: tipo.regraId,
      });
    });

    it('recusa data da ação no futuro', async () => {
      const resposta = await request(app)
        .post('/lancamentos')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: tampinhas.id, quantidade: 1, dataAcao: diasAtrasISO(-1) });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.detalhes.dataAcao).toEqual([
        'A data da ação não pode ser no futuro.',
      ]);
    });

    it('recusa data fora do período da gincana, dizendo qual é o período', async () => {
      const resposta = await request(app)
        .post('/lancamentos')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: tampinhas.id, quantidade: 1, dataAcao: diasAtrasISO(900) });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('DATA_FORA_DO_PERIODO_DA_GINCANA');
      expect(resposta.body.erro.mensagem).toContain(PERIODO_QUE_INCLUI_HOJE.dataInicio);
    });

    it('recusa lançamento em gincana que não está ativa', async () => {
      const planejada = await cenario.criarGincana(PERIODO_QUE_INCLUI_HOJE);
      const tipo = await cenario.criarTipoAcao(planejada.id, marieri.id, {
        nome: `Futuro ${cenario.marca}`,
      });

      const resposta = await request(app)
        .post('/lancamentos')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: tipo.id, quantidade: 1, dataAcao: hojeISO() });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('GINCANA_NAO_ESTA_ATIVA');
    });

    it('recusa lançamento em tipo de ação pausado', async () => {
      const pausado = await cenario.criarTipoAcao(gincana.id, marieri.id, {
        nome: `Pausado ${cenario.marca}`,
        ativo: false,
      });

      const resposta = await request(app)
        .post('/lancamentos')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: pausado.id, quantidade: 1, dataAcao: hojeISO() });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('TIPO_DE_ACAO_INATIVO');
    });

    it('recusa quem ainda não está em uma equipe', async () => {
      const semEquipe = await cenario.criarPessoa({ equipeId: null });

      const resposta = await request(app)
        .post('/lancamentos')
        .set('Authorization', `Bearer ${semEquipe.token}`)
        .send({ tipoAcaoId: tampinhas.id, quantidade: 1, dataAcao: hojeISO() });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('COLABORADOR_SEM_EQUIPE');
    });

    it('devolve 404 para tipo de ação inexistente', async () => {
      const resposta = await request(app)
        .post('/lancamentos')
        .set('Authorization', comoAna)
        .send({ tipoAcaoId: ID_INEXISTENTE, quantidade: 1, dataAcao: hojeISO() });

      expect(resposta.status).toBe(404);
    });

    it('exige autenticação', async () => {
      const resposta = await request(app)
        .post('/lancamentos')
        .send({ tipoAcaoId: tampinhas.id, quantidade: 1, dataAcao: hojeISO() });

      expect(resposta.status).toBe(401);
    });

    it('desfaz o lançamento quando a auditoria falha', async () => {
      const antes = await prisma.lancamento.count({ where: { colaboradorId: anaDaEquipeA.id } });

      // Autor inexistente derruba a gravação da auditoria pela chave estrangeira.
      const autorFantasma: UsuarioAutenticado = {
        id: ID_INEXISTENTE,
        nome: 'Quem não existe',
        email: 'fantasma@teste.invalido',
        papel: 'ADMIN',
        equipeId: null,
        equipeLideradaId: null,
      };

      await expect(
        criarLancamento(autorFantasma, {
          tipoAcaoId: tampinhas.id,
          quantidade: 99,
          dataAcao: hojeISO(),
          colaboradorId: anaDaEquipeA.id,
        }),
      ).rejects.toThrow();

      expect(await prisma.lancamento.count({ where: { colaboradorId: anaDaEquipeA.id } })).toBe(
        antes,
      );
    });
  });

  describe('GET /lancamentos', () => {
    it('devolve ao colaborador só os próprios, mesmo pedindo os de outra pessoa', async () => {
      await lancar(comoAna, { quantidade: 1 });
      await lancar(comoBruno, { quantidade: 1 });

      const resposta = await request(app)
        .get(`/lancamentos?colaboradorId=${brunoDaEquipeB.id}`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(200);
      expect(resposta.body.itens).toEqual([]);

      const semFiltro = await request(app).get('/lancamentos').set('Authorization', comoAna);
      expect(semFiltro.body.itens.length).toBeGreaterThan(0);
      for (const item of semFiltro.body.itens) {
        expect(item.colaboradorId).toBe(anaDaEquipeA.id);
      }
    });

    it('devolve ao líder a própria equipe e nunca a de outra', async () => {
      await lancar(comoAna, { quantidade: 1 });
      await lancar(comoBruno, { quantidade: 1 });

      const daEquipe = await request(app).get('/lancamentos').set('Authorization', comoLiderA);
      expect(daEquipe.status).toBe(200);
      expect(daEquipe.body.itens.length).toBeGreaterThan(0);
      for (const item of daEquipe.body.itens) {
        expect(item.equipeId).toBe(equipeA.id);
      }

      const forcandoOutraEquipe = await request(app)
        .get(`/lancamentos?equipeId=${equipeB.id}`)
        .set('Authorization', comoLiderA);
      expect(forcandoOutraEquipe.body.itens).toEqual([]);
    });

    it('devolve à administradora as duas equipes', async () => {
      await lancar(comoAna, { quantidade: 1 });
      await lancar(comoBruno, { quantidade: 1 });

      const resposta = await request(app)
        .get(`/lancamentos?gincanaId=${gincana.id}&porPagina=100`)
        .set('Authorization', comoAdmin);

      const equipes = new Set(
        resposta.body.itens.map((item: { equipeId: string }) => item.equipeId),
      );
      expect(equipes.has(equipeA.id)).toBe(true);
      expect(equipes.has(equipeB.id)).toBe(true);
    });

    it('pagina o resultado', async () => {
      await lancar(comoBruno, { quantidade: 1 });
      await lancar(comoBruno, { quantidade: 2 });

      const resposta = await request(app)
        .get('/lancamentos?pagina=1&porPagina=1')
        .set('Authorization', comoBruno);

      expect(resposta.body.itens).toHaveLength(1);
      expect(resposta.body.porPagina).toBe(1);
      expect(resposta.body.total).toBeGreaterThan(1);
      expect(resposta.body.totalDePaginas).toBeGreaterThan(1);
    });

    it('exige autenticação', async () => {
      expect((await request(app).get('/lancamentos')).status).toBe(401);
    });
  });

  describe('GET /lancamentos/:id', () => {
    it('abre para o dono, para o líder da equipe dele e para a administradora', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 3 });

      for (const token of [comoAna, comoLiderA, comoAdmin]) {
        const resposta = await request(app)
          .get(`/lancamentos/${lancamento.id}`)
          .set('Authorization', token);

        expect(resposta.status).toBe(200);
        expect(resposta.body.id).toBe(lancamento.id);
      }
    });

    it('esconde de colaborador e de líder de outra equipe', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 3 });

      for (const token of [comoBruno, comoLiderB]) {
        const resposta = await request(app)
          .get(`/lancamentos/${lancamento.id}`)
          .set('Authorization', token);

        expect(resposta.status).toBe(404);
      }
    });

    it('exige autenticação', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 3 });
      expect((await request(app).get(`/lancamentos/${lancamento.id}`)).status).toBe(401);
    });
  });

  describe('PATCH /lancamentos/:id', () => {
    it('deixa o dono corrigir a quantidade enquanto está pendente, recalculando', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 10 });

      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .set('Authorization', comoAna)
        .send({ quantidade: 24, observacao: 'Pesagem conferida' });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        quantidade: 24,
        pontosCalculados: 240,
        pontosPorUnidadeAplicado: 10,
        status: 'PENDENTE',
      });

      const registros = await auditoriasDoLancamento(lancamento.id);
      const alteracao = registros.find((registro) => registro.acao === 'ALTERACAO');
      expect(alteracao?.autorId).toBe(anaDaEquipeA.id);
      expect(alteracao?.valoresAntes).toMatchObject({ quantidade: 10, pontosCalculados: 100 });
      expect(alteracao?.valoresDepois).toMatchObject({ quantidade: 24, pontosCalculados: 240 });
    });

    it('mantém o preço congelado ao corrigir, mesmo com a regra já trocada', async () => {
      const tipo = await cenario.criarTipoAcao(gincana.id, marieri.id, {
        nome: `Correcao ${cenario.marca}`,
        pontosPorUnidade: 8,
      });
      const lancamento = await lancar(comoAna, {
        tipoAcaoId: tipo.id,
        quantidade: 10,
        dataAcao: hojeISO(),
      });

      await cenario.trocarPontuacao(tipo.id, 10, marieri.id);

      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .set('Authorization', comoAna)
        .send({ quantidade: 20 });

      // 20 × 8 (o preço congelado), e não 20 × 10 (o preço de agora).
      expect(resposta.body.pontosCalculados).toBe(160);
      expect(resposta.body.regraPontuacaoId).toBe(tipo.regraId);
    });

    it('devolve o lançamento recusado para a fila quando o dono corrige', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });
      await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .set('Authorization', comoLiderA)
        .send({ motivoRecusa: 'Foto sem a etiqueta da ONG' });

      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .set('Authorization', comoAna)
        .send({ quantidade: 6, observacao: 'Refiz a foto com a etiqueta' });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        status: 'PENDENTE',
        motivoRecusa: null,
        avaliadoPor: null,
        avaliadoEm: null,
      });

      // A recusa não sumiu: ela continua inteira na trilha de auditoria.
      const acoes = (await auditoriasDoLancamento(lancamento.id)).map((r) => r.acao);
      expect(acoes).toEqual(['CRIACAO', 'RECUSA', 'ALTERACAO']);
    });

    it('não deixa o dono alterar o que já foi aprovado', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });
      await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .set('Authorization', comoAna)
        .send({ quantidade: 500 });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('LANCAMENTO_JA_APROVADO');
    });

    it('deixa a administradora alterar o aprovado, recalculando e auditando', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });
      await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .set('Authorization', comoAdmin)
        .send({ quantidade: 12 });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        quantidade: 12,
        pontosCalculados: 120,
        status: 'APROVADO',
      });

      const alteracao = (await auditoriasDoLancamento(lancamento.id)).find(
        (registro) => registro.acao === 'ALTERACAO',
      );
      expect(alteracao?.autorId).toBe(marieri.id);
      expect(alteracao?.valoresAntes).toMatchObject({ pontosCalculados: 50 });
      expect(alteracao?.valoresDepois).toMatchObject({ pontosCalculados: 120 });
    });

    it('devolve 403 para quem não é dono nem administradora', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });

      for (const token of [comoLiderA, comoBruno]) {
        const resposta = await request(app)
          .patch(`/lancamentos/${lancamento.id}`)
          .set('Authorization', token)
          .send({ quantidade: 500 });

        expect(resposta.status).toBe(403);
      }

      const intacto = await prisma.lancamento.findUniqueOrThrow({ where: { id: lancamento.id } });
      expect(Number(intacto.quantidade)).toBe(5);
    });

    it('recusa mudar o status por aqui, ensinando o caminho certo', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });

      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .set('Authorization', comoAna)
        .send({ status: 'APROVADO' });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.detalhes.status?.[0]).toContain('aprovar ou recusar');
    });

    it('exige ao menos um campo', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });

      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .set('Authorization', comoAna)
        .send({});

      expect(resposta.status).toBe(400);
    });

    it('exige autenticação', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });
      const resposta = await request(app)
        .patch(`/lancamentos/${lancamento.id}`)
        .send({ quantidade: 7 });

      expect(resposta.status).toBe(401);
    });

    it('desfaz a correção quando a auditoria falha', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 5 });

      const autorFantasma: UsuarioAutenticado = {
        id: ID_INEXISTENTE,
        nome: 'Quem não existe',
        email: 'fantasma@teste.invalido',
        papel: 'ADMIN',
        equipeId: null,
        equipeLideradaId: null,
      };

      await expect(
        atualizarLancamento(autorFantasma, lancamento.id, { quantidade: 999 }),
      ).rejects.toThrow();

      const intacto = await prisma.lancamento.findUniqueOrThrow({ where: { id: lancamento.id } });
      expect(Number(intacto.quantidade)).toBe(5);
      expect(intacto.pontosCalculados).toBe(50);
      expect((await auditoriasDoLancamento(lancamento.id)).map((r) => r.acao)).toEqual(['CRIACAO']);
    });
  });

  describe('POST /lancamentos/:id/aprovar', () => {
    it('deixa o líder aprovar o lançamento da própria equipe, com auditoria', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 24 });

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        status: 'APROVADO',
        pontosCalculados: 240,
        motivoRecusa: null,
      });
      expect(resposta.body.avaliadoPor).toMatchObject({ id: liderA.id });
      expect(resposta.body.avaliadoEm).not.toBeNull();

      const aprovacao = (await auditoriasDoLancamento(lancamento.id)).find(
        (registro) => registro.acao === 'APROVACAO',
      );
      expect(aprovacao?.autorId).toBe(liderA.id);
      expect(aprovacao?.valoresAntes).toMatchObject({ status: 'PENDENTE' });
      expect(aprovacao?.valoresDepois).toMatchObject({ status: 'APROVADO', pontosCalculados: 240 });
    });

    it('deixa a administradora aprovar lançamento de qualquer equipe', async () => {
      const lancamento = await lancar(comoBruno, { quantidade: 2 });

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoAdmin)
        .send({});

      expect(resposta.status).toBe(200);
      expect(resposta.body.status).toBe('APROVADO');
    });

    it('devolve 403 ao líder de outra equipe, mesmo sabendo o identificador', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderB)
        .send({});

      expect(resposta.status).toBe(403);
      const intacto = await prisma.lancamento.findUniqueOrThrow({ where: { id: lancamento.id } });
      expect(intacto.status).toBe('PENDENTE');
    });

    it('devolve 403 ao colaborador, inclusive no da própria equipe', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoBruno)
        .send({});

      expect(resposta.status).toBe(403);
    });

    it('devolve 409 para quem tenta aprovar o próprio lançamento', async () => {
      const doLider = await lancar(comoLiderA, { quantidade: 2 });
      const daAdmin = await lancar(comoAdmin, { quantidade: 2 });

      const lider = await request(app)
        .post(`/lancamentos/${doLider.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});
      expect(lider.status).toBe(409);
      expect(lider.body.erro.codigo).toBe('NAO_PODE_AVALIAR_PROPRIO_LANCAMENTO');

      const admin = await request(app)
        .post(`/lancamentos/${daAdmin.id}/aprovar`)
        .set('Authorization', comoAdmin)
        .send({});
      expect(admin.status).toBe(409);
      expect(admin.body.erro.codigo).toBe('NAO_PODE_AVALIAR_PROPRIO_LANCAMENTO');

      // Outra pessoa com permissão resolve: a trava é de autoria, não de papel.
      const porOutraPessoa = await request(app)
        .post(`/lancamentos/${daAdmin.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});
      expect(porOutraPessoa.status).toBe(200);
    });

    it('devolve 409 no lançamento já avaliado, sem auditar de novo', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });

      await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      const segunda = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoAdmin)
        .send({});

      expect(segunda.status).toBe(409);
      expect(segunda.body.erro.codigo).toBe('LANCAMENTO_JA_AVALIADO');

      const acoes = (await auditoriasDoLancamento(lancamento.id)).map((r) => r.acao);
      expect(acoes).toEqual(['CRIACAO', 'APROVACAO']);
    });

    it('devolve 409 quando o tipo exige comprovante e o lançamento não tem nenhum', async () => {
      const lancamento = await lancar(comoAna, {
        tipoAcaoId: comComprovante.id,
        quantidade: 1,
      });

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('EVIDENCIA_OBRIGATORIA');
      expect(resposta.body.erro.mensagem).toContain('exige comprovante');

      const intacto = await prisma.lancamento.findUniqueOrThrow({ where: { id: lancamento.id } });
      expect(intacto.status).toBe('PENDENTE');
    });

    it('deixa recusar o que não tem comprovante, que é o caminho para pedir correção', async () => {
      const lancamento = await lancar(comoAna, {
        tipoAcaoId: comComprovante.id,
        quantidade: 1,
      });

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .set('Authorization', comoLiderA)
        .send({ motivoRecusa: 'Falta anexar o certificado do curso' });

      expect(resposta.status).toBe(200);
    });

    it('exige autenticação', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });
      expect(
        (await request(app).post(`/lancamentos/${lancamento.id}/aprovar`).send({})).status,
      ).toBe(401);
    });
  });

  describe('POST /lancamentos/:id/recusar', () => {
    it('recusa com o motivo, sem apagar nada do lançamento', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 24 });

      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .set('Authorization', comoLiderA)
        .send({ motivoRecusa: 'Foto sem a etiqueta da ONG' });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        status: 'RECUSADO',
        motivoRecusa: 'Foto sem a etiqueta da ONG',
        quantidade: 24,
        pontosCalculados: 240,
      });
      expect(resposta.body.avaliadoPor).toMatchObject({ id: liderA.id });

      const recusa = (await auditoriasDoLancamento(lancamento.id)).find(
        (registro) => registro.acao === 'RECUSA',
      );
      expect(recusa?.autorId).toBe(liderA.id);
      expect(recusa?.descricao).toContain('Foto sem a etiqueta da ONG');
    });

    it('exige o motivo, porque sem ele ninguém sabe o que corrigir', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });

      const semMotivo = await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .set('Authorization', comoLiderA)
        .send({});
      expect(semMotivo.status).toBe(400);

      const motivoCurto = await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .set('Authorization', comoLiderA)
        .send({ motivoRecusa: 'não' });
      expect(motivoCurto.status).toBe(400);
    });

    it('devolve 403 ao líder de outra equipe e ao colaborador', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });

      for (const token of [comoLiderB, comoBruno]) {
        const resposta = await request(app)
          .post(`/lancamentos/${lancamento.id}/recusar`)
          .set('Authorization', token)
          .send({ motivoRecusa: 'Motivo qualquer' });

        expect(resposta.status).toBe(403);
      }
    });

    it('devolve 409 no lançamento já recusado, sem auditar de novo', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });

      await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .set('Authorization', comoLiderA)
        .send({ motivoRecusa: 'Comprovante ilegível' });

      const segunda = await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .set('Authorization', comoLiderA)
        .send({ motivoRecusa: 'Comprovante ilegível' });

      expect(segunda.status).toBe(409);
      expect((await auditoriasDoLancamento(lancamento.id)).map((r) => r.acao)).toEqual([
        'CRIACAO',
        'RECUSA',
      ]);
    });

    it('exige autenticação', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 2 });
      const resposta = await request(app)
        .post(`/lancamentos/${lancamento.id}/recusar`)
        .send({ motivoRecusa: 'Motivo qualquer' });

      expect(resposta.status).toBe(401);
    });
  });

  describe('GET /lancamentos/pendentes', () => {
    it('traz ao líder só os pendentes da própria equipe', async () => {
      const meu = await lancar(comoAna, { quantidade: 4 });
      const deOutraEquipe = await lancar(comoBruno, { quantidade: 4 });

      const resposta = await request(app)
        .get('/lancamentos/pendentes?porPagina=100')
        .set('Authorization', comoLiderA);

      expect(resposta.status).toBe(200);
      const ids = resposta.body.itens.map((item: { id: string }) => item.id);
      expect(ids).toContain(meu.id);
      expect(ids).not.toContain(deOutraEquipe.id);
      for (const item of resposta.body.itens) {
        expect(item.status).toBe('PENDENTE');
      }
    });

    it('traz à administradora as duas equipes', async () => {
      const daEquipeA = await lancar(comoAna, { quantidade: 4 });
      const daEquipeB = await lancar(comoBruno, { quantidade: 4 });

      const resposta = await request(app)
        .get(`/lancamentos/pendentes?gincanaId=${gincana.id}&porPagina=100`)
        .set('Authorization', comoAdmin);

      const ids = resposta.body.itens.map((item: { id: string }) => item.id);
      expect(ids).toContain(daEquipeA.id);
      expect(ids).toContain(daEquipeB.id);
    });

    it('some da fila depois de avaliado', async () => {
      const lancamento = await lancar(comoAna, { quantidade: 4 });
      await request(app)
        .post(`/lancamentos/${lancamento.id}/aprovar`)
        .set('Authorization', comoLiderA)
        .send({});

      const resposta = await request(app)
        .get('/lancamentos/pendentes?porPagina=100')
        .set('Authorization', comoLiderA);

      const ids = resposta.body.itens.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(lancamento.id);
    });

    it('devolve 403 ao colaborador e 401 a quem não entrou', async () => {
      const semPermissao = await request(app)
        .get('/lancamentos/pendentes')
        .set('Authorization', comoAna);
      expect(semPermissao.status).toBe(403);

      expect((await request(app).get('/lancamentos/pendentes')).status).toBe(401);
    });
  });
});
