import { useId, type ComponentProps, type ReactNode } from 'react';

interface Props extends Omit<ComponentProps<'input'>, 'id' | 'className' | 'children'> {
  rotulo: string;
  /** Ícone decorativo à esquerda do texto. */
  icone: ReactNode;
  /** Mensagem do erro deste campo. Fica ligada ao campo por `aria-describedby`. */
  erro?: string | undefined;
  /** Elemento à direita, dentro do campo (por exemplo, o botão de mostrar senha). */
  acaoFinal?: ReactNode;
}

/**
 * Campo de texto do protótipo: rótulo sempre visível (placeholder não substitui rótulo),
 * ícone à esquerda e erro logo abaixo. A fonte tem 16px para o iOS não ampliar a página
 * ao focar o campo.
 */
export function CampoDeTexto({ rotulo, icone, erro, acaoFinal, ...entrada }: Props) {
  const id = useId();
  const idDoErro = `${id}-erro`;
  const temErro = erro !== undefined && erro !== '';

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {rotulo}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-texto-suave">
          {icone}
        </span>
        <input
          {...entrada}
          id={id}
          aria-invalid={temErro ? true : undefined}
          aria-describedby={temErro ? idDoErro : undefined}
          className={`h-12 w-full rounded-xl border-2 border-transparent bg-fundo pl-12 text-base text-texto placeholder:text-texto-suave focus:outline-2 focus:outline-offset-2 focus:outline-marca-600 aria-invalid:border-recusado ${acaoFinal === undefined ? 'pr-4' : 'pr-14'}`}
        />
        {acaoFinal !== undefined && (
          <div className="absolute inset-y-0 right-0.5 flex items-center">{acaoFinal}</div>
        )}
      </div>
      {temErro && (
        <p id={idDoErro} className="mt-2 text-sm font-medium text-recusado">
          {erro}
        </p>
      )}
    </div>
  );
}
