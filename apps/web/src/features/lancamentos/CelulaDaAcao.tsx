import type { Lancamento } from '@gincana/contracts';
import { Link } from 'react-router-dom';

import { familiaDoTipo } from '../tipos-acao/familias-de-acao.js';
import { IconeDaFamilia } from '../tipos-acao/IconeDaFamilia.js';

/**
 * O ícone da família e o nome da ação: a primeira coluna das listas de lançamentos. O nome
 * leva ao detalhe do lançamento, onde estão o resumo e o histórico de quem fez o quê. O
 * sublinhado é o que diz, a quem não passa o mouse por cima, que o nome é um link.
 */
export function CelulaDaAcao({ lancamento }: { lancamento: Lancamento }) {
  return (
    <div className="flex items-center gap-3">
      <IconeDaFamilia familia={familiaDoTipo(lancamento.tipoAcao)} />
      <Link
        to={`/lancamentos/${lancamento.id}`}
        aria-label={`${lancamento.tipoAcao.nome}, ver detalhes e histórico`}
        className="inline-flex min-h-11 min-w-0 items-center rounded-lg font-semibold text-balance underline decoration-marca-300 decoration-2 underline-offset-4 hover:decoration-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600"
      >
        {lancamento.tipoAcao.nome}
      </Link>
    </div>
  );
}
