import { Link } from 'react-router-dom';

import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { useSessao } from '../../lib/sessao.js';

const passos = [
  {
    caminho: '/gincanas',
    titulo: 'Cadastre a gincana do ano',
    descricao: 'Defina o ano e o período em que os lançamentos valem.',
  },
  {
    caminho: '/colaboradores',
    titulo: 'Cadastre os colaboradores',
    descricao: 'Nome, e-mail, senha do primeiro acesso e papel de cada pessoa.',
  },
  {
    caminho: '/equipes',
    titulo: 'Monte as equipes',
    descricao: 'Crie cada equipe, escolha o líder e vincule os colaboradores.',
  },
] as const;

/**
 * Painel provisório da administradora. Os números da gincana (equipes, lançamentos,
 * pendências, ranking) dependem de histórias que ainda não existem. Até lá, a tela mostra
 * por onde começar, que é o que a pessoa realmente consegue fazer hoje.
 */
export function PainelEmBreve() {
  const { usuario } = useSessao();

  if (usuario === null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo="Painel"
        titulo={`Olá, ${usuario.nome}!`}
        descricao="O painel da gincana, com os números e o ranking, ainda está em construção. Enquanto isso, prepare o cadastro."
      />

      <ol aria-label="Por onde começar" className="flex flex-col gap-3">
        {passos.map((passo, indice) => (
          <li key={passo.caminho}>
            <Link
              to={passo.caminho}
              className="flex min-h-16 items-center gap-4 rounded-cartao bg-superficie p-4 shadow-sm hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600"
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-marca-100 font-bold text-aprovado"
              >
                {indice + 1}
              </span>
              <span>
                <span className="block font-semibold">{passo.titulo}</span>
                <span className="block text-sm text-texto-suave">{passo.descricao}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
