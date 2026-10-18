import type { StatusLancamento } from '@gincana/contracts';

import { Etiqueta } from '../../components/ui/Etiqueta.js';

const porStatus = {
  PENDENTE: { tom: 'atencao', texto: 'Pendente' },
  APROVADO: { tom: 'sucesso', texto: 'Aprovado' },
  RECUSADO: { tom: 'erro', texto: 'Recusado' },
} as const satisfies Record<
  StatusLancamento,
  { tom: 'atencao' | 'sucesso' | 'erro'; texto: string }
>;

/** O status em palavra e em cor: a cor sozinha não conta para quem não a distingue. */
export function EtiquetaDeStatus({ status }: { status: StatusLancamento }) {
  const { tom, texto } = porStatus[status];
  return <Etiqueta tom={tom}>{texto}</Etiqueta>;
}
