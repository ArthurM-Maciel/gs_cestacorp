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
  /**
   * A partir de que largura a lista vira tabela. `lg` (1024px) serve a quase todas; uma tabela
   * com muitas colunas pede `xl` (1280px), porque ao lado do menu lateral o `lg` deixa só uns
   * 680px de conteúdo. Abaixo disso ela continua cartão, que é legível em qualquer largura.
   * Os botões dentro das células usam o mesmo prefixo (`xl:w-auto`, não `lg:w-auto`).
   */
  tabelaA?: 'lg' | 'xl';
}

/**
 * Classes por ponto de quebra, escritas por extenso: o Tailwind só gera o CSS das classes
 * que encontra no código, então `${quebra}:grid` não funcionaria.
 */
const variantes = {
  lg: {
    tabela: 'lg:overflow-hidden lg:rounded-cartao lg:bg-superficie lg:shadow-sm',
    cabecalho:
      'sr-only lg:not-sr-only lg:grid lg:grid-cols-(--colunas) lg:items-center lg:gap-4 lg:border-b lg:border-fundo lg:px-5 lg:py-3',
    cabecalhoDeAcoes: 'lg:text-right',
    grupo: 'flex flex-col gap-3 lg:gap-0',
    linha:
      'flex flex-col gap-1 rounded-cartao bg-superficie p-4 shadow-sm lg:grid lg:grid-cols-(--colunas) lg:items-center lg:gap-4 lg:rounded-none lg:px-5 lg:py-3 lg:shadow-none lg:not-last:border-b lg:not-last:border-fundo',
    celulaDeAcoes: 'mt-1 border-t border-fundo pt-3 lg:mt-0 lg:border-0 lg:pt-0 lg:text-right',
    celula: 'flex items-center justify-between gap-3 py-1 lg:block lg:py-0',
    rotulo: 'shrink-0 text-xs font-semibold tracking-wide text-texto-suave uppercase lg:hidden',
  },
  xl: {
    tabela: 'xl:overflow-hidden xl:rounded-cartao xl:bg-superficie xl:shadow-sm',
    cabecalho:
      'sr-only xl:not-sr-only xl:grid xl:grid-cols-(--colunas) xl:items-center xl:gap-4 xl:border-b xl:border-fundo xl:px-5 xl:py-3',
    cabecalhoDeAcoes: 'xl:text-right',
    grupo: 'flex flex-col gap-3 xl:gap-0',
    linha:
      'flex flex-col gap-1 rounded-cartao bg-superficie p-4 shadow-sm xl:grid xl:grid-cols-(--colunas) xl:items-center xl:gap-4 xl:rounded-none xl:px-5 xl:py-3 xl:shadow-none xl:not-last:border-b xl:not-last:border-fundo',
    celulaDeAcoes: 'mt-1 border-t border-fundo pt-3 xl:mt-0 xl:border-0 xl:pt-0 xl:text-right',
    celula: 'flex items-center justify-between gap-3 py-1 xl:block xl:py-0',
    rotulo: 'shrink-0 text-xs font-semibold tracking-wide text-texto-suave uppercase xl:hidden',
  },
} as const;

/**
 * Lista que é cartão no celular e tabela a partir de `lg` (ou `xl`, com `tabelaA`). Um único conjunto de elementos
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
  tabelaA = 'lg',
}: Props<T>) {
  const estiloDaGrade = { '--colunas': modeloDeColunas } as CSSProperties;
  const classes = variantes[tabelaA];

  return (
    <div role="table" aria-label={rotulo} className={classes.tabela}>
      <div role="rowgroup">
        <div role="row" style={estiloDaGrade} className={classes.cabecalho}>
          {colunas.map((coluna) => (
            <div
              key={coluna.chave}
              role="columnheader"
              className={`text-xs font-semibold tracking-wide text-texto-suave uppercase ${
                coluna.acoes === true ? classes.cabecalhoDeAcoes : ''
              } ${coluna.classe ?? ''}`}
            >
              {coluna.titulo}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup" className={classes.grupo}>
        {itens.map((item) => (
          <div key={chaveDoItem(item)} role="row" style={estiloDaGrade} className={classes.linha}>
            {colunas.map((coluna) => {
              const conteudo = coluna.renderizar(item);
              // Sem ação possível (lançamento já aprovado), não sobra uma faixa vazia no cartão.
              if (coluna.acoes === true && conteudo === null) {
                return null;
              }
              return (
                <div
                  key={coluna.chave}
                  role="cell"
                  className={`${
                    coluna.acoes === true ? classes.celulaDeAcoes : classes.celula
                  } ${coluna.classe ?? ''}`}
                >
                  {coluna.semRotuloNoCelular !== true && coluna.acoes !== true && (
                    <span aria-hidden="true" className={classes.rotulo}>
                      {coluna.titulo}
                    </span>
                  )}
                  <div className="min-w-0">{conteudo}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
