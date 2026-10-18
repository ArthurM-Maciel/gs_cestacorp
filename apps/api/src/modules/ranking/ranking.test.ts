import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../../app.js';
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

/**
 * US11 — o placar por equipe.
 *
 * O cenário tem três equipes com lançamento e uma sem nenhum, e mistura aprovado,
 * pendente e recusado de propósito: a regra que a cliente mais vai conferir é que só
 * aprovado soma. Os números são os da inception — 24 kg de tampinhas a 10 pontos o quilo
 * dão 240, 3 peças de roupa a 15 dão 45.
 */

const app = criarApp();
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

interface LinhaDoPlacar {
  posicao: number;
  empatada: boolean;
  equipeId: string;
  equipe: { id: string; nome: string };
  lider: { id: string; nome: string } | null;
  pontos: number;
  acoesAprovadas: number;
  totalColaboradores: number;
}

describe('US11 — ranking da gincana', () => {
  let cenario: CenarioDeCadastro;
  let gincana: GincanaDeTeste;
  let alfa: EquipeDeTeste;
  let beta: EquipeDeTeste;
  let gama: EquipeDeTeste;
  let delta: EquipeDeTeste;
  let marieri: PessoaDeTeste;
  let liderAlfa: PessoaDeTeste;
  let ana: PessoaDeTeste;
  let bruno: PessoaDeTeste;
  let carla: PessoaDeTeste;
  let tampinhas: TipoAcaoDeTeste;
  let roupas: TipoAcaoDeTeste;

  let comoAdmin: string;
  let comoAna: string;

  /** Cria o lançamento pela API, em nome de quem o token identifica. */
  async function lancar(
    token: string,
    corpo: { tipoAcaoId: string; quantidade: number; dataAcao?: string },
  ): Promise<string> {
    const resposta = await request(app)
      .post('/lancamentos')
      .set('Authorization', token)
      .send({ dataAcao: hojeISO(), ...corpo });

    expect(resposta.status).toBe(201);
    return resposta.body.id as string;
  }

  async function aprovar(id: string): Promise<void> {
    const resposta = await request(app)
      .post(`/lancamentos/${id}/aprovar`)
      .set('Authorization', comoAdmin)
      .send({});
    expect(resposta.status).toBe(200);
  }

  async function recusar(id: string): Promise<void> {
    const resposta = await request(app)
      .post(`/lancamentos/${id}/recusar`)
      .set('Authorization', comoAdmin)
      .send({ motivoRecusa: 'Foto sem a etiqueta da ONG' });
    expect(resposta.status).toBe(200);
  }

  async function placar(
    token: string,
    consulta: Record<string, string> = {},
  ): Promise<LinhaDoPlacar[]> {
    const resposta = await request(app)
      .get(`/gincanas/${gincana.id}/ranking`)
      .query(consulta)
      .set('Authorization', token);

    expect(resposta.status).toBe(200);
    return resposta.body.linhas as LinhaDoPlacar[];
  }

  const linhaDe = (linhas: LinhaDoPlacar[], equipeId: string): LinhaDoPlacar => {
    const linha = linhas.find((item) => item.equipeId === equipeId);
    if (!linha) {
      throw new Error('A equipe sumiu do placar.');
    }
    return linha;
  };

  beforeAll(async () => {
    cenario = await criarCenarioDeCadastro();
    gincana = await cenario.criarGincana({ status: 'ATIVA', ...PERIODO_QUE_INCLUI_HOJE });

    alfa = await cenario.criarEquipe(gincana.id, 'Alfa');
    beta = await cenario.criarEquipe(gincana.id, 'Beta');
    gama = await cenario.criarEquipe(gincana.id, 'Gama');
    delta = await cenario.criarEquipe(gincana.id, 'Delta');

    // A administradora não está em equipe nenhuma: assim ela aprova tudo sem esbarrar na
    // trava de não avaliar o próprio lançamento.
    marieri = await cenario.criarPessoa({ papel: 'ADMIN' });
    liderAlfa = await cenario.criarPessoa({ papel: 'LIDER', lideraEquipeId: alfa.id });
    ana = await cenario.criarPessoa({ equipeId: alfa.id });
    bruno = await cenario.criarPessoa({ equipeId: beta.id });
    carla = await cenario.criarPessoa({ equipeId: gama.id });

    comoAdmin = `Bearer ${marieri.token}`;
    comoAna = `Bearer ${ana.token}`;

    tampinhas = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: 'Tampinhas',
      unidade: 'KG',
      pontosPorUnidade: 10,
    });
    roupas = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: 'Roupas',
      unidade: 'PECA',
      pontosPorUnidade: 15,
    });

    // Alfa: 24 kg hoje (240) e 3 peças de dez dias atrás (45) — os dois aprovados.
    await aprovar(await lancar(comoAna, { tipoAcaoId: tampinhas.id, quantidade: 24 }));
    await aprovar(
      await lancar(comoAna, {
        tipoAcaoId: roupas.id,
        quantidade: 3,
        dataAcao: diasAtrasISO(10),
      }),
    );

    // Beta: 24 kg aprovados, mais um pendente e um recusado que não podem somar.
    const comoBruno = `Bearer ${bruno.token}`;
    await aprovar(await lancar(comoBruno, { tipoAcaoId: tampinhas.id, quantidade: 24 }));
    await lancar(comoBruno, { tipoAcaoId: tampinhas.id, quantidade: 100 });
    await recusar(await lancar(comoBruno, { tipoAcaoId: tampinhas.id, quantidade: 50 }));

    // Gama: 28,5 kg aprovados — empata com Alfa no placar geral.
    const comoCarla = `Bearer ${carla.token}`;
    await aprovar(await lancar(comoCarla, { tipoAcaoId: tampinhas.id, quantidade: 28.5 }));

    // Delta não tem lançamento nenhum, de propósito.
  });

  afterAll(async () => {
    await cenario.limpar();
  });

  describe('o placar geral', () => {
    it('soma só o que foi aprovado', async () => {
      const linhas = await placar(comoAna);

      // Beta tem 100 kg pendentes e 50 kg recusados; nada disso entra.
      expect(linhaDe(linhas, beta.id)).toMatchObject({ pontos: 240, acoesAprovadas: 1 });
      expect(linhaDe(linhas, alfa.id)).toMatchObject({ pontos: 285, acoesAprovadas: 2 });
      expect(linhaDe(linhas, gama.id)).toMatchObject({ pontos: 285, acoesAprovadas: 1 });
    });

    it('lista toda equipe da gincana, inclusive a que ainda não pontuou', async () => {
      const linhas = await placar(comoAna);

      expect(linhas).toHaveLength(4);
      expect(linhaDe(linhas, delta.id)).toMatchObject({
        pontos: 0,
        acoesAprovadas: 0,
        posicao: 4,
      });
    });

    it('divide a posição no empate e pula a seguinte', async () => {
      const linhas = await placar(comoAna);

      expect(linhas.map((linha) => [linha.equipe.nome, linha.posicao, linha.empatada])).toEqual([
        ['Alfa', 1, true],
        ['Gama', 1, true],
        ['Beta', 3, false],
        ['Delta', 4, false],
      ]);
    });

    it('traz a liderança e o tamanho da equipe', async () => {
      const linhas = await placar(comoAna);

      expect(linhaDe(linhas, alfa.id).lider).toEqual({ id: liderAlfa.id, nome: liderAlfa.nome });
      expect(linhaDe(linhas, beta.id).lider).toBeNull();
      // Ana e quem lidera a Alfa estão na equipe; Delta está vazia.
      expect(linhaDe(linhas, alfa.id).totalColaboradores).toBe(2);
      expect(linhaDe(linhas, delta.id).totalColaboradores).toBe(0);
    });

    it('devolve 404 para gincana que não existe', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${ID_INEXISTENTE}/ranking`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Gincana não encontrada.');
    });
  });

  describe('o filtro de período', () => {
    it('conta só os lançamentos cuja data da ação cai na janela', async () => {
      const linhas = await placar(comoAna, { desde: diasAtrasISO(3), ate: hojeISO() });

      // As 3 peças da Alfa são de dez dias atrás: ficam de fora.
      expect(linhaDe(linhas, alfa.id)).toMatchObject({ pontos: 240, acoesAprovadas: 1 });
      expect(linhaDe(linhas, beta.id).pontos).toBe(240);
      expect(linhaDe(linhas, gama.id).pontos).toBe(285);
    });

    it('reordena o pódio conforme a janela', async () => {
      const linhas = await placar(comoAna, { desde: diasAtrasISO(3) });

      expect(linhas.map((linha) => [linha.equipe.nome, linha.posicao])).toEqual([
        ['Gama', 1],
        ['Alfa', 2],
        ['Beta', 2],
        ['Delta', 4],
      ]);
    });

    it('devolve o recorte aplicado, para a tela confirmar o filtro', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}/ranking`)
        .query({ desde: diasAtrasISO(3) })
        .set('Authorization', comoAna);

      expect(resposta.body).toMatchObject({ desde: diasAtrasISO(3), ate: null });
    });

    it('recusa janela invertida', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}/ranking`)
        .query({ desde: hojeISO(), ate: diasAtrasISO(10) })
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(400);
      expect(resposta.body.erro.detalhes.ate).toContain(
        'A data final não pode ser anterior à inicial.',
      );
    });
  });

  describe('o extrato da equipe', () => {
    it('abre a pontuação por tipo de ação', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}/ranking/equipes/${alfa.id}`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({
        equipe: { id: alfa.id, nome: 'Alfa' },
        posicao: 1,
        empatada: true,
        pontos: 285,
        acoesAprovadas: 2,
      });
      expect(resposta.body.linhas).toEqual([
        {
          tipoAcaoId: tampinhas.id,
          tipoAcao: { id: tampinhas.id, nome: 'Tampinhas', unidade: 'KG' },
          quantidade: 24,
          acoesAprovadas: 1,
          pontos: 240,
        },
        {
          tipoAcaoId: roupas.id,
          tipoAcao: { id: roupas.id, nome: 'Roupas', unidade: 'PECA' },
          quantidade: 3,
          acoesAprovadas: 1,
          pontos: 45,
        },
      ]);
    });

    it('respeita o filtro de período', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}/ranking/equipes/${alfa.id}`)
        .query({ desde: diasAtrasISO(3) })
        .set('Authorization', comoAna);

      expect(resposta.body.pontos).toBe(240);
      expect(resposta.body.linhas).toHaveLength(1);
    });

    it('mostra a equipe sem lançamento com zero e sem linhas', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}/ranking/equipes/${delta.id}`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({ pontos: 0, acoesAprovadas: 0, linhas: [] });
    });

    it('devolve 404 para equipe que não é desta gincana', async () => {
      const resposta = await request(app)
        .get(`/gincanas/${gincana.id}/ranking/equipes/${ID_INEXISTENTE}`)
        .set('Authorization', comoAna);

      expect(resposta.status).toBe(404);
      expect(resposta.body.erro.mensagem).toBe('Equipe não encontrada nesta gincana.');
    });
  });

  describe('quem alcança o placar', () => {
    it('qualquer perfil autenticado vê o placar da gincana', async () => {
      for (const pessoa of [ana, bruno, carla, liderAlfa, marieri]) {
        const resposta = await request(app)
          .get(`/gincanas/${gincana.id}/ranking`)
          .set('Authorization', `Bearer ${pessoa.token}`);

        expect(resposta.status).toBe(200);
      }
    });

    it('exige token no placar e no extrato', async () => {
      const semToken = await request(app).get(`/gincanas/${gincana.id}/ranking`);
      expect(semToken.status).toBe(401);

      const extrato = await request(app).get(`/gincanas/${gincana.id}/ranking/equipes/${alfa.id}`);
      expect(extrato.status).toBe(401);
    });
  });
});

