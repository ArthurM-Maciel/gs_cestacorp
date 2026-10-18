import type { Lancamento } from '@gincana/contracts';

import { enderecoSeguroDoComprovante } from '../evidencias/evidencias-api.js';

const linkDoComprovante =
  'inline-flex min-h-11 items-center rounded-lg font-semibold text-marca-600 underline decoration-2 underline-offset-4 hover:text-marca-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600';

/**
 * "Ver comprovante": abre o arquivo numa nova aba, para o líder conferir antes de decidir.
 * Sem comprovante, a célula diz isso com todas as letras e, se a ação o exige, avisa que a
 * API vai recusar a aprovação.
 */
export function ComprovantesDoLancamento({ lancamento }: { lancamento: Lancamento }) {
  if (lancamento.evidencias.length === 0) {
    return (
      <span
        className={`text-sm font-semibold ${lancamento.tipoAcao.exigeEvidencia ? 'text-pendente' : 'text-texto-suave'}`}
      >
        {lancamento.tipoAcao.exigeEvidencia
          ? 'Sem comprovante (a ação exige um)'
          : 'Sem comprovante'}
      </span>
    );
  }

  const varios = lancamento.evidencias.length > 1;

  return (
    <ul className="flex flex-col">
      {lancamento.evidencias.map((evidencia, indice) => {
        const endereco = enderecoSeguroDoComprovante(evidencia.url);
        const rotulo = varios ? `Ver comprovante ${String(indice + 1)}` : 'Ver comprovante';

        return (
          <li key={evidencia.id}>
            {endereco === null ? (
              <span className="text-sm text-texto-suave">
                {evidencia.nomeArquivo}: endereço do arquivo indisponível
              </span>
            ) : (
              <a
                href={endereco}
                target="_blank"
                rel="noopener noreferrer"
                className={linkDoComprovante}
              >
                {rotulo}
                <span className="sr-only">
                  {' '}
                  de {lancamento.tipoAcao.nome}, {lancamento.colaborador.nome} (abre em uma nova
                  aba)
                </span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
