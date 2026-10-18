import type { Colaborador, Equipe, Gincana } from '@gincana/contracts';
import type { InternalAxiosRequestConfig } from 'axios';

import { gravarToken } from './lib/token.js';
import { simularApi, usuarioDeTeste, type Simulacao } from './simulacao-da-api.js';

/**
 * Dados e rotas de mentira para os testes das telas de cadastro (gincanas, equipes e
 * colaboradores). Todo nome e e-mail é fictício: nenhum dado de colaborador real entra em
 * teste.
 */

let contador = 0;

/** UUID v4 válido e previsível: o contrato valida o formato dos identificadores. */
export function novoId(): string {
  contador += 1;
  return `00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`;
}

export function umaGincana(sobrepor: Partial<Gincana> = {}): Gincana {
  return {
    id: novoId(),
    ano: 2026,
    nome: 'Gincana Solidária 2026',
    dataInicio: '2026-10-28',
    dataFim: '2026-11-19',
    status: 'ATIVA',
    ...sobrepor,
  };
}

export function umColaborador(nome: string, sobrepor: Partial<Colaborador> = {}): Colaborador {
  const login = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.');
  return {
    id: novoId(),
    nome,
    email: `${login}@exemplo.com.br`,
    papel: 'COLABORADOR',
    ativo: true,
    equipe: null,
    ...sobrepor,
  };
}

export function umaEquipe(gincanaId: string, nome: string, sobrepor: Partial<Equipe> = {}): Equipe {
  return {
    id: novoId(),
    nome,
    gincanaId,
    lider: null,
    totalMembros: 0,
    ...sobrepor,
  };
}

export interface EstadoDoCadastro {
  gincanas: Gincana[];
  equipes: Equipe[];
  colaboradores: Colaborador[];
}

/**
 * Rotas de leitura que respondem com o estado atual. Como devolvem o que está no objeto no
 * momento da chamada, um teste que "grava" (alterando o estado) vê a lista nova na leitura
 * seguinte, que é exatamente o que a invalidação do TanStack Query provoca.
 */
export function rotasDeLeitura(estado: EstadoDoCadastro): Record<string, Simulacao> {
  const rotas: Record<string, Simulacao> = {
    'GET /gincanas': () => ({ status: 200, dados: estado.gincanas }),
    'GET /colaboradores': (requisicao: InternalAxiosRequestConfig) => {
      const filtros = (requisicao.params ?? {}) as { equipeId?: string; papel?: string };
      const lista = estado.colaboradores.filter(
        (pessoa) =>
          (filtros.equipeId === undefined || pessoa.equipe?.id === filtros.equipeId) &&
          (filtros.papel === undefined || pessoa.papel === filtros.papel),
      );
      return { status: 200, dados: lista };
    },
  };

  for (const gincana of estado.gincanas) {
    rotas[`GET /gincanas/${gincana.id}/equipes`] = () => ({
      status: 200,
      dados: estado.equipes.filter((equipe) => equipe.gincanaId === gincana.id),
    });
  }

  return rotas;
}

/** A pessoa já entrou como administradora e a API responde com as rotas dadas. */
export function comSessaoDeAdmin(rotas: Record<string, Simulacao>): void {
  gravarToken('token-de-teste');
  simularApi({
    'GET /auth/me': () => ({ status: 200, dados: usuarioDeTeste('ADMIN') }),
    ...rotas,
  });
}

/**
 * Uma gincana com duas equipes. Ipê é liderada por Ana e tem Bruno; Araucária é liderada
 * por Davi. Carla está sem equipe e Elisa está desativada.
 */
export function cenarioDoCadastro() {
  const gincana = umaGincana();
  const ana = umColaborador('Ana Exemplo', { papel: 'LIDER' });
  const bruno = umColaborador('Bruno Exemplo');
  const carla = umColaborador('Carla Exemplo');
  const davi = umColaborador('Davi Exemplo', { papel: 'LIDER' });
  const elisa = umColaborador('Elisa Exemplo', { ativo: false });

  const ipe = umaEquipe(gincana.id, 'Ipê', {
    lider: { id: ana.id, nome: ana.nome },
    totalMembros: 1,
  });
  const araucaria = umaEquipe(gincana.id, 'Araucária', {
    lider: { id: davi.id, nome: davi.nome },
    totalMembros: 0,
  });
  ana.equipe = { id: ipe.id, nome: ipe.nome };
  bruno.equipe = { id: ipe.id, nome: ipe.nome };
  davi.equipe = { id: araucaria.id, nome: araucaria.nome };

  const estado: EstadoDoCadastro = {
    gincanas: [gincana],
    equipes: [ipe, araucaria],
    colaboradores: [ana, bruno, carla, davi, elisa],
  };
  return { gincana, estado, ana, bruno, carla, davi, elisa, ipe, araucaria };
}
