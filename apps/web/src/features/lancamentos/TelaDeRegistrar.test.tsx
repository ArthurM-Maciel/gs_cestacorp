import type { Lancamento, RespostaDeAssinatura, TipoAcao } from '@gincana/contracts';
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

function arquivoDeTeste(nome = 'entrega.jpg', tipo = 'image/jpeg', bytes = 2048): File {
  const arquivo = new File(['conteudo'], nome, { type: tipo });
  Object.defineProperty(arquivo, 'size', { value: bytes });
  return arquivo;
}

function assinatura(): RespostaDeAssinatura {
  return {
    provedor: 'cloudinary',
    urlDeUpload: 'https://api.cloudinary.com/v1_1/demo/auto/upload',
    campos: {
      api_key: 'chave-publica',
      timestamp: '1760000000',
      public_id: 'gincana/evidencias/abc',
      signature: 'assinatura-derivada',
    },
    publicId: 'gincana/evidencias/abc',
    urlPrevista: 'https://res.cloudinary.com/demo/image/upload/gincana/evidencias/abc.jpg',
    expiraEm: '2026-11-02T12:10:00.000Z',
  };
}

/** O campo de arquivo muda de rótulo depois de escolhido (passa a dizer o nome do arquivo). */
function escolherArquivo(arquivo: File) {
  const campo = document.querySelector('input[type="file"]');
  if (campo === null) {
    throw new Error('A tela não tem campo de arquivo.');
  }
  fireEvent.change(campo, { target: { files: [arquivo] } });
}

const quantidade = () => screen.getByLabelText('Quantidade (kg)');
const enviar = () => screen.getByRole('button', { name: 'Enviar para aprovação' });

/**
 * O que a API faz no registro, em estado compartilhado: assinar, criar o lançamento e
 * registrar o comprovante nele. Cada teste troca só a rota que quer fazer falhar.
 * `chamadas` guarda a ordem em que as rotas (e o armazenamento) foram acionados.
 */
function rotasDeRegistro(
  estado: EstadoDosLancamentos,
  novo: Lancamento,
  trocas: Record<string, Simulacao> = {},
) {
  const chamadas: string[] = [];
  const assinar = vi.fn((_requisicao: InternalAxiosRequestConfig) => {
    chamadas.push('assinatura');
    return { status: 201, dados: assinatura() };
  });
  const criar = vi.fn((_requisicao: InternalAxiosRequestConfig) => {
    chamadas.push('lancamento');
    estado.lancamentos.push({ ...novo, evidencias: [] });
    return { status: 201, dados: { ...novo, evidencias: [] } };
  });
  const registrar = vi.fn((_requisicao: InternalAxiosRequestConfig) => {
    chamadas.push('comprovante');
    const comComprovante = { ...novo, evidencias: [umaEvidencia(novo.id)] };
    estado.lancamentos = estado.lancamentos.map((l) => (l.id === novo.id ? comComprovante : l));
    return { status: 201, dados: comComprovante };
  });
  const rotas: Record<string, Simulacao> = {
    ...rotasDeLancamentos(estado),
    'POST /evidencias/assinatura': assinar,
    'POST /lancamentos': criar,
    [`POST /lancamentos/${novo.id}/evidencias`]: registrar,
    ...trocas,
  };
  return { rotas, assinar, criar, registrar, chamadas };
}

/** O armazenamento externo (a Cloudinary): recebe o arquivo direto do navegador. */
function armazenamentoQueAceita(chamadas: string[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    chamadas.push('armazenamento');
    return Promise.resolve(new Response(null, { status: 200 }));
  });
}

