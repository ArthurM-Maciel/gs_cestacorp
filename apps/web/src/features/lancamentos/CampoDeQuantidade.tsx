import { rotulosDeUnidade, type Unidade } from '@gincana/contracts';
import { useId } from 'react';

const botao =
  'grid size-12 shrink-0 place-items-center rounded-full text-2xl font-semibold leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Lê o texto digitado como número, aceitando vírgula ou ponto ("1,5" e "1.5"). Devolve
 * `NaN` para o que não é número, para o contrato dizer o que está errado.
 */
export function lerQuantidade(texto: string): number {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d{0,3})?$/.test(limpo) ? Number(limpo) : Number.NaN;
}

function formatarParaOCampo(valor: number): string {
  return String(Math.round(valor * 1000) / 1000).replace('.', ',');
}

interface Props {
  unidade: Unidade;
  /** O que está digitado. Fica como texto para a pessoa poder apagar tudo e começar de novo. */
  valor: string;
  aoMudar: (valor: string) => void;
  erro?: string | undefined;
}

/**
 * Quantidade com "−" e "+" (alvo de toque de 48px, como o polegar pede), ou digitada.
 * Tem dois jeitos de mexer, e o teclado numérico do celular abre ao tocar no número.
 * O "−" para em 1: quantidade zero não é lançamento.
 */
export function CampoDeQuantidade({ unidade, valor, aoMudar, erro }: Props) {
  const id = useId();
  const idDoErro = `${id}-erro`;
  const unidadeNoPlural = rotulosDeUnidade[unidade].plural;
  const atual = lerQuantidade(valor);
  const temErro = erro !== undefined && erro !== '';

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        Quantidade ({unidadeNoPlural})
      </label>
      <div
        className={`flex items-center gap-2 rounded-2xl border-2 bg-fundo p-2 ${temErro ? 'border-recusado' : 'border-transparent'} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-marca-600`}
      >
        <button
          type="button"
          aria-label="Diminuir a quantidade"
          disabled={Number.isNaN(atual) || atual <= 1}
          onClick={() => {
            aoMudar(formatarParaOCampo(Math.max(1, atual - 1)));
          }}
          className={`${botao} bg-superficie text-texto hover:bg-marca-50`}
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={id}
          name="quantidade"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(evento) => {
            aoMudar(evento.target.value);
          }}
          aria-invalid={temErro ? true : undefined}
          aria-describedby={temErro ? idDoErro : undefined}
          className="h-12 min-w-0 flex-1 bg-transparent text-center text-xl font-semibold text-texto focus:outline-none"
        />
        <button
          type="button"
          aria-label="Aumentar a quantidade"
          onClick={() => {
            aoMudar(formatarParaOCampo(Number.isNaN(atual) ? 1 : atual + 1));
          }}
          className={`${botao} bg-marca-600 text-superficie hover:bg-marca-800`}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {temErro && (
        <p id={idDoErro} className="mt-2 text-sm font-medium text-recusado">
          {erro}
        </p>
      )}
    </div>
  );
}
