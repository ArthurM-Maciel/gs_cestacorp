import { tipoAcaoSchema, type TipoAcao } from '@gincana/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api.js';
import { chaveDosTiposDeAcao } from '../../lib/chaves-de-consulta.js';

async function buscarTiposDeAcao(gincanaId: string): Promise<TipoAcao[]> {
  const { data } = await api.get<unknown>(`/gincanas/${gincanaId}/tipos-acao`);
  return tipoAcaoSchema.array().parse(data);
}

/**
 * O catálogo do formulário. Para quem não é administradora a API devolve só os tipos ativos:
 * um tipo pausado some da lista sem que a tela precise filtrar nada.
 */
export function useTiposDeAcao(gincanaId: string | null) {
  return useQuery({
    queryKey: [...chaveDosTiposDeAcao, gincanaId],
    queryFn: () => buscarTiposDeAcao(gincanaId ?? ''),
    enabled: gincanaId !== null,
  });
}