describe('Escolher ação (US06)', () => {
  it('mostra cada tipo com os pontos por unidade à vista', async () => {
    const { estado } = cenarioDeLancamentos();
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

    renderizarNaRota('/registrar');

    await screen.findByRole('heading', { level: 1, name: 'Qual ação você fez?' });
    const grade = within(screen.getByRole('main')).getByRole('list');
    const itens = within(grade).getAllByRole('listitem');
    expect(itens).toHaveLength(4);
    expect(itens[0]).toHaveTextContent('Doação de alimentos');
    expect(itens[0]).toHaveTextContent('10 pts por kg');
    expect(itens[2]).toHaveTextContent('15 pts por peça');
    expect(itens[3]).toHaveTextContent('50 pts por certificado');
    expect(within(itens[0]!).getByRole('link')).toHaveAttribute(
      'href',
      `/registrar/${estado.tipos[0]?.id}`,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Qual ação você fez?' })).toBeVisible();
    expect(screen.getByText(/os pontos são calculados sozinhos/i)).toBeVisible();
  });

  it('mostra uma atividade extra criada no meio da gincana, sem conhecer o nome dela', async () => {
    const { estado, gincana } = cenarioDeLancamentos();
    estado.tipos.push({
      ...estado.tipos[0]!,
      id: '00000000-0000-4000-8000-0000000000aa',
      nome: 'Mutirão de plantio de mudas',
      unidade: 'UNIDADE',
      regraVigente: { ...estado.tipos[0]!.regraVigente!, pontosPorUnidade: 5 },
      gincanaId: gincana.id,
    });
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

    renderizarNaRota('/registrar');

    const extra = await screen.findByRole('link', { name: /mutirão de plantio de mudas/i });
    expect(extra).toHaveTextContent('5 pts por unidade');
  });

  it('não deixa escolher um tipo sem pontuação cadastrada, e diz por quê', async () => {
    const { estado } = cenarioDeLancamentos();
    estado.tipos[1] = { ...estado.tipos[1]!, regraVigente: null };
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

    renderizarNaRota('/registrar');

    expect(await screen.findByText('Pontuação ainda não cadastrada')).toBeVisible();
    expect(screen.queryByRole('link', { name: /tampinhas/i })).not.toBeInTheDocument();
  });

  it('explica o que fazer quando não há gincana ativa', async () => {
    const { estado } = cenarioDeLancamentos();
    estado.gincanas = [{ ...estado.gincanas[0]!, status: 'ENCERRADA' }];
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

    renderizarNaRota('/registrar');

    expect(await screen.findByText('Nenhuma gincana ativa agora')).toBeVisible();
    expect(screen.getByText(/assim que a administradora ativar a gincana/i)).toBeVisible();
  });

  it('explica o que fazer quando a administradora ainda não cadastrou ações', async () => {
    const { estado } = cenarioDeLancamentos();
    estado.tipos = [];
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

    renderizarNaRota('/registrar');

    expect(await screen.findByText('Nenhuma ação cadastrada ainda')).toBeVisible();
  });

  it('avisa em português quando as ações não carregam e deixa tentar de novo', async () => {
    const { estado, gincana } = cenarioDeLancamentos();
    const rotas = rotasDeLancamentos(estado);
    let funcionando = false;
    comSessaoDe('COLABORADOR', {
      ...rotas,
      [`GET /gincanas/${gincana.id}/tipos-acao`]: (requisicao) =>
        funcionando
          ? (rotas[`GET /gincanas/${gincana.id}/tipos-acao`] as Simulacao)(requisicao)
          : { status: 500 },
    });

    renderizarNaRota('/registrar');

    expect(await screen.findByRole('alert')).toHaveTextContent(/servidor está com problemas/i);
    funcionando = true;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: /doação de alimentos/i })).toBeVisible();
  });

  it('diz que a ação não está disponível quando o endereço aponta para um tipo pausado', async () => {
    const { estado } = cenarioDeLancamentos();
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));

    renderizarNaRota('/registrar/00000000-0000-4000-8000-00000000ffff');

    expect(await screen.findByText('Esta ação não está disponível')).toBeVisible();
    expect(screen.getByRole('link', { name: /doação de alimentos/i })).toBeVisible();
  });

  it('leva a escolha ao formulário da ação', async () => {
    const { estado } = cenarioDeLancamentos();
    comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
    renderizarNaRota('/registrar');

    fireEvent.click(await screen.findByRole('link', { name: /doação de roupas/i }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Doação de roupas' }),
    ).toBeVisible();
    expect(screen.getByText('15 pts por peça · precisa de comprovante')).toBeVisible();
    expect(screen.getByLabelText('Quantidade (peças)')).toHaveValue('1');
  });
});

