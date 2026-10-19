import type { LinhaDoRanking, Ranking } from '@gincana/contracts';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { CabecalhoDePagina } from '../../components/ui/CabecalhoDePagina.js';
import { botaoPrimario } from '../../components/ui/estilos-de-botao.js';
import { EstadoCarregando, EstadoDeErro, EstadoVazio } from '../../components/ui/Estados.js';
import { mensagemDeErro } from '../../lib/api.js';
import { formatarData } from '../../lib/formatar-data.js';
import { descreverInstante } from '../../lib/formatar-instante.js';
import { useSessao } from '../../lib/sessao.js';
import { SeletorDeGincana } from '../gincanas/SeletorDeGincana.js';
import { useGincanaSelecionada } from '../gincanas/useGincanaSelecionada.js';
import { ExtratoDaEquipe } from './ExtratoDaEquipe.js';
import { ListaDoRanking } from './ListaDoRanking.js';
import { consultaDoPeriodo, lerPeriodo, type PeriodoDoPlacar } from './periodo-do-placar.js';
import { useRanking } from './placar-api.js';
import { Podio } from './Podio.js';
import { SeletorDePeriodo } from './SeletorDePeriodo.js';

/** `2026-10-26` → `26/10`: a semana cabe numa frase sem repetir o ano. */
const diaEMes = (dataIso: string) => formatarData(dataIso).slice(0, 5);

function descreverPeriodo(periodo: PeriodoDoPlacar, ranking: Ranking | undefined): string {
  if (periodo === 'geral') {
    return 'Geral';
  }
  return ranking?.desde != null && ranking.ate != null
    ? `Esta semana (${diaEMes(ranking.desde)} a ${diaEMes(ranking.ate)})`
    : 'Esta semana';
}

interface PropsDoConteudo {
  ranking: Ranking;
  periodo: PeriodoDoPlacar;
  minhaEquipeId: string | null;
  aoAbrir: (linha: LinhaDoRanking) => void;
}

function Conteudo({ ranking, periodo, minhaEquipeId, aoAbrir }: PropsDoConteudo) {
  const { linhas } = ranking;
  const primeira = linhas[0];
  // Todas empatadas em zero: um pódio com três "1º lugar" sem ponto nenhum premiaria ninguém.
  const ninguemPontuou = primeira !== undefined && primeira.pontos === 0;

  return (
    <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[20rem_minmax(0,1fr)] xl:items-start">
      {ninguemPontuou ? (
        <div className="xl:col-span-2">
          <EstadoVazio
            titulo={
              periodo === 'semana'
                ? 'Nenhuma equipe pontuou esta semana'
                : 'Nenhuma equipe pontuou ainda'
            }
            descricao="Os pontos entram quando o líder aprova os lançamentos. Enquanto isso, todas as equipes aparecem empatadas na lista."
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-md xl:mx-0 xl:max-w-none">
          <Podio linhas={linhas} minhaEquipeId={minhaEquipeId} aoAbrir={aoAbrir} />
        </div>
      )}

      <section aria-labelledby="titulo-do-ranking" className="flex flex-col gap-3">
        <div>
          <h2 id="titulo-do-ranking" className="text-xl font-bold">
            Ranking completo
          </h2>
          <p className="text-sm text-texto-suave">
            Toque numa equipe para ver os pontos por tipo de ação.
          </p>
        </div>
        <ListaDoRanking linhas={linhas} minhaEquipeId={minhaEquipeId} aoAbrir={aoAbrir} />
      </section>
    </div>
  );
}

/**
 * US11 — o placar da gincana: pódio com as três primeiras equipes e, abaixo, o ranking
 * completo. Os três perfis abrem esta tela, cada um dentro do próprio menu.
 *
 * O filtro "Geral / Esta semana" fica na barra de endereço (`?periodo=semana`), então o
 * link e o botão voltar o preservam. A janela da semana é calculada aqui, no aparelho, e
 * mandada à API como `desde` e `ate`: o servidor só soma o que cai nela.
 */
