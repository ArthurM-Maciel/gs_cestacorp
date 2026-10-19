import type { Lancamento, Papel, RegistroDeAuditoria } from '@gincana/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { instante, trilhaDeUmLancamento, umaLinhaDoTempo } from '../../simulacao-da-auditoria.js';
import { erroDaApi } from '../../simulacao-da-api.js';
import {
  cenarioDeLancamentos,
  comSessaoDe,
  rotasDeLancamentos,
  umLancamento,
} from '../../simulacao-de-lancamentos.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

/**
 * O lançamento de 15 kg de tampinhas da usuária de teste, que nasceu com 12 kg, foi recusado,
 * corrigido e aprovado por Bruno: as quatro etapas da trilha da API.
 */
function cenarioDoDetalhe(sobrepor: Partial<Lancamento> = {}) {
  const base = cenarioDeLancamentos();
  const { estado, tampinhas, euMesma, equipe, bruno } = base;
  const lancamento = umLancamento(tampinhas, euMesma, equipe, {
    quantidade: 15,
    status: 'APROVADO',
    dataAcao: '2026-11-02',
    avaliadoPor: bruno,
    avaliadoEm: instante(3, 10, 45),
    ...sobrepor,
  });
  estado.lancamentos = [lancamento];
  const trilha = trilhaDeUmLancamento(lancamento.id, euMesma, bruno);
  return { ...base, lancamento, trilha };
}

function abrir(
  papel: Papel,
  cenario: ReturnType<typeof cenarioDoDetalhe>,
  trilha: RegistroDeAuditoria[] = cenario.trilha,
  caminho = `/lancamentos/${cenario.lancamento.id}`,
) {
  comSessaoDe(papel, {
    ...rotasDeLancamentos(cenario.estado),
    [`GET /lancamentos/${cenario.lancamento.id}/auditoria`]: () => ({
      status: 200,
      dados: umaLinhaDoTempo(cenario.lancamento.id, trilha),
    }),
  });
  return renderizarNaRota(caminho);
}

const linhaDoTempo = () => screen.findByRole('list', { name: 'Histórico do lançamento' });
/**
 * As etapas são os itens diretos da lista; as listas de mudanças dentro delas também têm
 * itens, e não são etapas.
 */
const entradas = async () => Array.from((await linhaDoTempo()).children) as HTMLElement[];
const resumo = () => screen.getByLabelText('Dados do lançamento');

