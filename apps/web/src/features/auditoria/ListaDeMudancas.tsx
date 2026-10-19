import type { AcaoAuditada, MudancaAuditada, Unidade } from '@gincana/contracts';

import { prepararMudancas, type MudancaParaExibir } from './descrever-mudanca.js';

function Mudanca({ mudanca }: { mudanca: MudancaParaExibir }) {
  const { rotulo, forma, antes, depois } = mudanca;

  // A criação diz com o que a coisa nasceu: "Registrado com 24 kg", nunca "— → 24".
  if (forma === 'registro' && mudanca.campo === 'quantidade') {
    return (
      <>
        Registrado com <strong className="font-semibold">{depois}</strong>
      </>
    );
  }

  const nome = <span className="text-texto-suave">{rotulo}:</span>;

  if (forma === 'troca') {
    return (
      <>
        {nome} <span className="whitespace-nowrap">{antes}</span> →{' '}
        <strong className="font-semibold">{depois}</strong>
      </>
    );
  }
  if (forma === 'removido') {
    return (
      <>
        {nome} <strong className="font-semibold">removido</strong> (era {antes})
      </>
    );
  }
  return (
    <>
      {nome} <strong className="font-semibold">{depois}</strong>
    </>
  );
}

interface Props {
  mudancas: readonly MudancaAuditada[];
  acao: AcaoAuditada;
  /** A unidade do lançamento, quando a tela a conhece. */
  unidade?: Unidade;
}

/**
 * "O que mudou" de um registro: uma linha por campo, no formato "Quantidade: 12 kg → 15 kg".
 *
 * A comparação vem pronta da API (`mudancas`); este componente só a escreve. Sem nada a
 * mostrar (um registro sem diferença comparável), não desenha nada: a descrição do registro
 * continua dizendo o que aconteceu.
 */
export function ListaDeMudancas({ mudancas, acao, unidade }: Props) {
  const linhas = prepararMudancas(mudancas, {
    acao,
    ...(unidade === undefined ? {} : { unidade }),
  });

  if (linhas.length === 0) {
    return null;
  }

  return (
    <ul aria-label="O que mudou" className="mt-2 flex flex-col gap-1 text-sm">
      {linhas.map((linha) => (
        <li key={linha.campo}>
          <Mudanca mudanca={linha} />
        </li>
      ))}
    </ul>
  );
}
