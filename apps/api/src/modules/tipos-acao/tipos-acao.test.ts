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

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const DIA = 24 * 60 * 60 * 1000;

describe('US04 — API de tipos de ação', () => {
  let cenario: CenarioDeCadastro;
  let gincana: GincanaDeTeste;
  let administradora: PessoaDeTeste;
  let lider: PessoaDeTeste;
  let colaborador: PessoaDeTeste;
  let comoAdmin: string;
  let comoLider: string;
  let comoColaborador: string;
  let contador = 0;

  const nomeDeTipo = (prefixo: string) => `${prefixo} ${cenario.marca}-${(contador += 1)}`;

  /** Cria um tipo pela própria API e devolve o corpo da resposta. */
  async function criarTipo(corpo: Record<string, unknown>) {
    const resposta = await request(app)
      .post(`/gincanas/${gincana.id}/tipos-acao`)
      .set('Authorization', comoAdmin)
      .send(corpo);

    expect(resposta.status).toBe(201);
    return resposta.body;
  }

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    gincana = await cenario.criarGincana();
    const equipe = await cenario.criarEquipe(gincana.id);

    administradora = await cenario.criarPessoa({ papel: 'ADMIN' });
    lider = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipe.id });
    colaborador = await cenario.criarPessoa({ equipeId: equipe.id });

    comoAdmin = `Bearer ${administradora.token}`;
    comoLider = `Bearer ${lider.token}`;
    comoColaborador = `Bearer ${colaborador.token}`;
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('POST /gincanas/:gincanaId/tipos-acao', () => {
    it('cadastra o tipo já com a primeira regra de pontuação', async () => {
      const nome = nomeDeTipo('Tampinhas');
      const resposta = await request(app)
        .post(`/gincanas/${gincana.id}/tipos-acao`)
        .set('Authorization', comoAdmin)
        .send({
          nome,
          descricao: 'Tampinhas plásticas para a campanha do hospital',
          unidade: 'KG',
          exigeEvidencia: true,
          pontosPorUnidade: 8,
        });

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({
        nome,
        gincanaId: gincana.id,
        unidade: 'KG',
        exigeEvidencia: true,
        ativo: true,
      });
      expect(resposta.body.regraVigente).toMatchObject({
        pontosPorUnidade: 8,
        vigenciaFim: null,
      });
      expect(resposta.body.regras).toHaveLength(1);
    });

    it('cadastra atividade extra no meio da gincana como qualquer outro tipo', async () => {
      const resposta = await request(app)
        .post(`/gincanas/${gincana.id}/tipos-acao`)
        .set('Authorization', comoAdmin)
        .send({
          nome: nomeDeTipo('Mutirão extra de inverno'),
          unidade: 'UNIDADE',
          exigeEvidencia: false,
          pontosPorUnidade: 50,
        });

      expect(resposta.status).toBe(201);
      expect(resposta.body.regraVigente.pontosPorUnidade).toBe(50);
    });

    it('recusa pontuação negativa', async () => {
      const resposta = await request(app)
        .post(`/gincanas/${gincana.id}/tipos-acao`)
        .set('Authorization', comoAdmin)
        .send({ nome: nomeDeTipo('Negativo'), unidade: 'KG', pontosPorUnidade: -1 });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
      expect(resposta.body.erro.detalhes.pontosPorUnidade).toContain(
        'Os pontos por unidade não podem ser negativos.',
      );
    });

    it('recusa nome repetido na mesma gincana', async () => {
      const nome = nomeDeTipo('Livros infantis');
      await criarTipo({ nome, unidade: 'UNIDADE', pontosPorUnidade: 5 });

      const resposta = await request(app)
        .post(`/gincanas/${gincana.id}/tipos-acao`)
        .set('Authorization', comoAdmin)
        .send({ nome, unidade: 'UNIDADE', pontosPorUnidade: 9 });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('NOME_DE_TIPO_DUPLICADO');
      expect(resposta.body.erro.mensagem).toContain(nome);
    });

    it('devolve 404 quando a gincana não existe', async () => {
      const resposta = await request(app)
        .post(`/gincanas/${ID_INEXISTENTE}/tipos-acao`)
        .set('Authorization', comoAdmin)
        .send({ nome: nomeDeTipo('Órfão'), unidade: 'KG', pontosPorUnidade: 1 });

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Gincana não encontrada.');
    });

    it('exige administradora: 401 sem token, 403 para líder e colaborador', async () => {
      const corpo = { nome: nomeDeTipo('Sem permissão'), unidade: 'KG', pontosPorUnidade: 1 };
      const caminho = `/gincanas/${gincana.id}/tipos-acao`;

      expect((await request(app).post(caminho).send(corpo)).status).toBe(401);
      expect(
        (await request(app).post(caminho).set('Authorization', comoLider).send(corpo)).status,
      ).toBe(403);
      expect(
        (await request(app).post(caminho).set('Authorization', comoColaborador).send(corpo)).status,
      ).toBe(403);

      expect(await prisma.tipoAcao.findFirst({ where: { nome: corpo.nome } })).toBeNull();
    });
  });

  describe('GET /gincanas/:gincanaId/tipos-acao', () => {
    it('devolve a pontuação que vale hoje, não a primeira nem a última cadastrada', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Horas de voluntariado'),
        unidade: 'CERTIFICADO',
        pontosPorUnidade: 8,
        vigenciaInicio: new Date(Date.now() - 10 * DIA).toISOString(),
      });

      await request(app)
        .post(`/tipos-acao/${tipo.id}/regras`)
        .set('Authorization', comoAdmin)
        .send({
          pontosPorUnidade: 10,
          vigenciaInicio: new Date(Date.now() - 2 * DIA).toISOString(),
        })
        .expect(201);
      await request(app)
        .post(`/tipos-acao/${tipo.id}/regras`)
        .set('Authorization', comoAdmin)
        .send({ pontosPorUnidade: 20, vigenciaInicio: new Date(Date.now() + DIA).toISOString() })
        .expect(201);

      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}/tipos-acao`)
        .set('Authorization', comoColaborador);

      expect(resposta.status).toBe(200);
      const encontrado = resposta.body.find(
        (item: { id: string }) => item.id === tipo.id,
      ) as unknown as { regraVigente: { pontosPorUnidade: number } };
      expect(encontrado.regraVigente.pontosPorUnidade).toBe(10);
    });

    it('esconde tipo pausado de quem registra ação e mantém à vista da administradora', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Pausado'),
        unidade: 'KG',
        pontosPorUnidade: 4,
      });

      await request(app)
        .patch(`/tipos-acao/${tipo.id}`)
        .set('Authorization', comoAdmin)
        .send({ ativo: false })
        .expect(200);

      const paraColaborador = await request(app)
        .get(`/gincanas/${gincana.id}/tipos-acao`)
        .set('Authorization', comoColaborador);
      const paraAdmin = await request(app)
        .get(`/gincanas/${gincana.id}/tipos-acao?ativo=false`)
        .set('Authorization', comoAdmin);

      const ids = (corpo: { id: string }[]) => corpo.map((item) => item.id);
      expect(ids(paraColaborador.body)).not.toContain(tipo.id);
      expect(ids(paraAdmin.body)).toContain(tipo.id);

      // Nem forjando o filtro na URL o colaborador alcança o que está pausado.
      const forjado = await request(app)
        .get(`/gincanas/${gincana.id}/tipos-acao?ativo=false`)
        .set('Authorization', comoColaborador);
      expect(ids(forjado.body)).not.toContain(tipo.id);
    });

    it('exige autenticação', async () => {
      expect((await request(app).get(`/gincanas/${gincana.id}/tipos-acao`)).status).toBe(401);
    });
  });

  describe('GET /tipos-acao/:id', () => {
    it('traz o histórico de regras para quem está autenticado', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Agasalhos'),
        unidade: 'PECA',
        pontosPorUnidade: 15,
      });
      await request(app)
        .post(`/tipos-acao/${tipo.id}/regras`)
        .set('Authorization', comoAdmin)
        .send({ pontosPorUnidade: 18 })
        .expect(201);

      const resposta = await request(app)
        .get(`/tipos-acao/${tipo.id}`)
        .set('Authorization', comoColaborador);

      expect(resposta.status).toBe(200);
      expect(resposta.body.regras).toHaveLength(2);
      expect(resposta.body.regraVigente.pontosPorUnidade).toBe(18);
    });

    it('devolve 404 para identificador inexistente e exige autenticação', async () => {
      expect(
        (await request(app).get(`/tipos-acao/${ID_INEXISTENTE}`).set('Authorization', comoAdmin))
          .status,
      ).toBe(404);
      expect((await request(app).get(`/tipos-acao/${ID_INEXISTENTE}`)).status).toBe(401);
    });
  });

  describe('PATCH /tipos-acao/:id', () => {
    it('muda nome, descrição e exigência de evidência sem tocar na pontuação', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Brinquedos'),
        unidade: 'PECA',
        pontosPorUnidade: 7,
      });

      const novoNome = nomeDeTipo('Brinquedos novos');
      const resposta = await request(app)
        .patch(`/tipos-acao/${tipo.id}`)
        .set('Authorization', comoAdmin)
        .send({ nome: novoNome, descricao: 'Brinquedos em bom estado', exigeEvidencia: false });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({ nome: novoNome, exigeEvidencia: false });
      expect(resposta.body.regraVigente.pontosPorUnidade).toBe(7);
      expect(resposta.body.regras).toHaveLength(1);
      expect(resposta.body.regras[0].id).toBe(tipo.regraVigente.id);
    });

    it('não oferece caminho para alterar a pontuação pelo cadastro do tipo', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Sem reajuste por aqui'),
        unidade: 'KG',
        pontosPorUnidade: 3,
      });

      const resposta = await request(app)
        .patch(`/tipos-acao/${tipo.id}`)
        .set('Authorization', comoAdmin)
        .send({ pontosPorUnidade: 99 });

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.detalhes.pontosPorUnidade[0]).toContain('nova regra');

      const regras = await prisma.regraPontuacao.findMany({ where: { tipoAcaoId: tipo.id } });
      expect(regras).toHaveLength(1);
      expect(Number(regras[0]?.pontosPorUnidade)).toBe(3);
    });

    it('recusa nome que já existe na gincana', async () => {
      const ocupado = await criarTipo({
        nome: nomeDeTipo('Nome ocupado'),
        unidade: 'KG',
        pontosPorUnidade: 1,
      });
      const outro = await criarTipo({
        nome: nomeDeTipo('Outro qualquer'),
        unidade: 'KG',
        pontosPorUnidade: 1,
      });

      const resposta = await request(app)
        .patch(`/tipos-acao/${outro.id}`)
        .set('Authorization', comoAdmin)
        .send({ nome: ocupado.nome });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('NOME_DE_TIPO_DUPLICADO');
    });

    it('devolve 404 quando o tipo não existe', async () => {
      const resposta = await request(app)
        .patch(`/tipos-acao/${ID_INEXISTENTE}`)
        .set('Authorization', comoAdmin)
        .send({ ativo: false });

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Tipo de ação não encontrado.');
    });

    it('exige administradora: 401 sem token, 403 para líder e colaborador', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Protegido'),
        unidade: 'KG',
        pontosPorUnidade: 1,
      });
      const caminho = `/tipos-acao/${tipo.id}`;

      expect((await request(app).patch(caminho).send({ ativo: false })).status).toBe(401);
      expect(
        (await request(app).patch(caminho).set('Authorization', comoLider).send({ ativo: false }))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(caminho)
            .set('Authorization', comoColaborador)
            .send({ ativo: false })
        ).status,
      ).toBe(403);

      const guardado = await prisma.tipoAcao.findUniqueOrThrow({ where: { id: tipo.id } });
      expect(guardado.ativo).toBe(true);
    });
  });

  describe('POST /tipos-acao/:id/regras', () => {
    it('fecha a vigência da regra atual e abre a nova, com auditoria', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Doação de alimentos'),
        unidade: 'KG',
        pontosPorUnidade: 8,
        vigenciaInicio: new Date(Date.now() - DIA).toISOString(),
      });

      const resposta = await request(app)
        .post(`/tipos-acao/${tipo.id}/regras`)
        .set('Authorization', comoAdmin)
        .send({ pontosPorUnidade: 10, motivo: 'Campanha de fim de ano' });

      expect(resposta.status).toBe(201);
      expect(resposta.body.regraVigente.pontosPorUnidade).toBe(10);
      expect(resposta.body.regras).toHaveLength(2);

      const antiga = resposta.body.regras.find(
        (regra: { id: string }) => regra.id === tipo.regraVigente.id,
      ) as unknown as { vigenciaFim: string };
      expect(antiga.vigenciaFim).toBe(resposta.body.regraVigente.vigenciaInicio);

      const auditoria = await prisma.registroAuditoria.findFirst({
        where: { entidade: 'RegraPontuacao', entidadeId: resposta.body.regraVigente.id },
      });
      expect(auditoria?.autorId).toBe(administradora.id);
      expect(auditoria?.acao).toBe('ALTERACAO');
    });

    it('recusa vigência anterior ao início da regra atual, sem gravar nada', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Retroativo'),
        unidade: 'KG',
        pontosPorUnidade: 8,
      });

      const resposta = await request(app)
        .post(`/tipos-acao/${tipo.id}/regras`)
        .set('Authorization', comoAdmin)
        .send({
          pontosPorUnidade: 10,
          vigenciaInicio: new Date(Date.now() - 30 * DIA).toISOString(),
        });

      expect(resposta.status).toBe(409);
      expect(resposta.body.erro.codigo).toBe('VIGENCIA_ANTERIOR_A_REGRA_ATUAL');

      const regras = await prisma.regraPontuacao.findMany({ where: { tipoAcaoId: tipo.id } });
      expect(regras).toHaveLength(1);
      const auditorias = await prisma.registroAuditoria.findMany({
        where: { entidade: 'RegraPontuacao', entidadeId: { in: regras.map((r) => r.id) } },
      });
      expect(auditorias.every((registro) => registro.acao === 'CRIACAO')).toBe(true);
    });

    it('agenda a troca para uma data futura', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Agendado'),
        unidade: 'KG',
        pontosPorUnidade: 8,
      });
      const futuro = new Date(Date.now() + 7 * DIA).toISOString();

      const resposta = await request(app)
        .post(`/tipos-acao/${tipo.id}/regras`)
        .set('Authorization', comoAdmin)
        .send({ pontosPorUnidade: 12, vigenciaInicio: futuro });

      expect(resposta.status).toBe(201);
      // Hoje ainda vale a regra antiga: a nova só começa na data marcada.
      expect(resposta.body.regraVigente.pontosPorUnidade).toBe(8);
      expect(
        resposta.body.regras.find(
          (regra: { vigenciaInicio: string }) => regra.vigenciaInicio === futuro,
        ).pontosPorUnidade,
      ).toBe(12);
    });

    it('devolve 404 quando o tipo não existe', async () => {
      const resposta = await request(app)
        .post(`/tipos-acao/${ID_INEXISTENTE}/regras`)
        .set('Authorization', comoAdmin)
        .send({ pontosPorUnidade: 10 });

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Tipo de ação não encontrado.');
    });

    it('exige administradora: 401 sem token, 403 para líder e colaborador', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Pontuação protegida'),
        unidade: 'KG',
        pontosPorUnidade: 8,
      });
      const caminho = `/tipos-acao/${tipo.id}/regras`;
      const corpo = { pontosPorUnidade: 99 };

      expect((await request(app).post(caminho).send(corpo)).status).toBe(401);
      expect(
        (await request(app).post(caminho).set('Authorization', comoLider).send(corpo)).status,
      ).toBe(403);
      expect(
        (await request(app).post(caminho).set('Authorization', comoColaborador).send(corpo)).status,
      ).toBe(403);

      const regras = await prisma.regraPontuacao.findMany({ where: { tipoAcaoId: tipo.id } });
      expect(regras).toHaveLength(1);
    });
  });

  describe('GET /tipos-acao/:id/regras', () => {
    it('devolve o histórico para administradora e líder, e barra o colaborador', async () => {
      const tipo = await criarTipo({
        nome: nomeDeTipo('Histórico'),
        unidade: 'KG',
        pontosPorUnidade: 8,
      });
      await request(app)
        .post(`/tipos-acao/${tipo.id}/regras`)
        .set('Authorization', comoAdmin)
        .send({ pontosPorUnidade: 10 })
        .expect(201);

      const caminho = `/tipos-acao/${tipo.id}/regras`;

      const paraAdmin = await request(app).get(caminho).set('Authorization', comoAdmin);
      expect(paraAdmin.status).toBe(200);
      expect(paraAdmin.body).toHaveLength(2);
      expect(paraAdmin.body[0].pontosPorUnidade).toBe(10);
      expect(paraAdmin.body[1].pontosPorUnidade).toBe(8);

      expect((await request(app).get(caminho).set('Authorization', comoLider)).status).toBe(200);
      expect((await request(app).get(caminho).set('Authorization', comoColaborador)).status).toBe(
        403,
      );
      expect((await request(app).get(caminho)).status).toBe(401);
    });
  });
});
