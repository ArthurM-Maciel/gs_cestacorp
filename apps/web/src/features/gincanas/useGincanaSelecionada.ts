import type { Gincana } from '@gincana/contracts';
import { useSearchParams } from 'react-router-dom';

import { useGincanas } from './gincanas-api.js';

/**
 * Qual gincana as telas de equipes e colaboradores estão mostrando.
 *
 * Fica na barra de endereço (`?gincana=`), então o link e o botão voltar preservam a
 * escolha. Sem escolha, vale a gincana ativa e, na falta dela, a mais recente. Tudo é
 * derivado: nenhum estado a sincronizar.
 */
export function useGincanaSelecionada() {
  const consulta = useGincanas();
  const [parametros, definirParametros] = useSearchParams();

  const gincanas = consulta.data ?? [];
  const pedida = parametros.get('gincana');
  const escolhida: Gincana | null =
    gincanas.find((gincana) => gincana.id === pedida) ??
    gincanas.find((gincana) => gincana.status === 'ATIVA') ??
    gincanas[0] ??
    null;

  function escolher(id: string) {
    definirParametros(
      (atuais) => {
        const novos = new URLSearchParams(atuais);
        novos.set('gincana', id);
        return novos;
      },
      { replace: true },
    );
  }

  return { consulta, gincanas, escolhida, escolher };
}
