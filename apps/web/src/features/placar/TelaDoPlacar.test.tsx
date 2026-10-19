import type { LinhaDoExtrato, PeriodoDoRankingQuery } from '@gincana/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cenarioDeLancamentos,
  comSessaoDe,
  EQUIPE_DO_TESTE,
  rotasDeLancamentos,
} from '../../simulacao-de-lancamentos.js';
import {
  classificar,
  rotasDoPlacar,
  umaLinhaDoExtrato,
  umTotalDeEquipe,
  type TotalDaEquipe,
} from '../../simulacao-do-placar.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

/**
 * O relógio é fixado numa quinta-feira, 12/11/2026, às 16:00: a semana é de 09/11 a 15/11 e o
 * placar apurado às 10:15 do mesmo dia aparece como "hoje, 10:15". Só `Date` é trocado;
 * os temporizadores continuam reais, para a consulta e o `findBy` seguirem como em produção.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 12, 16, 0) });
});
afterEach(() => {
  vi.useRealTimers();
});

const menuLateral = () => screen.getByRole('navigation', { name: 'Menu principal' });

function lider(nome: string) {
  return { id: `00000000-0000-4000-8000-00000000${String(nome.length).padStart(4, '0')}`, nome };
}

/** As seis equipes do protótipo. Araucária é a do usuário de teste. */
function equipesDoPrototipo() {
  const ipe = umTotalDeEquipe('Ipê', 4280, {
    lider: lider('Fernanda Exemplo'),
    acoesAprovadas: 74,
  });
  const araucaria = umTotalDeEquipe('Araucária', 3910, {
    equipeId: EQUIPE_DO_TESTE,
    lider: lider('Arthur Exemplo'),
    acoesAprovadas: 69,
  });
  const jacaranda = umTotalDeEquipe('Jacarandá', 3355, {
    lider: lider('Bruno Exemplo'),
    acoesAprovadas: 66,
  });
  const paineira = umTotalDeEquipe('Paineira', 3120, {
    lider: lider('Juliana Exemplo'),
    acoesAprovadas: 71,
  });
  const figueira = umTotalDeEquipe('Figueira', 2870, {
    lider: lider('Marcos Exemplo'),
    acoesAprovadas: 70,
  });
  const pitanga = umTotalDeEquipe('Pitanga', 2540, {
    lider: lider('Letícia Exemplo'),
    acoesAprovadas: 62,
  });
  return { ipe, araucaria, jacaranda, paineira, figueira, pitanga };
}

function abrirPlacar(
  papel: 'COLABORADOR' | 'LIDER' | 'ADMIN',
  totaisDo: (periodo: PeriodoDoRankingQuery) => TotalDaEquipe[],
  extratos: Record<string, LinhaDoExtrato[]> = {},
  caminho = '/placar',
) {
  const { estado, gincana } = cenarioDeLancamentos();
  const { rotas, chamadas, chamadasDoExtrato } = rotasDoPlacar(gincana, totaisDo, extratos);
  comSessaoDe(papel, { ...rotasDeLancamentos(estado), ...rotas });
  const tela = renderizarNaRota(caminho);
  return { ...tela, estado, gincana, chamadas, chamadasDoExtrato };
}

const lista = () => screen.findByRole('list', { name: 'Ranking completo' });
const podio = () => screen.findByRole('region', { name: 'Pódio: as três primeiras equipes' });