describe('Registrar ação (US06 e US07)', () => {
  async function abrir(tipo: TipoAcao) {
    renderizarNaRota(`/registrar/${tipo.id}`);
    await screen.findByRole('heading', { level: 2, name: tipo.nome });
  }

  describe('prévia de pontos', () => {
    it('mostra os pontos ao abrir e atualiza quando a pessoa muda a quantidade', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      const rotas = rotasDeLancamentos(estado);
      const previa = vi.fn(rotas['POST /lancamentos/preview'] as Simulacao);
      comSessaoDe('COLABORADOR', { ...rotas, 'POST /lancamentos/preview': previa });

      await abrir(alimentos);

      expect(await screen.findByText('+10 pts')).toBeVisible();

      fireEvent.change(quantidade(), { target: { value: '12' } });

      expect(await screen.findByText('+120 pts')).toBeVisible();
      expect(screen.getByText('12 kg × 10 pts por kg')).toBeVisible();
      expect(corpoDa(previa.mock.calls.at(-1)?.[0] as InternalAxiosRequestConfig)).toMatchObject({
        tipoAcaoId: alimentos.id,
        quantidade: 12,
      });
    });

    it('espera a pessoa parar de digitar: só a quantidade final chega à API', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      const rotas = rotasDeLancamentos(estado);
      const previa = vi.fn(rotas['POST /lancamentos/preview'] as Simulacao);
      comSessaoDe('COLABORADOR', { ...rotas, 'POST /lancamentos/preview': previa });
      await abrir(alimentos);
      await screen.findByText('+10 pts');
      previa.mockClear();
      const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

      fireEvent.change(quantidade(), { target: { value: '5' } });
      await esperar(150);
      // Menos que o atraso da prévia: nada foi pedido, e a tela diz que está calculando.
      expect(previa).not.toHaveBeenCalled();
      expect(screen.getByText('Calculando os pontos…')).toBeVisible();

      // Mexer de novo reinicia a espera: o "5" nunca chega à API.
      fireEvent.change(quantidade(), { target: { value: '12' } });
      await esperar(150);
      expect(previa).not.toHaveBeenCalled();

      expect(await screen.findByText('+120 pts')).toBeVisible();
      const quantidadesPedidas = previa.mock.calls.map(
        ([requisicao]) => (corpoDa(requisicao) as { quantidade: number }).quantidade,
      );
      expect(quantidadesPedidas).toEqual([12]);
    });

    it('anuncia o resultado para leitor de tela numa região de status', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);

      const regiao = await screen.findByRole('status');

      expect(regiao).toHaveAttribute('aria-live', 'polite');
      expect(regiao).toHaveTextContent('Esta ação vale +10 pts');
    });

    it('diz para quem vai a aprovação', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);

      expect(
        await screen.findByText('Vai para aprovação de Bruno Exemplo, líder da equipe.'),
      ).toBeVisible();
    });

    it('para quem lidera a equipe, diz que a administradora aprova', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('LIDER', rotasDeLancamentos(estado));
      await abrir(alimentos);

      expect(
        await screen.findByText('Como você lidera a equipe, quem aprova é a administradora.'),
      ).toBeVisible();
    });

    it('mexe na quantidade pelos botões de mais e de menos, e não deixa chegar a zero', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);

      const menos = screen.getByRole('button', { name: 'Diminuir a quantidade' });
      expect(menos).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Aumentar a quantidade' }));
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar a quantidade' }));

      expect(quantidade()).toHaveValue('3');
      expect(await screen.findByText('+30 pts')).toBeVisible();
      expect(menos).toBeEnabled();
    });

    it('aceita quantidade com vírgula', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);

      fireEvent.change(quantidade(), { target: { value: '2,5' } });

      expect(await screen.findByText('+25 pts')).toBeVisible();
    });

    it('pede a quantidade enquanto o campo não tem um número', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);
      await screen.findByText('+10 pts');

      fireEvent.change(quantidade(), { target: { value: '' } });

      expect(screen.getByText(/informe a quantidade para ver quantos pontos/i)).toBeVisible();
    });

    it('mostra a recusa da regra (ação pausada) e segura o botão de enviar', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        'POST /lancamentos/preview': () => ({
          status: 409,
          dados: erroDaApi('TIPO_DE_ACAO_INATIVO', 'A ação "Doação de alimentos" está pausada.'),
        }),
      });
      await abrir(alimentos);

      const alerta = await screen.findByRole('alert');

      expect(alerta).toHaveTextContent('Não foi possível calcular os pontos');
      expect(alerta).toHaveTextContent(/foi pausada e não aceita novos lançamentos/i);
      expect(alerta).toHaveTextContent(/escolha outra ação/i);
      expect(alerta).not.toHaveTextContent('TIPO_DE_ACAO_INATIVO');
      expect(enviar()).toBeDisabled();
    });

    it('avisa que o período da gincana não vale quando a data foge dele', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', {
        ...rotasDeLancamentos(estado),
        'POST /lancamentos/preview': () => ({
          status: 409,
          dados: erroDaApi(
            'DATA_FORA_DO_PERIODO_DA_GINCANA',
            'A data da ação está fora do período da gincana, que vai de 2026-10-28 a 2026-11-19.',
          ),
        }),
      });
      await abrir(alimentos);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /escolha um dia dentro desse período/i,
      );
    });
  });

  describe('comprovante', () => {
    it('tem um campo de arquivo com rótulo, que o teclado alcança', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);

      const campo = screen.getByLabelText(/tirar foto ou escolher arquivo/i);

      expect(campo).toHaveAttribute('type', 'file');
      expect(campo).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,application/pdf');
      campo.focus();
      expect(campo).toHaveFocus();
      expect(
        screen.getByRole('group', { name: /comprovante \(obrigatório para esta ação\)/i }),
      ).toBeVisible();
    });

    it('mostra o arquivo escolhido e deixa remover', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);

      escolherArquivo(arquivoDeTeste('entrega-ong.jpg', 'image/jpeg', 340_000));

      expect(screen.getByText('entrega-ong.jpg')).toBeVisible();
      expect(screen.getByText(/332 KB · toque para trocar o arquivo/)).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Remover o comprovante' }));

      expect(screen.queryByText('entrega-ong.jpg')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/tirar foto ou escolher arquivo/i)).toHaveFocus();
    });

    it('recusa antes de enviar um tipo de arquivo que a API não aceita', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      const rotas = rotasDeLancamentos(estado);
      const assinar = vi.fn(() => ({ status: 201, dados: assinatura() }));
      comSessaoDe('COLABORADOR', { ...rotas, 'POST /evidencias/assinatura': assinar });
      await abrir(alimentos);

      escolherArquivo(arquivoDeTeste('animacao.gif', 'image/gif'));

      const campo = screen.getByLabelText(/tirar foto ou escolher arquivo/i);
      expect(
        screen.getByText(/não é aceito\. envie uma foto \(jpg, png ou webp\) ou um pdf/i),
      ).toBeVisible();
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('animacao.gif')).not.toBeInTheDocument();
      expect(assinar).not.toHaveBeenCalled();
    });

    it('recusa antes de enviar um arquivo maior que 5 MB, com o tamanho dele na mensagem', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);

      escolherArquivo(arquivoDeTeste('foto-grande.jpg', 'image/jpeg', 7 * 1024 * 1024));

      expect(screen.getByText(/o arquivo tem 7 mb e o limite é 5 mb/i)).toBeVisible();
      expect(screen.queryByText('foto-grande.jpg')).not.toBeInTheDocument();
    });

    it('um arquivo recusado não apaga o comprovante bom que já estava escolhido', async () => {
      const { estado, alimentos } = cenarioDeLancamentos();
      comSessaoDe('COLABORADOR', rotasDeLancamentos(estado));
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste('bom.jpg'));

      escolherArquivo(arquivoDeTeste('ruim.gif', 'image/gif'));

      expect(screen.getByText('bom.jpg')).toBeVisible();
    });
  });

  describe('enviar para aprovação', () => {
    it('sem comprovante, quando a ação exige, mostra o erro no campo e não envia nada', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, assinar, criar } = rotasDeRegistro(estado, novo);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      await screen.findByText('+10 pts');

      fireEvent.click(enviar());

      const campo = screen.getByLabelText(/tirar foto ou escolher arquivo/i);
      const erro = await screen.findByText(
        /anexe o comprovante: esta ação exige uma foto ou um arquivo/i,
      );
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      expect(campo.getAttribute('aria-describedby')).toContain(erro.id);
      expect(campo).toHaveFocus();
      expect(assinar).not.toHaveBeenCalled();
      expect(criar).not.toHaveBeenCalled();
    });

    it('envia o arquivo, cria o lançamento, registra o comprovante e leva ao início', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe, { quantidade: 12 });
      const { rotas, assinar, criar, registrar, chamadas } = rotasDeRegistro(estado, novo);
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      fireEvent.change(quantidade(), { target: { value: '12' } });
      await screen.findByText('+120 pts');
      escolherArquivo(arquivoDeTeste('entrega.jpg', 'image/jpeg', 2048));

      fireEvent.click(enviar());

      expect(
        await screen.findByText(
          /ação registrada: 12 kg de doação de alimentos\. vai para aprovação de bruno exemplo/i,
        ),
      ).toBeVisible();
      expect(await screen.findByRole('table', { name: 'Meus lançamentos' })).toHaveTextContent(
        'Doação de alimentos',
      );

      // 1) assinatura  2) arquivo direto ao armazenamento  3) lançamento  4) comprovante.
      expect(chamadas).toEqual(['assinatura', 'armazenamento', 'lancamento', 'comprovante']);
      expect(corpoDa(assinar.mock.calls[0]![0])).toEqual({
        nomeArquivo: 'entrega.jpg',
        mimeType: 'image/jpeg',
        tamanhoBytes: 2048,
      });
      expect(corpoDa(criar.mock.calls[0]![0])).toMatchObject({
        tipoAcaoId: alimentos.id,
        quantidade: 12,
        observacao: null,
      });
      expect(corpoDa(registrar.mock.calls[0]![0])).toEqual({
        url: assinatura().urlPrevista,
        publicId: assinatura().publicId,
        nomeArquivo: 'entrega.jpg',
        mimeType: 'image/jpeg',
        tamanhoBytes: 2048,
      });
    });

    it('manda o arquivo ao armazenamento com a assinatura e SEM o token da pessoa', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, chamadas } = rotasDeRegistro(estado, novo);
      const armazenamento = armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste('entrega.jpg'));

      fireEvent.click(enviar());
      await screen.findByRole('table', { name: 'Meus lançamentos' });

      const [endereco, opcoes] = armazenamento.mock.calls[0]!;
      expect(endereco).toBe('https://api.cloudinary.com/v1_1/demo/auto/upload');
      expect(opcoes?.method).toBe('POST');
      expect(opcoes?.headers).toBeUndefined();
      const formulario = opcoes?.body as FormData;
      expect(formulario.get('signature')).toBe('assinatura-derivada');
      expect(formulario.get('api_key')).toBe('chave-publica');
      expect(formulario.get('public_id')).toBe('gincana/evidencias/abc');
      expect((formulario.get('file') as File).name).toBe('entrega.jpg');
    });

    it('registra sem comprovante quando a ação não exige e a pessoa não anexa nada', async () => {
      const { estado, alimentos, euMesma, equipe, gincana } = cenarioDeLancamentos();
      const atitude = {
        ...alimentos,
        id: '00000000-0000-4000-8000-0000000000bb',
        nome: 'Atitude solidária',
        exigeEvidencia: false,
        gincanaId: gincana.id,
      };
      estado.tipos.push(atitude);
      const novo = umLancamento(atitude, euMesma, equipe, { evidencias: [] });
      const { rotas, assinar, criar, registrar } = rotasDeRegistro(estado, novo);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(atitude);
      expect(screen.getByRole('group', { name: /comprovante \(opcional\)/i })).toBeVisible();

      fireEvent.click(enviar());

      expect(await screen.findByText(/ação registrada/i)).toBeVisible();
      expect(criar).toHaveBeenCalledTimes(1);
      expect(assinar).not.toHaveBeenCalled();
      expect(registrar).not.toHaveBeenCalled();
    });

    it('não deixa clicar duas vezes enquanto envia e diz em que etapa está', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((resolver) => {
        liberar = resolver;
      });
      const { rotas, criar, chamadas } = rotasDeRegistro(estado, novo, {
        'POST /lancamentos': async (requisicao) => {
          await espera;
          return rotasDeRegistro(estado, novo).rotas['POST /lancamentos']!(requisicao);
        },
      });
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      const botao = await screen.findByRole('button', { name: 'Registrando a ação…' });
      expect(botao).toBeDisabled();
      expect(criar).not.toHaveBeenCalled();
      liberar();
      expect(await screen.findByText(/ação registrada/i)).toBeVisible();
    });

    it('mantém o que a pessoa digitou e não repete o upload quando o registro é recusado', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      let tentativa = 0;
      const base = rotasDeRegistro(estado, novo);
      const { rotas, assinar, chamadas } = rotasDeRegistro(estado, novo, {
        'POST /lancamentos': (requisicao) => {
          tentativa += 1;
          return tentativa === 1
            ? {
                status: 409,
                dados: erroDaApi(
                  'DATA_FORA_DO_PERIODO_DA_GINCANA',
                  'A data da ação está fora do período da gincana, que vai de 2026-10-28 a 2026-11-19.',
                ),
              }
            : base.rotas['POST /lancamentos']!(requisicao);
        },
      });
      const armazenamento = armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      fireEvent.change(quantidade(), { target: { value: '7' } });
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      const data = await screen.findByLabelText('Data da ação');
      expect(await screen.findByText(/escolha um dia dentro desse período/i)).toBeVisible();
      expect(data).toHaveAttribute('aria-invalid', 'true');
      expect(data).toHaveFocus();
      expect(quantidade()).toHaveValue('7');
      expect(screen.getByText('entrega.jpg')).toBeVisible();

      fireEvent.click(enviar());

      expect(await screen.findByText(/ação registrada/i)).toBeVisible();
      // O arquivo subiu uma vez só: a segunda tentativa reaproveita o que já foi enviado.
      expect(assinar).toHaveBeenCalledTimes(1);
      expect(armazenamento).toHaveBeenCalledTimes(1);
    });

    it('com a gincana encerrada, diz o que fazer e não mostra o código da API', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, chamadas } = rotasDeRegistro(estado, novo, {
        'POST /lancamentos': () => ({
          status: 409,
          dados: erroDaApi('GINCANA_NAO_ESTA_ATIVA', 'Esta gincana já foi encerrada.'),
        }),
      });
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(/a gincana não está ativa/i);
      expect(alerta).toHaveTextContent(/fale com a administradora/i);
      expect(alerta).not.toHaveTextContent('GINCANA_NAO_ESTA_ATIVA');
    });

    it('com a ação pausada entre a prévia e o envio, manda escolher outra', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, chamadas } = rotasDeRegistro(estado, novo, {
        'POST /lancamentos': () => ({
          status: 409,
          dados: erroDaApi('TIPO_DE_ACAO_INATIVO', 'A ação está pausada.'),
        }),
      });
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      expect(await screen.findByRole('alert')).toHaveTextContent(/escolha outra ação na lista/i);
    });

    it('mostra o erro de validação da API junto do campo que falhou', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, chamadas } = rotasDeRegistro(estado, novo, {
        'POST /lancamentos': () => ({
          status: 400,
          dados: erroDaApi('DADOS_INVALIDOS', 'Confira os campos informados.', {
            quantidade: ['Quantidade fora do intervalo aceito.'],
            observacao: ['A observação tem no máximo 500 caracteres.'],
          }),
        }),
      });
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      const erro = await screen.findByText('Quantidade fora do intervalo aceito.');
      expect(quantidade()).toHaveAttribute('aria-invalid', 'true');
      expect(quantidade().getAttribute('aria-describedby')).toBe(erro.id);
      expect(quantidade()).toHaveFocus();
      expect(screen.getByText('A observação tem no máximo 500 caracteres.')).toBeVisible();
    });

    it('valida a quantidade antes de enviar, com a mesma regra do contrato', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, criar } = rotasDeRegistro(estado, novo);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());
      fireEvent.change(quantidade(), { target: { value: '0' } });

      fireEvent.click(enviar());

      expect(await screen.findByText('A quantidade precisa ser maior que zero.')).toBeVisible();
      expect(criar).not.toHaveBeenCalled();
    });

    it('se o armazenamento recusa o arquivo, não cria lançamento nenhum', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, criar } = rotasDeRegistro(estado, novo);
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(/não foi possível enviar o comprovante/i);
      expect(alerta).toHaveTextContent(/verifique a sua internet e tente de novo/i);
      expect(criar).not.toHaveBeenCalled();
      expect(enviar()).toBeEnabled();
      expect(quantidade()).toBeVisible();
    });

    it('se o armazenamento responde com erro, também não cria lançamento', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, criar } = rotasDeRegistro(estado, novo);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 400 }));
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /o armazenamento não aceitou o comprovante/i,
      );
      expect(criar).not.toHaveBeenCalled();
    });

    it('se o lançamento nasce mas o comprovante não chega, leva ao início e diz como anexar', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, chamadas } = rotasDeRegistro(estado, novo, {
        [`POST /lancamentos/${novo.id}/evidencias`]: () => ({ status: 500 }),
      });
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());

      fireEvent.click(enviar());

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(
        /seu lançamento de doação de alimentos foi registrado, mas o comprovante não chegou/i,
      );
      expect(alerta).toHaveTextContent(/anexar comprovante/i);
      // O lançamento existe e a lista oferece o caminho para anexar o comprovante.
      const tabela = await screen.findByRole('table', { name: 'Meus lançamentos' });
      expect(
        within(tabela).getByRole('link', { name: 'Anexar comprovante a Doação de alimentos' }),
      ).toBeVisible();
      expect(chamadas.filter((chamada) => chamada === 'lancamento')).toHaveLength(1);
    });

    it('o aviso de sucesso pode ser dispensado', async () => {
      const { estado, alimentos, euMesma, equipe } = cenarioDeLancamentos();
      const novo = umLancamento(alimentos, euMesma, equipe);
      const { rotas, chamadas } = rotasDeRegistro(estado, novo);
      armazenamentoQueAceita(chamadas);
      comSessaoDe('COLABORADOR', rotas);
      await abrir(alimentos);
      escolherArquivo(arquivoDeTeste());
      fireEvent.click(enviar());
      await screen.findByText(/ação registrada/i);

      fireEvent.click(screen.getByRole('button', { name: 'Dispensar' }));

      await waitFor(() => {
        expect(screen.queryByText(/ação registrada/i)).not.toBeInTheDocument();
      });
    });
  });
});
