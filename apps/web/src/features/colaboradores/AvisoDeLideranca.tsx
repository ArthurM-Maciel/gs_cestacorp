import { Link } from 'react-router-dom';

interface PropsDaOrientacao {
  /** A equipe que a pessoa lidera, quando a tela já a conhece; senão o texto fica genérico. */
  equipeNome: string | undefined;
}

/**
 * O que fazer quando a API recusa mexer em quem lidera uma equipe. A mensagem da API diz o
 * que aconteceu; este texto diz o próximo passo, para o erro nunca ser um beco sem saída.
 */
export function OrientacaoDeLideranca({ equipeNome }: PropsDaOrientacao) {
  return (
    <p className="mt-2 font-normal">
      {equipeNome === undefined
        ? 'Troque o líder da equipe dela e tente de novo.'
        : `Troque o líder da equipe ${equipeNome} e tente de novo.`}
    </p>
  );
}

/** Leva à tela onde o líder se troca, já na gincana certa. */
export function LinkParaEquipes({ gincanaId }: { gincanaId: string | null }) {
  const destino = gincanaId === null ? '/equipes' : `/equipes?gincana=${gincanaId}`;
  return (
    <Link
      to={destino}
      className="inline-flex min-h-11 items-center rounded-xl border-2 border-recusado px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-recusado"
    >
      Ir para Equipes
    </Link>
  );
}
