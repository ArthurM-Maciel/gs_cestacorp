import { useId, type ComponentProps } from 'react';

interface Props extends Omit<ComponentProps<'select'>, 'id' | 'className'> {
  rotulo: string;
  erro?: string | undefined;
  dica?: string | undefined;
}

/**
 * Seleção nativa: no celular abre o seletor do próprio aparelho, que é o mais fácil de
 * usar com o polegar. Mesmo visual do campo de texto, para os formulários ficarem iguais.
 */
export function CampoDeSelecao({ rotulo, erro, dica, children, ...selecao }: Props) {
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
      <select
        {...selecao}
        id={id}
        aria-invalid={temErro ? true : undefined}
        aria-describedby={descricao === '' ? undefined : descricao}
        className="h-12 w-full rounded-xl border-2 border-transparent bg-fundo px-3 text-base text-texto focus:outline-2 focus:outline-offset-2 focus:outline-marca-600 aria-invalid:border-recusado disabled:cursor-not-allowed disabled:text-texto-suave"
      >
        {children}
      </select>
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
