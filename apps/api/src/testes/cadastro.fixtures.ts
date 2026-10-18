import { randomUUID } from 'node:crypto';

import type { Papel } from '@gincana/contracts';
import bcrypt from 'bcryptjs';

import { prisma } from '../db.js';
import { ehViolacaoDeUnicidade } from '../prisma-erros.js';
import { assinarToken } from '../modules/auth/token.js';

/**
 * Dados de apoio das histórias de cadastro (US02 e US03).
 *
 * Cada execução monta o próprio cenário, marcado por um identificador sorteado, e apaga
 * no fim tudo que carrega essa marca — inclusive o que o teste criou pela própria API.
 * A suíte não pode depender do seed de demonstração nem deixar resíduo para a próxima
 * execução. Nenhum nome ou e-mail real de colaborador da Cestacorp entra aqui.
 */
export const SENHA_DE_TESTE = 'Teste@2026';

/** Custo baixo de propósito: o teste confere o fluxo, não a força do hash. */
const CUSTO_NOS_TESTES = 4;

export interface OpcoesDePessoa {
  papel?: Papel;
  ativo?: boolean;
  equipeId?: string | null;
  /** Depois de criada, a pessoa passa a liderar esta equipe. */
  lideraEquipeId?: string;
}

export interface PessoaDeTeste {
  id: string;
  nome: string;
  email: string;
  senha: string;
  token: string;
}

export interface GincanaDeTeste {
  id: string;
  ano: number;
  nome: string;
}

export interface EquipeDeTeste {
  id: string;
  nome: string;
  gincanaId: string;
}

export interface CenarioDeCadastro {
  /** Sufixo único deste cenário. Use nos nomes e e-mails criados pelo próprio teste. */
  marca: string;
  emailDeTeste: (prefixo: string) => string;
  anoLivre: () => Promise<number>;
  criarGincana: (dados?: { ano?: number; nome?: string }) => Promise<GincanaDeTeste>;
  criarEquipe: (gincanaId: string, nome?: string) => Promise<EquipeDeTeste>;
  criarPessoa: (opcoes?: OpcoesDePessoa) => Promise<PessoaDeTeste>;
  limpar: () => Promise<void>;
}

/**
 * Faixa de anos reservada para teste.
 *
 * O ano da gincana é único no banco e o contrato só aceita de 2020 a 2100, então não dá
 * para fugir para um futuro distante: separamos a ponta da faixa, longe dos anos que o
 * seed de demonstração usa.
 */
const ANO_MINIMO_DE_TESTE = 2040;
const ANO_MAXIMO_DE_TESTE = 2099;

/** Datas do período usadas por padrão. Qualquer ano serve: a coluna é só de calendário. */
export const DATA_INICIO_PADRAO = '2099-03-01';
export const DATA_FIM_PADRAO = '2099-11-30';

async function sortearAnoLivre(): Promise<number> {
  const ocupados = await prisma.gincana.findMany({
    where: { ano: { gte: ANO_MINIMO_DE_TESTE, lte: ANO_MAXIMO_DE_TESTE } },
    select: { ano: true },
  });
  const usados = new Set(ocupados.map((gincana) => gincana.ano));

  const livres: number[] = [];
  for (let ano = ANO_MINIMO_DE_TESTE; ano <= ANO_MAXIMO_DE_TESTE; ano += 1) {
    if (!usados.has(ano)) {
      livres.push(ano);
    }
  }

  const escolhido = livres[Math.floor(Math.random() * livres.length)];
  if (escolhido === undefined) {
    throw new Error('A faixa de anos de teste acabou: algum cenário não limpou o que criou.');
  }

  return escolhido;
}

