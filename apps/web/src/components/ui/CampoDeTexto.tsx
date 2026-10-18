import { useId, type ComponentProps, type ReactNode } from 'react';

interface Props extends Omit<ComponentProps<'input'>, 'id' | 'className' | 'children'> {
  rotulo: string;
  /** Ícone decorativo à esquerda do texto. Sem ele o texto começa na borda do campo. */
  icone?: ReactNode;
  /** Mensagem do erro deste campo. Fica ligada ao campo por `aria-describedby`. */
  erro?: string | undefined;
  /** Orientação que vale antes de errar (formato, limite). Também fica ligada ao campo. */
  dica?: string | undefined;
  /** Elemento à direita, dentro do campo (por exemplo, o botão de mostrar senha). */
  acaoFinal?: ReactNode;
}

/**
 * Campo de texto do protótipo: rótulo sempre visível (placeholder não substitui rótulo),
 * ícone opcional à esquerda e erro logo abaixo. A fonte tem 16px para o iOS não ampliar a
 * página ao focar o campo.
 */
export function CampoDeTexto({ rotulo, icone, erro, dica, acaoFinal, ...entrada }: Props) {
  const id = useId();
  const idDoErro = `${id}-erro`;
  const idDaDica = `${id}-dica`;
  const temErro = erro !== undefined && erro !== '';
  const temDica = dica !== undefined && dica !== '';
  const descricao = [temErro ? idDoErro : null, temDica ? idDaDica : null]
    .filter((item) => item !== null)
    .join(' ');

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {rotulo}
      </label>
      <div className="relative">
        {icone !== undefined && (
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-texto-suave">
            {icone}
          </span>
        )}
        <input
          {...entrada}
          id={id}
          aria-invalid={temErro ? true : undefined}
          aria-describedby={descricao === '' ? undefined : descricao}
          className={`h-12 w-full rounded-xl border-2 border-transparent bg-fundo text-base text-texto placeholder:text-texto-suave focus:outline-2 focus:outline-offset-2 focus:outline-marca-600 aria-invalid:border-recusado disabled:cursor-not-allowed disabled:text-texto-suave ${icone === undefined ? 'pl-4' : 'pl-12'} ${acaoFinal === undefined ? 'pr-4' : 'pr-14'}`}
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
      {temDica && (
        <p id={idDaDica} className="mt-2 text-sm text-texto-suave">
          {dica}
        </p>
      )}
    </div>
  );
}
