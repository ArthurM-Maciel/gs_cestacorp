import type { LinhaDoRanking, PeriodoDoRankingQuery } from '@gincana/contracts';

import { CorpoDoDialogo, Dialogo } from '../../components/ui/Dialogo.js';
import { EstadoCarregando, EstadoDeErro } from '../../components/ui/Estados.js';
import { mensagemDeErro } from '../../lib/api.js';
import { formatarNumero, formatarPontos, formatarQuantidade } from '../../lib/formatar-numero.js';
import { familiaDoTipo } from '../tipos-acao/familias-de-acao.js';
import { IconeDaFamilia } from '../tipos-acao/IconeDaFamilia.js';
import { useExtratoDaEquipe } from './placar-api.js';
import { rotuloDaPosicao } from './posicao-da-equipe.js';

interface Props {
  gincanaId: string;
  /** A linha em que a pessoa tocou: já tem nome e posição, então o título aparece sem esperar. */
  linha: LinhaDoRanking;
  periodo: PeriodoDoRankingQuery;
  /** "Geral" ou "Esta semana (26/10 a 01/11)": o recorte que vale para os números abaixo. */
  rotuloDoPeriodo: string;
  aoFechar: () => void;
}

function pessoas(quantas: number): string {
  return quantas === 1 ? '1 colaborador' : `${formatarNumero(quantas)} colaboradores`;
}

/**
 * O extrato: de onde vieram os pontos da equipe, tipo de ação por tipo de ação. Abre sobre o
 * placar, que continua onde estava, e devolve o foco à linha que o abriu.
 *
 * O extrato é pedido à API com o mesmo período do placar, para que o total daqui bata com o
 * da linha em que a pessoa tocou.
 */
export function ExtratoDaEquipe({ gincanaId, linha, periodo, rotuloDoPeriodo, aoFechar }: Props) {
  const consulta = useExtratoDaEquipe(gincanaId, linha.equipeId, periodo);

  return (
    <Dialogo
      titulo={linha.equipe.nome}
      descricao={`${rotuloDaPosicao(linha)} · ${rotuloDoPeriodo}`}
      aoFechar={aoFechar}
    >
      <CorpoDoDialogo>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-marca-100 p-3">
            <dt className="text-sm text-texto-suave">Pontos</dt>
            <dd className="text-2xl font-bold text-aprovado">{formatarPontos(linha.pontos)}</dd>
          </div>
          <div className="rounded-xl bg-fundo p-3">
            <dt className="text-sm text-texto-suave">Ações aprovadas</dt>
            <dd className="text-2xl font-bold">{formatarNumero(linha.acoesAprovadas)}</dd>
          </div>
          <div className="col-span-2 text-sm text-texto-suave">
            <dt className="sr-only">Líder e tamanho da equipe</dt>
            <dd>
              {linha.lider === null ? 'Sem líder' : `Líder: ${linha.lider.nome}`} ·{' '}
              {pessoas(linha.totalColaboradores)}
            </dd>
          </div>
        </dl>

        <section aria-labelledby="pontos-por-tipo" className="flex flex-col gap-3">
          <h3 id="pontos-por-tipo" className="text-lg font-bold">
            Pontos por tipo de ação
          </h3>

          {consulta.isPending && <EstadoCarregando mensagem="Carregando o extrato…" />}

          {consulta.isError && (
            <EstadoDeErro
              mensagem={mensagemDeErro(consulta.error)}
              aoTentarDeNovo={() => {
                void consulta.refetch();
              }}
            />
          )}

          {consulta.isSuccess && consulta.data.linhas.length === 0 && (
            <p className="rounded-cartao bg-fundo p-4 text-texto-suave">
              Esta equipe ainda não tem lançamento aprovado neste período. Os pontos aparecem aqui
              quando o líder aprova o primeiro.
            </p>
          )}

          {consulta.isSuccess && consulta.data.linhas.length > 0 && (
            <ul className="flex flex-col gap-2">
              {consulta.data.linhas
                .toSorted(
                  (a, b) =>
                    b.pontos - a.pontos || a.tipoAcao.nome.localeCompare(b.tipoAcao.nome, 'pt-BR'),
                )
                .map((item) => (
                  <li
                    key={item.tipoAcaoId}
                    className="flex items-center gap-3 rounded-xl bg-fundo p-3"
                  >
                    <IconeDaFamilia familia={familiaDoTipo(item.tipoAcao)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-balance">{item.tipoAcao.nome}</p>
                      <p className="text-sm text-texto-suave">
                        {formatarQuantidade(item.quantidade, item.tipoAcao.unidade)} ·{' '}
                        {item.acoesAprovadas === 1
                          ? '1 ação'
                          : `${formatarNumero(item.acoesAprovadas)} ações`}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold text-aprovado">
                      {formatarPontos(item.pontos)}
                    </p>
                  </li>
                ))}
            </ul>
          )}

          <p className="text-sm text-texto-suave">Só lançamentos aprovados contam.</p>
        </section>

        <div className="pb-seguro" />
      </CorpoDoDialogo>
    </Dialogo>
  );
}
