import {
  colaboradorSchema,
  type AtualizarColaborador,
  type Colaborador,
  type CriarColaborador,
  type ListarColaboradoresQuery,
} from '@gincana/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDasEquipes, chaveDosColaboradores } from '../../lib/chaves-de-consulta.js';

async function buscarColaboradores(filtros: ListarColaboradoresQuery): Promise<Colaborador[]> {
  const { data } = await api.get<unknown>('/colaboradores', { params: filtros });
  return colaboradorSchema.array().parse(data);
}

async function postarColaborador(dados: CriarColaborador): Promise<Colaborador> {
  const { data } = await api.post<unknown>('/colaboradores', dados);
  return colaboradorSchema.parse(data);
}

async function patchColaborador(id: string, dados: AtualizarColaborador): Promise<Colaborador> {
  const { data } = await api.patch<unknown>(`/colaboradores/${id}`, dados);
  return colaboradorSchema.parse(data);
}

/** Sem filtro a API devolve todos os cadastrados, ativos e desativados. */
export function useColaboradores(filtros: ListarColaboradoresQuery = {}) {
  return useQuery({
    queryKey: [...chaveDosColaboradores, filtros.equipeId ?? null, filtros.papel ?? null],
    queryFn: () => buscarColaboradores(filtros),
  });
}

/** Mexer em colaborador muda o total de colaboradores da equipe, então as duas listas se atualizam. */
function useInvalidarCadastro() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chaveDosColaboradores }),
      queryClient.invalidateQueries({ queryKey: chaveDasEquipes }),
    ]);
}

export function useCriarColaborador() {
  const invalidar = useInvalidarCadastro();
  return useMutation({ mutationFn: postarColaborador, onSettled: invalidar });
}

export function useAtualizarColaborador() {
  const invalidar = useInvalidarCadastro();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: AtualizarColaborador }) =>
      patchColaborador(id, dados),
    onSettled: invalidar,
  });
}
