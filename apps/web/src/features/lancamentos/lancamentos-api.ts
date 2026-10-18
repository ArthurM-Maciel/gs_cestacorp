import {
  lancamentoSchema,
  paginaDeLancamentosSchema,
  resultadoDaPreviaSchema,
  type Lancamento,
  type PaginaDeLancamentos,
  type PreviaDeLancamento,
  type ResultadoDaPrevia,
  type StatusLancamento,
} from '@gincana/contracts';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef } from 'react';

import { api } from '../../lib/api.js';
import { chaveDasPrevias, chaveDosLancamentos } from '../../lib/chaves-de-consulta.js';
import {
  corrigirLancamento,
  registrarLancamento,
  type ArquivosEnviados,
  type EtapaDoEnvio,
  type PedidoDeCorrecao,
  type PedidoDeRegistro,
} from './enviar-lancamento.js';

/** Quantos lançamentos cada "Ver mais" traz. A gincana é pequena: duas telas bastam. */
export const TAMANHO_DA_PAGINA = 10;

interface ParametrosDaLista {
  colaboradorId?: string;
  status?: StatusLancamento;
  pagina?: number;
  porPagina?: number;
}

/**
 * Lê uma página de lançamentos. O escopo (quem vê o quê) é da API: os filtros daqui só
 * estreitam o que ela já deixaria ver.
 */
export async function buscarPaginaDeLancamentos(
  caminho: '/lancamentos' | '/lancamentos/pendentes',
  parametros: ParametrosDaLista,
): Promise<PaginaDeLancamentos> {
  const { data } = await api.get<unknown>(caminho, { params: parametros });
  return paginaDeLancamentosSchema.parse(data);
}

function proximaPagina(ultima: PaginaDeLancamentos): number | undefined {
  return ultima.pagina < ultima.totalDePaginas ? ultima.pagina + 1 : undefined;
}

/**
 * "Meus lançamentos". O filtro por colaborador existe porque o líder enxerga também os da
 * equipe dele: nesta lista só entram os da própria pessoa.
 */
export function useMeusLancamentos(colaboradorId: string) {
  return useInfiniteQuery({
    queryKey: [...chaveDosLancamentos, 'meus', colaboradorId],
    queryFn: ({ pageParam }) =>
      buscarPaginaDeLancamentos('/lancamentos', {
        colaboradorId,
        pagina: pageParam,
        porPagina: TAMANHO_DA_PAGINA,
      }),
    initialPageParam: 1,
    getNextPageParam: proximaPagina,
  });
}

/** Só o total de um status (o número do cartão "Aguardando aprovação"): pede uma página de um item. */
export function useTotalDeMeusLancamentos(colaboradorId: string, status: StatusLancamento) {
  return useQuery({
    queryKey: [...chaveDosLancamentos, 'total', colaboradorId, status],
    queryFn: async () => {
      const pagina = await buscarPaginaDeLancamentos('/lancamentos', {
        colaboradorId,
        status,
        pagina: 1,
        porPagina: 1,
      });
      return pagina.total;
    },
  });
}

async function buscarLancamento(id: string): Promise<Lancamento> {
  const { data } = await api.get<unknown>(`/lancamentos/${id}`);
  return lancamentoSchema.parse(data);
}

export function useLancamento(id: string) {
  return useQuery({
    queryKey: [...chaveDosLancamentos, 'detalhe', id],
    queryFn: () => buscarLancamento(id),
  });
}

async function postarPrevia(dados: PreviaDeLancamento): Promise<ResultadoDaPrevia> {
  const { data } = await api.post<unknown>('/lancamentos/preview', dados);
  return resultadoDaPreviaSchema.parse(data);
}

/**
 * O "+120 pts" do formulário, calculado pela API com a mesma função que grava o
 * lançamento (`@gincana/scoring`): a tela nunca promete um número que o placar não vai ter.
 *
 * Sem entrada válida a consulta espera. Enquanto uma nova prévia chega, a anterior fica na
 * tela (`isPlaceholderData`) em vez de piscar em branco e empurrar o formulário.
 */
export function usePrevia(entrada: PreviaDeLancamento | null) {
  return useQuery({
    queryKey: [...chaveDasPrevias, entrada],
    queryFn: () => {
      if (entrada === null) {
        throw new Error('A prévia só roda com quantidade e data válidas.');
      }
      return postarPrevia(entrada);
    },
    enabled: entrada !== null,
    placeholderData: keepPreviousData,
    // Um erro de regra (gincana encerrada, ação pausada) não melhora tentando de novo.
    retry: false,
  });
}

/**
 * Registrar muda a lista da pessoa, os totais do início e a fila de quem aprova. Invalidar
 * a chave curta atinge todas essas consultas; a promessa devolvida faz a gravação só
 * terminar depois das listas novas chegarem.
 */
function useInvalidarLancamentos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: chaveDosLancamentos });
}

export function useRegistrarLancamento(aoMudarEtapa: (etapa: EtapaDoEnvio) => void) {
  const invalidar = useInvalidarLancamentos();
  const enviados = useRef<ArquivosEnviados>(new WeakMap());

  return useMutation({
    mutationFn: (pedido: PedidoDeRegistro) =>
      registrarLancamento({ ...pedido, enviados: enviados.current, aoMudarEtapa }),
    onSettled: invalidar,
  });
}

export function useCorrigirLancamento(
  lancamentoId: string,
  aoMudarEtapa: (etapa: EtapaDoEnvio) => void,
) {
  const invalidar = useInvalidarLancamentos();
  const enviados = useRef<ArquivosEnviados>(new WeakMap());

  return useMutation({
    mutationFn: (pedido: PedidoDeCorrecao) =>
      corrigirLancamento({ ...pedido, lancamentoId, enviados: enviados.current, aoMudarEtapa }),
    onSettled: invalidar,
  });
}
