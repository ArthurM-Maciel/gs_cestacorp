import type { RegistroDeAuditoria } from '@gincana/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  instante,
  rotaDoPainelDeAuditoria,
  trilhaDeUmLancamento,
  umRegistroDeAuditoria,
} from '../../simulacao-da-auditoria.js';
import {
  comSessaoDe,
  rotasDeLancamentos,
  cenarioDeLancamentos,
} from '../../simulacao-de-lancamentos.js';
import { umColaborador } from '../../simulacao-do-cadastro.js';
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

/**
 * A trilha de um lançamento (criado pela Camila, recusado e aprovado pelo Bruno, corrigido
 * pela Camila) e, por cima, a alteração de uma regra pela Marieri: cinco registros, do mais
 * recente para o mais antigo, como a API os devolve.
 */
function cenarioDoPainel() {
  const marieri = umColaborador('Marieri Exemplo', { papel: 'ADMIN' });
  const bruno = umColaborador('Bruno Exemplo', { papel: 'LIDER' });
  const camila = umColaborador('Camila Exemplo');
  const pessoa = (p: { id: string; nome: string }) => ({ id: p.id, nome: p.nome });

  const lancamentoId = '00000000-0000-4000-8000-0000000000f1';
  const trilha = trilhaDeUmLancamento(lancamentoId, pessoa(camila), pessoa(bruno));
  const regra = umRegistroDeAuditoria('ALTERACAO', pessoa(marieri), {
    entidade: 'RegraPontuacao',
    criadoEm: instante(4, 8, 0),
    descricao: 'Regra de "Doação de tampinhas" alterada.',
    mudancas: [{ campo: 'pontosPorUnidade', rotulo: 'Pontos por unidade', de: '10', para: '12' }],
  });
  const registros = [regra, ...trilha.toReversed()];

  return { marieri, bruno, camila, lancamentoId, registros };
}

/**
 * As pessoas do filtro "Feito por" são as dos registros, mais uma colaboradora desativada
 * (que também aparece na lista, porque a trilha guarda o que ela fez quando estava ativa).
 */
function abrirPainel(registros: RegistroDeAuditoria[], caminho = '/auditoria') {
  const { estado } = cenarioDeLancamentos();
  const { rota, chamadas } = rotaDoPainelDeAuditoria(registros);
  const autores = new Map(registros.map((registro) => [registro.autor.id, registro.autor]));
  const pessoas = [
    ...[...autores.values()].map((autor) => umColaborador(autor.nome, { id: autor.id })),
    umColaborador('Elisa Exemplo', { ativo: false }),
  ];
  comSessaoDe('ADMIN', {
    ...rotasDeLancamentos(estado),
    'GET /auditoria': rota,
    'GET /colaboradores': () => ({ status: 200, dados: pessoas }),
  });
  return { ...renderizarNaRota(caminho), chamadas };
}

const tabela = () => screen.findByRole('table', { name: 'Registros de auditoria' });
const linhasDe = (t: HTMLElement) => within(t).getAllByRole('row').slice(1);
const filtroDeAcao = () => screen.getByLabelText('Ação');
const filtroDeAutor = () => screen.getByLabelText('Feito por');

