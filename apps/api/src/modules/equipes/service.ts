import type { AtualizarEquipe, CriarEquipe, Equipe, Papel } from '@gincana/contracts';

import { prisma, type Transacao } from '../../db.js';
import { conflito, naoEncontrado } from '../../middlewares/erros.js';
import { comUnicidade } from '../../prisma-erros.js';
import { registrarAuditoria } from '../auditoria/registrar.js';

/**
 * US03 — a administradora cadastra equipes e vincula colaboradores.
 *
 * Nenhuma rota daqui mexe em pontuação, mas três mudanças entram na trilha de auditoria
 * assim mesmo: troca de líder, mudança de equipe e mudança de papel. São elas que, depois
 * da apuração, explicam por que o placar ficou do jeito que ficou.
 */

/** Nunca seleciona `senhaHash`: nada do que sai daqui pode carregar credencial. */
const selecaoDoMembro = {
  id: true,
  nome: true,
  papel: true,
  ativo: true,
  equipeId: true,
  equipeLiderada: { select: { id: true, nome: true } },
} as const;

const selecaoDaEquipe = {
  id: true,
  nome: true,
  gincanaId: true,
  liderId: true,
  lider: { select: { id: true, nome: true } },
  // A gincana tem 13 colaboradores: carregar os ids da equipe é mais barato que um
  // `_count` por linha e deixa o total de membros exato mesmo sem o líder vinculado.
  membros: { select: { id: true } },
} as const;

interface EquipeDoBanco {
  id: string;
  nome: string;
  gincanaId: string;
  liderId: string | null;
  lider: { id: string; nome: string } | null;
  membros: { id: string }[];
}

interface MembroDoBanco {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  equipeId: string | null;
  equipeLiderada: { id: string; nome: string } | null;
}

/** Identificação da equipe usada nas regras, sem arrastar a lista de membros junto. */
interface EquipeBasica {
  id: string;
  nome: string;
  liderId: string | null;
}

function montarEquipe(equipe: EquipeDoBanco): Equipe {
  return {
    id: equipe.id,
    nome: equipe.nome,
    gincanaId: equipe.gincanaId,
    lider: equipe.lider,
    // O contrato pede o total sem contar quem lidera.
    totalMembros: equipe.membros.filter((membro) => membro.id !== equipe.liderId).length,
  };
}

const nomeDuplicado = (nome: string) =>
  conflito('NOME_DE_EQUIPE_DUPLICADO', `Já existe uma equipe chamada "${nome}" nesta gincana.`);

function listarNomes(pessoas: readonly { nome: string }[]): string {
  return pessoas.map((pessoa) => pessoa.nome).join(', ');
}

async function carregarEquipe(cliente: Transacao, id: string): Promise<Equipe> {
  const equipe = await cliente.equipe.findUnique({ where: { id }, select: selecaoDaEquipe });

  if (!equipe) {
    throw naoEncontrado('Equipe não encontrada.');
  }

  return montarEquipe(equipe);
}

async function exigirEquipe(cliente: Transacao, id: string): Promise<EquipeBasica> {
  const equipe = await cliente.equipe.findUnique({
    where: { id },
    select: { id: true, nome: true, liderId: true },
  });

  if (!equipe) {
    throw naoEncontrado('Equipe não encontrada.');
  }

  return equipe;
}

async function exigirGincana(cliente: Transacao, id: string): Promise<void> {
  const gincana = await cliente.gincana.findUnique({ where: { id }, select: { id: true } });

  if (!gincana) {
    throw naoEncontrado('Gincana não encontrada.');
  }
}

/**
 * Quem deixa de liderar volta a ser colaborador comum.
 *
 * Papel de líder sem equipe abriria as telas de avaliação para alguém que não tem nada
 * para avaliar. A administradora que também liderava continua ADMIN: o papel dela não é
 * consequência de liderar equipe.
 */
async function demitirLiderAtual(
  tx: Transacao,
  equipe: EquipeBasica,
  autorId: string,
): Promise<void> {
  if (!equipe.liderId) {
    return;
  }

  const anterior = await tx.colaborador.findUnique({
    where: { id: equipe.liderId },
    select: { id: true, papel: true },
  });

  if (!anterior || anterior.papel !== 'LIDER') {
    return;
  }

  await tx.colaborador.update({ where: { id: anterior.id }, data: { papel: 'COLABORADOR' } });
  await registrarAuditoria(tx, {
    entidade: 'Colaborador',
    entidadeId: anterior.id,
    acao: 'ALTERACAO',
    autorId,
    valoresAntes: { papel: anterior.papel },
    valoresDepois: { papel: 'COLABORADOR' },
    descricao: `Deixou de liderar a equipe ${equipe.nome}.`,
  });
}

