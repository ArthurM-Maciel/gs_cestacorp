import {
  equipeSchema,
  type AtualizarEquipe,
  type CriarEquipe,
  type Equipe,
} from '@gincana/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDasEquipes, chaveDosColaboradores } from '../../lib/chaves-de-consulta.js';

async function buscarEquipes(gincanaId: string): Promise<Equipe[]> {
  const { data } = await api.get<unknown>(`/gincanas/${gincanaId}/equipes`);
  return equipeSchema.array().parse(data);
}

async function postarEquipe(gincanaId: string, dados: CriarEquipe): Promise<Equipe> {
  const { data } = await api.post<unknown>(`/gincanas/${gincanaId}/equipes`, dados);
  return equipeSchema.parse(data);
}

async function patchEquipe(id: string, dados: AtualizarEquipe): Promise<Equipe> {
  const { data } = await api.patch<unknown>(`/equipes/${id}`, dados);
  return equipeSchema.parse(data);
}

async function postarMembros(id: string, colaboradorIds: string[]): Promise<Equipe> {
  const { data } = await api.post<unknown>(`/equipes/${id}/membros`, { colaboradorIds });
  return equipeSchema.parse(data);
}

async function deletarMembro(id: string, colaboradorId: string): Promise<void> {
  await api.delete(`/equipes/${id}/membros/${colaboradorId}`);
}

/** Sem gincana escolhida ainda, a consulta espera em vez de chamar um endereço sem id. */
export function useEquipes(gincanaId: string | null) {
  return useQuery({
    queryKey: [...chaveDasEquipes, gincanaId],
    queryFn: () => buscarEquipes(gincanaId ?? ''),
    enabled: gincanaId !== null,
  });
}

/**
 * Mexer em equipe mexe também em quem está nela: o líder vira membro, o papel muda, o
 * total da equipe muda. Por isso as duas listas são invalidadas juntas.
 */
function useInvalidarCadastro() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chaveDasEquipes }),
      queryClient.invalidateQueries({ queryKey: chaveDosColaboradores }),
    ]);
}

export function useCriarEquipe(gincanaId: string) {
  const invalidar = useInvalidarCadastro();
  return useMutation({
    mutationFn: (dados: CriarEquipe) => postarEquipe(gincanaId, dados),
    onSettled: invalidar,
  });
}

export function useAtualizarEquipe(id: string) {
  const invalidar = useInvalidarCadastro();
  return useMutation({
    mutationFn: (dados: AtualizarEquipe) => patchEquipe(id, dados),
    onSettled: invalidar,
  });
}

export function useVincularColaboradores(equipeId: string) {
  const invalidar = useInvalidarCadastro();
  return useMutation({
    mutationFn: (colaboradorIds: string[]) => postarMembros(equipeId, colaboradorIds),
    onSettled: invalidar,
  });
}

export function useRemoverDaEquipe(equipeId: string) {
  const invalidar = useInvalidarCadastro();
  return useMutation({
    mutationFn: (colaboradorId: string) => deletarMembro(equipeId, colaboradorId),
    onSettled: invalidar,
  });
}
