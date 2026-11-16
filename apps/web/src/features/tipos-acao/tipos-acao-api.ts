import {
  tipoAcaoComHistoricoSchema,
  tipoAcaoSchema,
  type AtualizarTipoAcao,
  type CriarTipoAcao,
  type NovaRegra,
  type TipoAcao,
  type TipoAcaoComHistorico,
} from '@gincana/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDosTiposDeAcao } from '../../lib/chaves-de-consulta.js';

async function buscarTiposDeAcao(gincanaId: string): Promise<TipoAcao[]> {
  const { data } = await api.get<unknown>(`/gincanas/${gincanaId}/tipos-acao`);
  return tipoAcaoSchema.array().parse(data);
}

/**
 * O catálogo do formulário. Para quem não é administradora a API devolve só os tipos ativos:
 * um tipo pausado some da lista sem que a tela precise filtrar nada. Para a administradora,
 * vêm também os pausados — é o que a tela de Regras (US04) precisa para reativar.
 */
export function useTiposDeAcao(gincanaId: string | null) {
  return useQuery({
    queryKey: [...chaveDosTiposDeAcao, gincanaId],
    queryFn: () => buscarTiposDeAcao(gincanaId ?? ''),
    enabled: gincanaId !== null,
  });
}

async function postarTipoAcao(
  gincanaId: string,
  dados: CriarTipoAcao,
): Promise<TipoAcaoComHistorico> {
  const { data } = await api.post<unknown>(`/gincanas/${gincanaId}/tipos-acao`, dados);
  return tipoAcaoComHistoricoSchema.parse(data);
}

async function patchTipoAcao(id: string, dados: AtualizarTipoAcao): Promise<TipoAcaoComHistorico> {
  const { data } = await api.patch<unknown>(`/tipos-acao/${id}`, dados);
  return tipoAcaoComHistoricoSchema.parse(data);
}

async function postarNovaRegra(id: string, dados: NovaRegra): Promise<TipoAcaoComHistorico> {
  const { data } = await api.post<unknown>(`/tipos-acao/${id}/regras`, dados);
  return tipoAcaoComHistoricoSchema.parse(data);
}

function useInvalidarTiposDeAcao() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: chaveDosTiposDeAcao });
}

/** US04 — cadastra o tipo de ação com a primeira regra de pontuação. */
export function useCriarTipoAcao(gincanaId: string) {
  const invalidar = useInvalidarTiposDeAcao();
  return useMutation({
    mutationFn: (dados: CriarTipoAcao) => postarTipoAcao(gincanaId, dados),
    onSettled: invalidar,
  });
}

/** Muda a identidade do tipo de ação (nome, descrição, comprovante, situação). Nunca o preço. */
export function useAtualizarTipoAcao(id: string) {
  const invalidar = useInvalidarTiposDeAcao();
  return useMutation({
    mutationFn: (dados: AtualizarTipoAcao) => patchTipoAcao(id, dados),
    onSettled: invalidar,
  });
}

/** Troca a pontuação: abre uma vigência nova sem recalcular o que já foi apurado. */
export function useNovaRegra(id: string) {
  const invalidar = useInvalidarTiposDeAcao();
  return useMutation({
    mutationFn: (dados: NovaRegra) => postarNovaRegra(id, dados),
    onSettled: invalidar,
  });
}
