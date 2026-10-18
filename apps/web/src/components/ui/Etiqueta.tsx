import type { ReactNode } from 'react';

type Tom = 'sucesso' | 'atencao' | 'neutro' | 'erro';

/** As mesmas cores das etiquetas de estado do protótipo (pendente, aprovado, recusado). */
const classesPorTom: Record<Tom, string> = {
  sucesso: 'bg-aprovado-fundo text-aprovado',
  atencao: 'bg-pendente-fundo text-pendente',
  neutro: 'bg-fundo text-texto-suave',
  erro: 'bg-recusado-fundo text-recusado',
};

export function Etiqueta({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${classesPorTom[tom]}`}
    >
      {children}
    </span>
  );
}
