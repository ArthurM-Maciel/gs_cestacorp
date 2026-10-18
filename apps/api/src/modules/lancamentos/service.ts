import type {
  AprovarLancamento,
  AtualizarLancamento,
  CriarLancamento,
  FilaDePendentesQuery,
  Lancamento,
  ListarLancamentosQuery,
  PaginaDeLancamentos,
  PreviaDeLancamento,
  RecusarLancamento,
  ResultadoDaPrevia,
  StatusGincana,
  StatusLancamento,
  Unidade,
  UsuarioAutenticado,
} from '@gincana/contracts';
import {
  calcularPontos,
  calcularPontosNaData,
  ErroDeCalculo,
  type RegraPontuacao as RegraParaCalculo,
} from '@gincana/scoring';

import { prisma, type Transacao } from '../../db.js';
import { ErroDaAplicacao, conflito, naoEncontrado, semPermissao } from '../../middlewares/erros.js';
import { registrarAuditoria } from '../auditoria/registrar.js';
import { paraDataDoBanco, paraDataDoContrato } from '../gincanas/service.js';

import {
  donoDoNovoLancamento,
  ehAutoAvaliacao,
  escopoDeLeituraDeLancamentos,
  filtrosDaConsulta,
  podeAvaliarLancamento,
  podeEditarLancamento,
  type LancamentoParaPolicy,
} from './policy.js';

/**
 * US06 e US08 — o coração do sistema: lançar uma ação e avaliá-la.
 *
 * Quatro decisões atravessam o arquivo inteiro:
 *
 *  1. **Auditoria na mesma transação.** Criar, corrigir, aprovar e recusar passam por
 *     `prisma.$transaction` com `registrarAuditoria(tx, …)` dentro. Se a auditoria falha,
 *     a pontuação não existe — é o que sustenta o selo PQCRS.
 *  2. **Pontos congelados.** O lançamento grava `regraPontuacaoId` e
 *     `pontosPorUnidadeAplicado`. Trocar a regra depois não mexe em nada já apurado, e
 *     uma correção de quantidade recalcula sobre o preço congelado, não sobre o de hoje.
 *  3. **O cálculo é do `@gincana/scoring`.** O mesmo módulo que o front usa na prévia.
 *     Não existe multiplicação de pontos escrita à mão aqui.
 *  4. **A equipe é gravada no lançamento**, lida do colaborador no instante do registro.
 *     Quem muda de equipe depois não leva os pontos junto.
 */

/** O `Decimal` do Prisma, visto só pelo que precisamos dele. */
interface Decimalish {
  toString: () => string;
}

const paraNumero = (valor: Decimalish): number => Number(valor.toString());

const selecaoDaEvidencia = {
  id: true,
  lancamentoId: true,
  url: true,
  publicId: true,
  nomeArquivo: true,
  mimeType: true,
  tamanhoBytes: true,
  enviadoPorId: true,
  criadoEm: true,
} as const;

export const selecaoDoLancamento = {
  id: true,
  gincanaId: true,
  colaboradorId: true,
  colaborador: { select: { id: true, nome: true } },
  equipeId: true,
  equipe: { select: { id: true, nome: true } },
  tipoAcaoId: true,
  tipoAcao: { select: { id: true, nome: true, unidade: true, exigeEvidencia: true } },
  quantidade: true,
  regraPontuacaoId: true,
  pontosPorUnidadeAplicado: true,
  pontosCalculados: true,
  status: true,
  observacao: true,
  dataAcao: true,
  avaliadoPor: { select: { id: true, nome: true } },
  avaliadoEm: true,
  motivoRecusa: true,
  evidencias: { select: selecaoDaEvidencia, orderBy: { criadoEm: 'asc' } },
  criadoEm: true,
} as const;

