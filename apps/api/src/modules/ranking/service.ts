import type {
  ExtratoDaEquipe,
  LinhaDoExtrato,
  PeriodoDoRankingQuery,
  Ranking,
  Unidade,
} from '@gincana/contracts';

import { prisma } from '../../db.js';
import { naoEncontrado } from '../../middlewares/erros.js';
import { paraDataDoBanco } from '../gincanas/service.js';

import { classificarEquipes, type EquipeClassificada, type TotalDaEquipe } from './ordenacao.js';

/**
 * US11 — o placar por equipe.
 *
 * Quatro decisões sustentam este arquivo:
 *
 *  1. **Só lançamento APROVADO soma.** Pendente e recusado não entram em nenhum total.
 *     É a regra que a cliente mais vai conferir, e ela mora no `where` da agregação.
 *  2. **É consulta agregada, nunca tabela materializada.** `SUM(pontosCalculados)
 *     GROUP BY equipeId`, apoiada no índice `[equipeId, status]`. Não existe total
 *     guardado em lugar nenhum — total guardado é total que um dia diverge do que a
 *     trilha de auditoria explica.
 *  3. **Os pontos são os congelados no lançamento.** Somamos `pontosCalculados`, gravado
 *     no registro, e não recalculamos nada a partir da regra de hoje. Trocar a pontuação
 *     no meio da gincana não mexe no que já foi apurado.
 *  4. **Toda equipe da gincana aparece**, mesmo sem nenhum lançamento aprovado: a
 *     agregação é combinada com a lista de equipes, e quem não tem lançamento entra com
 *     zero. Sumir do placar seria pior do que aparecer em último.
 */

/** O `Decimal` do Prisma, visto só pelo que precisamos dele. */
interface Decimalish {
  toString: () => string;
}

const paraNumero = (valor: Decimalish | null): number => (valor ? Number(valor.toString()) : 0);

interface Periodo {
  desde: string | null;
  ate: string | null;
}

/**
 * O recorte "Geral / Esta semana" do protótipo, traduzido para o `where`.
 *
 * O filtro é pela `dataAcao` — o dia em que a ação aconteceu — e não pela data do
 * registro nem pela da aprovação: é o que a pessoa entende quando escolhe "esta semana".
 * As duas pontas são inclusivas.
 */
function filtroDePeriodo(periodo: Periodo): { gte?: Date; lte?: Date } | undefined {
  const faixa: { gte?: Date; lte?: Date } = {};

  if (periodo.desde) {
    faixa.gte = paraDataDoBanco(periodo.desde);
  }
  if (periodo.ate) {
    faixa.lte = paraDataDoBanco(periodo.ate);
  }

  return periodo.desde || periodo.ate ? faixa : undefined;
}

function periodoDaConsulta(filtros: PeriodoDoRankingQuery): Periodo {
  return { desde: filtros.desde ?? null, ate: filtros.ate ?? null };
}

async function carregarGincana(
  gincanaId: string,
): Promise<{ id: string; nome: string; ano: number }> {
  const gincana = await prisma.gincana.findUnique({
    where: { id: gincanaId },
    select: { id: true, nome: true, ano: true },
  });

  if (!gincana) {
    throw naoEncontrado('Gincana não encontrada.');
  }

  return gincana;
}

/**
 * A apuração em si: uma consulta pelas equipes da gincana e uma agregação pelos
 * lançamentos aprovados. Nada é lido linha a linha nem somado em memória.
 */
async function apurar(gincanaId: string, periodo: Periodo): Promise<EquipeClassificada[]> {
  const dataAcao = filtroDePeriodo(periodo);

  const [equipes, totais] = await Promise.all([
    prisma.equipe.findMany({
      where: { gincanaId },
      select: {
        id: true,
        nome: true,
        lider: { select: { id: true, nome: true } },
        _count: { select: { membros: true } },
      },
    }),
    prisma.lancamento.groupBy({
      by: ['equipeId'],
      where: { gincanaId, status: 'APROVADO', ...(dataAcao ? { dataAcao } : {}) },
      _sum: { pontosCalculados: true },
      _count: { _all: true },
    }),
  ]);

  const porEquipe = new Map(totais.map((total) => [total.equipeId, total]));

  const linhas: TotalDaEquipe[] = equipes.map((equipe) => {
    const total = porEquipe.get(equipe.id);
    return {
      equipeId: equipe.id,
      nome: equipe.nome,
      lider: equipe.lider,
      pontos: total?._sum.pontosCalculados ?? 0,
      acoesAprovadas: total?._count._all ?? 0,
      totalColaboradores: equipe._count.membros,
    };
  });

  return classificarEquipes(linhas);
}

