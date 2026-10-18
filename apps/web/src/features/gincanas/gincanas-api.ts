import {
  gincanaSchema,
  type AtualizarGincana,
  type CriarGincana,
  type Gincana,
} from '@gincana/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDasGincanas } from '../../lib/chaves-de-consulta.js';

/**
 * As respostas passam pelo schema do contrato: se a API mudar de forma, a falha aparece
 * aqui e não como um `undefined` perdido numa tela.
 */
async function buscarGincanas(): Promise<Gincana[]> {
  const { data } = await api.get<unknown>('/gincanas');
  return gincanaSchema.array().parse(data);
}

async function postarGincana(dados: CriarGincana): Promise<Gincana> {
  const { data } = await api.post<unknown>('/gincanas', dados);
  return gincanaSchema.parse(data);
}

async function patchGincana(id: string, dados: AtualizarGincana): Promise<Gincana> {
  const { data } = await api.patch<unknown>(`/gincanas/${id}`, dados);
  return gincanaSchema.parse(data);
}

/** A API devolve a mais recente primeiro: é a que a administradora abre quase sempre. */
export function useGincanas() {
  return useQuery({ queryKey: chaveDasGincanas, queryFn: buscarGincanas });
}

export function useCriarGincana() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postarGincana,
    // Devolver a promessa faz a gravação só terminar depois da lista nova chegar: a tela
    // nunca fecha o formulário mostrando a lista velha.
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaveDasGincanas }),
  });
}

export function useAtualizarGincana() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: AtualizarGincana }) => patchGincana(id, dados),
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaveDasGincanas }),
  });
}
