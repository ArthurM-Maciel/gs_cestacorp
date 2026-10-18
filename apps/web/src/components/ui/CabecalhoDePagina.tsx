import type { ReactNode } from 'react';

interface Props {
  /** Linha pequena acima do título, como "GINCANA 2026" nas telas do protótipo. */
  sobretitulo: string;
  titulo: string;
  descricao?: string;
  /** Botão principal da tela. Ocupa a largura toda no celular e fica à direita no computador. */
  acao?: ReactNode;
}

export function CabecalhoDePagina({ sobretitulo, titulo, descricao, acao }: Props) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-wide text-marca-600 uppercase">
          {sobretitulo}
        </p>
        <h1 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-balance">
          {titulo}
        </h1>
        {descricao !== undefined && <p className="mt-1 text-texto-suave">{descricao}</p>}
      </div>
      {acao !== undefined && <div className="lg:shrink-0">{acao}</div>}
    </header>
  );
}
