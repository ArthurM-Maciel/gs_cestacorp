import type { AtualizarGincana, CriarGincana, Gincana } from '@gincana/contracts';

import { prisma } from '../../db.js';
import { ErroDaAplicacao, conflito, naoEncontrado } from '../../middlewares/erros.js';
import { comUnicidade } from '../../prisma-erros.js';

/** O que lemos do banco. A gincana não tem campo sensível, mas o `select` é explícito. */
const selecaoDaGincana = {
  id: true,
  ano: true,
  nome: true,
  dataInicio: true,
  dataFim: true,
  status: true,
} as const;

interface GincanaDoBanco {
  id: string;
  ano: number;
  nome: string;
  dataInicio: Date;
  dataFim: Date;
  status: Gincana['status'];
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

/**
 * O `PATCH` muda um campo de cada vez, então o período precisa ser conferido contra o
 * que já está gravado: mandar só `dataFim` tem de esbarrar na `dataInicio` do banco.
 */
export async function atualizarGincana(id: string, dados: AtualizarGincana): Promise<Gincana> {
  const atual = await prisma.gincana.findUnique({ where: { id }, select: selecaoDaGincana });

  if (!atual) {
    throw naoEncontrado('Gincana não encontrada.');
  }

  const dataInicio = dados.dataInicio ? paraDataDoBanco(dados.dataInicio) : atual.dataInicio;
  const dataFim = dados.dataFim ? paraDataDoBanco(dados.dataFim) : atual.dataFim;

  if (dataFim < dataInicio) {
    throw periodoInvalido();
  }

  const gincana = await prisma.gincana.update({
    where: { id },
    data: {
      nome: dados.nome,
      dataInicio: dados.dataInicio ? dataInicio : undefined,
      dataFim: dados.dataFim ? dataFim : undefined,
      status: dados.status,
    },
    select: selecaoDaGincana,
  });

  return montarGincana(gincana);
}
