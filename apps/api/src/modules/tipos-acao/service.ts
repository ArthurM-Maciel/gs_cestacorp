import type {
  AtualizarTipoAcao,
  CriarTipoAcao,
  ListarTiposAcaoQuery,
  NovaRegra,
  RegraPontuacao,
  TipoAcao,
  TipoAcaoComHistorico,
  Unidade,
  UsuarioAutenticado,
} from '@gincana/contracts';
import { selecionarRegraVigente, type RegraPontuacao as RegraParaCalculo } from '@gincana/scoring';

import { prisma, type Transacao } from '../../db.js';
import { conflito, naoEncontrado } from '../../middlewares/erros.js';
import { comUnicidade } from '../../prisma-erros.js';
import { registrarAuditoria } from '../auditoria/registrar.js';

import { escopoDaListaDeTiposAcao, escopoDoTipoAcao } from './policy.js';

/**
 * US04 — a administradora cadastra tipos de ação com a regra de pontos.
 *
 * O arquivo inteiro gira em torno de uma frase que o protótipo mostra à cliente:
 * "Mudanças valem só para lançamentos novos e ficam registradas no histórico."
 *
 * Daí as três decisões que não se negociam aqui:
 *
 *  - `pontosPorUnidade` de uma regra gravada nunca é alterado. Trocar a pontuação é
 *    fechar a vigência da regra atual e abrir a próxima **no mesmo instante** — sem
 *    buraco e sem sobreposição, porque `selecionarRegraVigente` trata a vigência como
 *    fechada no início e aberta no fim.
 *  - Toda troca grava auditoria dentro da mesma transação, com antes e depois. É o que a
 *    US09 exibe e o que sustenta o selo PQCRS.
 *  - Quem decide qual regra vale numa data é o pacote `@gincana/scoring`, o mesmo que o
 *    front usa na prévia de pontos. Nada de recalcular vigência por aqui.
 *
 * Atividade extra criada no meio da gincana é só mais um tipo de ação: não existe nenhum
 * caminho neste módulo que olhe para o nome da ação.
 */

const selecaoDaRegra = {
  id: true,
  tipoAcaoId: true,
  pontosPorUnidade: true,
  vigenciaInicio: true,
  vigenciaFim: true,
  criadoPorId: true,
} as const;

/** Histórico da mais recente para a mais antiga: é a ordem em que a tela mostra. */
const selecaoDoTipo = {
  id: true,
  gincanaId: true,
  nome: true,
  descricao: true,
  unidade: true,
  exigeEvidencia: true,
  ativo: true,
  regras: { select: selecaoDaRegra, orderBy: { vigenciaInicio: 'desc' } },
} as const;

interface RegraDoBanco {
  id: string;
  tipoAcaoId: string;
  /** Vem como `Decimal` do Prisma; vira número só na borda, em `montarRegra`. */
  pontosPorUnidade: { toString: () => string };
  vigenciaInicio: Date;
  vigenciaFim: Date | null;
  criadoPorId: string;
}

interface TipoDoBanco {
  id: string;
  gincanaId: string;
  nome: string;
  descricao: string | null;
  unidade: Unidade;
  exigeEvidencia: boolean;
  ativo: boolean;
  regras: RegraDoBanco[];
}

/** Identificação do tipo usada nas regras, sem arrastar o histórico junto. */
interface TipoBasico {
  id: string;
  nome: string;
  gincanaId: string;
  ativo: boolean;
}

const nomeDuplicado = (nome: string) =>
  conflito(
    'NOME_DE_TIPO_DUPLICADO',
    `Já existe um tipo de ação chamado "${nome}" nesta gincana. ` +
      'Use outro nome ou edite o que já está cadastrado.',
  );

function paraNumero(pontos: RegraDoBanco['pontosPorUnidade']): number {
  return Number(pontos.toString());
}

function montarRegra(regra: RegraDoBanco): RegraPontuacao {
  return {
    id: regra.id,
    tipoAcaoId: regra.tipoAcaoId,
    pontosPorUnidade: paraNumero(regra.pontosPorUnidade),
    vigenciaInicio: regra.vigenciaInicio.toISOString(),
    vigenciaFim: regra.vigenciaFim?.toISOString() ?? null,
    criadoPorId: regra.criadoPorId,
  };
}

