import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
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

/**
 * US09 — "quero ver quem aprovou ou alterou cada lançamento".
 *
 * O cenário segue a vida inteira de um lançamento: criado pela Ana, recusado pelo líder,
 * corrigido pela Ana e aprovado pelo líder. É a linha do tempo que a tela desenha, e é
 * também a evidência que o selo PQCRS exige.
 */

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

interface EntradaDaTrilha {
  acao: string;
  autor: { id: string; nome: string };
  descricao: string | null;
  criadoEm: string;
  mudancas: { campo: string; rotulo: string; de: string | null; para: string | null }[];
  valoresAntes: Record<string, unknown> | null;
  valoresDepois: Record<string, unknown> | null;
}

describe('US09 — trilha de auditoria', () => {
  let cenario: CenarioDeCadastro;
  let gincana: GincanaDeTeste;
  let equipeA: EquipeDeTeste;
  let equipeB: EquipeDeTeste;
  let marieri: PessoaDeTeste;
  let liderA: PessoaDeTeste;
  let liderB: PessoaDeTeste;
  let ana: PessoaDeTeste;
  let bruno: PessoaDeTeste;
  let tampinhas: TipoAcaoDeTeste;

  let comoAdmin: string;
  let comoLiderA: string;
  let comoLiderB: string;
  let comoAna: string;
  let comoBruno: string;

  /** O lançamento que nasceu, foi recusado, corrigido e aprovado. */
  let lancamentoId: string;

  async function trilhaDe(id: string, token: string): Promise<EntradaDaTrilha[]> {
    const resposta = await request(app)
      .get(`/lancamentos/${id}/auditoria`)
      .set('Authorization', token);

    expect(resposta.status).toBe(200);
    return resposta.body.itens as EntradaDaTrilha[];
  }

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    gincana = await cenario.criarGincana({ status: 'ATIVA', ...PERIODO_QUE_INCLUI_HOJE });
    equipeA = await cenario.criarEquipe(gincana.id);
    equipeB = await cenario.criarEquipe(gincana.id);

    marieri = await cenario.criarPessoa({ papel: 'ADMIN' });
    liderA = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipeA.id });
    liderB = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: equipeB.id });
    ana = await cenario.criarPessoa({ equipeId: equipeA.id });
    bruno = await cenario.criarPessoa({ equipeId: equipeB.id });

    comoAdmin = `Bearer ${marieri.token}`;
    comoLiderA = `Bearer ${liderA.token}`;
    comoLiderB = `Bearer ${liderB.token}`;
    comoAna = `Bearer ${ana.token}`;
    comoBruno = `Bearer ${bruno.token}`;

    tampinhas = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: 'Tampinhas',
      unidade: 'KG',
      pontosPorUnidade: 10,
    });

    const criado = await request(app)
      .post('/lancamentos')
      .set('Authorization', comoAna)
      .send({ tipoAcaoId: tampinhas.id, quantidade: 12, dataAcao: hojeISO() });
    expect(criado.status).toBe(201);
    lancamentoId = criado.body.id as string;

    await request(app)
      .post(`/lancamentos/${lancamentoId}/recusar`)
      .set('Authorization', comoLiderA)
      .send({ motivoRecusa: 'Foto sem a etiqueta da ONG' })
      .expect(200);

    await request(app)
      .patch(`/lancamentos/${lancamentoId}`)
      .set('Authorization', comoAna)
      .send({ quantidade: 15 })
      .expect(200);

    await request(app)
      .post(`/lancamentos/${lancamentoId}/aprovar`)
      .set('Authorization', comoLiderA)
      .send({})
      .expect(200);
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('a linha do tempo do lançamento', () => {
    it('traz as quatro entradas na ordem, com o nome de quem fez cada uma', async () => {
      const itens = await trilhaDe(lancamentoId, comoAna);

      expect(itens.map((item) => [item.acao, item.autor.nome])).toEqual([
        ['CRIACAO', ana.nome],
        ['RECUSA', liderA.nome],
        ['ALTERACAO', ana.nome],
        ['APROVACAO', liderA.nome],
      ]);
    });

    it('diz o que mudou em cada passo, em texto que a tela exibe', async () => {
      const itens = await trilhaDe(lancamentoId, comoAna);
      const [, recusa, alteracao, aprovacao] = itens;

      expect(recusa?.mudancas).toContainEqual({
        campo: 'status',
        rotulo: 'Situação',
        de: 'Pendente',
        para: 'Recusado',
      });
      expect(recusa?.descricao).toBe('Lançamento recusado: Foto sem a etiqueta da ONG');

      expect(alteracao?.mudancas).toContainEqual({
        campo: 'quantidade',
        rotulo: 'Quantidade',
        de: '12',
        para: '15',
      });
      // A correção devolveu o lançamento para a fila e recalculou os pontos.
      expect(alteracao?.mudancas).toContainEqual({
        campo: 'pontosCalculados',
        rotulo: 'Pontos',
        de: '120',
        para: '150',
      });

      expect(aprovacao?.mudancas).toContainEqual({
        campo: 'status',
        rotulo: 'Situação',
        de: 'Pendente',
        para: 'Aprovado',
      });
    });

    it('mantém os valores crus ao lado da comparação', async () => {
      const itens = await trilhaDe(lancamentoId, comoAna);

      expect(itens[0]?.valoresAntes).toBeNull();
      expect(itens[0]?.valoresDepois).toMatchObject({ quantidade: 12, status: 'PENDENTE' });
      expect(itens[3]?.valoresAntes).toMatchObject({ status: 'PENDENTE' });
      expect(itens[3]?.valoresDepois).toMatchObject({ status: 'APROVADO' });
    });

    it('o líder da equipe e a administradora enxergam a mesma trilha', async () => {
      const doLider = await trilhaDe(lancamentoId, comoLiderA);
      const daAdmin = await trilhaDe(lancamentoId, comoAdmin);

      expect(doLider).toHaveLength(4);
      expect(daAdmin).toHaveLength(4);
    });

    it('o líder de outra equipe não alcança a trilha', async () => {
      const resposta = await request(app)
        .get(`/lancamentos/${lancamentoId}/auditoria`)
        .set('Authorization', comoLiderB);

      // 404, igual ao que `GET /lancamentos/:id` já faz: a existência do lançamento
      // alheio não vaza pela diferença entre 403 e 404.
      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Lançamento não encontrado.');
    });

    it('o colaborador de outra equipe também não alcança', async () => {
      const resposta = await request(app)
        .get(`/lancamentos/${lancamentoId}/auditoria`)
        .set('Authorization', comoBruno);

      expect(resposta.status).toBe(404);
    });

    it('devolve 404 para lançamento que não existe', async () => {
      const resposta = await request(app)
        .get(`/lancamentos/${ID_INEXISTENTE}/auditoria`)
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(404);
    });

    it('exige token', async () => {
      const resposta = await request(app).get(`/lancamentos/${lancamentoId}/auditoria`);
      expect(resposta.status).toBe(401);
    });
  });

  describe('o painel de evidência da administradora', () => {
    it('o colaborador não alcança', async () => {
      const resposta = await request(app).get('/auditoria').set('Authorization', comoAna);

      expect(resposta.status).toBe(403);
      expect(resposta.body.erro.codigo).toBe('SEM_PERMISSAO');
    });

    it('o líder também não alcança', async () => {
      const resposta = await request(app).get('/auditoria').set('Authorization', comoLiderA);
      expect(resposta.status).toBe(403);
    });

    it('exige token', async () => {
      const resposta = await request(app).get('/auditoria');
      expect(resposta.status).toBe(401);
    });

    it('a administradora consulta e filtra por entidade', async () => {
      const resposta = await request(app)
        .get('/auditoria')
        .query({ entidade: 'Lancamento', entidadeId: lancamentoId })
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(200);
      expect(resposta.body.total).toBe(4);
      // Mais recentes primeiro: é o que a tela de evidência mostra no topo.
      expect(resposta.body.itens.map((item: EntradaDaTrilha) => item.acao)).toEqual([
        'APROVACAO',
        'ALTERACAO',
        'RECUSA',
        'CRIACAO',
      ]);
    });

    it('filtra por ação e por autor', async () => {
      const porAcao = await request(app)
        .get('/auditoria')
        .query({ entidadeId: lancamentoId, acao: 'APROVACAO' })
        .set('Authorization', comoAdmin);

      expect(porAcao.body.total).toBe(1);
      expect(porAcao.body.itens[0].autor).toEqual({ id: liderA.id, nome: liderA.nome });

      const porAutor = await request(app)
        .get('/auditoria')
        .query({ entidadeId: lancamentoId, autorId: ana.id })
        .set('Authorization', comoAdmin);

      expect(porAutor.body.total).toBe(2);
      expect(porAutor.body.itens.map((item: EntradaDaTrilha) => item.acao)).toEqual([
        'ALTERACAO',
        'CRIACAO',
      ]);
    });

    it('pagina o resultado', async () => {
      const resposta = await request(app)
        .get('/auditoria')
        .query({ entidadeId: lancamentoId, pagina: 2, porPagina: 3 })
        .set('Authorization', comoAdmin);

      expect(resposta.body).toMatchObject({
        pagina: 2,
        porPagina: 3,
        total: 4,
        totalDePaginas: 2,
      });
      expect(resposta.body.itens).toHaveLength(1);
    });

    it('recusa filtro malformado', async () => {
      const resposta = await request(app)
        .get('/auditoria')
        .query({ acao: 'SUMIU' })
        .set('Authorization', comoAdmin);

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.codigo).toBe('DADOS_INVALIDOS');
    });
  });
});