describe('Painel de auditoria da administradora (US09)', () => {
  describe('lista', () => {
    it('mostra cada registro com a ação, o que foi alterado, quem fez e quando, do mais recente ao mais antigo', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros);

      const linhas = linhasDe(await tabela());

      expect(linhas).toHaveLength(5);
      expect(linhas[0]).toHaveTextContent('Alteração');
      expect(linhas[0]).toHaveTextContent('Regra de pontuação');
      expect(linhas[0]).toHaveTextContent('Marieri Exemplo');
      expect(linhas[0]).toHaveTextContent('04/11/2026 às 08:00');
      expect(linhas[0]).toHaveTextContent('Regra de "Doação de tampinhas" alterada.');
      expect(linhas[0]).toHaveTextContent('Pontos por unidade: 10 pts → 12 pts');
      expect(linhas[1]).toHaveTextContent('Aprovação');
      expect(linhas[1]).toHaveTextContent('Lançamento');
      expect(linhas[1]).toHaveTextContent('Bruno Exemplo');
      expect(linhas[1]).toHaveTextContent('Situação: Pendente → Aprovado');
      expect(linhas[2]).toHaveTextContent('Alteração');
      expect(linhas[2]).toHaveTextContent('Camila Exemplo');
      expect(linhas[2]).toHaveTextContent('Quantidade: 12 → 15');
      expect(linhas[3]).toHaveTextContent('Recusa');
      expect(linhas[3]).toHaveTextContent('Motivo da recusa: Foto sem a etiqueta da ONG');
      expect(linhas[4]).toHaveTextContent('Criação');
    });

    it('é legível: colunas com nome e nenhum "null" ou JSON cru na tela', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros);

      const t = await tabela();

      expect(
        within(t)
          .getAllByRole('columnheader')
          .map((cabecalho) => cabecalho.textContent),
      ).toEqual(['Ação', 'Quando', 'Feito por', 'O que mudou', 'Detalhe']);
      expect(t).not.toHaveTextContent(/null|undefined|\{|\[object/);
    });

    it('a criação diz com o que nasceu, sem "null" nem seta, mesmo sem saber a unidade', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros);

      const criacao = linhasDe(await tabela())[4]!;

      expect(criacao).toHaveTextContent('Registrado com 12');
      expect(criacao).toHaveTextContent('Situação: Pendente');
      expect(criacao).not.toHaveTextContent(/null|→/);
    });

    it('leva ao detalhe só os registros de lançamento', async () => {
      const { registros, lancamentoId } = cenarioDoPainel();
      abrirPainel(registros);

      const linhas = linhasDe(await tabela());

      // A regra não tem tela de detalhe: não há link.
      expect(within(linhas[0]!).queryByRole('link')).not.toBeInTheDocument();
      expect(
        within(linhas[1]!).getByRole('link', {
          name: 'Ver o lançamento: Aprovação por Bruno Exemplo',
        }),
      ).toHaveAttribute('href', `/lancamentos/${lancamentoId}`);
    });

    it('mostra como veio uma entidade que a tela ainda não conhece', async () => {
      const marieri = umColaborador('Marieri Exemplo', { papel: 'ADMIN' });
      abrirPainel([
        umRegistroDeAuditoria('CRIACAO', marieri, {
          entidade: 'Premio',
          mudancas: [{ campo: 'nome', rotulo: 'Nome', de: null, para: 'Troféu' }],
        }),
      ]);

      const [linha] = linhasDe(await tabela());

      expect(linha).toHaveTextContent('Premio');
      expect(linha).toHaveTextContent('Nome: Troféu');
    });
  });

  describe('filtros', () => {
    it('filtra por ação e refaz a consulta com a ação escolhida', async () => {
      const { registros } = cenarioDoPainel();
      const { chamadas } = abrirPainel(registros);
      await tabela();

      fireEvent.change(filtroDeAcao(), { target: { value: 'APROVACAO' } });

      await waitFor(() => {
        expect(
          linhasDe(screen.getByRole('table', { name: 'Registros de auditoria' })),
        ).toHaveLength(1);
      });
      expect(chamadas.at(-1)).toMatchObject({ acao: 'APROVACAO', pagina: 1 });
      expect(screen.getByRole('table', { name: 'Registros de auditoria' })).toHaveTextContent(
        'Situação: Pendente → Aprovado',
      );
      expect(screen.getByText(/1 registro com os filtros escolhidos/)).toBeVisible();
    });

    it('filtra por autor, com o nome da pessoa e o desativado marcado', async () => {
      const { registros, bruno } = cenarioDoPainel();
      const { chamadas } = abrirPainel(registros);
      await tabela();

      const opcoes = await within(filtroDeAutor()).findAllByRole('option');
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
        'Todas as pessoas',
        'Bruno Exemplo',
        'Camila Exemplo',
        'Elisa Exemplo (desativado)',
        'Marieri Exemplo',
      ]);

      fireEvent.change(filtroDeAutor(), { target: { value: bruno.id } });

      await waitFor(() => {
        expect(
          linhasDe(screen.getByRole('table', { name: 'Registros de auditoria' })),
        ).toHaveLength(2);
      });
      expect(chamadas.at(-1)).toMatchObject({ autorId: bruno.id, pagina: 1 });
      const linhas = linhasDe(screen.getByRole('table', { name: 'Registros de auditoria' }));
      expect(linhas[0]).toHaveTextContent('Aprovação');
      expect(linhas[1]).toHaveTextContent('Recusa');
    });

    it('combina ação e autor', async () => {
      const { registros, camila } = cenarioDoPainel();
      const { chamadas } = abrirPainel(registros);
      await tabela();
      await within(filtroDeAutor()).findByRole('option', { name: 'Camila Exemplo' });

      fireEvent.change(filtroDeAutor(), { target: { value: camila.id } });
      fireEvent.change(filtroDeAcao(), { target: { value: 'ALTERACAO' } });

      await waitFor(() => {
        expect(chamadas.at(-1)).toMatchObject({ acao: 'ALTERACAO', autorId: camila.id });
      });
      await waitFor(() => {
        expect(
          linhasDe(screen.getByRole('table', { name: 'Registros de auditoria' })),
        ).toHaveLength(1);
      });
    });

    it('sem resultado para os filtros, explica e oferece limpá-los', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros);
      await tabela();

      fireEvent.change(filtroDeAcao(), { target: { value: 'EXCLUSAO' } });

      expect(await screen.findByText('Nenhum registro com esses filtros')).toBeVisible();
      expect(screen.getByText(/tente outra ação ou outra pessoa/i)).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

      expect(linhasDe(await tabela())).toHaveLength(5);
      expect(filtroDeAcao()).toHaveValue('');
    });

    it('lê os filtros do endereço, que dá para guardar e compartilhar', async () => {
      const { registros } = cenarioDoPainel();
      const { chamadas } = abrirPainel(registros, '/auditoria?acao=RECUSA');

      const linhas = linhasDe(await tabela());

      expect(filtroDeAcao()).toHaveValue('RECUSA');
      expect(chamadas[0]).toMatchObject({ acao: 'RECUSA', pagina: 1 });
      expect(linhas).toHaveLength(1);
    });

    it('um endereço editado à mão e inválido cai nos padrões, sem erro', async () => {
      const { registros } = cenarioDoPainel();
      const { chamadas } = abrirPainel(registros, '/auditoria?acao=SUMIU&pagina=abc');

      expect(linhasDe(await tabela())).toHaveLength(5);
      expect(chamadas[0]).toEqual({ pagina: 1, porPagina: 10 });
    });

    it('os filtros são campos com nome, para quem usa leitor de tela e teclado', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros);
      await tabela();

      expect(screen.getByRole('group', { name: 'Filtros da auditoria' })).toBeVisible();
      expect(filtroDeAcao()).toBeEnabled();
      expect(
        within(filtroDeAcao())
          .getAllByRole('option')
          .map((opcao) => opcao.textContent),
      ).toEqual(['Todas as ações', 'Criação', 'Aprovação', 'Recusa', 'Alteração', 'Exclusão']);
    });
  });

  describe('paginação', () => {
    /** 25 registros: três páginas de dez. */
    const muitos = (): RegistroDeAuditoria[] => {
      const { marieri } = cenarioDoPainel();
      return Array.from({ length: 25 }, (_, indice) =>
        umRegistroDeAuditoria('CRIACAO', marieri, {
          descricao: `Registro número ${String(25 - indice)}`,
        }),
      );
    };

    it('mostra dez por vez, diz em que página está e avança e volta', async () => {
      const { chamadas } = abrirPainel(muitos());

      let linhas = linhasDe(await tabela());
      expect(linhas).toHaveLength(10);
      expect(linhas[0]).toHaveTextContent('Registro número 25');
      expect(screen.getByText('Página 1 de 3')).toBeVisible();
      expect(screen.getByText(/25 registros, do mais recente ao mais antigo/)).toBeVisible();
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));

      expect(await screen.findByText('Página 2 de 3')).toBeVisible();
      await waitFor(() => {
        linhas = linhasDe(screen.getByRole('table', { name: 'Registros de auditoria' }));
        expect(linhas[0]).toHaveTextContent('Registro número 15');
      });
      expect(chamadas.at(-1)).toMatchObject({ pagina: 2, porPagina: 10 });

      fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
      expect(await screen.findByText('Página 3 de 3')).toBeVisible();
      await waitFor(() => {
        expect(
          linhasDe(screen.getByRole('table', { name: 'Registros de auditoria' })),
        ).toHaveLength(5);
      });
      expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
      expect(await screen.findByText('Página 2 de 3')).toBeVisible();
    });

    it('mudar o filtro volta à primeira página', async () => {
      const { chamadas } = abrirPainel(muitos(), '/auditoria?pagina=3');

      await tabela();
      expect(screen.getByText('Página 3 de 3')).toBeVisible();

      fireEvent.change(filtroDeAcao(), { target: { value: 'CRIACAO' } });

      await waitFor(() => {
        expect(chamadas.at(-1)).toMatchObject({ acao: 'CRIACAO', pagina: 1 });
      });
    });

    it('com uma página só, não mostra a paginação', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros);
      await tabela();

      expect(
        screen.queryByRole('navigation', { name: 'Paginação da auditoria' }),
      ).not.toBeInTheDocument();
    });

    it('uma página que não existe oferece voltar à primeira', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros, '/auditoria?pagina=9');

      expect(await screen.findByText('Esta página não tem registros')).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Ir para a primeira página' }));

      expect(linhasDe(await tabela())).toHaveLength(5);
    });
  });

  describe('estados da tela', () => {
    it('mostra o carregamento enquanto o histórico não chega', async () => {
      const { registros } = cenarioDoPainel();
      const { estado } = cenarioDeLancamentos();
      const { rota } = rotaDoPainelDeAuditoria(registros);
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      comSessaoDe('ADMIN', {
        ...rotasDeLancamentos(estado),
        'GET /colaboradores': () => ({ status: 200, dados: [] }),
        'GET /auditoria': async (requisicao) => {
          await espera;
          return rota(requisicao);
        },
      });

      renderizarNaRota('/auditoria');

      expect(await screen.findByText('Carregando o histórico de alterações…')).toBeVisible();
      liberar();
      expect(linhasDe(await tabela())).toHaveLength(5);
    });

    it('explica o que esperar quando ainda não há nenhum registro', async () => {
      abrirPainel([]);

      expect(await screen.findByText('Ainda não há registros')).toBeVisible();
      expect(
        screen.getByText(/quando alguém criar, aprovar, recusar ou alterar um lançamento/i),
      ).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
    });

    it('avisa em português quando o histórico não carrega e deixa tentar de novo', async () => {
      const { registros } = cenarioDoPainel();
      const { estado } = cenarioDeLancamentos();
      const { rota } = rotaDoPainelDeAuditoria(registros);
      let funcionando = false;
      comSessaoDe('ADMIN', {
        ...rotasDeLancamentos(estado),
        'GET /colaboradores': () => ({ status: 200, dados: [] }),
        'GET /auditoria': (requisicao) => (funcionando ? rota(requisicao) : { status: 500 }),
      });
      renderizarNaRota('/auditoria');

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);

      funcionando = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(linhasDe(await tabela())).toHaveLength(5);
    });

    it('se a lista de pessoas falha, o filtro por ação continua funcionando', async () => {
      const { registros } = cenarioDoPainel();
      const { estado } = cenarioDeLancamentos();
      const { rota } = rotaDoPainelDeAuditoria(registros);
      comSessaoDe('ADMIN', {
        ...rotasDeLancamentos(estado),
        'GET /colaboradores': () => ({ status: 500 }),
        'GET /auditoria': rota,
      });
      renderizarNaRota('/auditoria');

      expect(linhasDe(await tabela())).toHaveLength(5);
      expect(await screen.findByText(/não foi possível carregar as pessoas/i)).toBeVisible();
      expect(filtroDeAutor()).toBeDisabled();
      expect(filtroDeAcao()).toBeEnabled();
    });
  });

  describe('quem é a administradora', () => {
    it('abre dentro do menu dela, com o item "Auditoria" marcado', async () => {
      const { registros } = cenarioDoPainel();
      abrirPainel(registros);
      await tabela();

      const menu = within(screen.getByRole('navigation', { name: 'Menu principal' }));

      expect(menu.getByRole('link', { name: 'Auditoria' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('heading', { level: 1, name: 'Auditoria' })).toBeVisible();
      expect(screen.getByText(/nada aqui é editado ou apagado/i)).toBeVisible();
    });
  });
});