function paraCalculo(regra: RegraDoBanco): RegraParaCalculo {
  return {
    id: regra.id,
    pontosPorUnidade: paraNumero(regra.pontosPorUnidade),
    vigenciaInicio: regra.vigenciaInicio,
    vigenciaFim: regra.vigenciaFim,
  };
}

/**
 * Qual regra vale numa data, decidido pelo `@gincana/scoring`.
 *
 * A seleção passa pelo pacote compartilhado de propósito: se a API escolhesse a regra por
 * conta própria, a prévia de pontos do front e o valor gravado poderiam divergir.
 */
function regraVigenteEm(regras: readonly RegraDoBanco[], data: Date): RegraDoBanco | null {
  const escolhida = selecionarRegraVigente(regras.map(paraCalculo), data);

  return escolhida ? (regras.find((regra) => regra.id === escolhida.id) ?? null) : null;
}

function montarTipo(tipo: TipoDoBanco, agora: Date): TipoAcao {
  const vigente = regraVigenteEm(tipo.regras, agora);

  return {
    id: tipo.id,
    gincanaId: tipo.gincanaId,
    nome: tipo.nome,
    descricao: tipo.descricao,
    unidade: tipo.unidade,
    exigeEvidencia: tipo.exigeEvidencia,
    ativo: tipo.ativo,
    regraVigente: vigente ? montarRegra(vigente) : null,
  };
}

function montarTipoComHistorico(tipo: TipoDoBanco, agora: Date): TipoAcaoComHistorico {
  return { ...montarTipo(tipo, agora), regras: tipo.regras.map(montarRegra) };
}

async function exigirGincana(cliente: Transacao, id: string): Promise<void> {
  const gincana = await cliente.gincana.findUnique({ where: { id }, select: { id: true } });

  if (!gincana) {
    throw naoEncontrado('Gincana não encontrada.');
  }
}

async function exigirTipo(cliente: Transacao, id: string): Promise<TipoBasico> {
  const tipo = await cliente.tipoAcao.findUnique({
    where: { id },
    select: { id: true, nome: true, gincanaId: true, ativo: true },
  });

  if (!tipo) {
    throw naoEncontrado('Tipo de ação não encontrado.');
  }

  return tipo;
}

async function carregarTipo(
  cliente: Transacao,
  id: string,
  agora: Date,
): Promise<TipoAcaoComHistorico> {
  const tipo = await cliente.tipoAcao.findUnique({ where: { id }, select: selecaoDoTipo });

  if (!tipo) {
    throw naoEncontrado('Tipo de ação não encontrado.');
  }

  return montarTipoComHistorico(tipo, agora);
}

/** Retrato da regra usado na auditoria: pontos e vigências, que é o que a US09 exibe. */
function retratoDaRegra(regra: RegraDoBanco) {
  return {
    regraId: regra.id,
    pontosPorUnidade: paraNumero(regra.pontosPorUnidade),
    vigenciaInicio: regra.vigenciaInicio.toISOString(),
    vigenciaFim: regra.vigenciaFim?.toISOString() ?? null,
  };
}

/**
 * Cadastra o tipo de ação e a sua primeira regra de pontuação.
 *
 * As duas coisas nascem na mesma transação porque um tipo sem regra não pode ser usado em
 * lançamento nenhum: ficaria visível no formulário e explodiria no cálculo.
 */
export async function criarTipoAcao(
  gincanaId: string,
  dados: CriarTipoAcao,
  autorId: string,
): Promise<TipoAcaoComHistorico> {
  const agora = new Date();
  const vigenciaInicio = dados.vigenciaInicio ? new Date(dados.vigenciaInicio) : agora;

  return prisma.$transaction(async (tx) => {
    await exigirGincana(tx, gincanaId);

    const tipo = await comUnicidade(
      () =>
        tx.tipoAcao.create({
          data: {
            gincanaId,
            nome: dados.nome,
            descricao: dados.descricao ?? null,
            unidade: dados.unidade,
            exigeEvidencia: dados.exigeEvidencia,
          },
          select: { id: true, nome: true },
        }),
      () => nomeDuplicado(dados.nome),
    );

    await registrarAuditoria(tx, {
      entidade: 'TipoAcao',
      entidadeId: tipo.id,
      acao: 'CRIACAO',
      autorId,
      valoresDepois: {
        nome: dados.nome,
        descricao: dados.descricao ?? null,
        unidade: dados.unidade,
        exigeEvidencia: dados.exigeEvidencia,
        ativo: true,
      },
      descricao: `Cadastro do tipo de ação "${dados.nome}".`,
    });

    const regra = await tx.regraPontuacao.create({
      data: {
        tipoAcaoId: tipo.id,
        pontosPorUnidade: dados.pontosPorUnidade,
        vigenciaInicio,
        criadoPorId: autorId,
      },
      select: selecaoDaRegra,
    });

    await registrarAuditoria(tx, {
      entidade: 'RegraPontuacao',
      entidadeId: regra.id,
      acao: 'CRIACAO',
      autorId,
      valoresDepois: { tipoAcaoId: tipo.id, ...retratoDaRegra(regra) },
      descricao: `Primeira regra de pontuação de "${dados.nome}".`,
    });

    return carregarTipo(tx, tipo.id, agora);
  });
}

