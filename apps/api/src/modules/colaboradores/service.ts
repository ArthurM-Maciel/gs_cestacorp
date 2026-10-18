import type {
  AtualizarColaborador,
  Colaborador,
  CriarColaborador,
  ListarColaboradoresQuery,
  Papel,
  UsuarioAutenticado,
} from '@gincana/contracts';
import bcrypt from 'bcryptjs';

import { prisma, type Transacao } from '../../db.js';
import { conflito, naoEncontrado } from '../../middlewares/erros.js';
import { comUnicidade } from '../../prisma-erros.js';
import { registrarAuditoria } from '../auditoria/registrar.js';
import { CUSTO_DO_HASH } from '../auth/service.js';

import { montarFiltroDeColaboradores } from './policy.js';

/**
 * US03 — cadastro de colaboradores pela administradora.
 *
 * `senhaHash` não entra em nenhuma seleção daqui: o que o serviço devolve vai direto para
 * a resposta HTTP, e credencial não passeia por ali nem por engano.
 */
const selecaoDoColaborador = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  equipeId: true,
  equipe: { select: { id: true, nome: true } },
  equipeLiderada: { select: { id: true, nome: true } },
} as const;

interface ColaboradorDoBanco {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  equipeId: string | null;
  equipe: { id: string; nome: string } | null;
  equipeLiderada: { id: string; nome: string } | null;
}

function montarColaborador(colaborador: ColaboradorDoBanco): Colaborador {
  return {
    id: colaborador.id,
    nome: colaborador.nome,
    email: colaborador.email,
    papel: colaborador.papel,
    ativo: colaborador.ativo,
    equipe: colaborador.equipe,
  };
}

const emailDuplicado = () =>
  conflito('EMAIL_JA_CADASTRADO', 'Já existe um colaborador com este e-mail.');

async function exigirEquipe(cliente: Transacao, id: string): Promise<void> {
  const equipe = await cliente.equipe.findUnique({ where: { id }, select: { id: true } });

  if (!equipe) {
    throw naoEncontrado('Equipe não encontrada.');
  }
}

export async function criarColaborador(dados: CriarColaborador): Promise<Colaborador> {
  const equipeId = dados.equipeId ?? null;

  if (equipeId) {
    await exigirEquipe(prisma, equipeId);
  }

  // Mesmo custo do seed e do login: trocar aqui invalidaria as senhas já gravadas.
  const senhaHash = await bcrypt.hash(dados.senha, CUSTO_DO_HASH);

  const colaborador = await comUnicidade(
    () =>
      prisma.colaborador.create({
        data: {
          nome: dados.nome,
          email: dados.email,
          senhaHash,
          papel: dados.papel,
          equipeId,
        },
        select: selecaoDoColaborador,
      }),
    emailDuplicado,
  );

  return montarColaborador(colaborador);
}

export async function listarColaboradores(
  usuario: UsuarioAutenticado,
  filtros: ListarColaboradoresQuery,
): Promise<Colaborador[]> {
  const colaboradores = await prisma.colaborador.findMany({
    where: montarFiltroDeColaboradores(usuario, filtros),
    select: selecaoDoColaborador,
    orderBy: { nome: 'asc' },
  });

  return colaboradores.map(montarColaborador);
}

/** Valores sensíveis que, quando mudam, precisam sobrar registrados na auditoria. */
type ValoresAuditados = Record<string, string | boolean | null>;

export async function atualizarColaborador(
  id: string,
  dados: AtualizarColaborador,
  autorId: string,
): Promise<Colaborador> {
  return prisma.$transaction(async (tx) => {
    const atual: ColaboradorDoBanco | null = await tx.colaborador.findUnique({
      where: { id },
      select: selecaoDoColaborador,
    });

    if (!atual) {
      throw naoEncontrado('Colaborador não encontrado.');
    }

    const ativo = dados.ativo ?? atual.ativo;
    const papel = dados.papel ?? atual.papel;
    const mudaEquipe = 'equipeId' in dados && (dados.equipeId ?? null) !== atual.equipeId;
    const novaEquipeId = mudaEquipe ? (dados.equipeId ?? null) : atual.equipeId;

    // Quem lidera uma equipe é intocável até que a equipe ganhe outro líder: sem isso,
    // sobraria uma equipe sem quem aprove lançamento.
    const equipeLiderada = atual.equipeLiderada;
    if (equipeLiderada) {
      const aviso = `${atual.nome} lidera a equipe ${equipeLiderada.nome}.`;

      if (!ativo) {
        throw conflito('LIDERA_EQUIPE', `${aviso} Troque o líder antes de desativar esta pessoa.`);
      }
      if (mudaEquipe && novaEquipeId !== equipeLiderada.id) {
        throw conflito('LIDERA_EQUIPE', `${aviso} Troque o líder antes de mudar a equipe dela.`);
      }
      if (papel !== 'LIDER' && papel !== 'ADMIN') {
        throw conflito('LIDERA_EQUIPE', `${aviso} Troque o líder antes de mudar o papel dela.`);
      }
    }

    if (mudaEquipe && novaEquipeId) {
      if (!ativo) {
        throw conflito(
          'COLABORADOR_INATIVO',
          'Só dá para vincular a uma equipe quem está ativo. Reative a pessoa antes.',
        );
      }
      await exigirEquipe(tx, novaEquipeId);
    }

    const atualizado: ColaboradorDoBanco = await tx.colaborador.update({
      where: { id },
      data: {
        nome: dados.nome,
        papel: dados.papel,
        ativo: dados.ativo,
        equipeId: mudaEquipe ? novaEquipeId : undefined,
      },
      select: selecaoDoColaborador,
    });

    const antes: ValoresAuditados = {};
    const depois: ValoresAuditados = {};
    const mudancas: string[] = [];

    if (dados.papel && dados.papel !== atual.papel) {
      antes.papel = atual.papel;
      depois.papel = dados.papel;
      mudancas.push('papel');
    }

    if (mudaEquipe) {
      antes.equipeId = atual.equipeId;
      depois.equipeId = novaEquipeId;
      mudancas.push('equipe');
    }

    if (dados.ativo !== undefined && dados.ativo !== atual.ativo) {
      antes.ativo = atual.ativo;
      depois.ativo = dados.ativo;
      mudancas.push(dados.ativo ? 'reativação' : 'desativação');
    }

    // Trocar só o nome não muda nada que explique o placar depois.
    if (mudancas.length > 0) {
      await registrarAuditoria(tx, {
        entidade: 'Colaborador',
        entidadeId: id,
        acao: 'ALTERACAO',
        autorId,
        valoresAntes: antes,
        valoresDepois: depois,
        descricao: `Alteração de ${mudancas.join(', ')} do colaborador.`,
      });
    }

    return montarColaborador(atualizado);
  });
}