/**
 * Define quem lidera a equipe.
 *
 * Três coisas acontecem juntas, ou nenhuma acontece: a equipe passa a apontar para a
 * pessoa, a pessoa vira membro da própria equipe com papel de líder, e a auditoria
 * registra as duas mudanças.
 */
async function definirLider(
  tx: Transacao,
  equipe: EquipeBasica,
  liderId: string,
  autorId: string,
): Promise<void> {
  if (equipe.liderId === liderId) {
    return;
  }

  const pessoa = await tx.colaborador.findUnique({
    where: { id: liderId },
    select: selecaoDoMembro,
  });

  if (!pessoa) {
    throw naoEncontrado('Colaborador não encontrado.');
  }

  if (!pessoa.ativo) {
    throw conflito(
      'COLABORADOR_INATIVO',
      `${pessoa.nome} está desativado e não pode liderar uma equipe.`,
    );
  }

  if (pessoa.equipeLiderada && pessoa.equipeLiderada.id !== equipe.id) {
    throw conflito(
      'JA_LIDERA_OUTRA_EQUIPE',
      `${pessoa.nome} já lidera a equipe "${pessoa.equipeLiderada.nome}". ` +
        'Troque o líder de lá antes de trazer esta pessoa.',
    );
  }

  await demitirLiderAtual(tx, equipe, autorId);

  await comUnicidade(
    () => tx.equipe.update({ where: { id: equipe.id }, data: { liderId: pessoa.id } }),
    () =>
      conflito(
        'JA_LIDERA_OUTRA_EQUIPE',
        `${pessoa.nome} já lidera outra equipe. Troque o líder de lá antes de trazer ` +
          'esta pessoa.',
      ),
  );
  await registrarAuditoria(tx, {
    entidade: 'Equipe',
    entidadeId: equipe.id,
    acao: 'ALTERACAO',
    autorId,
    valoresAntes: { liderId: equipe.liderId },
    valoresDepois: { liderId: pessoa.id },
    descricao: `Troca de líder da equipe ${equipe.nome}.`,
  });

  // O líder precisa ser membro da própria equipe, senão a avaliação olha para um time
  // do qual ele não faz parte.
  const papel: Papel = pessoa.papel === 'ADMIN' ? 'ADMIN' : 'LIDER';

  if (pessoa.papel !== papel || pessoa.equipeId !== equipe.id) {
    await tx.colaborador.update({
      where: { id: pessoa.id },
      data: { papel, equipeId: equipe.id },
    });
    await registrarAuditoria(tx, {
      entidade: 'Colaborador',
      entidadeId: pessoa.id,
      acao: 'ALTERACAO',
      autorId,
      valoresAntes: { papel: pessoa.papel, equipeId: pessoa.equipeId },
      valoresDepois: { papel, equipeId: equipe.id },
      descricao: `Passou a liderar a equipe ${equipe.nome}.`,
    });
  }
}

async function removerLider(tx: Transacao, equipe: EquipeBasica, autorId: string): Promise<void> {
  if (!equipe.liderId) {
    return;
  }

  await demitirLiderAtual(tx, equipe, autorId);
  await tx.equipe.update({ where: { id: equipe.id }, data: { liderId: null } });
  await registrarAuditoria(tx, {
    entidade: 'Equipe',
    entidadeId: equipe.id,
    acao: 'ALTERACAO',
    autorId,
    valoresAntes: { liderId: equipe.liderId },
    valoresDepois: { liderId: null },
    descricao: `A equipe ${equipe.nome} ficou sem líder.`,
  });
}

export async function criarEquipe(
  gincanaId: string,
  dados: CriarEquipe,
  autorId: string,
): Promise<Equipe> {
  return prisma.$transaction(async (tx) => {
    await exigirGincana(tx, gincanaId);

    const equipe = await comUnicidade(
      () =>
        tx.equipe.create({
          data: { nome: dados.nome, gincanaId },
          select: { id: true, nome: true, liderId: true },
        }),
      () => nomeDuplicado(dados.nome),
    );

    if (dados.liderId) {
      await definirLider(tx, equipe, dados.liderId, autorId);
    }

    return carregarEquipe(tx, equipe.id);
  });
}

/** Qualquer pessoa autenticada vê as equipes: o placar é da gincana inteira. */
export async function listarEquipes(gincanaId: string): Promise<Equipe[]> {
  await exigirGincana(prisma, gincanaId);

  const equipes = await prisma.equipe.findMany({
    where: { gincanaId },
    select: selecaoDaEquipe,
    orderBy: { nome: 'asc' },
  });

  return equipes.map(montarEquipe);
}

