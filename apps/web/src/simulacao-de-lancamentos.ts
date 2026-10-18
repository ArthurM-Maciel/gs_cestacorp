import type {
  Equipe,
  Evidencia,
  Gincana,
  Lancamento,
  Papel,
  PreviaDeLancamento,
  StatusLancamento,
  TipoAcao,
  Unidade,
} from '@gincana/contracts';
import { calcularPontos } from '@gincana/scoring';
import type { InternalAxiosRequestConfig } from 'axios';

import { dataDeHoje } from './lib/dia-relativo.js';
import { gravarToken } from './lib/token.js';
import { simularApi, usuarioDeTeste, type Simulacao } from './simulacao-da-api.js';
import { novoId, umaEquipe, umaGincana } from './simulacao-do-cadastro.js';

/**
 * Dados e rotas de mentira para as telas de lançamento (início, registrar, corrigir e fila
 * de aprovações). Nomes fictícios: nenhum dado de colaborador real entra em teste.
 */

/** A equipe da `usuarioDeTeste`: é por ela que a tela acha "a minha equipe". */
export const EQUIPE_DO_TESTE = '22222222-2222-4222-8222-222222222222';
export const ID_DO_USUARIO_DE_TESTE = '11111111-1111-4111-8111-111111111111';

export function umTipoDeAcao(
  gincanaId: string,
  nome: string,
  unidade: Unidade,
  pontosPorUnidade: number,
  sobrepor: Partial<TipoAcao> = {},
): TipoAcao {
  const id = sobrepor.id ?? novoId();
  return {
    id,
    gincanaId,
    nome,
    descricao: null,
    unidade,
    exigeEvidencia: true,
    ativo: true,
    regraVigente: {
      id: novoId(),
      tipoAcaoId: id,
      pontosPorUnidade,
      vigenciaInicio: '2026-01-01T00:00:00.000Z',
      vigenciaFim: null,
      criadoPorId: ID_DO_USUARIO_DE_TESTE,
    },
    ...sobrepor,
  };
}

interface Pessoa {
  id: string;
  nome: string;
}

export function umaEvidencia(lancamentoId: string, sobrepor: Partial<Evidencia> = {}): Evidencia {
  return {
    id: novoId(),
    lancamentoId,
    url: 'https://armazenamento.exemplo.com/comprovante.jpg',
    publicId: 'gincana/evidencias/comprovante',
    nomeArquivo: 'comprovante.jpg',
    mimeType: 'image/jpeg',
    tamanhoBytes: 240_000,
    enviadoPorId: ID_DO_USUARIO_DE_TESTE,
    criadoEm: '2026-11-02T12:00:00.000Z',
    ...sobrepor,
  };
}

export function umLancamento(
  tipo: TipoAcao,
  colaborador: Pessoa,
  equipe: Pessoa,
  sobrepor: Partial<Lancamento> = {},
): Lancamento {
  const quantidade = sobrepor.quantidade ?? 12;
  const preco = tipo.regraVigente?.pontosPorUnidade ?? 0;
  const id = sobrepor.id ?? novoId();
  return {
    id,
    gincanaId: tipo.gincanaId,
    colaboradorId: colaborador.id,
    colaborador,
    equipeId: equipe.id,
    equipe,
    tipoAcaoId: tipo.id,
    tipoAcao: {
      id: tipo.id,
      nome: tipo.nome,
      unidade: tipo.unidade,
      exigeEvidencia: tipo.exigeEvidencia,
    },
    quantidade,
    regraPontuacaoId: tipo.regraVigente?.id ?? novoId(),
    pontosPorUnidadeAplicado: preco,
    pontosCalculados: calcularPontos(quantidade, preco),
    status: 'PENDENTE',
    observacao: null,
    dataAcao: dataDeHoje(),
    avaliadoPor: null,
    avaliadoEm: null,
    motivoRecusa: null,
    evidencias: [umaEvidencia(id)],
    criadoEm: '2026-11-02T12:00:00.000Z',
    ...sobrepor,
  };
}

export interface EstadoDosLancamentos {
  gincanas: Gincana[];
  equipes: Equipe[];
  tipos: TipoAcao[];
  lancamentos: Lancamento[];
}

function parametrosDa(requisicao: InternalAxiosRequestConfig) {
  return (requisicao.params ?? {}) as {
    status?: StatusLancamento;
    colaboradorId?: string;
    pagina?: number;
    porPagina?: number;
  };
}

function pagina(itens: Lancamento[], parametros: ReturnType<typeof parametrosDa>) {
  const porPagina = parametros.porPagina ?? 20;
  const atual = parametros.pagina ?? 1;
  return {
    itens: itens.slice((atual - 1) * porPagina, atual * porPagina),
    pagina: atual,
    porPagina,
    total: itens.length,
    totalDePaginas: Math.max(1, Math.ceil(itens.length / porPagina)),
  };
}

/**
 * Rotas de leitura que respondem com o estado atual, no mesmo formato da API. Um teste que
 * "grava" (alterando o estado) vê a lista nova na leitura seguinte, que é o que a invalidação
 * do TanStack Query provoca. A prévia usa o `@gincana/scoring`, como a API.
 */