/**
 * Os pontos do placar são os congelados no lançamento.
 *
 * Cenário próprio para não contaminar o placar de cima: a troca de pontuação é uma
 * mudança de cadastro e valeria para qualquer lançamento novo da mesma gincana.
 */
describe('US11 — o placar usa os pontos congelados', () => {
  let cenario: CenarioDeCadastro;

  afterAll(async () => {
    await cenario.limpar();
  });

  it('não recalcula lançamento antigo quando a regra muda', async () => {
    cenario = await criarCenarioDeCadastro();
    const gincana = await cenario.criarGincana({ status: 'ATIVA', ...PERIODO_QUE_INCLUI_HOJE });
    const equipe = await cenario.criarEquipe(gincana.id, 'Congeladas');
    const marieri = await cenario.criarPessoa({ papel: 'ADMIN' });
    const dinho = await cenario.criarPessoa({ equipeId: equipe.id });

    const doces = await cenario.criarTipoAcao(gincana.id, marieri.id, {
      nome: 'Doces',
      unidade: 'UNIDADE',
      pontosPorUnidade: 8,
    });

    const criado = await request(app)
      .post('/lancamentos')
      .set('Authorization', `Bearer ${dinho.token}`)
      .send({ tipoAcaoId: doces.id, quantidade: 10, dataAcao: hojeISO() });
    expect(criado.status).toBe(201);
    expect(criado.body.pontosCalculados).toBe(80);

    await request(app)
      .post(`/lancamentos/${criado.body.id}/aprovar`)
      .set('Authorization', `Bearer ${marieri.token}`)
      .send({});

    const antes = await request(app)
      .get(`/gincanas/${gincana.id}/ranking`)
      .set('Authorization', `Bearer ${dinho.token}`);
    expect(antes.body.linhas[0].pontos).toBe(80);

    // A administradora sobe a pontuação de 8 para 10: vale só para lançamento novo.
    await cenario.trocarPontuacao(doces.id, 10, marieri.id);

    const depois = await request(app)
      .get(`/gincanas/${gincana.id}/ranking`)
      .set('Authorization', `Bearer ${dinho.token}`);

    expect(depois.body.linhas[0].pontos).toBe(80);
  });
});
