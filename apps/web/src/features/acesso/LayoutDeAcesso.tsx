import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { IconeMaos, IconeSetaEsquerda } from './Icones.js';
import { PainelDaMarca } from './PainelDaMarca.js';

interface Props {
  /** Para onde o botão de voltar leva (só aparece no celular). */
  voltarPara: string;
  children: ReactNode;
}

/**
 * Moldura das telas de acesso. No celular é uma coluna única com voltar e marca no topo;
 * a partir de `lg` vira a tela dividida do protótipo, com o painel verde à esquerda.
 */
export function LayoutDeAcesso({ voltarPara, children }: Props) {
  return (
    <div className="min-h-dvh bg-superficie lg:grid lg:grid-cols-2">
      <PainelDaMarca className="hidden min-h-dvh lg:flex lg:flex-col" />
      <main className="pb-seguro mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-4 lg:max-w-sm lg:justify-center lg:px-0 lg:pt-12">
        <div className="flex flex-col gap-5 lg:hidden">
          <Link
            to={voltarPara}
            aria-label="Voltar"
            className="grid size-11 place-items-center rounded-full bg-fundo text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600"
          >
            <IconeSetaEsquerda className="size-6" />
          </Link>
          <span className="grid size-14 place-items-center rounded-2xl bg-marca-600 text-superficie">
            <IconeMaos className="size-9" />
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
