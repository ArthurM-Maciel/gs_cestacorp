import { randomUUID } from 'node:crypto';

import type { Login, RespostaLogin, UsuarioAutenticado } from '@gincana/contracts';
import bcrypt from 'bcryptjs';

import { prisma } from '../../db.js';
import { naoAutenticado } from '../../middlewares/erros.js';

import { assinarToken } from './token.js';

/** Mesmo custo usado no seed: trocar aqui invalida as senhas já gravadas. */
export const CUSTO_DO_HASH = 10;

/**
 * Mensagem única para e-mail inexistente, senha errada e conta desativada.
 *
 * Dizer "este e-mail não está cadastrado" entrega ao atacante metade do trabalho: ele
 * descobre quem tem conta antes de tentar qualquer senha.
 */
const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.';

/**
 * Hash descartável, de um valor aleatório que ninguém conhece.
 *
 * Quando o e-mail não existe, comparamos a senha contra ele assim mesmo: sem isso, a
 * resposta volta em microssegundos para e-mail inexistente e em dezenas de milissegundos
 * para e-mail real, e o tempo denuncia quem está cadastrado.
 */
const HASH_DE_COMPARACAO = bcrypt.hashSync(randomUUID(), CUSTO_DO_HASH);

/** Campos lidos do banco. Nunca inclui `senhaHash` no que sai daqui. */
const selecaoDoUsuario = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  equipeId: true,
  equipeLiderada: { select: { id: true } },
} as const;

interface ColaboradorSelecionado {
  id: string;
  nome: string;
  email: string;
  papel: UsuarioAutenticado['papel'];
  ativo: boolean;
  equipeId: string | null;
  equipeLiderada: { id: string } | null;
}

/** Converte o registro do banco no formato público do usuário autenticado. */
export function montarUsuarioAutenticado(colaborador: ColaboradorSelecionado): UsuarioAutenticado {
  return {
    id: colaborador.id,
    nome: colaborador.nome,
    email: colaborador.email,
    papel: colaborador.papel,
    equipeId: colaborador.equipeId,
    equipeLideradaId: colaborador.equipeLiderada?.id ?? null,
  };
}

/**
 * Confere credencial e devolve o token da sessão.
 *
 * O e-mail é normalizado para minúsculas porque o cadastro guarda assim e ninguém digita
 * do mesmo jeito duas vezes no celular.
 */
export async function autenticar({ email, senha }: Login): Promise<RespostaLogin> {
  const colaborador = await prisma.colaborador.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { ...selecaoDoUsuario, senhaHash: true },
  });

  const senhaConfere = await bcrypt.compare(senha, colaborador?.senhaHash ?? HASH_DE_COMPARACAO);

  if (!colaborador || !senhaConfere || !colaborador.ativo) {
    throw naoAutenticado(CREDENCIAL_INVALIDA);
  }

  const usuario = montarUsuarioAutenticado(colaborador);

  return { token: assinarToken(usuario), usuario };
}

/**
 * Recarrega o usuário do banco a partir do id do token.
 *
 * É o que mantém a sessão honesta: se a administradora tirou o papel de líder ou
 * desativou a conta depois da emissão, o token continua assinado, mas não vale mais.
 */
export async function carregarUsuarioAutenticado(id: string): Promise<UsuarioAutenticado> {
  const colaborador = await prisma.colaborador.findUnique({
    where: { id },
    select: selecaoDoUsuario,
  });

  if (!colaborador || !colaborador.ativo) {
    throw naoAutenticado('Sua sessão não é mais válida. Entre novamente.');
  }

  return montarUsuarioAutenticado(colaborador);
}
