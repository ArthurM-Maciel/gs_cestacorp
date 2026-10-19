import type {
  AcaoAuditada,
  LinhaDoTempo,
  MudancaAuditada,
  PaginaDeAuditoria,
  RegistroDeAuditoria,
} from '@gincana/contracts';
import type { InternalAxiosRequestConfig } from 'axios';

import type { Simulacao } from './simulacao-da-api.js';
import { novoId } from './simulacao-do-cadastro.js';

/**
 * Dados e rotas de mentira para a trilha de auditoria. Nomes fictícios: nenhum dado de
 * colaborador real entra em teste.
 *
 * As `mudancas` são escritas à mão, no formato que a API devolve (já comparadas, com `de`
 * nulo na criação): quem faz a comparação é o servidor, e o front não a repete.
 */

export interface Pessoa {
  id: string;
  nome: string;
}

/** Um instante no calendário local: a tela mostra a hora do aparelho, então o teste também. */
export const instante = (dia: number, hora: number, minuto: number) =>
  new Date(2026, 10, dia, hora, minuto).toISOString();

export function umRegistroDeAuditoria(
  acao: AcaoAuditada,
  autor: Pessoa,
  sobrepor: Partial<RegistroDeAuditoria> = {},
): RegistroDeAuditoria {
  return {
    id: novoId(),
    entidade: 'Lancamento',
    entidadeId: novoId(),
    acao,
    autor,
    descricao: null,
    criadoEm: instante(2, 12, 0),
    mudancas: [],
    valoresAntes: null,
    valoresDepois: null,
    ...sobrepor,
  };
}

const mudanca = (
  campo: string,
  rotulo: string,
  de: string | null,
  para: string | null,
): MudancaAuditada => ({ campo, rotulo, de, para });

/**
 * A vida inteira de um lançamento de 12 kg de tampinhas (10 pts por kg), como no teste da
 * API: criado pela dona, recusado pelo líder, corrigido para 15 kg e aprovado.
 */
export function trilhaDeUmLancamento(
  lancamentoId: string,
  dona: Pessoa,
  lider: Pessoa,
): RegistroDeAuditoria[] {
  const base = { entidade: 'Lancamento', entidadeId: lancamentoId } as const;
  return [
    umRegistroDeAuditoria('CRIACAO', dona, {
      ...base,
      criadoEm: instante(2, 12, 0),
      descricao: 'Lançamento de "Doação de tampinhas" aguardando avaliação.',
      mudancas: [
        mudanca('status', 'Situação', null, 'Pendente'),
        mudanca('quantidade', 'Quantidade', null, '12'),
        mudanca('pontosCalculados', 'Pontos', null, '120'),
        mudanca('pontosPorUnidadeAplicado', 'Pontos por unidade', null, '10'),
        mudanca('dataAcao', 'Data da ação', null, '2026-11-02'),
      ],
    }),
    umRegistroDeAuditoria('RECUSA', lider, {
      ...base,
      criadoEm: instante(2, 15, 30),
      descricao: 'Lançamento recusado: Foto sem a etiqueta da ONG',
      mudancas: [
        mudanca('status', 'Situação', 'Pendente', 'Recusado'),
        mudanca('motivoRecusa', 'Motivo da recusa', null, 'Foto sem a etiqueta da ONG'),
      ],
    }),
    umRegistroDeAuditoria('ALTERACAO', dona, {
      ...base,
      criadoEm: instante(3, 9, 10),
      descricao: 'Lançamento corrigido depois da recusa e devolvido para avaliação.',
      mudancas: [
        mudanca('status', 'Situação', 'Recusado', 'Pendente'),
        mudanca('quantidade', 'Quantidade', '12', '15'),
        mudanca('pontosCalculados', 'Pontos', '120', '150'),
      ],
    }),
    umRegistroDeAuditoria('APROVACAO', lider, {
      ...base,
      criadoEm: instante(3, 10, 45),
      descricao: 'Lançamento aprovado, somando 150 pontos à equipe.',
      mudancas: [mudanca('status', 'Situação', 'Pendente', 'Aprovado')],
    }),
  ];
}

export function umaLinhaDoTempo(lancamentoId: string, itens: RegistroDeAuditoria[]): LinhaDoTempo {
  return { entidade: 'Lancamento', entidadeId: lancamentoId, itens };
}

interface FiltrosLidos {
  acao?: AcaoAuditada;
  autorId?: string;
  pagina?: number;
  porPagina?: number;
}

/**
 * `GET /auditoria` como a API: filtra por ação e autor, mais recente primeiro (a lista que o
 * teste passa já vem nessa ordem) e devolve a página pedida. Cada consulta recebida fica
 * em `chamadas`, para o teste conferir o que a tela mandou.
 */
export function rotaDoPainelDeAuditoria(registros: readonly RegistroDeAuditoria[]) {
  const chamadas: FiltrosLidos[] = [];

  const rota: Simulacao = (requisicao: InternalAxiosRequestConfig) => {
    const filtros = (requisicao.params ?? {}) as FiltrosLidos;
    chamadas.push(filtros);

    const doFiltro = registros.filter(
      (registro) =>
        (filtros.acao === undefined || registro.acao === filtros.acao) &&
        (filtros.autorId === undefined || registro.autor.id === filtros.autorId),
    );
    const porPagina = filtros.porPagina ?? 20;
    const pagina = filtros.pagina ?? 1;
    const dados: PaginaDeAuditoria = {
      itens: doFiltro.slice((pagina - 1) * porPagina, pagina * porPagina),
      pagina,
      porPagina,
      total: doFiltro.length,
      totalDePaginas: Math.max(1, Math.ceil(doFiltro.length / porPagina)),
    };
    return { status: 200, dados };
  };

  return { rota, chamadas };
}