describe('Placar da gincana (US11)', () => {
  describe('ranking', () => {
    it('mostra as equipes na ordem do placar, com líder, ações e pontos', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [
        e.pitanga,
        e.ipe,
        e.paineira,
        e.araucaria,
        e.figueira,
        e.jacaranda,
      ]);

      const linhas = within(await lista()).getAllByRole('listitem');

      expect(linhas).toHaveLength(6);
      const esperado = [
        ['1º', 'Equipe Ipê', 'Fernanda Exemplo', '74', '4.280 pts'],
        ['2º', 'Equipe Araucária', 'Arthur Exemplo', '69', '3.910 pts'],
        ['3º', 'Equipe Jacarandá', 'Bruno Exemplo', '66', '3.355 pts'],
        ['4º', 'Equipe Paineira', 'Juliana Exemplo', '71', '3.120 pts'],
        ['5º', 'Equipe Figueira', 'Marcos Exemplo', '70', '2.870 pts'],
        ['6º', 'Equipe Pitanga', 'Letícia Exemplo', '62', '2.540 pts'],
      ];
      esperado.forEach((campos, indice) => {
        for (const campo of campos) {
          expect(linhas[indice]).toHaveTextContent(campo);
        }
      });
    });

    it('diz quando o placar foi apurado e que só lançamento aprovado conta', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [e.ipe, e.araucaria]);

      expect(
        await screen.findByText('Atualizado hoje, 10:15. Só lançamentos aprovados contam.'),
      ).toBeVisible();
    });

    it('destaca a equipe de quem está olhando, e só ela', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [e.ipe, e.araucaria, e.jacaranda]);

      const linhas = within(await lista()).getAllByRole('listitem');

      expect(linhas[1]).toHaveTextContent('Equipe Araucária');
      expect(linhas[1]).toHaveTextContent('sua equipe');
      expect(linhas[0]).not.toHaveTextContent('sua equipe');
      expect(linhas[2]).not.toHaveTextContent('sua equipe');
    });

    it('para a administradora, que não é de equipe nenhuma, ninguém é "sua equipe"', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('ADMIN', () => [e.ipe, e.araucaria]);

      await lista();

      expect(screen.queryByText('sua equipe')).not.toBeInTheDocument();
      // O placar abre dentro do menu da administradora, com o item marcado.
      expect(within(menuLateral()).getByRole('link', { name: 'Placar' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('o líder também vê o placar dentro do próprio menu', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('LIDER', () => [e.ipe, e.araucaria]);

      const linhas = within(await lista()).getAllByRole('listitem');

      expect(linhas[1]).toHaveTextContent('sua equipe');
      expect(within(menuLateral()).getByRole('link', { name: 'Aprovações' })).toBeVisible();
    });
  });

  describe('pódio', () => {
    it('lê as três primeiras equipes na ordem do placar, com posição, equipe e pontos', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [
        e.pitanga,
        e.ipe,
        e.paineira,
        e.araucaria,
        e.figueira,
        e.jacaranda,
      ]);

      const botoes = within(await podio()).getAllByRole('button');

      // A ordem visual (2º, 1º, 3º) é CSS; no DOM, que é o que o leitor de tela lê, é 1º, 2º, 3º.
      expect(botoes).toHaveLength(3);
      expect(botoes[0]).toHaveAccessibleName('1º lugar: Equipe Ipê, 4.280 pontos');
      expect(botoes[1]).toHaveAccessibleName(
        '2º lugar: Equipe Araucária, sua equipe, 3.910 pontos',
      );
      expect(botoes[2]).toHaveAccessibleName('3º lugar: Equipe Jacarandá, 3.355 pontos');
    });

    it('mostra o pódio com menos de três equipes', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [e.ipe, e.araucaria]);

      expect(within(await podio()).getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('empate', () => {
    it('duas equipes em 2º aparecem as duas como 2º, e a seguinte é 4ª', async () => {
      // O duplo de teste da API confere com o contrato antes de a tela confiar nele.
      const e = equipesDoPrototipo();
      const gemea = umTotalDeEquipe('Gêmea', 3910, {
        lider: lider('Elisa Exemplo'),
        acoesAprovadas: 60,
      });
      const totais = [e.ipe, e.araucaria, gemea, e.paineira];
      expect(classificar(totais).map((linha) => linha.posicao)).toEqual([1, 2, 2, 4]);
      expect(classificar(totais).map((linha) => linha.empatada)).toEqual([
        false,
        true,
        true,
        false,
      ]);

      abrirPlacar('COLABORADOR', () => totais);

      const linhas = within(await lista()).getAllByRole('listitem');
      expect(linhas).toHaveLength(4);
      // O nome que o leitor de tela lê é o do botão que cada linha contém.
      const nomeDe = (indice: number) => within(linhas[indice]!).getByRole('button');
      expect(nomeDe(1)).toHaveAccessibleName(
        '2º lugar (empate), Equipe Araucária, sua equipe, Líder: Arthur Exemplo, 69 ações, 3.910 pts',
      );
      expect(nomeDe(2)).toHaveAccessibleName(/^2º lugar \(empate\), Equipe Gêmea/);
      expect(nomeDe(3)).toHaveAccessibleName(/^4º lugar, Equipe Paineira/);
      // O empate também aparece escrito, para quem não tem leitor de tela.
      expect(within(linhas[1]!).getByText('empate')).toBeVisible();
      expect(within(linhas[0]!).queryByText('empate')).not.toBeInTheDocument();

      // O pódio repete a mesma verdade: ninguém aparece como 3º.
      const botoes = within(await podio()).getAllByRole('button');
      expect(botoes[1]).toHaveAccessibleName(/^2º lugar \(empate\): Equipe Araucária/);
      expect(botoes[2]).toHaveAccessibleName(/^2º lugar \(empate\): Equipe Gêmea/);
      expect(screen.queryByText(/3º/)).not.toBeInTheDocument();
    });

    it('avisa quando o empate do pódio tem equipes que ficaram de fora dele', async () => {
      const totais = [
        umTotalDeEquipe('Ipê', 500),
        umTotalDeEquipe('Alfa', 300),
        umTotalDeEquipe('Beta', 300),
        umTotalDeEquipe('Gama', 300),
      ];
      abrirPlacar('COLABORADOR', () => totais);

      const pódio = await podio();

      expect(within(pódio).getAllByRole('button')).toHaveLength(3);
      expect(within(pódio).getByText(/mais uma equipe também está em 2º lugar/i)).toBeVisible();
      // A lista completa tem as quatro.
      expect(within(await lista()).getAllByRole('listitem')).toHaveLength(4);
    });
  });

  describe('equipe sem pontos', () => {
    it('aparece na lista com zero, em vez de sumir', async () => {
      const e = equipesDoPrototipo();
      const novata = umTotalDeEquipe('Novata', 0, { lider: lider('Rita Exemplo') });
      abrirPlacar('COLABORADOR', () => [e.ipe, e.araucaria, e.jacaranda, e.paineira, novata]);

      const linhas = within(await lista()).getAllByRole('listitem');

      expect(linhas).toHaveLength(5);
      expect(linhas[4]).toHaveTextContent('Equipe Novata');
      expect(linhas[4]).toHaveTextContent('0 pts');
      expect(linhas[4]).toHaveTextContent('0');
    });

    it('com todas em zero, não monta um pódio de vencedoras que não pontuaram', async () => {
      abrirPlacar('COLABORADOR', () => [
        umTotalDeEquipe('Alfa', 0),
        umTotalDeEquipe('Beta', 0),
        umTotalDeEquipe('Gama', 0),
      ]);

      const linhas = within(await lista()).getAllByRole('listitem');

      expect(await screen.findByText('Nenhuma equipe pontuou ainda')).toBeVisible();
      expect(
        screen.getByText(/os pontos entram quando o líder aprova os lançamentos/i),
      ).toBeVisible();
      expect(screen.queryByRole('region', { name: /pódio/i })).not.toBeInTheDocument();
      // As três continuam na lista, todas em 1º e marcadas como empate.
      expect(linhas).toHaveLength(3);
      expect(within(linhas[0]!).getByRole('button')).toHaveAccessibleName(/^1º lugar \(empate\)/);
      expect(within(linhas[2]!).getByRole('button')).toHaveAccessibleName(/^1º lugar \(empate\)/);
    });
  });

  describe('filtro de período', () => {
    it('começa no geral, sem mandar data nenhuma, e "Esta semana" refaz a consulta com a janela da semana', async () => {
      const e = equipesDoPrototipo();
      // Na semana, a Jacarandá é quem lidera: o placar de "Esta semana" é outro.
      const naSemana = [
        { ...e.jacaranda, pontos: 600 },
        { ...e.ipe, pontos: 450 },
        { ...e.araucaria, pontos: 90 },
      ];
      const { chamadas } = abrirPlacar('COLABORADOR', (periodo) =>
        periodo.desde === undefined ? [e.ipe, e.araucaria, e.jacaranda] : naSemana,
      );

      let linhas = within(await lista()).getAllByRole('listitem');
      expect(linhas[0]).toHaveTextContent('Equipe Ipê');
      expect(chamadas).toEqual([{}]);
      expect(screen.getByRole('radio', { name: 'Geral' })).toBeChecked();

      fireEvent.click(screen.getByRole('radio', { name: 'Esta semana' }));

      // 12/11/2026 é uma quinta-feira: a semana vai da segunda 09/11 ao domingo 15/11.
      await waitFor(() => {
        expect(chamadas).toContainEqual({ desde: '2026-11-09', ate: '2026-11-15' });
      });
      await waitFor(() => {
        linhas = within(screen.getByRole('list', { name: 'Ranking completo' })).getAllByRole(
          'listitem',
        );
        expect(linhas[0]).toHaveTextContent('Equipe Jacarandá');
      });
      expect(linhas[0]).toHaveTextContent('600 pts');
      expect(screen.getByRole('radio', { name: 'Esta semana' })).toBeChecked();
      expect(
        screen.getByText(/Esta semana \(09\/11 a 15\/11\)\. Atualizado hoje, 10:15\./),
      ).toBeVisible();
    });

    it('volta ao geral e consulta de novo sem as datas', async () => {
      const e = equipesDoPrototipo();
      const { chamadas } = abrirPlacar(
        'COLABORADOR',
        () => [e.ipe, e.araucaria],
        {},
        '/placar?periodo=semana',
      );

      await lista();
      expect(chamadas[0]).toEqual({ desde: '2026-11-09', ate: '2026-11-15' });

      fireEvent.click(screen.getByRole('radio', { name: 'Geral' }));

      await waitFor(() => {
        expect(chamadas).toContainEqual({});
      });
      expect(screen.getByRole('radio', { name: 'Geral' })).toBeChecked();
    });

    it('abre direto na semana quando o endereço pede, e entende lixo como "Geral"', async () => {
      const e = equipesDoPrototipo();
      const { chamadas } = abrirPlacar(
        'COLABORADOR',
        () => [e.ipe, e.araucaria],
        {},
        '/placar?periodo=ano-que-vem',
      );

      await lista();

      expect(screen.getByRole('radio', { name: 'Geral' })).toBeChecked();
      expect(chamadas).toEqual([{}]);
    });

    it('é um grupo de opções navegável por teclado, com nome', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [e.ipe]);
      await lista();

      const grupo = screen.getByRole('group', { name: 'Período do placar' });

      expect(within(grupo).getAllByRole('radio')).toHaveLength(2);
    });
  });

  describe('extrato da equipe', () => {
    /** Soma 3.910 pts e 69 ações, os números da Araucária no protótipo. */
    const extratoDaAraucaria = (): LinhaDoExtrato[] => [
      umaLinhaDoExtrato('Doação de roupas', 'PECA', 40, 19, 600),
      umaLinhaDoExtrato('Doação de alimentos', 'KG', 251, 31, 2510),
      umaLinhaDoExtrato('Doação de tampinhas', 'KG', 80, 19, 800),
    ];

    it('abre os pontos por tipo de ação ao tocar na equipe da lista', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [e.ipe, e.araucaria], {
        [e.araucaria.equipeId]: extratoDaAraucaria(),
      });

      fireEvent.click(within(await lista()).getByRole('button', { name: /Equipe Araucária/ }));

      const dialogo = await screen.findByRole('dialog', { name: 'Equipe Araucária' });
      expect(within(dialogo).getByText('2º lugar · Geral')).toBeVisible();

      const itens = await within(dialogo).findAllByRole('listitem');
      // O tipo que mais pontuou vem primeiro.
      expect(itens).toHaveLength(3);
      expect(itens[0]).toHaveTextContent('Doação de alimentos');
      expect(itens[0]).toHaveTextContent('251 kg · 31 ações');
      expect(itens[0]).toHaveTextContent('2.510 pts');
      expect(itens[1]).toHaveTextContent('Doação de tampinhas');
      expect(itens[1]).toHaveTextContent('80 kg · 19 ações');
      expect(itens[2]).toHaveTextContent('Doação de roupas');
      expect(itens[2]).toHaveTextContent('40 peças · 19 ações');
      expect(itens[2]).toHaveTextContent('600 pts');
      expect(within(dialogo).getByText('3.910 pts')).toBeVisible();
      expect(within(dialogo).getByText(/Líder: Arthur Exemplo · 2 colaboradores/)).toBeVisible();
    });

    it('abre também pelo pódio, e pede o extrato com o mesmo período do placar', async () => {
      const e = equipesDoPrototipo();
      const { chamadasDoExtrato } = abrirPlacar(
        'COLABORADOR',
        () => [e.ipe, e.araucaria],
        {},
        '/placar?periodo=semana',
      );

      fireEvent.click(within(await podio()).getByRole('button', { name: /Equipe Ipê/ }));

      const dialogo = await screen.findByRole('dialog', { name: 'Equipe Ipê' });
      expect(within(dialogo).getByText('1º lugar · Esta semana (09/11 a 15/11)')).toBeVisible();
      await within(dialogo).findByText(/ainda não tem lançamento aprovado neste período/i);
      expect(chamadasDoExtrato).toEqual([{ desde: '2026-11-09', ate: '2026-11-15' }]);
    });

    it('explica o que esperar quando a equipe ainda não tem lançamento aprovado', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [e.ipe, e.araucaria]);

      fireEvent.click(within(await lista()).getByRole('button', { name: /Equipe Araucária/ }));

      const dialogo = await screen.findByRole('dialog', { name: 'Equipe Araucária' });
      expect(await within(dialogo).findByText(/quando o líder aprova o primeiro/i)).toBeVisible();
    });

    it('fecha o extrato e deixa o placar onde estava', async () => {
      const e = equipesDoPrototipo();
      abrirPlacar('COLABORADOR', () => [e.ipe, e.araucaria]);

      fireEvent.click(within(await lista()).getByRole('button', { name: /Equipe Araucária/ }));
      const dialogo = await screen.findByRole('dialog', { name: 'Equipe Araucária' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(screen.getByRole('list', { name: 'Ranking completo' })).toBeVisible();
    });

    it('avisa em português quando o extrato não carrega e deixa tentar de novo', async () => {
      const e = equipesDoPrototipo();
      const { estado, gincana } = cenarioDeLancamentos();
      const { rotas } = rotasDoPlacar(gincana, () => [e.ipe, e.araucaria]);
      const rotaDoExtrato = `GET /gincanas/${gincana.id}/ranking/equipes/${e.araucaria.equipeId}`;
      const extrato = rotas[rotaDoExtrato] as NonNullable<(typeof rotas)[string]>;
      let funcionando = false;
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        ...rotas,
        [rotaDoExtrato]: (requisicao) => (funcionando ? extrato(requisicao) : { status: 500 }),
      });
      renderizarNaRota('/placar');

      fireEvent.click(within(await lista()).getByRole('button', { name: /Equipe Araucária/ }));
      const dialogo = await screen.findByRole('dialog', { name: 'Equipe Araucária' });
      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        /servidor está com problemas/i,
      );

      funcionando = true;
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));

      expect(await within(dialogo).findByText(/ainda não tem lançamento aprovado/i)).toBeVisible();
    });
  });

  describe('estados da tela', () => {
    it('mostra o carregamento enquanto o placar não chega', async () => {
      const e = equipesDoPrototipo();
      const { estado, gincana } = cenarioDeLancamentos();
      const { rotas } = rotasDoPlacar(gincana, () => [e.ipe, e.araucaria]);
      const rotaDoPlacar = `GET /gincanas/${gincana.id}/ranking`;
      const placar = rotas[rotaDoPlacar] as NonNullable<(typeof rotas)[string]>;
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        ...rotas,
        [rotaDoPlacar]: async (requisicao) => {
          await espera;
          return placar(requisicao);
        },
      });

      renderizarNaRota('/placar');

      expect(await screen.findByText('Carregando o placar…')).toBeVisible();
      liberar();
      expect(await lista()).toBeVisible();
    });

    it('avisa em português quando o placar não carrega e deixa tentar de novo', async () => {
      const e = equipesDoPrototipo();
      const { estado, gincana } = cenarioDeLancamentos();
      const { rotas } = rotasDoPlacar(gincana, () => [e.ipe, e.araucaria]);
      const rotaDoPlacar = `GET /gincanas/${gincana.id}/ranking`;
      const placar = rotas[rotaDoPlacar] as NonNullable<(typeof rotas)[string]>;
      let funcionando = false;
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        ...rotas,
        [rotaDoPlacar]: (requisicao) => (funcionando ? placar(requisicao) : { status: 500 }),
      });
      renderizarNaRota('/placar');

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);

      funcionando = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await lista()).toBeVisible();
    });

    it('explica o que fazer quando a gincana ainda não tem equipes', async () => {
      abrirPlacar('COLABORADOR', () => []);

      expect(await screen.findByText('Esta gincana ainda não tem equipes')).toBeVisible();
      expect(screen.getByText(/a administradora monta as equipes/i)).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Ir para Equipes' })).not.toBeInTheDocument();
    });

    it('à administradora, a gincana sem equipes oferece o caminho para criá-las', async () => {
      abrirPlacar('ADMIN', () => []);

      expect(await screen.findByRole('link', { name: 'Ir para Equipes' })).toHaveAttribute(
        'href',
        '/equipes',
      );
    });

    it('explica o que fazer quando não há gincana cadastrada', async () => {
      const { estado } = cenarioDeLancamentos();
      estado.gincanas = [];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      renderizarNaRota('/placar');

      expect(await screen.findByText('Ainda não há gincana cadastrada')).toBeVisible();
      expect(screen.getByText(/a administradora cadastra a gincana/i)).toBeVisible();
    });
  });
});
