import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usuarioDeTeste } from '../../simulacao-da-api.js';
import { umaEquipe } from '../../simulacao-do-cadastro.js';
import {
  cenarioDeLancamentos,
  comSessaoDe,
  EQUIPE_DO_TESTE,
  rotasDeLancamentos,
  umLancamento,
} from '../../simulacao-de-lancamentos.js';
import { rotasDoPlacar, umTotalDeEquipe, type TotalDaEquipe } from '../../simulacao-do-placar.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

const menuInferior = () => screen.getByRole('navigation', { name: 'Menu inferior' });
const cartao = () => screen.findByRole('region', { name: /sua equipe/i });

/** A usuária de teste é da Araucária; `totais` é o placar geral que a API devolve. */
function abrirInicio(totais: TotalDaEquipe[], papel: 'COLABORADOR' | 'LIDER' = 'COLABORADOR') {
  const { estado, gincana } = cenarioDeLancamentos();
  const { rotas } = rotasDoPlacar(gincana, () => totais);
  comSessaoDe(papel, { ...rotasDeLancamentos(estado), ...rotas });
  return { ...renderizarNaRota('/inicio'), estado, gincana };
}

const ipe = () => umTotalDeEquipe('Ipê', 4280);
const araucaria = (pontos = 3910) =>
  umTotalDeEquipe('Araucária', pontos, { equipeId: EQUIPE_DO_TESTE });
const jacaranda = () => umTotalDeEquipe('Jacarandá', 3355);
const paineira = () => umTotalDeEquipe('Paineira', 3120);

