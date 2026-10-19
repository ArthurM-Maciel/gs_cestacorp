import type { TipoAcao } from '@gincana/contracts';
import { NavLink } from 'react-router-dom';

import { formatarPontosPorUnidade } from '../../lib/formatar-numero.js';
import { estilosDaFamilia, familiaDoTipo } from '../tipos-acao/familias-de-acao.js';
import { IconeDaFamilia } from '../tipos-acao/IconeDaFamilia.js';

const base =
  'flex min-h-32 flex-col items-center justify-center gap-2 rounded-cartao p-4 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600';

/**
 * A grade de tipos de ação: cada um com a cor da família e os pontos por unidade à vista,
 * que é o que o colaborador compara antes de escolher.
 *
 * Um tipo sem regra vigente (a pontuação começa no futuro) não vira link: a prévia e o
 * lançamento recusariam, e é melhor dizer isso antes do toque do que depois.
 */
export function GradeDeAcoes({ tipos }: { tipos: readonly TipoAcao[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      {tipos.map((tipo) => {
        const familia = familiaDoTipo(tipo);
        const fundo = estilosDaFamilia[familia].fundo;
        const conteudo = (
          <>
            <IconeDaFamilia familia={familia} tamanho="grande" />
            <span className="font-bold text-balance">{tipo.nome}</span>
            <span className="text-sm text-texto-suave">
              {tipo.regraVigente === null
                ? 'Pontuação ainda não cadastrada'
                : formatarPontosPorUnidade(tipo.regraVigente.pontosPorUnidade, tipo.unidade)}
            </span>
          </>
        );

        return (
          <li key={tipo.id} className="flex">
            {tipo.regraVigente === null ? (
              <div className={`${base} ${fundo} w-full opacity-60`}>{conteudo}</div>
            ) : (
              <NavLink
                to={`/registrar/${tipo.id}`}
                className={({ isActive }) =>
                  `${base} ${fundo} w-full border-2 ${isActive ? 'border-marca-600' : 'border-transparent'}`
                }
              >
                {conteudo}
              </NavLink>
            )}
          </li>
        );
      })}
    </ul>
  );
}
