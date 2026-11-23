import type {
  AtualizarGincana,
  CriarGincana,
  Gincana,
  UsuarioAutenticado,
} from '@gincana/contracts';

import { prisma } from '../../db.js';
import { ErroDaAplicacao, conflito, naoEncontrado, semPermissao } from '../../middlewares/erros.js';
import { comUnicidade } from '../../prisma-erros.js';
import { registrarAuditoria } from '../auditoria/registrar.js';

import { podeAtualizarGincana } from './policy.js';

/** O que lemos do banco. A gincana não tem campo sensível, mas o `select` é explícito. */
const selecaoDaGincana = {
  id: true,
  ano: true,
  nome: true,
  dataInicio: true,
  dataFim: true,
  status: true,
  placarVisivel: true,
} as const;

interface GincanaDoBanco {
  id: string;
  ano: number;
  nome: string;
  dataInicio: Date;
  dataFim: Date;
  status: Gincana['status'];
  placarVisivel: boolean;
}

/**
 * O contrato troca datas como `AAAA-MM-DD`, sem hora e sem fuso: a gincana começa e
 * termina num dia do calendário, não num instante. A coluna é `date` no Postgres, então
 * gravamos meia-noite em UTC para o dia não escorregar por causa do fuso de quem envia.
 */
export function paraDataDoBanco(data: string): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

export function paraDataDoContrato(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function montarGincana(gincana: GincanaDoBanco): Gincana {
  return {
    id: gincana.id,
    ano: gincana.ano,
    nome: gincana.nome,
    dataInicio: paraDataDoContrato(gincana.dataInicio),
    dataFim: paraDataDoContrato(gincana.dataFim),
    status: gincana.status,
    placarVisivel: gincana.placarVisivel,
  };
}

const anoDuplicado = (ano: number) =>
  conflito('ANO_JA_CADASTRADO', `Já existe uma gincana cadastrada para o ano de ${ano}.`);

/**
 * Período inválido vira 400 com o detalhe no campo, igual ao que o zod produziria: para
 * o formulário do front, os dois casos se tratam do mesmo jeito.
 */
export function periodoInvalido(): ErroDaAplicacao {
  return new ErroDaAplicacao(400, 'DADOS_INVALIDOS', 'Confira os campos informados.', {
    dataFim: ['A data de término não pode ser anterior à de início.'],
  });
}

/** US02 — a administradora cadastra a gincana do ano com o seu período. */
export async function criarGincana(dados: CriarGincana): Promise<Gincana> {
  const gincana = await comUnicidade(
    () =>
      prisma.gincana.create({
        data: {
          ano: dados.ano,
          nome: dados.nome,
          dataInicio: paraDataDoBanco(dados.dataInicio),
          dataFim: paraDataDoBanco(dados.dataFim),
        },
        select: selecaoDaGincana,
      }),
    () => anoDuplicado(dados.ano),
  );

  return montarGincana(gincana);
}

/** A mais recente primeiro: é a que a administradora abre em 99% das vezes. */
export async function listarGincanas(): Promise<Gincana[]> {
  const gincanas = await prisma.gincana.findMany({
    select: selecaoDaGincana,
    orderBy: { ano: 'desc' },
  });

  return gincanas.map(montarGincana);
}

export async function buscarGincana(id: string): Promise<Gincana> {
  const gincana = await prisma.gincana.findUnique({ where: { id }, select: selecaoDaGincana });

  if (!gincana) {
    throw naoEncontrado('Gincana não encontrada.');
  }

  return montarGincana(gincana);
}

const soOcultaOuMostraOPlacar = () =>
  semPermissao(
    'Como líder de equipe você pode ocultar ou mostrar o placar, mas não alterar o nome, o ' +
      'período ou a situação da gincana. Peça essa alteração à administradora.',
  );

/**
 * O `PATCH` muda um campo de cada vez, então o período precisa ser conferido contra o
 * que já está gravado: mandar só `dataFim` tem de esbarrar na `dataInicio` do banco.
 *
 * A autorização por campo vem antes de qualquer toque no banco: o líder só passa daqui se
 * o corpo trouxer exclusivamente `placarVisivel`.
 *
 * Esconder ou revelar o placar deixa rastro na trilha de auditoria, na mesma transação do
 * `update` — é uma decisão que muda o que a gincana mostra a quem participa, e precisa ter
 * autor e instante. As demais alterações de gincana seguem como antes, sem auditoria: esse
 * é um buraco anterior a esta mudança e tapá-lo aqui misturaria duas coisas.
 */
export async function atualizarGincana(
  usuario: UsuarioAutenticado,
  id: string,
  dados: AtualizarGincana,
  autorId: string,
): Promise<Gincana> {
  if (!podeAtualizarGincana(usuario, dados)) {
    throw soOcultaOuMostraOPlacar();
  }

  return prisma.$transaction(async (tx) => {
    const atual = await tx.gincana.findUnique({ where: { id }, select: selecaoDaGincana });

    if (!atual) {
      throw naoEncontrado('Gincana não encontrada.');
    }

    const dataInicio = dados.dataInicio ? paraDataDoBanco(dados.dataInicio) : atual.dataInicio;
    const dataFim = dados.dataFim ? paraDataDoBanco(dados.dataFim) : atual.dataFim;

    if (dataFim < dataInicio) {
      throw periodoInvalido();
    }

    const trocaOPlacar =
      dados.placarVisivel !== undefined && dados.placarVisivel !== atual.placarVisivel;

    const gincana = await tx.gincana.update({
      where: { id },
      data: {
        nome: dados.nome,
        dataInicio: dados.dataInicio ? dataInicio : undefined,
        dataFim: dados.dataFim ? dataFim : undefined,
        status: dados.status,
        placarVisivel: dados.placarVisivel,
      },
      select: selecaoDaGincana,
    });

    if (trocaOPlacar) {
      await registrarAuditoria(tx, {
        entidade: 'Gincana',
        entidadeId: id,
        acao: 'ALTERACAO',
        autorId,
        valoresAntes: { placarVisivel: atual.placarVisivel },
        valoresDepois: { placarVisivel: gincana.placarVisivel },
        descricao: gincana.placarVisivel
          ? `O placar da gincana "${gincana.nome}" voltou a ficar visível para todos.`
          : `O placar da gincana "${gincana.nome}" foi ocultado dos colaboradores.`,
      });
    }

    return montarGincana(gincana);
  });
}