interface LancamentoDoBanco {
  id: string;
  gincanaId: string;
  colaboradorId: string;
  colaborador: { id: string; nome: string };
  equipeId: string;
  equipe: { id: string; nome: string };
  tipoAcaoId: string;
  tipoAcao: { id: string; nome: string; unidade: Unidade; exigeEvidencia: boolean };
  quantidade: Decimalish;
  regraPontuacaoId: string;
  pontosPorUnidadeAplicado: Decimalish;
  pontosCalculados: number;
  status: StatusLancamento;
  observacao: string | null;
  dataAcao: Date;
  avaliadoPor: { id: string; nome: string } | null;
  avaliadoEm: Date | null;
  motivoRecusa: string | null;
  evidencias: {
    id: string;
    lancamentoId: string;
    url: string;
    publicId: string;
    nomeArquivo: string;
    mimeType: string;
    tamanhoBytes: number;
    enviadoPorId: string;
    criadoEm: Date;
  }[];
  criadoEm: Date;
}

export function montarLancamento(lancamento: LancamentoDoBanco): Lancamento {
  return {
    id: lancamento.id,
    gincanaId: lancamento.gincanaId,
    colaboradorId: lancamento.colaboradorId,
    colaborador: lancamento.colaborador,
    equipeId: lancamento.equipeId,
    equipe: lancamento.equipe,
    tipoAcaoId: lancamento.tipoAcaoId,
    tipoAcao: lancamento.tipoAcao,
    quantidade: paraNumero(lancamento.quantidade),
    regraPontuacaoId: lancamento.regraPontuacaoId,
    pontosPorUnidadeAplicado: paraNumero(lancamento.pontosPorUnidadeAplicado),
    pontosCalculados: lancamento.pontosCalculados,
    status: lancamento.status,
    observacao: lancamento.observacao,
    dataAcao: paraDataDoContrato(lancamento.dataAcao),
    avaliadoPor: lancamento.avaliadoPor,
    avaliadoEm: lancamento.avaliadoEm?.toISOString() ?? null,
    motivoRecusa: lancamento.motivoRecusa,
    evidencias: lancamento.evidencias.map((evidencia) => ({
      ...evidencia,
      criadoEm: evidencia.criadoEm.toISOString(),
    })),
    criadoEm: lancamento.criadoEm.toISOString(),
  };
}

/** Retrato que vai para a auditoria — o que a US09 precisa exibir, e nada além. */
function retratoDoLancamento(lancamento: LancamentoDoBanco) {
  return {
    colaboradorId: lancamento.colaboradorId,
    equipeId: lancamento.equipeId,
    tipoAcaoId: lancamento.tipoAcaoId,
    quantidade: paraNumero(lancamento.quantidade),
    dataAcao: paraDataDoContrato(lancamento.dataAcao),
    regraPontuacaoId: lancamento.regraPontuacaoId,
    pontosPorUnidadeAplicado: paraNumero(lancamento.pontosPorUnidadeAplicado),
    pontosCalculados: lancamento.pontosCalculados,
    status: lancamento.status,
    observacao: lancamento.observacao,
  };
}

/**
 * O instante usado para escolher a regra de pontuação.
 *
 * A vigência da regra é um instante (a administradora troca a pontuação no meio do
 * expediente), mas a ação aconteceu num dia do calendário. Para ação de hoje vale a regra
 * de agora — é a mesma pontuação que a prévia mostrou na tela segundos antes. Para ação
 * de um dia passado vale a regra do fim daquele dia, que é a que estava valendo quando o
 * dia terminou.
 *
 * Como dia futuro é recusado antes de chegar aqui, isso é simplesmente o menor entre
 * agora e o fim do dia da ação.
 */
export function instanteDaRegra(dataAcao: Date, agora: Date): Date {
  const fimDoDia = new Date(dataAcao.getTime() + 24 * 60 * 60 * 1000 - 1);
  return fimDoDia.getTime() < agora.getTime() ? fimDoDia : agora;
}

interface TipoParaLancamento {
  id: string;
  nome: string;
  unidade: Unidade;
  ativo: boolean;
  exigeEvidencia: boolean;
  gincanaId: string;
  gincana: { id: string; status: StatusGincana; dataInicio: Date; dataFim: Date };
  regras: {
    id: string;
    pontosPorUnidade: Decimalish;
    vigenciaInicio: Date;
    vigenciaFim: Date | null;
  }[];
}

