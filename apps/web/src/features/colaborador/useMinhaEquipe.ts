import type { Equipe } from '@gincana/contracts';

import { useSessao } from '../../lib/sessao.js';
import { useEquipes } from '../equipes/equipes-api.js';
import { useGincanaAtiva } from './useGincanaAtiva.js';

/**
 * A equipe da pessoa na gincana ativa, com o nome do líder.
 *
 * É só informação para a tela ("Vai para aprovação de Arthur"): se a consulta falhar, a
 * tela cai num texto genérico em vez de travar o formulário.
 */
export function useMinhaEquipe(): Equipe | null {
  const { usuario } = useSessao();
  const { ativa } = useGincanaAtiva();
  const equipes = useEquipes(ativa?.id ?? null);

  if (usuario?.equipeId == null) {
    return null;
  }
  return equipes.data?.find((equipe) => equipe.id === usuario.equipeId) ?? null;
}
