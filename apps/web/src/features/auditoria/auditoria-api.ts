import {
  linhaDoTempoSchema,
  paginaDeAuditoriaSchema,
  type LinhaDoTempo,
  type ListarAuditoriaQuery,
  type PaginaDeAuditoria,
} from '@gincana/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDaAuditoria, chaveDosLancamentos } from '../../lib/chaves-de-consulta.js';

async function buscarLinhaDoTempo(lancamentoId: string): Promise<LinhaDoTempo> {
  const { data } = await api.get<unknown>(`/lancamentos/${lancamentoId}/auditoria`);
  return linhaDoTempoSchema.parse(data);
}

async function buscarAuditoria(filtros: ListarAuditoriaQuery): Promise<PaginaDeAuditoria> {
  const { data } = await api.get<unknown>('/auditoria', { params: filtros });
  return paginaDeAuditoriaSchema.parse(data);
}

/**
 * A linha do tempo de um lançamento: criado, recusado, corrigido, aprovado.
 *
 * A chave mora sob a dos lançamentos de propósito: toda decisão e toda correção invalidam
 * `chaveDosLancamentos`, e com isso a linha do tempo ganha a entrada nova sem a tela fazer
 * nada. Quem não alcança o lançamento recebe 404 da API, e a tela trata como "não encontrado".
 */
export function useLinhaDoTempo(lancamentoId: string) {
  return useQuery({
    queryKey: [...chaveDosLancamentos, 'auditoria', lancamentoId],
    queryFn: () => buscarLinhaDoTempo(lancamentoId),
  });
}

/**
 * O painel de auditoria da administradora (só ela alcança; a API devolve 403 aos outros).
 *
 * Ao virar a página ou mudar um filtro, a lista anterior fica na tela, esmaecida, até a nova
 * chegar: a tela não pisca em branco e quem lê não perde o lugar.
 */
export function useAuditoria(filtros: ListarAuditoriaQuery) {
  return useQuery({
    queryKey: [
      ...chaveDaAuditoria,
      filtros.acao ?? null,
      filtros.autorId ?? null,
      filtros.pagina,
      filtros.porPagina,
    ],
    queryFn: () => buscarAuditoria(filtros),
    placeholderData: keepPreviousData,
  });
}
