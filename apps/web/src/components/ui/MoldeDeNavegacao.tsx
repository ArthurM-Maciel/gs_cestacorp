import type { ComponentType, SVGProps } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { IconeMaos } from '../../features/acesso/Icones.js';
import { useSessao } from '../../lib/sessao.js';

export interface ItemDoMenu {
  chave: string;
  rotulo: string;
  /** Rótulo da barra do celular, onde o espaço é curto ("Aprovar" em vez de "Aprovações"). */
  rotuloCurto?: string;
  Icone: ComponentType<SVGProps<SVGSVGElement>>;
  /** Telas que existem têm caminho. Sem caminho, a tela é de uma história futura. */
  caminho: string | null;
  /** Número no selo vermelho do item (aprovações pendentes). Zero ou ausente: sem selo. */
  selo?: number;
}

type ItemComCaminho = ItemDoMenu & { caminho: string };

const foco =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-300';

/**
 * No celular o topo é estreito: só o ícone fica à vista, e o nome continua disponível para
 * leitor de tela.
 */
function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <p className="flex items-center gap-3 font-semibold">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-marca-600">
        <IconeMaos className="size-5 text-superficie" />
      </span>
      <span className={compacta ? 'sr-only' : undefined}>Gincana Solidária</span>
    </p>
  );
}

/** Bolinha vermelha com a contagem. O leitor de tela ouve "3 pendentes", não só "3". */
function Selo({ quantidade }: { quantidade: number }) {
  return (
    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-recusado px-1.5 text-xs font-bold text-superficie">
      {quantidade}
      <span className="sr-only"> pendentes</span>
    </span>
  );
}

function ItemLateral({ item }: { item: ItemDoMenu }) {
  const base = 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold';

  if (item.caminho === null) {
    return (
      <li>
        <span className={`${base} justify-between text-superficie/60`}>
          <span className="flex items-center gap-3">
            <item.Icone className="size-5" />
            {item.rotulo}
          </span>
          <span className="rounded-full bg-marca-800 px-2 py-0.5 text-xs text-marca-300">
            Em breve
          </span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <NavLink
        to={item.caminho}
        className={({ isActive }) =>
          `${base} ${foco} ${isActive ? 'bg-marca-600 text-superficie' : 'text-superficie/80 hover:bg-marca-800'}`
        }
      >
        <item.Icone className="size-5" />
        {item.rotulo}
        {item.selo !== undefined && item.selo > 0 && <Selo quantidade={item.selo} />}
      </NavLink>
    </li>
  );
}

function ItemInferior({ item }: { item: ItemComCaminho }) {
  return (
    <li className="flex-auto">
      <NavLink
        to={item.caminho}
        className={({ isActive }) =>
          `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-xs font-semibold ${foco} ${isActive ? 'bg-marca-300 text-marca-900' : 'text-superficie'}`
        }
      >
        <span className="relative">
          <item.Icone className="size-5" />
          {item.selo !== undefined && item.selo > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-2 -right-3 inline-flex min-w-4 items-center justify-center rounded-full bg-recusado px-1 text-[0.625rem] leading-4 font-bold text-superficie"
            >
              {item.selo}
            </span>
          )}
        </span>
        {item.rotuloCurto ?? item.rotulo}
        {/* O número do selo é visual; quem usa leitor de tela ouve "Aprovar, 2 pendentes". */}
        {item.selo !== undefined && item.selo > 0 && (
          <span className="sr-only">, {item.selo} pendentes</span>
        )}
      </NavLink>
    </li>
  );
}

interface Props {
  itens: readonly ItemDoMenu[];
  /** Perfil da pessoa, no rodapé do menu lateral ("Administradora", "Líder da Equipe Ipê"). */
  descricaoDoPerfil: string;
}

/**
 * Moldura das telas de uma pessoa logada: menu lateral escuro no computador (como em
 * `08-administradora-web.png` e `06-colaborador-web.png`) e, no celular, topo com o nome e
 * barra de navegação inferior, ao alcance do polegar (`02-colaborador-mobile.png`).
 *
 * Os dois menus existem na página e o CSS mostra um por vez. Cada um tem o seu nome
 * ("Menu principal" e "Menu inferior"), para o leitor de tela distinguir os dois pontos
 * de referência.
 *
 * Os itens sem caminho (telas de histórias futuras) aparecem no computador como "Em breve",
 * sem link, e ficam fora da barra do celular: link para uma tela que não existe só ensina
 * a pessoa a não confiar no menu.
 *
 * Esconder um item aqui é conveniência de interface. Quem barra o acesso de verdade é a
 * API, que confere o papel em cada chamada.
 */
export function MoldeDeNavegacao({ itens, descricaoDoPerfil }: Props) {
  const { usuario, sair } = useSessao();

  // O guarda de rota já exigiu sessão; este retorno só satisfaz o tipo.
  if (usuario === null) {
    return null;
  }

  const itensQueExistem = itens.filter((item): item is ItemComCaminho => item.caminho !== null);
  const temItemFuturo = itensQueExistem.length < itens.length;

  return (
    <div className="min-h-dvh bg-fundo lg:pl-64">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-superficie focus:px-4 focus:py-3 focus:font-semibold focus:text-marca-600"
      >
        Ir para o conteúdo
      </a>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-marca-900 p-4 text-superficie lg:flex">
        <Marca />
        <nav aria-label="Menu principal" className="mt-8 flex-1 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {itens.map((item) => (
              <ItemLateral key={item.chave} item={item} />
            ))}
          </ul>
          {temItemFuturo && (
            <p className="mt-4 px-3 text-xs text-marca-300">
              Os itens marcados com “Em breve” chegam nas próximas entregas.
            </p>
          )}
        </nav>
        <div className="border-t border-marca-700 pt-4">
          <p className="font-semibold break-words">{usuario.nome}</p>
          <p className="text-sm text-marca-300">{descricaoDoPerfil}</p>
          <button
            type="button"
            onClick={sair}
            className={`mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-marca-700 px-4 text-sm font-semibold hover:bg-marca-800 ${foco}`}
          >
            Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 bg-marca-900 px-4 py-2 text-superficie lg:hidden">
        <Marca compacta />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{usuario.nome}</p>
        <button
          type="button"
          onClick={sair}
          className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold hover:bg-marca-800 ${foco}`}
        >
          Sair
        </button>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 pt-6 pb-32 focus:outline-none lg:px-10 lg:py-10"
      >
        <Outlet />
      </main>

      <nav
        aria-label="Menu inferior"
        className="pb-seguro fixed inset-x-0 bottom-0 z-20 px-2 lg:hidden"
      >
        {/* `flex-auto` reparte o espaço pelo tamanho do texto: "Colaboradores" é bem mais largo
            que "Painel", e colunas iguais cortariam o rótulo em 360px. */}
        <ul className="flex gap-0.5 rounded-full bg-marca-900 p-1 shadow-lg">
          {itensQueExistem.map((item) => (
            <ItemInferior key={item.chave} item={item} />
          ))}
        </ul>
      </nav>
    </div>
  );
}