/**
 * Lista os tipos de uma gincana com a pontuação que vale **hoje**.
 *
 * É o que a tela de registrar ação mostra: nem a primeira regra cadastrada, nem a última
 * — a que vigora no instante da consulta. Regra agendada para o futuro fica guardada no
 * histórico e só aparece aqui quando a vigência dela começa.
 */
export async function listarTiposAcao(
  usuario: UsuarioAutenticado,
  gincanaId: string,
  filtros: ListarTiposAcaoQuery,
): Promise<TipoAcao[]> {
  await exigirGincana(prisma, gincanaId);

  const agora = new Date();
  const tipos = await prisma.tipoAcao.findMany({
    where: escopoDaListaDeTiposAcao(usuario, gincanaId, filtros),
    select: selecaoDoTipo,
    orderBy: { nome: 'asc' },
  });

  return tipos.map((tipo) => montarTipo(tipo, agora));
}

export async function buscarTipoAcao(
  usuario: UsuarioAutenticado,
  id: string,
): Promise<TipoAcaoComHistorico> {
  const tipo = await prisma.tipoAcao.findFirst({
    where: escopoDoTipoAcao(usuario, id),
    select: selecaoDoTipo,
  });

  if (!tipo) {
    throw naoEncontrado('Tipo de ação não encontrado.');
  }

  return montarTipoComHistorico(tipo, new Date());
}

/**
 * Altera a identidade do tipo de ação — nunca o preço dele.
 *
 * Pausar (`ativo: false`) não apaga nem altera uma linha do histórico: o tipo some do
 * formulário de quem registra ação e continua valendo para tudo que já foi lançado.
 */
export async function atualizarTipoAcao(
  id: string,
  dados: AtualizarTipoAcao,
  autorId: string,
): Promise<TipoAcaoComHistorico> {
  const agora = new Date();

  return prisma.$transaction(async (tx) => {
    const atual = await tx.tipoAcao.findUnique({
      where: { id },
      select: { id: true, nome: true, descricao: true, exigeEvidencia: true, ativo: true },
    });

    if (!atual) {
      throw naoEncontrado('Tipo de ação não encontrado.');
    }

    const antes: Record<string, string | boolean | null> = {};
    const depois: Record<string, string | boolean | null> = {};

    if (dados.nome !== undefined && dados.nome !== atual.nome) {
      antes.nome = atual.nome;
      depois.nome = dados.nome;
    }

    // `descricao: null` limpa o campo; ausente não mexe no que está gravado.
    const novaDescricao = dados.descricao === undefined ? undefined : (dados.descricao ?? null);
    if (novaDescricao !== undefined && novaDescricao !== atual.descricao) {
      antes.descricao = atual.descricao;
      depois.descricao = novaDescricao;
    }

    if (dados.exigeEvidencia !== undefined && dados.exigeEvidencia !== atual.exigeEvidencia) {
      antes.exigeEvidencia = atual.exigeEvidencia;
      depois.exigeEvidencia = dados.exigeEvidencia;
    }

    if (dados.ativo !== undefined && dados.ativo !== atual.ativo) {
      antes.ativo = atual.ativo;
      depois.ativo = dados.ativo;
    }

    if (Object.keys(depois).length === 0) {
      // Nada mudou de fato: não suja a trilha de auditoria com linha vazia.
      return carregarTipo(tx, id, agora);
    }

    await comUnicidade(
      () =>
        tx.tipoAcao.update({
          where: { id },
          data: {
            nome: dados.nome,
            descricao: novaDescricao,
            exigeEvidencia: dados.exigeEvidencia,
            ativo: dados.ativo,
          },
        }),
      () => nomeDuplicado(dados.nome ?? atual.nome),
    );

    await registrarAuditoria(tx, {
      entidade: 'TipoAcao',
      entidadeId: id,
      acao: 'ALTERACAO',
      autorId,
      valoresAntes: antes,
      valoresDepois: depois,
      descricao: descreverAlteracao(atual.nome, dados.ativo, atual.ativo),
    });

    return carregarTipo(tx, id, agora);
  });
}