async function carregarTipoParaLancamento(
  cliente: Transacao,
  tipoAcaoId: string,
): Promise<TipoParaLancamento> {
  const tipo = await cliente.tipoAcao.findUnique({
    where: { id: tipoAcaoId },
    select: {
      id: true,
      nome: true,
      unidade: true,
      ativo: true,
      exigeEvidencia: true,
      gincanaId: true,
      gincana: { select: { id: true, status: true, dataInicio: true, dataFim: true } },
      regras: {
        select: { id: true, pontosPorUnidade: true, vigenciaInicio: true, vigenciaFim: true },
      },
    },
  });

  if (!tipo) {
    throw naoEncontrado('Tipo de ação não encontrado.');
  }

  return tipo;
}

/** Data inválida vira 400 com o detalhe no campo, igual ao que o zod produziria. */
function dataInvalida(mensagem: string): ErroDaAplicacao {
  return new ErroDaAplicacao(400, 'DADOS_INVALIDOS', 'Confira os campos informados.', {
    dataAcao: [mensagem],
  });
}

/**
 * Confere que a ação aconteceu num dia que vale: nem no futuro, nem fora da gincana.
 *
 * Dia futuro é erro de digitação (ou tentativa de antecipar ponto) e sai como 400, junto
 * do campo. Dia fora do período é um conflito com o cadastro da gincana e sai como 409,
 * dizendo qual é o período — sem isso, a pessoa fica tentando datas até acertar.
 */
function conferirDataAcao(dataAcao: Date, tipo: TipoParaLancamento, agora: Date): void {
  const hoje = paraDataDoBanco(paraDataDoContrato(agora));

  if (dataAcao.getTime() > hoje.getTime()) {
    throw dataInvalida('A data da ação não pode ser no futuro.');
  }

  const { dataInicio, dataFim } = tipo.gincana;
  if (dataAcao.getTime() < dataInicio.getTime() || dataAcao.getTime() > dataFim.getTime()) {
    throw conflito(
      'DATA_FORA_DO_PERIODO_DA_GINCANA',
      'A data da ação está fora do período da gincana, que vai de ' +
        `${paraDataDoContrato(dataInicio)} a ${paraDataDoContrato(dataFim)}.`,
    );
  }
}

function conferirTipoDisponivel(tipo: TipoParaLancamento): void {
  if (tipo.gincana.status !== 'ATIVA') {
    throw conflito(
      'GINCANA_NAO_ESTA_ATIVA',
      tipo.gincana.status === 'ENCERRADA'
        ? 'Esta gincana já foi encerrada e não aceita novos lançamentos.'
        : 'Esta gincana ainda não começou. Fale com a administradora.',
    );
  }

  if (!tipo.ativo) {
    throw conflito(
      'TIPO_DE_ACAO_INATIVO',
      `A ação "${tipo.nome}" está pausada e não aceita novos lançamentos.`,
    );
  }
}

interface PontuacaoResolvida {
  regraPontuacaoId: string;
  pontosPorUnidadeAplicado: number;
  pontosCalculados: number;
}

/**
 * Qual regra vale e quantos pontos a ação rende — tudo decidido pelo `@gincana/scoring`.
 *
 * A API não multiplica ponto por conta própria: o front mostra a prévia com a mesma
 * função, e as duas não podem divergir nem por arredondamento.
 */
function resolverPontuacao(
  tipo: TipoParaLancamento,
  quantidade: number,
  dataAcao: Date,
  agora: Date,
): PontuacaoResolvida {
  const regras: RegraParaCalculo[] = tipo.regras.map((regra) => ({
    id: regra.id,
    pontosPorUnidade: paraNumero(regra.pontosPorUnidade),
    vigenciaInicio: regra.vigenciaInicio,
    vigenciaFim: regra.vigenciaFim,
  }));

  try {
    const { pontos, regra } = calcularPontosNaData(
      quantidade,
      regras,
      instanteDaRegra(dataAcao, agora),
    );

    return {
      regraPontuacaoId: regra.id,
      pontosPorUnidadeAplicado: regra.pontosPorUnidade,
      pontosCalculados: pontos,
    };
  } catch (erro) {
    if (erro instanceof ErroDeCalculo) {
      throw conflito(
        'SEM_REGRA_DE_PONTUACAO_VIGENTE',
        `A ação "${tipo.nome}" não tinha pontuação cadastrada na data informada. ` +
          'Fale com a administradora antes de lançar.',
      );
    }
    throw erro;
  }
}

