import { useId, type ComponentProps } from 'react';

interface Props extends Omit<ComponentProps<'textarea'>, 'id' | 'className'> {
  rotulo: string;
  /** Mensagem do erro deste campo. Fica ligada ao campo por `aria-describedby`. */
  erro?: string | undefined;
  /** Orientação que vale antes de errar (limite, exemplo). Também fica ligada ao campo. */
  dica?: string | undefined;
}

/**
 * Texto de várias linhas, com o mesmo visual do campo de texto: rótulo sempre visível,
 * fonte de 16px (o iOS não amplia a página ao focar) e o erro logo abaixo.
 */
export function AreaDeTexto({ rotulo, erro, dica, rows = 3, ...area }: Props) {
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
      <textarea
        {...area}
        id={id}
        rows={rows}
        aria-invalid={temErro ? true : undefined}
        aria-describedby={descricao === '' ? undefined : descricao}
        className="w-full resize-y rounded-xl border-2 border-transparent bg-fundo px-4 py-3 text-base text-texto placeholder:text-texto-suave focus:outline-2 focus:outline-offset-2 focus:outline-marca-600 aria-invalid:border-recusado disabled:cursor-not-allowed disabled:text-texto-suave"
      />
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
