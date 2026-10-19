import { rotulosDeAcaoAuditada, type RegistroDeAuditoria, type Unidade } from '@gincana/contracts';

import { formatarDataEHora } from '../../lib/formatar-instante.js';
import { marcadorDaAcao } from './apresentacao-da-auditoria.js';
import { ListaDeMudancas } from './ListaDeMudancas.js';

interface Props {
  /** Do mais antigo para o mais recente, como a API entrega. */
  itens: readonly RegistroDeAuditoria[];
  /** A unidade do lançamento: é ela que transforma "12" em "12 kg". */
  unidade: Unidade;
  rotulo: string;
}

/**
 * A linha do tempo de um lançamento. É uma lista ordenada de verdade (`<ol>`): o leitor de
 * tela anuncia "lista com 4 itens" e a ordem do DOM é a ordem em que as coisas aconteceram.
 * O traço vertical e os marcadores são só desenho; cada entrada já diz a ação em palavras.
 */
export function LinhaDoTempo({ itens, unidade, rotulo }: Props) {
  return (
    <ol
      aria-label={rotulo}
      className="relative before:absolute before:top-3 before:bottom-3 before:left-[0.6875rem] before:w-0.5 before:bg-marca-100"
    >
      {itens.map((item) => (
        <li key={item.id} className="relative pb-6 pl-10 last:pb-0">
          <span
            aria-hidden="true"
            className={`absolute top-0.5 left-0 size-6 rounded-full ring-4 ring-superficie ${marcadorDaAcao[item.acao]}`}
          />
          <p className="text-lg leading-tight font-bold">{rotulosDeAcaoAuditada[item.acao]}</p>
          {/* Quem e quando em duas linhas: numa só, a data quebraria no meio do "às". */}
          <p className="mt-0.5 text-sm text-texto-suave">
            por {item.autor.nome}
            <br />
            <time dateTime={item.criadoEm}>{formatarDataEHora(item.criadoEm)}</time>
          </p>
          {item.descricao !== null && <p className="mt-2">{item.descricao}</p>}
          <ListaDeMudancas mudancas={item.mudancas} acao={item.acao} unidade={unidade} />
        </li>
      ))}
    </ol>
  );
}