export function TelaDoPlacar() {
  const { usuario } = useSessao();
  const { consulta: gincanas, gincanas: lista, escolhida, escolher } = useGincanaSelecionada();
  const [parametros, definirParametros] = useSearchParams();
  const periodo = lerPeriodo(parametros.get('periodo'));
  const janela = consultaDoPeriodo(periodo);
  const ranking = useRanking(escolhida?.id ?? null, janela);
  const [aberta, setAberta] = useState<LinhaDoRanking | null>(null);

  const ehAdmin = usuario?.papel === 'ADMIN';
  // A administradora não pertence a nenhuma equipe: ninguém aparece como "sua equipe".
  const minhaEquipeId = usuario?.equipeId ?? null;

  function escolherPeriodo(novo: PeriodoDoPlacar) {
    definirParametros(
      (atuais) => {
        const proximos = new URLSearchParams(atuais);
        if (novo === 'geral') {
          proximos.delete('periodo');
        } else {
          proximos.set('periodo', novo);
        }
        return proximos;
      },
      { replace: true },
    );
  }

  // "Esta semana (26/10 a 01/11). Atualizado hoje, 10:15. Só lançamentos aprovados contam."
  const descricao = [
    periodo === 'semana' && ranking.isSuccess
      ? `${descreverPeriodo(periodo, ranking.data)}.`
      : null,
    ranking.isSuccess ? `Atualizado ${descreverInstante(ranking.data.apuradoEm)}.` : null,
    'Só lançamentos aprovados contam.',
  ]
    .filter((frase) => frase !== null)
    .join(' ');

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDePagina
        sobretitulo={escolhida === null ? 'Gincana' : `Gincana ${String(escolhida.ano)}`}
        titulo="Placar da gincana"
        descricao={descricao}
        acao={
          escolhida === null ? undefined : (
            <SeletorDePeriodo periodo={periodo} aoEscolher={escolherPeriodo} />
          )
        }
      />

      {escolhida !== null && (
        <SeletorDeGincana gincanas={lista} escolhida={escolhida} aoEscolher={escolher} />
      )}

      {gincanas.isPending && <EstadoCarregando mensagem="Carregando a gincana…" />}

      {gincanas.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(gincanas.error)}
          aoTentarDeNovo={() => {
            void gincanas.refetch();
          }}
        />
      )}

      {gincanas.isSuccess && escolhida === null && (
        <EstadoVazio
          titulo="Ainda não há gincana cadastrada"
          descricao={
            ehAdmin
              ? 'Cadastre a gincana do ano para o placar começar a contar.'
              : 'A administradora cadastra a gincana. Quando ela estiver pronta, o placar aparece aqui.'
          }
        >
          {ehAdmin && (
            <Link to="/gincanas" className={botaoPrimario}>
              Ir para Gincanas
            </Link>
          )}
        </EstadoVazio>
      )}

      {escolhida !== null && ranking.isPending && (
        <EstadoCarregando mensagem="Carregando o placar…" />
      )}

      {escolhida !== null && ranking.isError && (
        <EstadoDeErro
          mensagem={mensagemDeErro(ranking.error)}
          aoTentarDeNovo={() => {
            void ranking.refetch();
          }}
        />
      )}

      {escolhida !== null && ranking.isSuccess && ranking.data.linhas.length === 0 && (
        <EstadoVazio
          titulo="Esta gincana ainda não tem equipes"
          descricao={
            ehAdmin
              ? 'Crie as equipes e vincule os colaboradores. Cada equipe aparece aqui, mesmo sem pontos.'
              : 'A administradora monta as equipes. Quando elas existirem, o placar aparece aqui.'
          }
        >
          {ehAdmin && (
            <Link to="/equipes" className={botaoPrimario}>
              Ir para Equipes
            </Link>
          )}
        </EstadoVazio>
      )}

      {escolhida !== null && ranking.isSuccess && ranking.data.linhas.length > 0 && (
        <Conteudo
          ranking={ranking.data}
          periodo={periodo}
          minhaEquipeId={minhaEquipeId}
          aoAbrir={setAberta}
        />
      )}

      {escolhida !== null && aberta !== null && (
        <ExtratoDaEquipe
          gincanaId={escolhida.id}
          linha={aberta}
          periodo={janela}
          rotuloDoPeriodo={descreverPeriodo(periodo, ranking.data)}
          aoFechar={() => {
            setAberta(null);
          }}
        />
      )}
    </div>
  );
}
