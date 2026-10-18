import { formatarPontos } from '../../lib/formatar-numero.js';

export type EstadoDaPrevia =
  /** Ainda não há quantidade válida para calcular. */
  | { situacao: 'aguardando' }
  /** A pessoa mexeu e a resposta nova ainda não chegou. Mostra a anterior, apagada. */
  | { situacao: 'calculando'; pontos: number | null }
  | { situacao: 'pronta'; pontos: number; detalhe: string }
  /** A API recusou o cálculo (gincana parada, ação pausada, data fora do período). */
  | { situacao: 'indisponivel'; mensagem: string };

interface Props {
  estado: EstadoDaPrevia;
  /** Para quem vai a aprovação. */
  destino: string;
}

/**
 * O "+120 pts" em destaque. A região é anunciada pelo leitor de tela quando o resultado muda;
 * enquanto calcula ela fica marcada como ocupada, para ninguém ouvir número velho nem um
 * resultado diferente a cada tecla.
 */
export function PreviaDePontos({ estado, destino }: Props) {
  if (estado.situacao === 'indisponivel') {
    return (
      <div
        role="alert"
        className="rounded-cartao border-2 border-recusado bg-recusado-fundo p-4 text-recusado"
      >
        <p className="font-semibold">Não foi possível calcular os pontos</p>
        <p className="mt-1 text-sm">{estado.mensagem}</p>
      </div>
    );
  }

  const calculando = estado.situacao === 'calculando';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={calculando}
      className="rounded-cartao bg-marca-100 p-4"
    >
      {estado.situacao === 'aguardando' && (
        <p className="text-aprovado">Informe a quantidade para ver quantos pontos a ação vale.</p>
      )}

      {calculando && (
        <>
          <p
            aria-hidden="true"
            className="text-4xl font-bold tracking-tight text-marca-600 opacity-40"
          >
            {estado.pontos === null ? '…' : `+${formatarPontos(estado.pontos)}`}
          </p>
          <p className="mt-1 text-sm text-aprovado">Calculando os pontos…</p>
        </>
      )}

      {estado.situacao === 'pronta' && (
        <>
          <p className="text-4xl font-bold tracking-tight text-marca-600">
            <span className="sr-only">Esta ação vale </span>+{formatarPontos(estado.pontos)}
          </p>
          <p className="mt-1 text-sm text-aprovado">{estado.detalhe}</p>
          <p className="mt-1 text-sm text-aprovado">{destino}</p>
        </>
      )}
    </div>
  );
}
