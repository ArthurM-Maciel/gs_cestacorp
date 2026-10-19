import type {
  ListarLancamentosQuery,
  StatusLancamento,
  UsuarioAutenticado,
} from '@gincana/contracts';

/**
 * Decisões de autorização dos lançamentos, como funções puras.
 *
 * Nada aqui conhece Express, Prisma ou banco: a entrada é o usuário autenticado (sempre
 * recarregado do banco pelo middleware, nunca lido do corpo da requisição) e a saída é
 * ou um `where` do Prisma, ou um sim/não. É o que permite cobrir "líder não alcança outra
 * equipe" com teste de unidade, sem subir HTTP.
 *
 * A regra de fundo é a do CLAUDE.md: o escopo entra na consulta, não num filtro aplicado
 * depois. Essa é a diferença entre "o colaborador não vê lançamento alheio" e "o
 * colaborador não vê lançamento alheio até alguém trocar o parâmetro na barra de
 * endereço".
 */

/** Os campos do lançamento de que a autorização precisa — e só eles. */
export interface LancamentoParaPolicy {
  readonly id: string;
  readonly colaboradorId: string;
  readonly equipeId: string;
  readonly status: StatusLancamento;
}

/** Recorte do `where` do Prisma. Combinado com os filtros da consulta por `AND`. */
export interface EscopoDeLancamentos {
  colaboradorId?: string;
  equipeId?: string;
  OR?: { colaboradorId?: string; equipeId?: string }[];
}

/**
 * O que cada perfil enxerga.
 *
 *  - Administradora: tudo, porque ela apura a gincana inteira.
 *  - Líder: os lançamentos da equipe que lidera, mais os seus próprios — ele também
 *    participa, e pode estar lotado em outra equipe que não a que lidera.
 *  - Colaborador: só os próprios.
 *
 * Quem lidera uma equipe mas nenhum lançamento é seu cai no mesmo `OR`: o resultado é
 * idêntico e evita um caminho especial a menos para testar.
 */
export function escopoDeLeituraDeLancamentos(usuario: UsuarioAutenticado): EscopoDeLancamentos {
  if (usuario.papel === 'ADMIN') {
    return {};
  }

  if (usuario.papel === 'LIDER' && usuario.equipeLideradaId) {
    return { OR: [{ equipeId: usuario.equipeLideradaId }, { colaboradorId: usuario.id }] };
  }

  // Líder sem equipe atribuída não avalia nem enxerga nada além do que é dele.
  return { colaboradorId: usuario.id };
}

/**
 * Quem pode aprovar ou recusar.
 *
 * Só responde pela autorização — um "não" daqui é 403. A trava de não avaliar o próprio
 * lançamento é outra coisa: ela vale até para quem tem permissão de sobra, e por isso
 * mora em `ehAutoAvaliacao`, virando 409.
 */
export function podeAvaliarLancamento(
  usuario: UsuarioAutenticado,
  lancamento: LancamentoParaPolicy,
): boolean {
  if (usuario.papel === 'ADMIN') {
    return true;
  }

  if (usuario.papel !== 'LIDER' || !usuario.equipeLideradaId) {
    return false;
  }

  // O líder avalia a própria equipe. Saber o identificador de outra não muda nada.
  return usuario.equipeLideradaId === lancamento.equipeId;
}

/**
 * Ninguém avalia o próprio lançamento — nem o líder, nem a administradora.
 *
 * É a trava que sustenta a trilha do selo PQCRS: ponto que entra no placar passou pelos
 * olhos de outra pessoa. Se a administradora registrar uma ação dela, outra pessoa
 * precisa aprovar.
 */
export function ehAutoAvaliacao(
  usuario: UsuarioAutenticado,
  lancamento: LancamentoParaPolicy,
): boolean {
  return usuario.id === lancamento.colaboradorId;
}

/**
 * Quem pode corrigir o lançamento.
 *
 * O dono corrige o que ainda está pendente e o que foi recusado (aí ele volta para a
 * fila). Depois de aprovado, só a administradora mexe — e qualquer mudança dela recalcula
 * os pontos e deixa rastro de antes e depois.
 *
 * O líder não edita lançamento alheio: avaliar é dizer sim ou não ao que a pessoa
 * declarou, não reescrever a declaração dela.
 */
export function podeEditarLancamento(
  usuario: UsuarioAutenticado,
  lancamento: LancamentoParaPolicy,
): boolean {
  if (usuario.papel === 'ADMIN') {
    return true;
  }

  return usuario.id === lancamento.colaboradorId && lancamento.status !== 'APROVADO';
}

/**
 * Quem pode anexar ou remover comprovante: só o dono, e só enquanto pendente.
 *
 * Depois de avaliado, o conjunto de comprovantes é a evidência do que foi decidido —
 * mexer nele apagaria o contexto da aprovação.
 */
export function podeMexerNasEvidencias(
  usuario: UsuarioAutenticado,
  lancamento: LancamentoParaPolicy,
): boolean {
  return usuario.id === lancamento.colaboradorId;
}

/**
 * Para quem a pessoa pode lançar.
 *
 * O colaborador lança para si. A administradora registra para outra pessoa o que chega
 * por papel na recepção — é o caso que a cliente descreveu na inception. `colaboradorId`
 * vindo do corpo de quem não é administradora é simplesmente ignorado: não vira erro,
 * vira o próprio identificador.
 */
export function donoDoNovoLancamento(
  usuario: UsuarioAutenticado,
  colaboradorIdPedido?: string,
): string {
  if (usuario.papel === 'ADMIN' && colaboradorIdPedido) {
    return colaboradorIdPedido;
  }

  return usuario.id;
}

/** Filtros da consulta, já sem nada que pudesse ampliar o escopo do papel. */
export interface FiltrosDeLancamentos {
  status?: StatusLancamento;
  gincanaId?: string;
  equipeId?: string;
  colaboradorId?: string;
  tipoAcaoId?: string;
}

export function filtrosDaConsulta(
  filtros: Pick<
    ListarLancamentosQuery,
    'status' | 'gincanaId' | 'equipeId' | 'colaboradorId' | 'tipoAcaoId'
  >,
): FiltrosDeLancamentos {
  const resultado: FiltrosDeLancamentos = {};

  if (filtros.status) {
    resultado.status = filtros.status;
  }
  if (filtros.gincanaId) {
    resultado.gincanaId = filtros.gincanaId;
  }
  if (filtros.equipeId) {
    resultado.equipeId = filtros.equipeId;
  }
  if (filtros.colaboradorId) {
    resultado.colaboradorId = filtros.colaboradorId;
  }
  if (filtros.tipoAcaoId) {
    resultado.tipoAcaoId = filtros.tipoAcaoId;
  }

  return resultado;
}
