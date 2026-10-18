import {
  lancamentoSchema,
  type Lancamento,
  type PaginaDeLancamentos,
  type UsuarioAutenticado,
} from '@gincana/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDosLancamentos } from '../../lib/chaves-de-consulta.js';
import { TAMANHO_DA_PAGINA, buscarPaginaDeLancamentos } from '../lancamentos/lancamentos-api.js';

/**
 * A fila de pendentes cabe numa página: são 13 colaboradores. Pedir o máximo que a API
 * aceita faz o contador "Você tem 3 aprovações" ser exato sem paginar a fila.
 */
const TAMANHO_DA_FILA = 100;

/**
 * Os pendentes que a pessoa pode avaliar. A API também devolve os lançamentos da própria
 * pessoa (um líder que registra ação), mas ninguém avalia o próprio lançamento: ele fica
 * em "Meus lançamentos" e não conta como aprovação.
 */
export function paraAvaliar(
  pagina: PaginaDeLancamentos,
  usuario: UsuarioAutenticado,
): Lancamento[] {
  return pagina.itens.filter((lancamento) => lancamento.colaboradorId !== usuario.id);
}

/**
 * A fila de pendentes. Usada pela tela de aprovações e pelo selo do menu, que compartilham
 * a mesma consulta: um pedido só alimenta os dois. Volta a consultar ao reabrir a aba,
 * porque o líder deixa o app aberto e quem lança não avisa.
 */
export function usePendentes(habilitado = true) {
  return useQuery({
    queryKey: [...chaveDosLancamentos, 'pendentes'],
    queryFn: () =>
      buscarPaginaDeLancamentos('/lancamentos/pendentes', {
        pagina: 1,
        porPagina: TAMANHO_DA_FILA,
      }),
    enabled: habilitado,
    refetchOnWindowFocus: true,
  });
}

/** Os já decididos (aprovados ou recusados), do mais novo para o mais antigo. */
export function useDecididos(status: 'APROVADO' | 'RECUSADO', habilitado: boolean) {
  return useInfiniteQuery({
    queryKey: [...chaveDosLancamentos, 'decididos', status],
    queryFn: ({ pageParam }) =>
      buscarPaginaDeLancamentos('/lancamentos', {
        status,
        pagina: pageParam,
        porPagina: TAMANHO_DA_PAGINA,
      }),
    initialPageParam: 1,
    getNextPageParam: (ultima) =>
      ultima.pagina < ultima.totalDePaginas ? ultima.pagina + 1 : undefined,
    enabled: habilitado,
  });
}

/**
 * Depois de decidir, a fila, o contador, as outras abas e o início do colaborador mudam:
 * invalidar a chave curta atualiza tudo sozinho, sem a tela cuidar de cada lista.
 */
function useInvalidarLancamentos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: chaveDosLancamentos });
}

export function useAprovarLancamento() {
  const invalidar = useInvalidarLancamentos();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<unknown>(`/lancamentos/${id}/aprovar`, {});
      return lancamentoSchema.parse(data);
    },
    onSettled: invalidar,
  });
}

export function useRecusarLancamento() {
  const invalidar = useInvalidarLancamentos();
  return useMutation({
    mutationFn: async ({ id, motivoRecusa }: { id: string; motivoRecusa: string }) => {
      const { data } = await api.post<unknown>(`/lancamentos/${id}/recusar`, { motivoRecusa });
      return lancamentoSchema.parse(data);
    },
    onSettled: invalidar,
  });
}