describe('Cartão de posição no início (US11)', () => {
  it('mostra a posição real da equipe, o total e a distância para a equipe da frente', async () => {
    abrirInicio([ipe(), araucaria(), jacaranda()]);

    const secao = await cartao();

    expect(within(secao).getByText('Equipe Araucária')).toBeVisible();
    expect(
      within(secao).getByRole('heading', { level: 2, name: 'Sua equipe está em segundo lugar!' }),
    ).toBeVisible();
    expect(within(secao).getByText('3.910 pts')).toBeVisible();
    expect(within(secao).getByText('370 pts atrás da Equipe Ipê')).toBeVisible();
    expect(screen.queryByText(/chega em breve/i)).not.toBeInTheDocument();
  });

  it('mede até a equipe logo à frente, e não até a líder', async () => {
    // A usuária de teste é da Araucária; aqui ela é a quarta, com a Jacarandá logo acima.
    abrirInicio([ipe(), jacaranda(), umTotalDeEquipe('Figueira', 3200), araucaria(3120)]);

    const secao = await cartao();

    expect(within(secao).getByText('Sua equipe está em quarto lugar!')).toBeVisible();
    expect(within(secao).getByText('80 pts atrás da Equipe Figueira')).toBeVisible();
    expect(within(secao).queryByText(/Ipê/)).not.toBeInTheDocument();
  });

  it('a equipe que lidera diz isso, sem calcular distância negativa', async () => {
    abrirInicio([araucaria(5000), ipe(), jacaranda()]);

    const secao = await cartao();

    expect(within(secao).getByText('Sua equipe está em primeiro lugar!')).toBeVisible();
    expect(within(secao).getByText('Sua equipe está na frente do placar.')).toBeVisible();
    expect(within(secao).getByText('5.000 pts')).toBeVisible();
    expect(within(secao).queryByText(/atrás/)).not.toBeInTheDocument();
    expect(within(secao).queryByText(/-\d/)).not.toBeInTheDocument();
  });

  it('avisa o empate e mede a distância até quem está acima dele', async () => {
    abrirInicio([ipe(), araucaria(3910), umTotalDeEquipe('Gêmea', 3910), paineira()]);

    const secao = await cartao();

    expect(within(secao).getByText('Sua equipe está em segundo lugar!')).toBeVisible();
    expect(within(secao).getByText('Empatada com a Equipe Gêmea.')).toBeVisible();
    expect(within(secao).getByText('370 pts atrás da Equipe Ipê')).toBeVisible();
  });

  it('equipe sem pontos não comemora o primeiro lugar que só existe porque ninguém pontuou', async () => {
    abrirInicio([araucaria(0), umTotalDeEquipe('Alfa', 0)]);

    const secao = await cartao();

    expect(within(secao).getByText('Sua equipe ainda não pontuou')).toBeVisible();
    expect(within(secao).getByText('Nenhuma equipe pontuou ainda.')).toBeVisible();
    expect(within(secao).getByText('0 pts')).toBeVisible();
  });

  it('leva ao placar completo', async () => {
    abrirInicio([ipe(), araucaria()]);

    const secao = await cartao();

    expect(within(secao).getByRole('link', { name: 'Ver o placar completo' })).toHaveAttribute(
      'href',
      '/placar',
    );
  });

  it('o líder também vê a posição da própria equipe', async () => {
    abrirInicio([ipe(), araucaria()], 'LIDER');

    expect(await within(await cartao()).findByText('370 pts atrás da Equipe Ipê')).toBeVisible();
  });

  describe('quando não há posição para mostrar', () => {
    it('explica a quem ainda não está em uma equipe', async () => {
      const { estado, gincana } = cenarioDeLancamentos();
      const { rotas } = rotasDoPlacar(gincana, () => [ipe()]);
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        ...rotas,
        'GET /auth/me': () => ({
          status: 200,
          dados: { ...usuarioDeTeste('COLABORADOR'), equipeId: null },
        }),
      });
      renderizarNaRota('/inicio');

      expect(await screen.findByText('Você ainda não está em uma equipe')).toBeVisible();
      expect(screen.getByText(/a administradora vincula você a uma equipe/i)).toBeVisible();
    });

    it('explica quando não há gincana ativa', async () => {
      const { estado } = cenarioDeLancamentos();
      estado.gincanas = [];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      renderizarNaRota('/inicio');

      expect(await screen.findByText('Não há gincana ativa no momento')).toBeVisible();
    });

    it('mostra o carregamento enquanto o placar não chega', async () => {
      const { estado, gincana } = cenarioDeLancamentos();
      const { rotas } = rotasDoPlacar(gincana, () => [ipe(), araucaria()]);
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
      renderizarNaRota('/inicio');

      expect(await screen.findByText('Carregando a posição da sua equipe…')).toBeVisible();
      liberar();
      expect(await cartao()).toBeVisible();
    });

    it('se o placar falha, só o cartão avisa: os lançamentos continuam na tela', async () => {
      const { estado, gincana, euMesma, equipe, alimentos } = cenarioDeLancamentos();
      estado.lancamentos = [umLancamento(alimentos, euMesma, equipe)];
      const { rotas } = rotasDoPlacar(gincana, () => [ipe(), araucaria()]);
      const rotaDoPlacar = `GET /gincanas/${gincana.id}/ranking`;
      const placar = rotas[rotaDoPlacar] as NonNullable<(typeof rotas)[string]>;
      let funcionando = false;
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        ...rotas,
        [rotaDoPlacar]: (requisicao) => (funcionando ? placar(requisicao) : { status: 500 }),
      });
      renderizarNaRota('/inicio');

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);
      expect(await screen.findByRole('table', { name: 'Meus lançamentos' })).toBeVisible();

      funcionando = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await screen.findByText('Sua equipe está em segundo lugar!')).toBeVisible();
    });
  });

  describe('depois de uma aprovação', () => {
    it('a posição da equipe se atualiza sozinha, sem recarregar a página', async () => {
      const { estado, gincana, bruno, camila, euMesma, araucaria, equipe, alimentos } =
        cenarioDeLancamentos();
      // A usuária lidera a Araucária, que está sem pontos; a Ipê tem 300 aprovados.
      const equipeIpe = umaEquipe(gincana.id, 'Equipe Ipê', { lider: bruno, totalMembros: 2 });
      estado.equipes = [{ ...araucaria, lider: euMesma }, equipeIpe];
      const aAprovar = umLancamento(alimentos, camila, equipe, { quantidade: 12 });
      estado.lancamentos = [
        aAprovar,
        umLancamento(
          alimentos,
          bruno,
          { id: equipeIpe.id, nome: 'Equipe Ipê' },
          {
            quantidade: 30,
            status: 'APROVADO',
          },
        ),
      ];
      comSessaoDe('LIDER', {
        ...rotasDeLancamentos(estado),
        [`POST /lancamentos/${aAprovar.id}/aprovar`]: () => {
          const aprovado = { ...aAprovar, status: 'APROVADO' as const, avaliadoPor: euMesma };
          estado.lancamentos = estado.lancamentos.map((l) => (l.id === aAprovar.id ? aprovado : l));
          return { status: 200, dados: aprovado };
        },
      });
      const { queryClient } = renderizarNaRota('/inicio');
      // Dado que nunca fica velho por conta própria: só uma invalidação o refaz. Sem isto, a
      // volta ao início refaria a consulta de qualquer jeito e o teste não provaria nada.
      queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });

      const antes = await cartao();
      expect(within(antes).getByText('Sua equipe ainda não pontuou')).toBeVisible();
      expect(within(antes).getByText('300 pts atrás da Equipe Ipê')).toBeVisible();

      fireEvent.click(await within(menuInferior()).findByRole('link', { name: /^Aprovar/ }));
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );
      expect(await screen.findByText(/aprovada: \+120 pts para a equipe Araucária/)).toBeVisible();

      fireEvent.click(within(menuInferior()).getByRole('link', { name: 'Início' }));

      await waitFor(async () => {
        const depois = await cartao();
        expect(within(depois).getByText('Sua equipe está em segundo lugar!')).toBeVisible();
      });
      const depois = await cartao();
      expect(within(depois).getByText('120 pts')).toBeVisible();
      expect(within(depois).getByText('180 pts atrás da Equipe Ipê')).toBeVisible();
    });
  });
});
