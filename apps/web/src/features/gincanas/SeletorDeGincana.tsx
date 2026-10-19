import type { Gincana } from '@gincana/contracts';

import { CampoDeSelecao } from '../../components/ui/CampoDeSelecao.js';

interface Props {
  gincanas: readonly Gincana[];
  escolhida: Gincana;
  aoEscolher: (id: string) => void;
}

/**
 * Só aparece quando há mais de uma gincana: com uma só, não há o que escolher e o seletor
 * seria ruído na tela.
 */
export function SeletorDeGincana({ gincanas, escolhida, aoEscolher }: Props) {
  if (gincanas.length < 2) {
    return null;
  }

  return (
    <div className="max-w-sm">
      <CampoDeSelecao
        rotulo="Gincana"
        value={escolhida.id}
        onChange={(evento) => {
          aoEscolher(evento.target.value);
        }}
      >
        {gincanas.map((gincana) => (
          <option key={gincana.id} value={gincana.id}>
            {gincana.nome.includes(String(gincana.ano))
              ? gincana.nome
              : `${gincana.nome} (${gincana.ano})`}
          </option>
        ))}
      </CampoDeSelecao>
    </div>
  );
}
