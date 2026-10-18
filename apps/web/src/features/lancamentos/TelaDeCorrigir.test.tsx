import type { Lancamento, RespostaDeAssinatura } from '@gincana/contracts';
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
import { renderizarNaRota } from '../../utilitarios-de-teste.js';

function corpoDa(requisicao: InternalAxiosRequestConfig): unknown {
  return typeof requisicao.data === 'string' ? JSON.parse(requisicao.data) : requisicao.data;
}

const assinatura: RespostaDeAssinatura = {
  provedor: 'cloudinary',
  urlDeUpload: 'https://api.cloudinary.com/v1_1/demo/auto/upload',
  campos: { api_key: 'k', timestamp: '1', public_id: 'gincana/novo', signature: 's' },
  publicId: 'gincana/novo',
  urlPrevista: 'https://res.cloudinary.com/demo/image/upload/gincana/novo.jpg',
  expiraEm: '2026-11-02T12:10:00.000Z',
};

function escolherArquivo(nome = 'foto-nova.jpg') {
  const arquivo = new File(['x'], nome, { type: 'image/jpeg' });
  const campo = document.querySelector('input[type="file"]');
  fireEvent.change(campo as Element, { target: { files: [arquivo] } });
}

const reenviar = () => screen.getByRole('button', { name: 'Reenviar para aprovação' });

/**
 * A correção como a API a faz: o `PATCH` devolve o recusado para PENDENTE sem motivo e
 * atualiza os campos. `chamadas` guarda a ordem das rotas acionadas.
 */
function rotasDeCorrecao(
  estado: EstadoDosLancamentos,
  original: Lancamento,
  trocas: Record<string, Simulacao> = {},
) {
  const chamadas: string[] = [];
  const corrigir = vi.fn((requisicao: InternalAxiosRequestConfig) => {
    chamadas.push('correcao');
    const dados = corpoDa(requisicao) as Partial<Lancamento>;
    const atualizado: Lancamento = {
      ...original,
      ...dados,
      pontosCalculados: Math.round(
        (dados.quantidade ?? original.quantidade) * original.pontosPorUnidadeAplicado,
      ),
      status: 'PENDENTE',
      motivoRecusa: null,
      avaliadoPor: null,
    };
    estado.lancamentos = estado.lancamentos.map((l) => (l.id === original.id ? atualizado : l));
    return { status: 200, dados: atualizado };
  });
  const remover = vi.fn((_requisicao: InternalAxiosRequestConfig) => {
    chamadas.push('remocao');
    const atual = estado.lancamentos.find((l) => l.id === original.id) as Lancamento;
    return { status: 200, dados: { ...atual, evidencias: [] } };
  });
  const assinar = vi.fn((_requisicao: InternalAxiosRequestConfig) => {
    chamadas.push('assinatura');
    return { status: 201, dados: assinatura };
  });
  const registrar = vi.fn((_requisicao: InternalAxiosRequestConfig) => {
    chamadas.push('comprovante');
    const atual = estado.lancamentos.find((l) => l.id === original.id) as Lancamento;
    const comNovo = { ...atual, evidencias: [...atual.evidencias, umaEvidencia(original.id)] };
    estado.lancamentos = estado.lancamentos.map((l) => (l.id === original.id ? comNovo : l));
    return { status: 201, dados: comNovo };
  });
  const rotas: Record<string, Simulacao> = {
    ...rotasDeLancamentos(estado),
    [`PATCH /lancamentos/${original.id}`]: corrigir,
    [`POST /lancamentos/${original.id}/evidencias`]: registrar,
    'POST /evidencias/assinatura': assinar,
    ...Object.fromEntries(
      original.evidencias.map((e) => [
        `DELETE /lancamentos/${original.id}/evidencias/${e.id}`,
        remover,
      ]),
    ),
    ...trocas,
  };
  return { rotas, corrigir, remover, assinar, registrar, chamadas };
}

function armazenamentoQueAceita(chamadas: string[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    chamadas.push('armazenamento');
    return Promise.resolve(new Response(null, { status: 200 }));
  });
}

async function abrirCorrecao(original: Lancamento) {
  renderizarNaRota(`/lancamentos/${original.id}/corrigir`);
  await screen.findByRole('heading', { level: 1, name: original.tipoAcao.nome });
}

