import { randomUUID } from 'node:crypto';

import type { Papel } from '@gincana/contracts';
import bcrypt from 'bcryptjs';

import { prisma } from '../../db.js';

/**
 * Dados de apoio dos testes de autenticação.
 *
 * Cada execução cria o próprio cenário, com identificadores sorteados, e apaga tudo no
 * fim: a suíte não pode depender de o seed de demonstração continuar igual, nem deixar
 * resíduo para a próxima execução. Nenhum nome ou e-mail real de colaborador da
 * Cestacorp entra aqui.
 */
export const SENHA_DE_TESTE = 'Teste@2026';

/** Custo baixo de propósito: o teste confere o fluxo, não a força do hash. */
const CUSTO_NOS_TESTES = 4;

export interface OpcoesDePessoa {
  papel?: Papel;
  ativo?: boolean;
  senha?: string;
  naEquipe?: boolean;
  lideraEquipe?: boolean;
}

export interface PessoaDeTeste {
  id: string;
  nome: string;
  email: string;
  senha: string;
}

export interface CenarioDeTeste {
  gincanaId: string;
  equipeId: string;
  criarPessoa: (opcoes?: OpcoesDePessoa) => Promise<PessoaDeTeste>;
  limpar: () => Promise<void>;
}

export async function criarCenario(): Promise<CenarioDeTeste> {
  const marca = randomUUID().slice(0, 8);
  const ano = 2100 + Math.floor(Math.random() * 8000);

  const gincana = await prisma.gincana.create({
    data: {
      ano,
      nome: `Gincana de teste ${marca}`,
      dataInicio: new Date('2100-01-01'),
      dataFim: new Date('2100-12-31'),
    },
  });

  const equipe = await prisma.equipe.create({
    data: { nome: `Equipe de teste ${marca}`, gincanaId: gincana.id },
  });

  const pessoasCriadas: string[] = [];

  async function criarPessoa(opcoes: OpcoesDePessoa = {}): Promise<PessoaDeTeste> {
    const senha = opcoes.senha ?? SENHA_DE_TESTE;
    const sufixo = randomUUID().slice(0, 8);
    const email = `us01-${sufixo}@teste.invalido`;

    const pessoa = await prisma.colaborador.create({
      data: {
        nome: `Pessoa de teste ${sufixo}`,
        email,
        senhaHash: await bcrypt.hash(senha, CUSTO_NOS_TESTES),
        papel: opcoes.papel ?? 'COLABORADOR',
        ativo: opcoes.ativo ?? true,
        equipeId: opcoes.naEquipe === false ? null : equipe.id,
      },
    });

    pessoasCriadas.push(pessoa.id);

    if (opcoes.lideraEquipe) {
      await prisma.equipe.update({ where: { id: equipe.id }, data: { liderId: pessoa.id } });
    }

    return { id: pessoa.id, nome: pessoa.nome, email: pessoa.email, senha };
  }

  async function limpar(): Promise<void> {
    await prisma.equipe.update({ where: { id: equipe.id }, data: { liderId: null } });
    await prisma.colaborador.deleteMany({ where: { id: { in: pessoasCriadas } } });
    await prisma.equipe.delete({ where: { id: equipe.id } });
    await prisma.gincana.delete({ where: { id: gincana.id } });
  }

  return { gincanaId: gincana.id, equipeId: equipe.id, criarPessoa, limpar };
}
