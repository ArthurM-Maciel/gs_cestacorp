import type { Lancamento } from '@gincana/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { erroDaApi, type Simulacao } from '../../simulacao-da-api.js';
import {
  cenarioDeLancamentos,
  comSessaoDe,
  rotasDeLancamentos,
  umaEvidencia,
  umLancamento,
  type EstadoDosLancamentos,
} from '../../simulacao-de-lancamentos.js';
import { pressionarEsc, renderizarNaRota } from '../../utilitarios-de-teste.js';

function corpoDa(requisicao: InternalAxiosRequestConfig): unknown {
  return typeof requisicao.data === 'string' ? JSON.parse(requisicao.data) : requisicao.data;
}

/**
 * Aprovar e recusar como a API faz: o lançamento muda de status e passa a ter quem decidiu.
 * Quem muda o estado é a simulação; a tela só vê o que as leituras seguintes devolvem.
 */
function rotasDeDecisao(
  estado: EstadoDosLancamentos,
  avaliador: { id: string; nome: string },
  trocas: Record<string, Simulacao> = {},
) {
  const aprovar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
    const id = /lancamentos\/([^/]+)\/aprovar/.exec(requisicao.url ?? '')?.[1];
    const atual = estado.lancamentos.find((l) => l.id === id) as Lancamento;
    const aprovado: Lancamento = { ...atual, status: 'APROVADO', avaliadoPor: avaliador };
    estado.lancamentos = estado.lancamentos.map((l) => (l.id === id ? aprovado : l));
    return { status: 200, dados: aprovado };
  });
  const recusar = vi.fn((requisicao: InternalAxiosRequestConfig) => {
    const id = /lancamentos\/([^/]+)\/recusar/.exec(requisicao.url ?? '')?.[1];
    const atual = estado.lancamentos.find((l) => l.id === id) as Lancamento;
    const { motivoRecusa } = corpoDa(requisicao) as { motivoRecusa: string };
    const recusado: Lancamento = {
      ...atual,
      status: 'RECUSADO',
      avaliadoPor: avaliador,
      motivoRecusa,
    };
    estado.lancamentos = estado.lancamentos.map((l) => (l.id === id ? recusado : l));
    return { status: 200, dados: recusado };
  });

  const rotas: Record<string, Simulacao> = { ...rotasDeLancamentos(estado) };
  for (const lancamento of estado.lancamentos) {
    rotas[`POST /lancamentos/${lancamento.id}/aprovar`] = aprovar;
    rotas[`POST /lancamentos/${lancamento.id}/recusar`] = recusar;
  }
  return { rotas: { ...rotas, ...trocas }, aprovar, recusar };
}

/** Três pendentes da equipe, como no protótipo, mais um aprovado e um recusado. */
function cenarioDaFila() {
  const base = cenarioDeLancamentos();
  const { estado, camila, bruno, equipe, alimentos, tampinhas, roupas } = base;
  const diego = { id: '00000000-0000-4000-8000-0000000000d1', nome: 'Diego Exemplo' };

  const doAlimentos = umLancamento(alimentos, camila, equipe, { quantidade: 12 });
  const dasTampinhas = umLancamento(tampinhas, diego, equipe, {
    quantidade: 3,
    dataAcao: '2026-11-12',
  });
  const dasRoupas = umLancamento(roupas, camila, equipe, { quantidade: 8 });
  const jaAprovado = umLancamento(alimentos, camila, equipe, {
    quantidade: 2,
    status: 'APROVADO',
    avaliadoPor: bruno,
  });
  const jaRecusado = umLancamento(roupas, diego, equipe, {
    quantidade: 1,
    status: 'RECUSADO',
    avaliadoPor: bruno,
    motivoRecusa: 'Foto sem etiqueta da ONG',
  });
  estado.lancamentos = [doAlimentos, dasTampinhas, dasRoupas, jaAprovado, jaRecusado];
  // Quem está logada lidera a equipe.
  estado.equipes = [{ ...estado.equipes[0]!, lider: base.euMesma }];

  return { ...base, diego, doAlimentos, dasTampinhas, dasRoupas, jaAprovado, jaRecusado };
}

async function abrirFila(caminho = '/aprovacoes') {
  renderizarNaRota(caminho);
  return screen.findByRole('table');
}