export async function atualizarEquipe(
  id: string,
  dados: AtualizarEquipe,
  autorId: string,
): Promise<Equipe> {
  return prisma.$transaction(async (tx) => {
    let equipe = await exigirEquipe(tx, id);
    const novoNome = dados.nome;

    if (novoNome && novoNome !== equipe.nome) {
      await comUnicidade(
        () => tx.equipe.update({ where: { id }, data: { nome: novoNome } }),
        () => nomeDuplicado(novoNome),
      );
      // Recarrega antes de mexer na liderança: a auditoria é o artefato do selo de
      // qualidade e não pode descrever a troca usando o nome que a equipe acabou de
      // deixar de ter.
      equipe = await exigirEquipe(tx, id);
    }

    // `liderId` ausente não mexe em quem lidera; `liderId: null` tira o líder atual.
    if ('liderId' in dados) {
      if (dados.liderId) {
        await definirLider(tx, equipe, dados.liderId, autorId);
      } else {
        await removerLider(tx, equipe, autorId);
      }
    }

    return carregarEquipe(tx, id);
  });
}

/**
 * Vincula colaboradores à equipe.
 *
 * Quem já estava em outra equipe é movido, e isso é mudança sensível: entra na auditoria
 * com a equipe de origem e a de destino.
 */
export async function vincularMembros(
  equipeId: string,
  colaboradorIds: readonly string[],
  autorId: string,
): Promise<Equipe> {
  return prisma.$transaction(async (tx) => {
    const equipe = await exigirEquipe(tx, equipeId);
    const ids = [...new Set(colaboradorIds)];

    const pessoas: MembroDoBanco[] = await tx.colaborador.findMany({
      where: { id: { in: ids } },
      select: selecaoDoMembro,
    });

    if (pessoas.length !== ids.length) {
      throw naoEncontrado('Não encontrei um ou mais dos colaboradores informados.');
    }

    const inativos = pessoas.filter((pessoa) => !pessoa.ativo);
    if (inativos.length > 0) {
      throw conflito(
        'COLABORADOR_INATIVO',
        `Só dá para vincular quem está ativo. Reative antes: ${listarNomes(inativos)}.`,
      );
    }

    // Mover alguém que lidera outra equipe deixaria essa equipe com um líder de fora.
    const lideresDeOutras = pessoas.filter(
      (pessoa) => pessoa.equipeLiderada && pessoa.equipeLiderada.id !== equipeId,
    );
    if (lideresDeOutras.length > 0) {
      throw conflito(
        'LIDERA_OUTRA_EQUIPE',
        `${listarNomes(lideresDeOutras)} lidera outra equipe. Troque o líder de lá antes de mover.`,
      );
    }

    for (const pessoa of pessoas) {
      if (pessoa.equipeId === equipeId) {
        continue;
      }

      await tx.colaborador.update({ where: { id: pessoa.id }, data: { equipeId } });
      await registrarAuditoria(tx, {
        entidade: 'Colaborador',
        entidadeId: pessoa.id,
        acao: 'ALTERACAO',
        autorId,
        valoresAntes: { equipeId: pessoa.equipeId },
        valoresDepois: { equipeId },
        descricao: pessoa.equipeId
          ? `Mudou de equipe e passou a integrar a equipe ${equipe.nome}.`
          : `Entrou na equipe ${equipe.nome}.`,
      });
    }

    return carregarEquipe(tx, equipeId);
  });
}

/**
 * Desfaz o vínculo, sem apagar o colaborador: o histórico de quem já pontuou precisa
 * continuar de pé.
 */
export async function removerMembro(
  equipeId: string,
  colaboradorId: string,
  autorId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const equipe = await exigirEquipe(tx, equipeId);

    const pessoa = await tx.colaborador.findUnique({
      where: { id: colaboradorId },
      select: selecaoDoMembro,
    });

    if (!pessoa || pessoa.equipeId !== equipeId) {
      throw naoEncontrado('Este colaborador não está nesta equipe.');
    }

    if (equipe.liderId === pessoa.id) {
      throw conflito(
        'LIDER_DA_EQUIPE',
        `${pessoa.nome} lidera a equipe ${equipe.nome}. Troque o líder antes de remover.`,
      );
    }

    await tx.colaborador.update({ where: { id: pessoa.id }, data: { equipeId: null } });
    await registrarAuditoria(tx, {
      entidade: 'Colaborador',
      entidadeId: pessoa.id,
      acao: 'ALTERACAO',
      autorId,
      valoresAntes: { equipeId: equipeId },
      valoresDepois: { equipeId: null },
      descricao: `Saiu da equipe ${equipe.nome}.`,
    });
  });
}