export function rotasDeLancamentos(estado: EstadoDosLancamentos): Record<string, Simulacao> {
  const [gincana] = estado.gincanas;
  const rotas: Record<string, Simulacao> = {
    'GET /gincanas': () => ({ status: 200, dados: estado.gincanas }),
    'GET /lancamentos': (requisicao) => {
      const filtros = parametrosDa(requisicao);
      const itens = estado.lancamentos
        .filter(
          (l) =>
            (filtros.status === undefined || l.status === filtros.status) &&
            (filtros.colaboradorId === undefined || l.colaboradorId === filtros.colaboradorId),
        )
        .toReversed();
      return { status: 200, dados: pagina(itens, filtros) };
    },
    'GET /lancamentos/pendentes': (requisicao) => ({
      status: 200,
      dados: pagina(
        estado.lancamentos.filter((l) => l.status === 'PENDENTE'),
        parametrosDa(requisicao),
      ),
    }),
    'POST /lancamentos/preview': (requisicao) => {
      const corpo = JSON.parse(String(requisicao.data)) as PreviaDeLancamento;
      const tipo = estado.tipos.find((t) => t.id === corpo.tipoAcaoId);
      if (tipo?.regraVigente == null) {
        return {
          status: 404,
          dados: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Tipo de ação não encontrado.' } },
        };
      }
      return {
        status: 200,
        dados: {
          tipoAcaoId: tipo.id,
          quantidade: corpo.quantidade,
          dataAcao: corpo.dataAcao,
          unidade: tipo.unidade,
          regraPontuacaoId: tipo.regraVigente.id,
          pontosPorUnidade: tipo.regraVigente.pontosPorUnidade,
          pontos: calcularPontos(corpo.quantidade, tipo.regraVigente.pontosPorUnidade),
          exigeEvidencia: tipo.exigeEvidencia,
        },
      };
    },
  };

  if (gincana !== undefined) {
    rotas[`GET /gincanas/${gincana.id}/equipes`] = () => ({ status: 200, dados: estado.equipes });
    rotas[`GET /gincanas/${gincana.id}/tipos-acao`] = () => ({
      status: 200,
      dados: estado.tipos.filter((tipo) => tipo.ativo),
    });
  }

  for (const lancamento of estado.lancamentos) {
    rotas[`GET /lancamentos/${lancamento.id}`] = () => ({
      status: 200,
      dados: estado.lancamentos.find((l) => l.id === lancamento.id),
    });
  }

  return rotas;
}

/** A pessoa já entrou com o papel dado e a API responde com as rotas dadas. */
export function comSessaoDe(papel: Papel, rotas: Record<string, Simulacao>): void {
  gravarToken('token-de-teste');
  simularApi({
    'GET /auth/me': () => ({ status: 200, dados: usuarioDeTeste(papel) }),
    ...rotas,
  });
}

/**
 * Uma gincana ativa com a equipe Araucária (a do usuário de teste, liderada por Bruno) e
 * quatro tipos de ação: alimentos e tampinhas (kg), roupas (peça) e curso (certificado).
 * Bruno e Camila são da equipe; "Pessoa Teste" é quem está logada.
 */
export function cenarioDeLancamentos() {
  const gincana = umaGincana();
  const bruno: Pessoa = { id: novoId(), nome: 'Bruno Exemplo' };
  const camila: Pessoa = { id: novoId(), nome: 'Camila Exemplo' };
  const euMesma: Pessoa = { id: ID_DO_USUARIO_DE_TESTE, nome: 'Pessoa Teste' };

  const araucaria = umaEquipe(gincana.id, 'Araucária', {
    id: EQUIPE_DO_TESTE,
    lider: bruno,
    totalMembros: 2,
  });
  const equipe: Pessoa = { id: araucaria.id, nome: araucaria.nome };

  const alimentos = umTipoDeAcao(gincana.id, 'Doação de alimentos', 'KG', 10);
  const tampinhas = umTipoDeAcao(gincana.id, 'Doação de tampinhas', 'KG', 10);
  const roupas = umTipoDeAcao(gincana.id, 'Doação de roupas', 'PECA', 15);
  const curso = umTipoDeAcao(gincana.id, 'Curso ou PDI', 'CERTIFICADO', 50);

  const estado: EstadoDosLancamentos = {
    gincanas: [gincana],
    equipes: [araucaria],
    tipos: [alimentos, tampinhas, roupas, curso],
    lancamentos: [],
  };

  return {
    gincana,
    estado,
    bruno,
    camila,
    euMesma,
    equipe,
    araucaria,
    alimentos,
    tampinhas,
    roupas,
    curso,
  };
}

/**
 * Rotas de uma gincana sem nada cadastrado (nenhuma gincana, nenhum lançamento). Para os
 * testes de sessão e de acesso, que só precisam que as telas de perfil abram e fiquem vazias.
 */
export function rotasSemDados(): Record<string, Simulacao> {
  return rotasDeLancamentos({ gincanas: [], equipes: [], tipos: [], lancamentos: [] });
}