/** US06 — a prévia do formulário: calcula e não grava nada. */
export async function preverLancamento(dados: PreviaDeLancamento): Promise<ResultadoDaPrevia> {
  const agora = new Date();
  const dataAcao = paraDataDoBanco(dados.dataAcao);
  const tipo = await carregarTipoParaLancamento(prisma, dados.tipoAcaoId);

  conferirTipoDisponivel(tipo);
  conferirDataAcao(dataAcao, tipo, agora);

  const pontuacao = resolverPontuacao(tipo, dados.quantidade, dataAcao, agora);

  return {
    tipoAcaoId: tipo.id,
    quantidade: dados.quantidade,
    dataAcao: dados.dataAcao,
    unidade: tipo.unidade,
    regraPontuacaoId: pontuacao.regraPontuacaoId,
    pontosPorUnidade: pontuacao.pontosPorUnidadeAplicado,
    pontos: pontuacao.pontosCalculados,
    exigeEvidencia: tipo.exigeEvidencia,
  };
}

interface DonoDoLancamento {
  id: string;
  nome: string;
  ativo: boolean;
  equipeId: string | null;
}

async function carregarDono(cliente: Transacao, id: string): Promise<DonoDoLancamento> {
  const colaborador = await cliente.colaborador.findUnique({
    where: { id },
    select: { id: true, nome: true, ativo: true, equipeId: true },
  });

  if (!colaborador) {
    throw naoEncontrado('Colaborador não encontrado.');
  }

  return colaborador;
}

async function carregarComRelacoes(cliente: Transacao, id: string): Promise<LancamentoDoBanco> {
  const lancamento = await cliente.lancamento.findUnique({
    where: { id },
    select: selecaoDoLancamento,
  });

  if (!lancamento) {
    throw naoEncontrado('Lançamento não encontrado.');
  }

  return lancamento;
}

/**
 * US06 — registra a ação.
 *
 * A equipe sai do cadastro do colaborador **neste instante** e fica gravada no
 * lançamento: é o que garante que quem trocar de equipe no meio da gincana deixe os
 * pontos onde foram conquistados.
 */
export async function criarLancamento(
  usuario: UsuarioAutenticado,
  dados: CriarLancamento,
): Promise<Lancamento> {
  const agora = new Date();
  const dataAcao = paraDataDoBanco(dados.dataAcao);
  const colaboradorId = donoDoNovoLancamento(usuario, dados.colaboradorId);

  return prisma.$transaction(async (tx) => {
    const tipo = await carregarTipoParaLancamento(tx, dados.tipoAcaoId);
    conferirTipoDisponivel(tipo);
    conferirDataAcao(dataAcao, tipo, agora);

    const dono = await carregarDono(tx, colaboradorId);

    if (!dono.ativo) {
      throw conflito(
        'COLABORADOR_INATIVO',
        'Este colaborador está desativado e não pode receber lançamentos.',
      );
    }

    if (!dono.equipeId) {
      throw conflito(
        'COLABORADOR_SEM_EQUIPE',
        colaboradorId === usuario.id
          ? 'Você ainda não está em uma equipe. Fale com a administradora para entrar em uma.'
          : 'Este colaborador ainda não está em uma equipe.',
      );
    }

    const equipe = await tx.equipe.findUnique({
      where: { id: dono.equipeId },
      select: { id: true, gincanaId: true },
    });

    if (!equipe || equipe.gincanaId !== tipo.gincanaId) {
      throw conflito(
        'EQUIPE_DE_OUTRA_GINCANA',
        'A equipe do colaborador não participa da gincana desta ação.',
      );
    }

    const pontuacao = resolverPontuacao(tipo, dados.quantidade, dataAcao, agora);

    const criado = await tx.lancamento.create({
      data: {
        gincanaId: tipo.gincanaId,
        colaboradorId,
        equipeId: equipe.id,
        tipoAcaoId: tipo.id,
        quantidade: dados.quantidade,
        regraPontuacaoId: pontuacao.regraPontuacaoId,
        pontosPorUnidadeAplicado: pontuacao.pontosPorUnidadeAplicado,
        pontosCalculados: pontuacao.pontosCalculados,
        observacao: dados.observacao ?? null,
        dataAcao,
      },
      select: selecaoDoLancamento,
    });

    await registrarAuditoria(tx, {
      entidade: 'Lancamento',
      entidadeId: criado.id,
      acao: 'CRIACAO',
      autorId: usuario.id,
      valoresDepois: retratoDoLancamento(criado),
      descricao:
        colaboradorId === usuario.id
          ? `Lançamento de "${tipo.nome}" aguardando avaliação.`
          : `Lançamento de "${tipo.nome}" registrado em nome de ${dono.nome}.`,
    });

    return montarLancamento(criado);
  });
}

