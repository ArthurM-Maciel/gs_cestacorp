import type { Gincana } from '@gincana/contracts';

import { useGincanas } from '../gincanas/gincanas-api.js';

/**
 * A gincana em que o colaborador lança ações: a ativa. Quem não é administradora não escolhe
 * gincana, e a API só aceita lançamento numa gincana ativa, então não há o que escolher.
 */
export function useGincanaAtiva() {
  const consulta = useGincanas();
  const ativa: Gincana | null =
    consulta.data?.find((gincana) => gincana.status === 'ATIVA') ?? null;
  return { consulta, ativa };
}