export async function criarCenarioDeCadastro(): Promise<CenarioDeCadastro> {
  const marca = randomUUID().slice(0, 8);
  const gincanasCriadas: string[] = [];

  const emailDeTeste = (prefixo: string) => `${prefixo}-${marca}@teste.invalido`;

  async function criarGincana(
    dados: { ano?: number; nome?: string } = {},
  ): Promise<GincanaDeTeste> {
    // Sortear um ano livre e depois criar é uma corrida: os arquivos de teste rodam em
    // processos paralelos, e entre a consulta e a inserção outro cenário pode fincar o
    // mesmo ano. Quando isso acontece, sorteamos de novo em vez de falhar — era a causa
    // de falhas esporádicas que não se reproduziam ao rodar o arquivo sozinho.
    const TENTATIVAS = 5;

    for (let tentativa = 1; ; tentativa += 1) {
      const ano = dados.ano ?? (await sortearAnoLivre());

      try {
        const gincana = await prisma.gincana.create({
          data: {
            ano,
            nome: dados.nome ?? `Gincana ${marca} ${ano}`,
            dataInicio: new Date(`${DATA_INICIO_PADRAO}T00:00:00.000Z`),
            dataFim: new Date(`${DATA_FIM_PADRAO}T00:00:00.000Z`),
          },
        });

        gincanasCriadas.push(gincana.id);
        return { id: gincana.id, ano: gincana.ano, nome: gincana.nome };
      } catch (erro) {
        // Ano pedido explicitamente não é corrida: é o teste querendo o conflito.
        const podeTentarDeNovo =
          dados.ano === undefined && ehViolacaoDeUnicidade(erro) && tentativa < TENTATIVAS;

        if (!podeTentarDeNovo) {
          throw erro;
        }
      }
    }
  }

  async function criarEquipe(gincanaId: string, nome?: string): Promise<EquipeDeTeste> {
    const equipe = await prisma.equipe.create({
      data: { nome: nome ?? `Equipe ${randomUUID().slice(0, 6)} ${marca}`, gincanaId },
    });

    return { id: equipe.id, nome: equipe.nome, gincanaId };
  }

  async function criarPessoa(opcoes: OpcoesDePessoa = {}): Promise<PessoaDeTeste> {
    const sufixo = randomUUID().slice(0, 6);
    const email = emailDeTeste(`us03-${sufixo}`);

    const pessoa = await prisma.colaborador.create({
      data: {
        nome: `Pessoa de teste ${sufixo}`,
        email,
        senhaHash: await bcrypt.hash(SENHA_DE_TESTE, CUSTO_NOS_TESTES),
        papel: opcoes.papel ?? 'COLABORADOR',
        ativo: opcoes.ativo ?? true,
        equipeId: opcoes.equipeId ?? opcoes.lideraEquipeId ?? null,
      },
    });

    if (opcoes.lideraEquipeId) {
      await prisma.equipe.update({
        where: { id: opcoes.lideraEquipeId },
        data: { liderId: pessoa.id },
      });
    }

    const token = assinarToken({
      id: pessoa.id,
      nome: pessoa.nome,
      email: pessoa.email,
      papel: pessoa.papel,
      equipeId: pessoa.equipeId,
      equipeLideradaId: opcoes.lideraEquipeId ?? null,
    });

    return { id: pessoa.id, nome: pessoa.nome, email: pessoa.email, senha: SENHA_DE_TESTE, token };
  }

  /**
   * A ordem importa: auditoria aponta para o autor, regra de pontuação aponta para quem a
   * criou, equipe aponta para o líder e o colaborador aponta para a equipe. Desmonta-se de
   * fora para dentro.
   */
  async function limpar(): Promise<void> {
    const pessoas = await prisma.colaborador.findMany({
      where: { email: { contains: marca } },
      select: { id: true },
    });
    const gincanas = await prisma.gincana.findMany({
      where: { OR: [{ id: { in: gincanasCriadas } }, { nome: { contains: marca } }] },
      select: { id: true },
    });
    const gincanaIds = gincanas.map((gincana) => gincana.id);
    const equipes = await prisma.equipe.findMany({
      where: { gincanaId: { in: gincanaIds } },
      select: { id: true },
    });

    const tipos = await prisma.tipoAcao.findMany({
      where: { gincanaId: { in: gincanaIds } },
      select: { id: true },
    });
    const tipoIds = tipos.map((tipo) => tipo.id);
    const regras = await prisma.regraPontuacao.findMany({
      where: { tipoAcaoId: { in: tipoIds } },
      select: { id: true },
    });

    const pessoaIds = pessoas.map((pessoa) => pessoa.id);
    const equipeIds = equipes.map((equipe) => equipe.id);
    const regraIds = regras.map((regra) => regra.id);

    await prisma.registroAuditoria.deleteMany({
      where: {
        OR: [
          { autorId: { in: pessoaIds } },
          {
            entidadeId: {
              in: [...pessoaIds, ...equipeIds, ...gincanaIds, ...tipoIds, ...regraIds],
            },
          },
        ],
      },
    });
    // A regra aponta para quem a criou: sai antes do colaborador, senão a chave
    // estrangeira segura a limpeza.
    await prisma.regraPontuacao.deleteMany({ where: { id: { in: regraIds } } });
    await prisma.tipoAcao.deleteMany({ where: { id: { in: tipoIds } } });
    await prisma.equipe.updateMany({ where: { id: { in: equipeIds } }, data: { liderId: null } });
    await prisma.colaborador.updateMany({
      where: { id: { in: pessoaIds } },
      data: { equipeId: null },
    });
    await prisma.colaborador.deleteMany({ where: { id: { in: pessoaIds } } });
    // As equipes caem junto da gincana, por cascata declarada no schema.
    await prisma.gincana.deleteMany({ where: { id: { in: gincanaIds } } });
  }

  return {
    marca,
    emailDeTeste,
    anoLivre: sortearAnoLivre,
    criarGincana,
    criarEquipe,
    criarPessoa,
    limpar,
  };
}
