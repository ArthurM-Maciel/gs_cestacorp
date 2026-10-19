import type { CSSProperties, ReactNode } from 'react';

export interface ColunaDaLista<T> {
  chave: string;
  titulo: string;
  renderizar: (item: T) => ReactNode;
  /** Esconde o rótulo do cartão no celular (o nome do item não precisa dele). */
  semRotuloNoCelular?: boolean;
  /**
   * Coluna dos botões de ação: no celular fica numa faixa própria, no pé do cartão, e no
   * computador alinha à direita. Os botões decidem a própria largura (`w-full lg:w-auto`).
   */
  acoes?: boolean;
  /** Classes extras da célula, por exemplo para alinhar à direita no computador. */
  classe?: string;
}

interface Props<T> {
  /** Nome da lista para leitor de tela. */
  rotulo: string;
  colunas: readonly ColunaDaLista<T>[];
  itens: readonly T[];
  chaveDoItem: (item: T) => string;
  /** Larguras das colunas no computador, no formato do `grid-template-columns`. */
  modeloDeColunas: string;
}

/**
 * Lista que é cartão no celular e tabela a partir de `lg`. Um único conjunto de elementos
 * muda de aparência por CSS, então nada se repete na página e o leitor de tela encontra a
 * mesma estrutura nos dois tamanhos.
 *
 * Usa as funções ARIA de tabela (`role="table"` e afins) porque `display: grid` faz o
 * navegador esquecer a semântica de uma `<table>` de verdade.
 *
 * O cabeçalho continua na página no celular, só fora da vista, para o leitor de tela
 * associar cada célula ao seu título. Quem enxerga vê o rótulo dentro do cartão.
 */
export function ListaResponsiva<T>({
  rotulo,
  colunas,
  itens,
  chaveDoItem,
  modeloDeColunas,
}: Props<T>) {
  const estiloDaGrade = { '--colunas': modeloDeColunas } as CSSProperties;

  return (
    <div
      role="table"
      aria-label={rotulo}
      className="lg:overflow-hidden lg:rounded-cartao lg:bg-superficie lg:shadow-sm"
    >
      <div role="rowgroup">
        <div
          role="row"
          style={estiloDaGrade}
          className="sr-only lg:not-sr-only lg:grid lg:grid-cols-(--colunas) lg:items-center lg:gap-4 lg:border-b lg:border-fundo lg:px-5 lg:py-3"
        >
          {colunas.map((coluna) => (
            <div
              key={coluna.chave}
              role="columnheader"
              className={`text-xs font-semibold tracking-wide text-texto-suave uppercase ${
                coluna.acoes === true ? 'lg:text-right' : ''
              } ${coluna.classe ?? ''}`}
            >
              {coluna.titulo}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup" className="flex flex-col gap-3 lg:gap-0">
        {itens.map((item) => (
          <div
            key={chaveDoItem(item)}
            role="row"
            style={estiloDaGrade}
            className="flex flex-col gap-1 rounded-cartao bg-superficie p-4 shadow-sm lg:grid lg:grid-cols-(--colunas) lg:items-center lg:gap-4 lg:rounded-none lg:px-5 lg:py-3 lg:shadow-none lg:not-last:border-b lg:not-last:border-fundo"
          >
            {colunas.map((coluna) => (
              <div
                key={coluna.chave}
                role="cell"
                className={`${
                  coluna.acoes === true
                    ? 'mt-1 border-t border-fundo pt-3 lg:mt-0 lg:border-0 lg:pt-0 lg:text-right'
                    : 'flex items-center justify-between gap-3 py-1 lg:block lg:py-0'
                } ${coluna.classe ?? ''}`}
              >
                {coluna.semRotuloNoCelular !== true && coluna.acoes !== true && (
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xs font-semibold tracking-wide text-texto-suave uppercase lg:hidden"
                  >
                    {coluna.titulo}
                  </span>
                )}
                <div className="min-w-0">{coluna.renderizar(item)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
