import { periodosDoPlacar, type PeriodoDoPlacar } from './periodo-do-placar.js';

interface Props {
  periodo: PeriodoDoPlacar;
  aoEscolher: (periodo: PeriodoDoPlacar) => void;
}

/**
 * "Geral" e "Esta semana". É um grupo de opções que se excluem, então a semântica certa é a
 * de botões de rádio: o navegador já dá a navegação por setas e anuncia "1 de 2". Só a
 * aparência é de botão segmentado, como no protótipo.
 *
 * O círculo do rádio fica fora da vista, mas continua focável: o contorno de foco aparece
 * na opção inteira (`peer-focus-visible`).
 */
export function SeletorDePeriodo({ periodo, aoEscolher }: Props) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Período do placar</legend>
      <div className="flex w-full rounded-full bg-marca-100 p-1 lg:w-auto">
        {periodosDoPlacar.map((opcao) => (
          <label key={opcao.valor} className="flex-1 cursor-pointer lg:flex-none">
            <input
              type="radio"
              name="periodo-do-placar"
              value={opcao.valor}
              checked={periodo === opcao.valor}
              onChange={() => {
                aoEscolher(opcao.valor);
              }}
              className="peer sr-only"
            />
            <span className="flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold whitespace-nowrap text-texto peer-checked:bg-marca-600 peer-checked:text-superficie peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marca-600">
              {opcao.rotulo}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