/** US11 — o placar da gincana. Autenticado, qualquer perfil: o placar é de todo mundo. */
export async function montarRanking(
  gincanaId: string,
  filtros: PeriodoDoRankingQuery,
): Promise<Ranking> {
  const gincana = await carregarGincana(gincanaId);
  const periodo = periodoDaConsulta(filtros);
  const classificadas = await apurar(gincana.id, periodo);

  return {
    gincanaId: gincana.id,
    gincana,
    desde: periodo.desde,
    ate: periodo.ate,
    apuradoEm: new Date().toISOString(),
    linhas: classificadas.map((equipe) => ({
      posicao: equipe.posicao,
      empatada: equipe.empatada,
      equipeId: equipe.equipeId,
      equipe: { id: equipe.equipeId, nome: equipe.nome },
      lider: equipe.lider,
      pontos: equipe.pontos,
      acoesAprovadas: equipe.acoesAprovadas,
      totalColaboradores: equipe.totalColaboradores,
    })),
  };
}

/**
 * US11 — o extrato da equipe, para a tela de detalhe.
 *
 * A posição vem da mesma apuração do placar: duas telas que discordassem sobre quem está
 * em 2º seriam pior do que não ter a tela de detalhe.
 */
export async function montarExtratoDaEquipe(
  gincanaId: string,
  equipeId: string,
  filtros: PeriodoDoRankingQuery,
): Promise<ExtratoDaEquipe> {
  const gincana = await carregarGincana(gincanaId);
  const periodo = periodoDaConsulta(filtros);

  const classificadas = await apurar(gincana.id, periodo);
  const equipe = classificadas.find((linha) => linha.equipeId === equipeId);

  if (!equipe) {
    throw naoEncontrado('Equipe não encontrada nesta gincana.');
  }

  const dataAcao = filtroDePeriodo(periodo);

  const porTipo = await prisma.lancamento.groupBy({
    by: ['tipoAcaoId'],
    where: { gincanaId, equipeId, status: 'APROVADO', ...(dataAcao ? { dataAcao } : {}) },
    _sum: { pontosCalculados: true, quantidade: true },
    _count: { _all: true },
  });

  const tipos = await prisma.tipoAcao.findMany({
    where: { id: { in: porTipo.map((linha) => linha.tipoAcaoId) } },
    select: { id: true, nome: true, unidade: true },
  });
  const nomeDoTipo = new Map<string, { id: string; nome: string; unidade: Unidade }>(
    tipos.map((tipo) => [tipo.id, tipo]),
  );

  const linhas: LinhaDoExtrato[] = porTipo.flatMap((linha) => {
    const tipo = nomeDoTipo.get(linha.tipoAcaoId);
    if (!tipo) {
      return [];
    }

    return [
      {
        tipoAcaoId: tipo.id,
        tipoAcao: tipo,
        quantidade: paraNumero(linha._sum.quantidade),
        acoesAprovadas: linha._count._all,
        pontos: linha._sum.pontosCalculados ?? 0,
      },
    ];
  });

  // Mais pontos primeiro: é a leitura de "onde esta equipe está ganhando a gincana".
  linhas.sort(
    (a, b) => b.pontos - a.pontos || a.tipoAcao.nome.localeCompare(b.tipoAcao.nome, 'pt-BR'),
  );

  return {
    gincanaId: gincana.id,
    desde: periodo.desde,
    ate: periodo.ate,
    apuradoEm: new Date().toISOString(),
    equipe: { id: equipe.equipeId, nome: equipe.nome },
    lider: equipe.lider,
    posicao: equipe.posicao,
    empatada: equipe.empatada,
    pontos: equipe.pontos,
    acoesAprovadas: equipe.acoesAprovadas,
    totalColaboradores: equipe.totalColaboradores,
    linhas,
  };
}
