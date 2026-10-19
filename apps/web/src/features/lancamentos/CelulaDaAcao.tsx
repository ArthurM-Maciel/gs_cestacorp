import type { Lancamento } from '@gincana/contracts';

import { familiaDoTipo } from '../tipos-acao/familias-de-acao.js';
import { IconeDaFamilia } from '../tipos-acao/IconeDaFamilia.js';

/** O ícone da família e o nome da ação: a primeira coluna das listas de lançamentos. */
export function CelulaDaAcao({ lancamento }: { lancamento: Lancamento }) {
  return (
    <div className="flex items-center gap-3">
      <IconeDaFamilia familia={familiaDoTipo(lancamento.tipoAcao)} />
      <span className="min-w-0 font-semibold text-balance">{lancamento.tipoAcao.nome}</span>
    </div>
  );
}
