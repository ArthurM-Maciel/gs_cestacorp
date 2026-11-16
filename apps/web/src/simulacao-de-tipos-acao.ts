import type { Gincana, TipoAcao, TipoAcaoComHistorico, Unidade } from '@gincana/contracts';

import type { Simulacao } from './simulacao-da-api.js';
import { novoId, umaGincana } from './simulacao-do-cadastro.js';

/**
 * Dados e rotas de mentira para a tela de tipos de ação (US04). Nomes fictícios: nenhum
 * dado de colaborador real entra em teste. A sessão de administradora vem de
 * `comSessaoDeAdmin`, em `simulacao-do-cadastro.js`.
 */

const ID_DO_USUARIO_DE_TESTE = '11111111-1111-4111-8111-111111111111';

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

function comHistorico(tipo: TipoAcao): TipoAcaoComHistorico {
  return { ...tipo, regras: tipo.regraVigente === null ? [] : [tipo.regraVigente] };
}

export interface EstadoDosTiposDeAcao {
  gincanas: Gincana[];
  tipos: TipoAcao[];
}

/**
 * Rotas de leitura que respondem com o estado atual, no mesmo formato da API. A
 * administradora enxerga tipos pausados também — é o que a tela de Regras precisa para
 * oferecer "Reativar".
 */
export function rotasDeTiposDeAcao(estado: EstadoDosTiposDeAcao): Record<string, Simulacao> {
  const rotas: Record<string, Simulacao> = {
    'GET /gincanas': () => ({ status: 200, dados: estado.gincanas }),
  };

  for (const gincana of estado.gincanas) {
    rotas[`GET /gincanas/${gincana.id}/tipos-acao`] = () => ({
      status: 200,
      dados: estado.tipos.filter((tipo) => tipo.gincanaId === gincana.id),
    });
  }

  for (const tipo of estado.tipos) {
    rotas[`GET /tipos-acao/${tipo.id}`] = () => ({
      status: 200,
      dados: comHistorico(estado.tipos.find((item) => item.id === tipo.id) ?? tipo),
    });
  }

  return rotas;
}

/**
 * Uma gincana com três tipos de ação: alimentos e tampinhas (kg, 10 pts), roupas (peça,
 * 15 pts) e curso (certificado, 50 pts, pausado) — como no protótipo de "Regras".
 */
export function cenarioDeTiposDeAcao() {
  const gincana = umaGincana();
  const alimentos = umTipoDeAcao(gincana.id, 'Doação de alimentos', 'KG', 10);
  const tampinhas = umTipoDeAcao(gincana.id, 'Doação de tampinhas', 'KG', 10);
  const roupas = umTipoDeAcao(gincana.id, 'Doação de roupas', 'PECA', 15);
  const curso = umTipoDeAcao(gincana.id, 'Curso ou PDI', 'CERTIFICADO', 50, { ativo: false });

  const estado: EstadoDosTiposDeAcao = {
    gincanas: [gincana],
    tipos: [alimentos, tampinhas, roupas, curso],
  };

  return { gincana, estado, alimentos, tampinhas, roupas, curso };
}