describe('Detalhe do lançamento e histórico (US09)', () => {
  describe('linha do tempo', () => {
    it('mostra as quatro etapas de um lançamento criado, recusado, corrigido e aprovado, na ordem', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      const itens = await entradas();

      expect(itens).toHaveLength(4);
      expect(itens[0]).toHaveTextContent('Criação');
      expect(itens[0]).toHaveTextContent('por Pessoa Teste');
      expect(itens[1]).toHaveTextContent('Recusa');
      expect(itens[1]).toHaveTextContent('por Bruno Exemplo');
      expect(itens[2]).toHaveTextContent('Alteração');
      expect(itens[2]).toHaveTextContent('por Pessoa Teste');
      expect(itens[3]).toHaveTextContent('Aprovação');
      expect(itens[3]).toHaveTextContent('por Bruno Exemplo');
    });

    it('diz quando cada coisa aconteceu, na hora de quem olha', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      const itens = await entradas();

      expect(itens[0]).toHaveTextContent('02/11/2026 às 12:00');
      expect(itens[1]).toHaveTextContent('02/11/2026 às 15:30');
      expect(itens[2]).toHaveTextContent('03/11/2026 às 09:10');
      expect(itens[3]).toHaveTextContent('03/11/2026 às 10:45');
      // O instante exato continua na marcação, para quem o lê por máquina.
      expect(within(itens[0]!).getByText('02/11/2026 às 12:00')).toHaveAttribute(
        'datetime',
        instante(2, 12, 0),
      );
    });

    it('escreve as mudanças como "Quantidade: 12 kg → 15 kg", com a unidade do lançamento', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      const itens = await entradas();

      expect(itens[1]).toHaveTextContent('Situação: Pendente → Recusado');
      expect(itens[2]).toHaveTextContent('Quantidade: 12 kg → 15 kg');
      expect(itens[2]).toHaveTextContent('Pontos: 120 pts → 150 pts');
      expect(itens[2]).toHaveTextContent('Situação: Recusado → Pendente');
      expect(itens[3]).toHaveTextContent('Situação: Pendente → Aprovado');
    });

    it('mostra o motivo da recusa e a descrição que o servidor gravou em cada etapa', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      const itens = await entradas();

      expect(itens[1]).toHaveTextContent('Lançamento recusado: Foto sem a etiqueta da ONG');
      expect(itens[1]).toHaveTextContent('Motivo da recusa: Foto sem a etiqueta da ONG');
      expect(itens[2]).toHaveTextContent('corrigido depois da recusa e devolvido para avaliação');
      expect(itens[3]).toHaveTextContent('somando 150 pontos à equipe');
    });

    it('a criação diz com o que o lançamento nasceu, sem "null" nem seta', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      const [criacao] = await entradas();

      expect(criacao).toHaveTextContent('Registrado com 12 kg');
      expect(criacao).toHaveTextContent('Situação: Pendente');
      expect(criacao).toHaveTextContent('Pontos: 120 pts');
      expect(criacao).toHaveTextContent('Pontos por unidade: 10 pts por kg');
      expect(criacao).toHaveTextContent('Data da ação: 02/11/2026');
      expect(criacao).not.toHaveTextContent(/null|undefined/);
      expect(criacao).not.toHaveTextContent('→');
    });

    it('nenhuma etapa deixa "null" escapar para a tela', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      expect(await linhaDoTempo()).not.toHaveTextContent(/null|undefined/);
    });

    it('é uma lista, e cada lista de mudanças tem nome para o leitor de tela', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      const itens = await entradas();

      expect(within(itens[2]!).getByRole('list', { name: 'O que mudou' })).toBeVisible();
    });

    it('uma etapa sem nada comparável mostra só a descrição', async () => {
      const cenario = cenarioDoDetalhe();
      const [criacao] = cenario.trilha;
      abrir('COLABORADOR', cenario, [{ ...criacao!, mudancas: [] }]);

      const [item] = await entradas();

      expect(item).toHaveTextContent('aguardando avaliação');
      expect(within(item!).queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('resumo do lançamento', () => {
    it('mostra o que foi registrado e a regra que valeu na hora', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Doação de tampinhas' }),
      ).toBeVisible();
      const dados = resumo();
      expect(dados).toHaveTextContent('Aprovado');
      expect(dados).toHaveTextContent('15 kg');
      expect(dados).toHaveTextContent('150 pts');
      expect(dados).toHaveTextContent('Regra aplicada10 pts por kg');
      expect(dados).toHaveTextContent('02/11/2026');
      expect(dados).toHaveTextContent('Pessoa Teste · Equipe Araucária');
      expect(dados).toHaveTextContent('Avaliado porBruno Exemplo');
    });

    it('para o lançamento recusado, mostra o motivo e que não há pontos', async () => {
      const cenario = cenarioDoDetalhe({
        status: 'RECUSADO',
        motivoRecusa: 'Foto sem a etiqueta da ONG',
      });
      abrir('COLABORADOR', cenario);

      await linhaDoTempo();

      const dados = resumo();
      expect(dados).toHaveTextContent('Recusado');
      expect(dados).toHaveTextContent('Sem pontos (recusado)');
      expect(dados).toHaveTextContent('Motivo da recusaFoto sem a etiqueta da ONG');
      expect(dados).toHaveTextContent('Recusado porBruno Exemplo');
    });

    it('para o pendente, avisa que os pontos só entram no placar depois da aprovação', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe({ status: 'PENDENTE', avaliadoPor: null }));

      expect(await screen.findByText(/só entram no placar depois da aprovação/i)).toBeVisible();
    });
  });

  describe('quem chega e de onde', () => {
    it('o colaborador abre pelo nome da ação, na lista do início, e volta para ela', async () => {
      const cenario = cenarioDoDetalhe();
      abrir('COLABORADOR', cenario, cenario.trilha, '/inicio');

      fireEvent.click(
        await screen.findByRole('link', {
          name: 'Doação de tampinhas, ver detalhes e histórico',
        }),
      );

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Doação de tampinhas' }),
      ).toBeVisible();
      expect(await entradas()).toHaveLength(4);

      fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Olá, Pessoa Teste!' }),
      ).toBeVisible();
    });

    it('o líder abre pelo nome da ação, na fila de aprovações', async () => {
      const cenario = cenarioDoDetalhe({ status: 'PENDENTE', avaliadoPor: null });
      cenario.estado.lancamentos = [
        { ...cenario.lancamento, colaboradorId: cenario.camila.id, colaborador: cenario.camila },
      ];
      abrir('LIDER', cenario, cenario.trilha, '/aprovacoes');

      fireEvent.click(
        await screen.findByRole('link', {
          name: 'Doação de tampinhas, ver detalhes e histórico',
        }),
      );

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Doação de tampinhas' }),
      ).toBeVisible();
      expect(await entradas()).toHaveLength(4);
    });

    it('a administradora vê o detalhe dentro do menu dela', async () => {
      abrir('ADMIN', cenarioDoDetalhe());

      expect(await entradas()).toHaveLength(4);
      const menu = within(screen.getByRole('navigation', { name: 'Menu principal' }));
      expect(menu.getByRole('link', { name: 'Auditoria' })).toBeVisible();
      expect(menu.getByRole('link', { name: 'Painel' })).toBeVisible();
    });

    it('quem chega por um link direto volta ao início do próprio perfil, e não para fora do app', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe());
      await linhaDoTempo();

      fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Olá, Pessoa Teste!' }),
      ).toBeVisible();
    });

    it('o lançamento que a pessoa não alcança vira "não encontrado", sem confirmar que existe', async () => {
      const cenario = cenarioDoDetalhe();
      comSessaoDe('LIDER', {
        ...rotasDeLancamentos(cenario.estado),
        [`GET /lancamentos/${cenario.lancamento.id}`]: () => ({
          status: 404,
          dados: erroDaApi('NAO_ENCONTRADO', 'Lançamento não encontrado.'),
        }),
      });

      renderizarNaRota(`/lancamentos/${cenario.lancamento.id}`);

      expect(await screen.findByText('Lançamento não encontrado')).toBeVisible();
      expect(screen.getByText(/não existe ou você não tem acesso a ele/i)).toBeVisible();
      expect(
        screen.queryByRole('list', { name: 'Histórico do lançamento' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('estados do histórico', () => {
    it('mostra o carregamento do histórico sem esconder o resumo do lançamento', async () => {
      const cenario = cenarioDoDetalhe();
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(cenario.estado),
        [`GET /lancamentos/${cenario.lancamento.id}/auditoria`]: async () => {
          await espera;
          return { status: 200, dados: umaLinhaDoTempo(cenario.lancamento.id, cenario.trilha) };
        },
      });

      renderizarNaRota(`/lancamentos/${cenario.lancamento.id}`);

      expect(await screen.findByText('Carregando o histórico…')).toBeVisible();
      expect(screen.getByRole('heading', { level: 1, name: 'Doação de tampinhas' })).toBeVisible();
      liberar();
      expect(await entradas()).toHaveLength(4);
    });

    it('explica o que esperar quando o lançamento ainda não tem histórico', async () => {
      abrir('COLABORADOR', cenarioDoDetalhe(), []);

      expect(await screen.findByText('Este lançamento ainda não tem histórico')).toBeVisible();
      expect(
        screen.getByText(/cada criação, correção e decisão passa a aparecer aqui/i),
      ).toBeVisible();
    });

    it('avisa em português quando o histórico não carrega e deixa tentar de novo', async () => {
      const cenario = cenarioDoDetalhe();
      let funcionando = false;
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(cenario.estado),
        [`GET /lancamentos/${cenario.lancamento.id}/auditoria`]: () =>
          funcionando
            ? { status: 200, dados: umaLinhaDoTempo(cenario.lancamento.id, cenario.trilha) }
            : { status: 500 },
      });
      renderizarNaRota(`/lancamentos/${cenario.lancamento.id}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);
      // O resumo, que já tinha carregado, continua na tela.
      expect(screen.getByRole('heading', { level: 1, name: 'Doação de tampinhas' })).toBeVisible();

      funcionando = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await entradas()).toHaveLength(4);
    });
  });
});