const linhasDe = (tabela: HTMLElement) => within(tabela).getAllByRole('row').slice(1);
const abaPendentes = () => screen.getByRole('tab', { name: /^Pendentes/ });

describe('Fila de aprovações (US08)', () => {
  describe('pendentes', () => {
    it('conta as aprovações e mostra o que o líder precisa para decidir', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      const tabela = await abrirFila();

      expect(
        screen.getByRole('heading', { level: 1, name: 'Você tem 3 aprovações' }),
      ).toBeVisible();
      expect(
        screen.getByText('Abra o comprovante antes de aprovar. Cada decisão fica no histórico.'),
      ).toBeVisible();
      expect(await screen.findByText('Equipe Araucária')).toBeVisible();
      expect(screen.getByRole('tab', { name: 'Pendentes · 3' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      const linhas = linhasDe(tabela);
      expect(linhas).toHaveLength(3);
      expect(linhas[0]).toHaveTextContent('Doação de alimentos');
      expect(linhas[0]).toHaveTextContent('Camila Exemplo');
      expect(linhas[0]).toHaveTextContent('hoje');
      expect(linhas[0]).toHaveTextContent('12 kg');
      expect(linhas[0]).toHaveTextContent('+120 pts');
      expect(linhas[1]).toHaveTextContent('Diego Exemplo');
      expect(linhas[1]).toHaveTextContent('12/11');
      expect(linhas[1]).toHaveTextContent('3 kg');
      expect(linhas[1]).toHaveTextContent('+30 pts');
      expect(linhas[2]).toHaveTextContent('8 peças');
      expect(linhas[2]).toHaveTextContent('+120 pts');
      expect(
        within(tabela)
          .getAllByRole('columnheader')
          .map((cabecalho) => cabecalho.textContent),
      ).toEqual(['Ação', 'Colaborador', 'Quantidade', 'Pontos', 'Comprovante', 'Decisão']);
    });

    it('tem em cada item o link para abrir o comprovante numa nova aba', async () => {
      const { estado, euMesma, doAlimentos } = cenarioDaFila();
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      const tabela = await abrirFila();

      const link = within(linhasDe(tabela)[0]!).getByRole('link', { name: /ver comprovante/i });
      expect(link).toHaveAttribute('href', doAlimentos.evidencias[0]?.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleName(
        /de doação de alimentos, camila exemplo \(abre em uma nova aba\)/i,
      );
    });

    it('numera os comprovantes quando o lançamento tem mais de um', async () => {
      const { estado, euMesma, doAlimentos } = cenarioDaFila();
      estado.lancamentos[0] = {
        ...doAlimentos,
        evidencias: [
          umaEvidencia(doAlimentos.id),
          umaEvidencia(doAlimentos.id, { url: 'https://armazenamento.exemplo.com/outro.pdf' }),
        ],
      };
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      const tabela = await abrirFila();

      const links = within(linhasDe(tabela)[0]!).getAllByRole('link');
      expect(links.map((link) => link.textContent?.split(' de ')[0])).toEqual([
        'Ver comprovante 1',
        'Ver comprovante 2',
      ]);
    });

    it('nunca vira link um comprovante com endereço que não é http(s)', async () => {
      const { estado, euMesma, doAlimentos } = cenarioDaFila();
      estado.lancamentos[0] = {
        ...doAlimentos,
        evidencias: [umaEvidencia(doAlimentos.id, { url: 'javascript:alert(document.cookie)' })],
      };
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      const tabela = await abrirFila();

      const linha = linhasDe(tabela)[0]!;
      expect(within(linha).queryByRole('link')).not.toBeInTheDocument();
      expect(linha).toHaveTextContent('endereço do arquivo indisponível');
    });

    it('avisa quando o lançamento não tem o comprovante que a ação exige', async () => {
      const { estado, euMesma, doAlimentos } = cenarioDaFila();
      estado.lancamentos[0] = { ...doAlimentos, evidencias: [] };
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      const tabela = await abrirFila();

      expect(linhasDe(tabela)[0]).toHaveTextContent('Sem comprovante (a ação exige um)');
    });

    it('deixa de fora o lançamento do próprio líder: ninguém avalia o que lançou', async () => {
      const { estado, euMesma, equipe, alimentos } = cenarioDaFila();
      estado.lancamentos.push(umLancamento(alimentos, euMesma, equipe, { quantidade: 77 }));
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      const tabela = await abrirFila();

      expect(linhasDe(tabela)).toHaveLength(3);
      expect(tabela).not.toHaveTextContent('77 kg');
      expect(
        screen.getByRole('heading', { level: 1, name: 'Você tem 3 aprovações' }),
      ).toBeVisible();
    });

    it('fala no singular com uma só aprovação', async () => {
      const { estado, euMesma, dasTampinhas, dasRoupas } = cenarioDaFila();
      estado.lancamentos = estado.lancamentos.filter(
        (l) => l.id !== dasTampinhas.id && l.id !== dasRoupas.id,
      );
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      await abrirFila();

      expect(screen.getByRole('heading', { level: 1, name: 'Você tem 1 aprovação' })).toBeVisible();
    });
  });

  describe('aprovar', () => {
    it('aprova, tira o item da fila, atualiza o contador e confirma', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const { rotas, aprovar } = rotasDeDecisao(estado, euMesma);
      comSessaoDe('LIDER', rotas);
      const tabela = await abrirFila();
      // O selo da barra inferior usa a mesma consulta e conta os mesmos três.
      expect(
        await within(screen.getByRole('navigation', { name: 'Menu inferior' })).findByRole('link', {
          name: 'Aprovar, 3 pendentes',
        }),
      ).toBeVisible();

      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );

      expect(
        await screen.findByText(
          'Doação de alimentos de Camila Exemplo aprovada: +120 pts para a equipe Araucária.',
        ),
      ).toBeVisible();
      await waitFor(() => {
        expect(linhasDe(screen.getByRole('table'))).toHaveLength(2);
      });
      expect(
        screen.queryByRole('button', { name: /aprovar doação de alimentos de camila/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Você tem 2 aprovações' }),
      ).toBeVisible();
      expect(screen.getByRole('tab', { name: 'Pendentes · 2' })).toBeVisible();
      expect(
        within(screen.getByRole('navigation', { name: 'Menu inferior' })).getByRole('link', {
          name: 'Aprovar, 2 pendentes',
        }),
      ).toBeVisible();
      expect(aprovar).toHaveBeenCalledTimes(1);
    });

    it('o aprovado passa a aparecer na aba Aprovados, com quem decidiu', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);
      const tabela = await abrirFila();
      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de tampinhas de Diego Exemplo',
        }),
      );
      await screen.findByText(/doação de tampinhas de diego exemplo aprovada/i);

      fireEvent.click(screen.getByRole('tab', { name: 'Aprovados' }));

      const aprovados = await screen.findByRole('table', { name: 'Lançamentos aprovados' });
      await waitFor(() => {
        expect(linhasDe(aprovados)).toHaveLength(2);
      });
      expect(aprovados).toHaveTextContent('Diego Exemplo');
      expect(aprovados).toHaveTextContent('Aprovado');
      expect(aprovados).toHaveTextContent('por Pessoa Teste');
    });

    it('não deixa decidir duas vezes enquanto uma decisão está em andamento', async () => {
      const { estado, euMesma } = cenarioDaFila();
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      const base = rotasDeDecisao(estado, euMesma);
      const lenta = vi.fn(async (requisicao: InternalAxiosRequestConfig) => {
        await espera;
        return base.aprovar(requisicao);
      });
      const rotas = { ...base.rotas };
      for (const l of estado.lancamentos) {
        rotas[`POST /lancamentos/${l.id}/aprovar`] = lenta;
      }
      comSessaoDe('LIDER', rotas);
      const tabela = await abrirFila();

      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );

      expect(
        await within(tabela).findByRole('button', {
          name: /aprovar doação de alimentos de camila/i,
        }),
      ).toHaveTextContent('Aprovando…');
      for (const botao of within(tabela).getAllByRole('button')) {
        expect(botao).toBeDisabled();
      }
      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de tampinhas de Diego Exemplo',
        }),
      );
      liberar();
      await screen.findByText(/aprovada: \+120 pts/i);
      expect(lenta).toHaveBeenCalledTimes(1);
    });
  });

  describe('recusar', () => {
    async function abrirRecusa(nomeDoBotao = 'Recusar Doação de alimentos de Camila Exemplo') {
      const tabela = screen.getByRole('table');
      fireEvent.click(within(tabela).getByRole('button', { name: nomeDoBotao }));
      return screen.findByRole('dialog', { name: 'Recusar lançamento' });
    }

    it('abre um diálogo que pede o motivo, com o foco no campo', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);
      await abrirFila();

      const dialogo = await abrirRecusa();

      expect(within(dialogo).getByLabelText('Motivo da recusa')).toHaveFocus();
      expect(dialogo).toHaveTextContent('Doação de alimentos de Camila Exemplo');
      expect(dialogo).toHaveTextContent(/poderá corrigir e reenviar/i);
    });

    it('exige o motivo: vazio ou curto demais não envia nada e mostra o erro no campo', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const { rotas, recusar } = rotasDeDecisao(estado, euMesma);
      comSessaoDe('LIDER', rotas);
      await abrirFila();
      const dialogo = await abrirRecusa();
      const campo = within(dialogo).getByLabelText('Motivo da recusa');

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Recusar' }));

      const erro = await within(dialogo).findByText(
        'Explique em uma frase o que precisa ser corrigido.',
      );
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      expect(campo.getAttribute('aria-describedby')).toContain(erro.id);
      expect(campo).toHaveFocus();

      fireEvent.change(campo, { target: { value: 'ruim' } });
      expect(
        within(dialogo).queryByText('Explique em uma frase o que precisa ser corrigido.'),
      ).not.toBeInTheDocument();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Recusar' }));
      expect(
        await within(dialogo).findByText('Explique em uma frase o que precisa ser corrigido.'),
      ).toBeVisible();
      expect(recusar).not.toHaveBeenCalled();
    });

    it('recusa com o motivo, tira da fila e o item aparece em Recusados com o motivo', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const { rotas, recusar } = rotasDeDecisao(estado, euMesma);
      comSessaoDe('LIDER', rotas);
      await abrirFila();
      const dialogo = await abrirRecusa();

      fireEvent.change(within(dialogo).getByLabelText('Motivo da recusa'), {
        target: { value: '  Foto sem a etiqueta da ONG  ' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Recusar' }));

      expect(
        await screen.findByText(
          /doação de alimentos de camila exemplo recusada\. o motivo já está com o colaborador/i,
        ),
      ).toBeVisible();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(corpoDa(recusar.mock.calls[0]![0])).toEqual({
        motivoRecusa: 'Foto sem a etiqueta da ONG',
      });
      await waitFor(() => {
        expect(linhasDe(screen.getByRole('table'))).toHaveLength(2);
      });
      expect(
        screen.getByRole('heading', { level: 1, name: 'Você tem 2 aprovações' }),
      ).toBeVisible();

      fireEvent.click(screen.getByRole('tab', { name: 'Recusados' }));
      const recusados = await screen.findByRole('table', { name: 'Lançamentos recusados' });
      await waitFor(() => {
        expect(linhasDe(recusados)).toHaveLength(2);
      });
      expect(recusados).toHaveTextContent('Motivo: Foto sem a etiqueta da ONG');
    });

    it('cancelar não recusa nada e devolve o foco ao botão que abriu o diálogo', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const { rotas, recusar } = rotasDeDecisao(estado, euMesma);
      comSessaoDe('LIDER', rotas);
      await abrirFila();
      const botao = within(screen.getByRole('table')).getByRole('button', {
        name: 'Recusar Doação de alimentos de Camila Exemplo',
      });
      botao.focus();
      const dialogo = await abrirRecusa();

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(botao).toHaveFocus();
      expect(recusar).not.toHaveBeenCalled();
      expect(linhasDe(screen.getByRole('table'))).toHaveLength(3);
    });

    it('fecha com Esc sem recusar', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const { rotas, recusar } = rotasDeDecisao(estado, euMesma);
      comSessaoDe('LIDER', rotas);
      await abrirFila();
      const dialogo = await abrirRecusa();

      pressionarEsc(dialogo);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(recusar).not.toHaveBeenCalled();
    });

    it('mostra o erro de validação da API junto do campo do motivo', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const base = rotasDeDecisao(estado, euMesma);
      const rotas = { ...base.rotas };
      for (const l of estado.lancamentos) {
        rotas[`POST /lancamentos/${l.id}/recusar`] = () => ({
          status: 400,
          dados: erroDaApi('DADOS_INVALIDOS', 'Confira os campos informados.', {
            motivoRecusa: ['O motivo tem no máximo 500 caracteres.'],
          }),
        });
      }
      comSessaoDe('LIDER', rotas);
      await abrirFila();
      const dialogo = await abrirRecusa();

      fireEvent.change(within(dialogo).getByLabelText('Motivo da recusa'), {
        target: { value: 'Motivo válido para o contrato' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Recusar' }));

      expect(
        await within(dialogo).findByText('O motivo tem no máximo 500 caracteres.'),
      ).toBeVisible();
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    it('se outra pessoa já avaliou, o diálogo diz isso e a lista é atualizada', async () => {
      const { estado, euMesma, doAlimentos } = cenarioDaFila();
      const base = rotasDeDecisao(estado, euMesma);
      const rotas = {
        ...base.rotas,
        [`POST /lancamentos/${doAlimentos.id}/recusar`]: () => {
          estado.lancamentos = estado.lancamentos.map((l) =>
            l.id === doAlimentos.id ? { ...l, status: 'APROVADO' as const } : l,
          );
          return {
            status: 409,
            dados: erroDaApi('LANCAMENTO_JA_AVALIADO', 'Este lançamento já foi aprovado.'),
          };
        },
      };
      comSessaoDe('LIDER', rotas);
      await abrirFila();
      const dialogo = await abrirRecusa();

      fireEvent.change(within(dialogo).getByLabelText('Motivo da recusa'), {
        target: { value: 'Foto sem a etiqueta' },
      });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Recusar' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        'Outra pessoa já avaliou este lançamento. A lista foi atualizada com o resultado.',
      );
      await waitFor(() => {
        expect(linhasDe(screen.getByRole('table'))).toHaveLength(2);
      });
    });
  });

  describe('conflitos da API ao aprovar', () => {
    function falhaAoAprovar(
      estado: EstadoDosLancamentos,
      avaliador: { id: string; nome: string },
      codigo: string,
      mensagem: string,
      status = 409,
    ) {
      const base = rotasDeDecisao(estado, avaliador);
      const rotas = { ...base.rotas };
      for (const l of estado.lancamentos) {
        rotas[`POST /lancamentos/${l.id}/aprovar`] = () => ({
          status,
          dados: erroDaApi(codigo, mensagem),
        });
      }
      return rotas;
    }

    it('sem comprovante: diz o que fazer, não mostra o código e mantém o item na fila', async () => {
      const { estado, euMesma, doAlimentos } = cenarioDaFila();
      estado.lancamentos[0] = { ...doAlimentos, evidencias: [] };
      comSessaoDe(
        'LIDER',
        falhaAoAprovar(estado, euMesma, 'EVIDENCIA_OBRIGATORIA', 'A ação exige comprovante.'),
      );
      const tabela = await abrirFila();

      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(
        /peça o comprovante ao colaborador ou recuse explicando o que falta/i,
      );
      expect(alerta).not.toHaveTextContent('EVIDENCIA_OBRIGATORIA');
      expect(linhasDe(screen.getByRole('table'))).toHaveLength(3);
    });

    it('lançamento do próprio líder: manda pedir à administradora', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe(
        'LIDER',
        falhaAoAprovar(
          estado,
          euMesma,
          'NAO_PODE_AVALIAR_PROPRIO_LANCAMENTO',
          'Você não pode avaliar um lançamento seu.',
        ),
      );
      const tabela = await abrirFila();

      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /a administradora avalia o de quem lidera a equipe/i,
      );
    });

    it('já avaliado por outra pessoa: avisa e a lista é atualizada', async () => {
      const { estado, euMesma, doAlimentos } = cenarioDaFila();
      const base = rotasDeDecisao(estado, euMesma);
      comSessaoDe('LIDER', {
        ...base.rotas,
        [`POST /lancamentos/${doAlimentos.id}/aprovar`]: () => {
          estado.lancamentos = estado.lancamentos.map((l) =>
            l.id === doAlimentos.id ? { ...l, status: 'APROVADO' as const } : l,
          );
          return {
            status: 409,
            dados: erroDaApi('LANCAMENTO_JA_AVALIADO', 'Este lançamento já foi aprovado.'),
          };
        },
      });
      const tabela = await abrirFila();

      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Outra pessoa já avaliou este lançamento',
      );
      await waitFor(() => {
        expect(linhasDe(screen.getByRole('table'))).toHaveLength(2);
      });
    });

    it('de outra equipe: mostra a mensagem da API', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe(
        'LIDER',
        falhaAoAprovar(
          estado,
          euMesma,
          'SEM_PERMISSAO',
          'Você só pode avaliar lançamentos da sua equipe.',
          403,
        ),
      );
      const tabela = await abrirFila();

      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Você só pode avaliar lançamentos da sua equipe.',
      );
    });

    it('com a internet caída, diz isso em português', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const base = rotasDeDecisao(estado, euMesma);
      const rotas = { ...base.rotas };
      for (const l of estado.lancamentos) {
        rotas[`POST /lancamentos/${l.id}/aprovar`] = () => ({ status: 503 });
      }
      comSessaoDe('LIDER', rotas);
      const tabela = await abrirFila();

      fireEvent.click(
        within(tabela).getByRole('button', {
          name: 'Aprovar Doação de alimentos de Camila Exemplo',
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);
      expect(linhasDe(screen.getByRole('table'))).toHaveLength(3);
    });
  });

  describe('abas', () => {
    it('abre direto na aba do endereço', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      const tabela = await abrirFila('/aprovacoes?aba=recusados');

      expect(screen.getByRole('tab', { name: 'Recusados' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(linhasDe(tabela)).toHaveLength(1);
      expect(tabela).toHaveTextContent('Motivo: Foto sem etiqueta da ONG');
    });

    it('troca de aba pelas setas do teclado e leva o foco junto', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);
      await abrirFila();
      abaPendentes().focus();

      fireEvent.keyDown(abaPendentes(), { key: 'ArrowRight' });

      const aprovados = screen.getByRole('tab', { name: 'Aprovados' });
      expect(aprovados).toHaveAttribute('aria-selected', 'true');
      expect(aprovados).toHaveFocus();
      expect(aprovados).toHaveAttribute('tabindex', '0');
      expect(abaPendentes()).toHaveAttribute('tabindex', '-1');
      expect(await screen.findByRole('table', { name: 'Lançamentos aprovados' })).toBeVisible();

      fireEvent.keyDown(aprovados, { key: 'End' });
      expect(screen.getByRole('tab', { name: 'Recusados' })).toHaveFocus();
      fireEvent.keyDown(screen.getByRole('tab', { name: 'Recusados' }), { key: 'ArrowRight' });
      expect(abaPendentes()).toHaveFocus();
    });

    it('o painel da aba é nomeado pela aba ativa', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);
      await abrirFila();

      expect(screen.getByRole('tabpanel', { name: /pendentes/i })).toBeVisible();

      fireEvent.click(screen.getByRole('tab', { name: 'Aprovados' }));

      expect(await screen.findByRole('tabpanel', { name: 'Aprovados' })).toBeVisible();
    });

    it('traz mais lançamentos sob demanda nas abas de decididos', async () => {
      const { estado, euMesma, camila, equipe, alimentos, bruno } = cenarioDaFila();
      estado.lancamentos.push(
        ...Array.from({ length: 11 }, (_, indice) =>
          umLancamento(alimentos, camila, equipe, {
            quantidade: indice + 20,
            status: 'APROVADO',
            avaliadoPor: bruno,
          }),
        ),
      );
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);
      await abrirFila('/aprovacoes?aba=aprovados');
      await waitFor(() => {
        expect(linhasDe(screen.getByRole('table'))).toHaveLength(10);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Ver mais lançamentos' }));

      await waitFor(() => {
        expect(linhasDe(screen.getByRole('table'))).toHaveLength(12);
      });
    });
  });

  describe('estados da tela', () => {
    it('mostra o carregamento enquanto a fila não chega', async () => {
      const { estado, euMesma } = cenarioDaFila();
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      const base = rotasDeDecisao(estado, euMesma).rotas;
      comSessaoDe('LIDER', {
        ...base,
        'GET /lancamentos/pendentes': async (requisicao) => {
          await espera;
          return (base['GET /lancamentos/pendentes'] as Simulacao)(requisicao);
        },
      });

      renderizarNaRota('/aprovacoes');

      expect(await screen.findByText('Carregando os lançamentos…')).toBeVisible();
      liberar();
      expect(await screen.findByRole('table')).toBeVisible();
    });

    it('explica o que acontece quando não há nada pendente', async () => {
      const { estado, euMesma } = cenarioDaFila();
      estado.lancamentos = [];
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);

      renderizarNaRota('/aprovacoes');

      expect(
        await screen.findByText('Nenhuma aprovação pendente', { selector: 'h2' }),
      ).toBeVisible();
      expect(
        screen.getByText(/quando alguém da equipe registrar uma ação, ela aparece aqui/i),
      ).toBeVisible();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Nenhuma aprovação pendente' }),
      ).toBeVisible();
    });

    it.each([
      ['Aprovados', 'Nenhum lançamento aprovado ainda'],
      ['Recusados', 'Nenhum lançamento recusado'],
    ])('explica a aba %s vazia', async (aba, titulo) => {
      const { estado, euMesma } = cenarioDaFila();
      estado.lancamentos = estado.lancamentos.filter((l) => l.status === 'PENDENTE');
      comSessaoDe('LIDER', rotasDeDecisao(estado, euMesma).rotas);
      await abrirFila();

      fireEvent.click(screen.getByRole('tab', { name: aba }));

      expect(await screen.findByText(titulo)).toBeVisible();
    });

    it('avisa em português quando a fila não carrega e deixa tentar de novo', async () => {
      const { estado, euMesma } = cenarioDaFila();
      const base = rotasDeDecisao(estado, euMesma).rotas;
      let funcionando = false;
      comSessaoDe('LIDER', {
        ...base,
        'GET /lancamentos/pendentes': (requisicao) =>
          funcionando
            ? (base['GET /lancamentos/pendentes'] as Simulacao)(requisicao)
            : { status: 500 },
      });

      renderizarNaRota('/aprovacoes');

      const alertas = await screen.findAllByRole('alert');
      expect(alertas[0]).toHaveTextContent(/servidor está com problemas/i);

      funcionando = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await screen.findByRole('table')).toBeVisible();
    });
  });

  describe('administradora', () => {
    it('aprova de qualquer equipe, dentro do menu dela, vendo de que equipe é cada um', async () => {
      const { estado, euMesma, camila, alimentos } = cenarioDaFila();
      const paineira = { id: '00000000-0000-4000-8000-0000000000e1', nome: 'Paineira' };
      estado.lancamentos.push(umLancamento(alimentos, camila, paineira, { quantidade: 4 }));
      const { rotas } = rotasDeDecisao(estado, euMesma);
      comSessaoDe('ADMIN', rotas);

      const tabela = await abrirFila();

      expect(screen.getByText('Todas as equipes')).toBeVisible();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Você tem 4 aprovações' }),
      ).toBeVisible();
      expect(tabela).toHaveTextContent('Equipe Araucária');
      expect(tabela).toHaveTextContent('Equipe Paineira');

      const menu = within(screen.getByRole('navigation', { name: 'Menu principal' }));
      expect(menu.getByRole('link', { name: 'Painel' })).toBeVisible();
      expect(menu.getByRole('link', { name: 'Aprovações' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        within(screen.getByRole('navigation', { name: 'Menu inferior' })).getByRole('link', {
          name: 'Aprovar',
        }),
      ).toBeVisible();

      // A administradora decide sobre uma equipe que não é a dela (nem a de ninguém da tela).
      const daPaineira = linhasDe(tabela).find((linha) => linha.textContent?.includes('Paineira'));
      fireEvent.click(within(daPaineira as HTMLElement).getByRole('button', { name: /^Aprovar/ }));

      expect(
        await screen.findByText(
          'Doação de alimentos de Camila Exemplo aprovada: +40 pts para a equipe Paineira.',
        ),
      ).toBeVisible();
    });

    it('o menu da administradora leva à fila a partir do painel', async () => {
      const { estado, euMesma } = cenarioDaFila();
      comSessaoDe('ADMIN', rotasDeDecisao(estado, euMesma).rotas);
      renderizarNaRota('/painel');
      await screen.findByRole('heading', { level: 1 });

      fireEvent.click(
        within(screen.getByRole('navigation', { name: 'Menu principal' })).getByRole('link', {
          name: 'Aprovações',
        }),
      );

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Você tem 3 aprovações' }),
      ).toBeVisible();
    });
  });

  it('o colaborador não abre a fila de aprovações', async () => {
    const { estado } = cenarioDaFila();
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

    renderizarNaRota('/aprovacoes');

    expect(
      await screen.findByRole('heading', { name: 'Você não tem acesso a esta página' }),
    ).toBeVisible();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