function cenarioDeRecusa() {
  const base = cenarioDeLancamentos();
  const recusado = umLancamento(base.roupas, base.euMesma, base.equipe, {
    quantidade: 8,
    status: 'RECUSADO',
    motivoRecusa: 'Foto sem etiqueta da ONG',
    observacao: 'Entregue na ONG do bairro',
    avaliadoPor: base.bruno,
    avaliadoEm: '2026-11-03T10:00:00.000Z',
  });
  base.estado.lancamentos = [recusado];
  return { ...base, recusado };
}

describe('Corrigir e reenviar (US06 e US10)', () => {
  describe('o lançamento recusado', () => {
    it('mostra o motivo da recusa antes dos campos, com os dados já preenchidos', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      comSessaoDe('COLABORADOR', rotasDeCorrecao(estado, recusado).rotas);

      await abrirCorrecao(recusado);

      const motivo = screen.getByRole('region', { name: /motivo da recusa/i });
      expect(motivo).toHaveTextContent('Foto sem etiqueta da ONG');
      expect(motivo).toHaveTextContent('Bruno Exemplo');
      expect(screen.getByText('Corrigir e reenviar')).toBeVisible();
      expect(screen.getByLabelText('Quantidade (peças)')).toHaveValue('8');
      expect(screen.getByLabelText('Data da ação')).toHaveValue(recusado.dataAcao);
      expect(screen.getByLabelText('Observação (opcional)')).toHaveValue(
        'Entregue na ONG do bairro',
      );
      expect(screen.getByText('comprovante.jpg')).toBeVisible();
    });

    it('reenvia com as correções, volta para a fila e a lista mostra pendente sem o motivo', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const { rotas, corrigir, chamadas } = rotasDeCorrecao(estado, recusado);
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(recusado);

      fireEvent.change(screen.getByLabelText('Quantidade (peças)'), { target: { value: '9' } });
      fireEvent.click(reenviar());

      expect(
        await screen.findByText(
          /reenviado\. ele voltou para a fila de aprovação com as suas correções/i,
        ),
      ).toBeVisible();
      const tabela = await screen.findByRole('table', { name: 'Meus lançamentos' });
      expect(tabela).toHaveTextContent('9 peças');
      expect(tabela).toHaveTextContent('Pendente');
      expect(tabela).not.toHaveTextContent('Foto sem etiqueta da ONG');
      expect(chamadas).toEqual(['correcao']);
      expect(corpoDa(corrigir.mock.calls[0]![0])).toEqual({
        quantidade: 9,
        dataAcao: recusado.dataAcao,
        observacao: 'Entregue na ONG do bairro',
      });
    });

    it('troca o comprovante: sobe o novo, corrige, remove o antigo e registra o novo, nessa ordem', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const { rotas, chamadas, registrar } = rotasDeCorrecao(estado, recusado);
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(recusado);

      fireEvent.click(
        screen.getByRole('button', { name: 'Remover o comprovante comprovante.jpg' }),
      );
      expect(screen.getByText('Será removido ao reenviar')).toBeVisible();
      escolherArquivo('foto-com-etiqueta.jpg');
      fireEvent.click(reenviar());

      await screen.findByText(/reenviado/i);
      expect(chamadas).toEqual([
        'assinatura',
        'armazenamento',
        'correcao',
        'remocao',
        'comprovante',
      ]);
      expect(corpoDa(registrar.mock.calls[0]![0])).toMatchObject({
        nomeArquivo: 'foto-com-etiqueta.jpg',
        publicId: 'gincana/novo',
      });
    });

    it('deixa desistir de remover um comprovante antes de reenviar', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const { rotas, remover } = rotasDeCorrecao(estado, recusado);
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(recusado);

      const botao = screen.getByRole('button', { name: 'Remover o comprovante comprovante.jpg' });
      fireEvent.click(botao);
      fireEvent.click(screen.getByRole('button', { name: 'Manter o comprovante comprovante.jpg' }));
      fireEvent.click(reenviar());

      await screen.findByText(/reenviado/i);
      expect(remover).not.toHaveBeenCalled();
    });

    it('não deixa reenviar sem comprovante quando a ação exige e o único foi descartado', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const { rotas, corrigir } = rotasDeCorrecao(estado, recusado);
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(recusado);

      fireEvent.click(
        screen.getByRole('button', { name: 'Remover o comprovante comprovante.jpg' }),
      );
      fireEvent.click(reenviar());

      const erro = await screen.findByText(
        /esta ação exige comprovante\. mantenha um dos anexados/i,
      );
      const campo = document.querySelector('input[type="file"]');
      expect(campo?.getAttribute('aria-describedby')).toContain(erro.id);
      expect(corrigir).not.toHaveBeenCalled();
    });
  });

  describe('prévia de pontos na correção', () => {
    it('recalcula sobre o preço congelado no lançamento, não sobre o de hoje, sem chamar a API', async () => {
      const { estado, recusado, roupas } = cenarioDeRecusa();
      // O preço da roupa subiu para 15 depois; este lançamento foi apurado a 12 por peça.
      const antigo: Lancamento = {
        ...recusado,
        pontosPorUnidadeAplicado: 12,
        pontosCalculados: 96,
      };
      estado.lancamentos = [antigo];
      const base = rotasDeCorrecao(estado, antigo);
      const previa = vi.fn((_requisicao: InternalAxiosRequestConfig) => ({ status: 500 }));
      comSessaoDe('COLABORADOR', { ...base.rotas, 'POST /lancamentos/preview': previa });
      await abrirCorrecao(antigo);

      expect(screen.getByText('+96 pts')).toBeVisible();
      fireEvent.change(screen.getByLabelText('Quantidade (peças)'), { target: { value: '10' } });

      expect(await screen.findByText('+120 pts')).toBeVisible();
      expect(
        screen.getByText(/10 peças × 12 pts por peça, o preço de quando você registrou/),
      ).toBeVisible();
      expect(previa).not.toHaveBeenCalled();
      expect(roupas.regraVigente?.pontosPorUnidade).toBe(15);
    });

    it('se o dia da ação muda, pede à API, que escolhe a regra daquela data', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const base = rotasDeCorrecao(estado, recusado);
      const previa = vi.fn(base.rotas['POST /lancamentos/preview'] as Simulacao);
      comSessaoDe('COLABORADOR', { ...base.rotas, 'POST /lancamentos/preview': previa });
      await abrirCorrecao(recusado);
      expect(previa).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText('Data da ação'), { target: { value: '2026-11-01' } });

      expect(await screen.findByText('+120 pts')).toBeVisible();
      expect(previa).toHaveBeenCalledTimes(1);
      expect(corpoDa(previa.mock.calls[0]![0])).toMatchObject({
        quantidade: 8,
        dataAcao: '2026-11-01',
      });
    });
  });

  describe('o lançamento pendente sem comprovante', () => {
    it('deixa anexar o comprovante que faltou', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const semComprovante = umLancamento(alimentos, euMesma, equipe, { evidencias: [] });
      estado.lancamentos = [semComprovante];
      const { rotas, chamadas } = rotasDeCorrecao(estado, semComprovante);
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(semComprovante);
      expect(screen.getByText('Corrigir lançamento')).toBeVisible();
      expect(screen.queryByText(/motivo da recusa/i)).not.toBeInTheDocument();

      escolherArquivo('entrega.jpg');
      fireEvent.click(reenviar());

      expect(
        await screen.findByText(/atualizado\. ele continua na fila de aprovação/i),
      ).toBeVisible();
      expect(chamadas).toEqual(['assinatura', 'armazenamento', 'correcao', 'comprovante']);
    });
  });

  describe('conflitos', () => {
    it('se o comprovante novo estoura o limite, diz que as correções foram salvas e o que fazer', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const { rotas, chamadas } = rotasDeCorrecao(estado, recusado, {
        [`POST /lancamentos/${recusado.id}/evidencias`]: () => ({
          status: 409,
          dados: erroDaApi('LIMITE_DE_COMPROVANTES', 'Este lançamento já tem 10 comprovantes.'),
        }),
      });
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(recusado);
      escolherArquivo();

      fireEvent.click(reenviar());

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(
        /as suas correções foram salvas e o lançamento voltou para a fila/i,
      );
      expect(alerta).toHaveTextContent(
        /máximo de 10 comprovantes\. remova um antes de anexar outro/i,
      );
      expect(alerta).not.toHaveTextContent('LIMITE_DE_COMPROVANTES');
      expect(reenviar()).toBeEnabled();
    });

    it('se alguém aprovou enquanto a pessoa corrigia, mostra a mensagem da API', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const { rotas } = rotasDeCorrecao(estado, recusado, {
        [`PATCH /lancamentos/${recusado.id}`]: () => ({
          status: 409,
          dados: erroDaApi(
            'LANCAMENTO_JA_APROVADO',
            'Este lançamento já foi aprovado e não pode mais ser alterado. Fale com a administradora se algo estiver errado.',
          ),
        }),
      });
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(recusado);

      fireEvent.click(reenviar());

      expect(await screen.findByRole('alert')).toHaveTextContent(/fale com a administradora/i);
    });

    it('mostra o erro de validação junto do campo', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      const { rotas } = rotasDeCorrecao(estado, recusado, {
        [`PATCH /lancamentos/${recusado.id}`]: () => ({
          status: 400,
          dados: erroDaApi('DADOS_INVALIDOS', 'Confira os campos informados.', {
            dataAcao: ['A data da ação não pode ser no futuro.'],
          }),
        }),
      });
      comSessaoDe('COLABORADOR', rotas);
      await abrirCorrecao(recusado);

      fireEvent.click(reenviar());

      expect(await screen.findByText('A data da ação não pode ser no futuro.')).toBeVisible();
      expect(screen.getByLabelText('Data da ação')).toHaveFocus();
    });
  });

  describe('estados da tela', () => {
    it('mostra o carregamento enquanto o lançamento não chega', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      const base = rotasDeCorrecao(estado, recusado);
      comSessaoDe('COLABORADOR', {
        ...base.rotas,
        [`GET /lancamentos/${recusado.id}`]: async (requisicao) => {
          await espera;
          return (rotasDeLancamentos(estado)[`GET /lancamentos/${recusado.id}`] as Simulacao)(
            requisicao,
          );
        },
      });

      renderizarNaRota(`/lancamentos/${recusado.id}/corrigir`);

      expect(await screen.findByText('Carregando o lançamento…')).toBeVisible();
      liberar();
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Doação de roupas' }),
      ).toBeVisible();
    });

    it('diz que o lançamento não foi encontrado e leva de volta ao início', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        [`GET /lancamentos/${recusado.id}`]: () => ({
          status: 404,
          dados: erroDaApi('NAO_ENCONTRADO', 'Lançamento não encontrado.'),
        }),
      });

      renderizarNaRota(`/lancamentos/${recusado.id}/corrigir`);

      expect(await screen.findByText('Lançamento não encontrado')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute(
        'href',
        '/inicio',
      );
    });

    it('avisa em português quando o lançamento não carrega, e deixa tentar de novo', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      let funcionando = false;
      const rotas = rotasDeCorrecao(estado, recusado).rotas;
      comSessaoDe('COLABORADOR', {
        ...rotas,
        [`GET /lancamentos/${recusado.id}`]: (requisicao) =>
          funcionando
            ? (rotasDeLancamentos(estado)[`GET /lancamentos/${recusado.id}`] as Simulacao)(
                requisicao,
              )
            : { status: 500 },
      });

      renderizarNaRota(`/lancamentos/${recusado.id}/corrigir`);
      expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);

      funcionando = true;
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Doação de roupas' }),
      ).toBeVisible();
    });

    it('não deixa corrigir o que já foi aprovado', async () => {
      const { estado, recusado } = cenarioDeRecusa();
      estado.lancamentos = [{ ...recusado, status: 'APROVADO', motivoRecusa: null }];
      comSessaoDe('COLABORADOR', rotasDeCorrecao(estado, recusado).rotas);

      renderizarNaRota(`/lancamentos/${recusado.id}/corrigir`);

      expect(await screen.findByText('Este lançamento já foi aprovado')).toBeVisible();
      expect(screen.queryByRole('button', { name: /reenviar/i })).not.toBeInTheDocument();
    });

    it('não abre o lançamento de outra pessoa', async () => {
      const { estado, camila, equipe, alimentos } = cenarioDeLancamentos();
      const dela = umLancamento(alimentos, camila, equipe, {
        status: 'RECUSADO',
        motivoRecusa: 'Sem foto legível',
      });
      estado.lancamentos = [dela];
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

      renderizarNaRota(`/lancamentos/${dela.id}/corrigir`);

      expect(await screen.findByText('Este lançamento não é seu')).toBeVisible();
      expect(screen.queryByText('Sem foto legível')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /reenviar/i })).not.toBeInTheDocument();
      });
      expect(
        within(screen.getByRole('main')).getByRole('link', { name: 'Voltar para o início' }),
      ).toBeVisible();
    });
  });
});