/**
 * US06 — a lista, já escopada pelo papel de quem consulta.
 *
 * O escopo entra no `where` antes dos filtros da consulta e os dois são combinados por
 * `AND`. Um colaborador que escreva `colaboradorId` de outra pessoa na barra de endereço
 * recebe lista vazia: a consulta pede "os meus E os dela", que não existe.
 */
export async function listarLancamentos(
  usuario: UsuarioAutenticado,
  filtros: ListarLancamentosQuery,
): Promise<PaginaDeLancamentos> {
  const where = {
    AND: [escopoDeLeituraDeLancamentos(usuario), filtrosDaConsulta(filtros)],
  };

  const [total, itens] = await Promise.all([
    prisma.lancamento.count({ where }),
    prisma.lancamento.findMany({
      where,
      select: selecaoDoLancamento,
      orderBy: [{ criadoEm: 'desc' }],
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
    }),
  ]);

  return {
    itens: itens.map(montarLancamento),
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    total,
    totalDePaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

/** US08 — a fila do avaliador. Mesmo escopo da lista, com o status fixo em PENDENTE. */
export async function listarPendentes(
  usuario: UsuarioAutenticado,
  filtros: FilaDePendentesQuery,
): Promise<PaginaDeLancamentos> {
  // Os mais antigos primeiro: quem está esperando há mais tempo é avaliado antes.
  const where = {
    AND: [
      escopoDeLeituraDeLancamentos(usuario),
      filtrosDaConsulta(filtros),
      { status: 'PENDENTE' as const },
    ],
  };

  const [total, itens] = await Promise.all([
    prisma.lancamento.count({ where }),
    prisma.lancamento.findMany({
      where,
      select: selecaoDoLancamento,
      orderBy: [{ criadoEm: 'asc' }],
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
    }),
  ]);

  return {
    itens: itens.map(montarLancamento),
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    total,
    totalDePaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
  };
}

/**
 * Um lançamento, se quem pede alcança esse lançamento.
 *
 * Fora do escopo a resposta é 404, não 403: quem não pode ver o lançamento também não
 * precisa saber que ele existe.
 */
export async function buscarLancamento(
  usuario: UsuarioAutenticado,
  id: string,
): Promise<Lancamento> {
  const lancamento = await prisma.lancamento.findFirst({
    where: { AND: [{ id }, escopoDeLeituraDeLancamentos(usuario)] },
    select: selecaoDoLancamento,
  });

  if (!lancamento) {
    throw naoEncontrado('Lançamento não encontrado.');
  }

  return montarLancamento(lancamento);
}

const paraPolicy = (lancamento: LancamentoDoBanco): LancamentoParaPolicy => ({
  id: lancamento.id,
  colaboradorId: lancamento.colaboradorId,
  equipeId: lancamento.equipeId,
  status: lancamento.status,
});

/**
 * US06 — a correção do lançamento.
 *
 * Duas coisas acontecem aqui e nenhuma delas é óbvia:
 *
 *  - **Correção de recusa volta para a fila.** Um lançamento RECUSADO que o dono corrige
 *    volta a PENDENTE e perde o motivo e o carimbo da avaliação anterior — é o "corrigir
 *    e reenviar" que o protótipo promete. A recusa em si não apagou nada: ela continua
 *    inteira na trilha de auditoria, com autor e motivo.
 *  - **O preço continua congelado.** Mudar a quantidade recalcula os pontos sobre o
 *    `pontosPorUnidadeAplicado` que já estava gravado, não sobre a regra de hoje. Só
 *    mudar a `dataAcao` faz o sistema escolher uma regra de novo — porque aí a ação passa
 *    a ter acontecido noutro dia, sob outra vigência.
 */
export async function atualizarLancamento(
  usuario: UsuarioAutenticado,
  id: string,
  dados: AtualizarLancamento,
): Promise<Lancamento> {
  const agora = new Date();

  return prisma.$transaction(async (tx) => {
    const atual = await carregarComRelacoes(tx, id);

    if (!podeEditarLancamento(usuario, paraPolicy(atual))) {
      throw atual.colaboradorId === usuario.id
        ? conflito(
            'LANCAMENTO_JA_APROVADO',
            'Este lançamento já foi aprovado e não pode mais ser alterado. ' +
              'Fale com a administradora se algo estiver errado.',
          )
        : semPermissao('Você só pode alterar os seus próprios lançamentos.');
    }

    const quantidade = dados.quantidade ?? paraNumero(atual.quantidade);
    const dataAcao = dados.dataAcao ? paraDataDoBanco(dados.dataAcao) : atual.dataAcao;
    const mudouData = dataAcao.getTime() !== atual.dataAcao.getTime();

    if (mudouData) {
      const tipo = await carregarTipoParaLancamento(tx, atual.tipoAcaoId);
      conferirDataAcao(dataAcao, tipo, agora);
    }

    const pontuacao = mudouData
      ? await recalcularComNovaData(tx, atual.tipoAcaoId, quantidade, dataAcao, agora)
      : {
          regraPontuacaoId: atual.regraPontuacaoId,
          pontosPorUnidadeAplicado: paraNumero(atual.pontosPorUnidadeAplicado),
          // Mesma regra congelada, quantidade nova: o cálculo continua sendo do scoring.
          pontosCalculados: calcularPontos(quantidade, paraNumero(atual.pontosPorUnidadeAplicado)),
        };

    const observacao =
      dados.observacao === undefined ? atual.observacao : (dados.observacao ?? null);

    // Correção de recusa devolve o lançamento para a fila do avaliador.
    const reenviado = atual.status === 'RECUSADO';

    const atualizado = await tx.lancamento.update({
      where: { id },
      data: {
        quantidade,
        dataAcao,
        observacao,
        regraPontuacaoId: pontuacao.regraPontuacaoId,
        pontosPorUnidadeAplicado: pontuacao.pontosPorUnidadeAplicado,
        pontosCalculados: pontuacao.pontosCalculados,
        ...(reenviado
          ? {
              status: 'PENDENTE' as const,
              motivoRecusa: null,
              avaliadoPorId: null,
              avaliadoEm: null,
            }
          : {}),
      },
      select: selecaoDoLancamento,
    });

    await registrarAuditoria(tx, {
      entidade: 'Lancamento',
      entidadeId: id,
      acao: 'ALTERACAO',
      autorId: usuario.id,
      valoresAntes: retratoDoLancamento(atual),
      valoresDepois: retratoDoLancamento(atualizado),
      descricao: reenviado
        ? 'Lançamento corrigido depois da recusa e devolvido para avaliação.'
        : atual.status === 'APROVADO'
          ? 'Alteração de lançamento já aprovado.'
          : 'Correção do lançamento pendente.',
    });

    return montarLancamento(atualizado);
  });
}

async function recalcularComNovaData(
  tx: Transacao,
  tipoAcaoId: string,
  quantidade: number,
  dataAcao: Date,
  agora: Date,
): Promise<PontuacaoResolvida> {
  const tipo = await carregarTipoParaLancamento(tx, tipoAcaoId);
  return resolverPontuacao(tipo, quantidade, dataAcao, agora);
}

/**
 * As travas comuns a aprovar e recusar.
 *
 * A ordem das recusas é deliberada: primeiro a permissão (403, porque a pessoa não devia
 * nem estar vendo este lançamento), depois as travas que valem para todo mundo (409).
 */
function conferirAvaliacao(usuario: UsuarioAutenticado, lancamento: LancamentoDoBanco): void {
  if (!podeAvaliarLancamento(usuario, paraPolicy(lancamento))) {
    throw semPermissao('Você só pode avaliar lançamentos da sua equipe.');
  }

  if (ehAutoAvaliacao(usuario, lancamento)) {
    throw conflito(
      'NAO_PODE_AVALIAR_PROPRIO_LANCAMENTO',
      'Você não pode avaliar um lançamento seu. Peça a outra pessoa com permissão.',
    );
  }

  if (lancamento.status !== 'PENDENTE') {
    throw conflito(
      'LANCAMENTO_JA_AVALIADO',
      lancamento.status === 'APROVADO'
        ? 'Este lançamento já foi aprovado.'
        : 'Este lançamento já foi recusado.',
    );
  }
}

/** US08 — aprovar. Só o líder da própria equipe ou a administradora, e nunca o próprio. */
export async function aprovarLancamento(
  usuario: UsuarioAutenticado,
  id: string,
  dados: AprovarLancamento,
): Promise<Lancamento> {
  return prisma.$transaction(async (tx) => {
    const atual = await carregarComRelacoes(tx, id);
    conferirAvaliacao(usuario, atual);

    // O tipo exige comprovante: sem ele a aprovação não tem o que sustentar na auditoria.
    if (atual.tipoAcao.exigeEvidencia && atual.evidencias.length === 0) {
      throw conflito(
        'EVIDENCIA_OBRIGATORIA',
        `A ação "${atual.tipoAcao.nome}" exige comprovante e este lançamento não tem nenhum. ` +
          'Peça o comprovante ao colaborador ou recuse explicando o motivo.',
      );
    }

    const aprovado = await tx.lancamento.update({
      where: { id },
      data: {
        status: 'APROVADO',
        avaliadoPorId: usuario.id,
        avaliadoEm: new Date(),
        motivoRecusa: null,
      },
      select: selecaoDoLancamento,
    });

    await registrarAuditoria(tx, {
      entidade: 'Lancamento',
      entidadeId: id,
      acao: 'APROVACAO',
      autorId: usuario.id,
      valoresAntes: retratoDoLancamento(atual),
      valoresDepois: retratoDoLancamento(aprovado),
      descricao: dados.observacao
        ? `Lançamento aprovado: ${dados.observacao}`
        : `Lançamento aprovado, somando ${aprovado.pontosCalculados} pontos à equipe.`,
    });

    return montarLancamento(aprovado);
  });
}

/**
 * US08 — recusar.
 *
 * Recusar não apaga nada: o lançamento fica RECUSADO com o motivo, o colaborador lê o que
 * precisa corrigir e pode reenviar pela correção. O motivo é obrigatório justamente para
 * que "Foto sem a etiqueta da ONG" chegue a quem pode resolver.
 */
export async function recusarLancamento(
  usuario: UsuarioAutenticado,
  id: string,
  dados: RecusarLancamento,
): Promise<Lancamento> {
  return prisma.$transaction(async (tx) => {
    const atual = await carregarComRelacoes(tx, id);
    conferirAvaliacao(usuario, atual);

    const recusado = await tx.lancamento.update({
      where: { id },
      data: {
        status: 'RECUSADO',
        avaliadoPorId: usuario.id,
        avaliadoEm: new Date(),
        motivoRecusa: dados.motivoRecusa,
      },
      select: selecaoDoLancamento,
    });

    await registrarAuditoria(tx, {
      entidade: 'Lancamento',
      entidadeId: id,
      acao: 'RECUSA',
      autorId: usuario.id,
      valoresAntes: retratoDoLancamento(atual),
      valoresDepois: { ...retratoDoLancamento(recusado), motivoRecusa: dados.motivoRecusa },
      descricao: `Lançamento recusado: ${dados.motivoRecusa}`,
    });

    return montarLancamento(recusado);
  });
}