function descreverAlteracao(nome: string, novoAtivo?: boolean, ativoAtual?: boolean): string {
  if (novoAtivo !== undefined && novoAtivo !== ativoAtual) {
    return novoAtivo
      ? `O tipo de ação "${nome}" voltou a aceitar novos lançamentos.`
      : `O tipo de ação "${nome}" foi pausado e não aceita novos lançamentos.`;
  }

  return `Alteração do cadastro do tipo de ação "${nome}".`;
}

/**
 * A troca de pontuação.
 *
 * Fecha a vigência da regra atual exatamente no instante em que a nova começa e grava a
 * auditoria — tudo na mesma transação. O que já foi lançado continua apontando para a
 * regra antiga, com o valor congelado no lançamento: é assim que "mudanças valem só para
 * lançamentos novos" deixa de ser promessa de tela e vira comportamento do banco.
 */
export async function registrarNovaRegra(
  tipoAcaoId: string,
  dados: NovaRegra,
  autorId: string,
): Promise<TipoAcaoComHistorico> {
  const agora = new Date();
  const vigenciaInicio = dados.vigenciaInicio ? new Date(dados.vigenciaInicio) : agora;

  return prisma.$transaction(async (tx) => {
    const tipo = await exigirTipo(tx, tipoAcaoId);

    // A regra atual é a de vigência aberta. Cadastro consistente tem no máximo uma.
    const atual = await tx.regraPontuacao.findFirst({
      where: { tipoAcaoId, vigenciaFim: null },
      select: selecaoDaRegra,
      orderBy: { vigenciaInicio: 'desc' },
    });

    if (atual && vigenciaInicio.getTime() < atual.vigenciaInicio.getTime()) {
      throw conflito(
        'VIGENCIA_ANTERIOR_A_REGRA_ATUAL',
        'A nova pontuação não pode começar antes da regra que está valendo, que começou em ' +
          `${atual.vigenciaInicio.toISOString()}. ` +
          'A pontuação já apurada não é recalculada: escolha agora ou uma data futura.',
      );
    }

    if (atual) {
      await tx.regraPontuacao.update({
        where: { id: atual.id },
        data: { vigenciaFim: vigenciaInicio },
      });
    }

    const nova = await tx.regraPontuacao.create({
      data: {
        tipoAcaoId,
        pontosPorUnidade: dados.pontosPorUnidade,
        vigenciaInicio,
        criadoPorId: autorId,
      },
      select: selecaoDaRegra,
    });

    await registrarAuditoria(tx, {
      entidade: 'RegraPontuacao',
      entidadeId: nova.id,
      acao: 'ALTERACAO',
      autorId,
      valoresAntes: atual
        ? { tipoAcaoId, ...retratoDaRegra(atual), vigenciaFim: vigenciaInicio.toISOString() }
        : { tipoAcaoId, regraId: null, pontosPorUnidade: null },
      valoresDepois: { tipoAcaoId, ...retratoDaRegra(nova) },
      descricao: dados.motivo
        ? `Nova pontuação de "${tipo.nome}": ${dados.motivo}`
        : `Nova pontuação de "${tipo.nome}".`,
    });

    return carregarTipo(tx, tipoAcaoId, agora);
  });
}

/** Histórico completo de vigências, da mais recente para a mais antiga. */
export async function listarRegras(tipoAcaoId: string): Promise<RegraPontuacao[]> {
  await exigirTipo(prisma, tipoAcaoId);

  const regras = await prisma.regraPontuacao.findMany({
    where: { tipoAcaoId },
    select: selecaoDaRegra,
    orderBy: { vigenciaInicio: 'desc' },
  });

  return regras.map(montarRegra);
}
